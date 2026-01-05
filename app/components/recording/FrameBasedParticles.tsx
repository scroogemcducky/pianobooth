import React, { useMemo, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { scalingFactor } from '../../utils/functions'
import { white_key_dimensions, black_key_dimensions, BLACK_KEY_COLOR, WHITE_KEY_COLOR } from '../../utils/constants'
import { type PianoLayout, getKeyboardMetrics, getKeyboardWidth, getNoteXPosition } from '../../utils/pianoLayout'
import useParticleSettingsStore, { type ParticleSettings, PARTICLE_DEFAULTS } from '../../store/particleSettingsStore'
import { isBlack } from '../../utils/functions'

const FRAME_DURATION_MS = 1000 / 60

export interface FrameBasedParticlesHandle {
  setFrame: (adjustedFrame: number) => void
}

interface MidiNote {
  Delta: number
  Duration: number
  NoteNumber: number
  Velocity: number
  SoundDuration: number
}

type ActiveNoteInfo = {
  noteNumber: number
  isBlack: boolean
  color: [number, number, number]
}

interface FrameBasedParticlesProps {
  midiObject: MidiNote[] | null
  layout: PianoLayout
  scaleMultiplier?: number
  scaleFillRatio?: number
  scaleMax?: number
  lookahead?: number
  blackKeyColor?: number[]
  whiteKeyColor?: number[]
  settings?: ParticleSettings
  zoomAdaptive?: boolean
  motionScaleMultiplier?: number
}

const WHITE_KEY_Z = 2.2
const BLACK_KEY_Z = 2.4

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uHeight;
  uniform float uBaseSize;
  uniform vec3 uDrift;
  uniform float uIntensity;
  attribute float aSeed;
  attribute float aLife;
  attribute float aSpeed;
  attribute float aRadius;
  attribute float aSize;
  attribute float aPhase;
  attribute float aAngle;
  attribute vec2 aBaseOffset;
  varying float vProgress;
  varying float vSeed;
  varying float vIntensity;
  void main() {
    float lifeTime = uTime * aSpeed + aPhase;
    float lifeProgress = fract(lifeTime / aLife);
    float radius = aRadius * lifeProgress;
    float theta = aAngle;
    vec2 circleDir = vec2(sin(theta), cos(theta));

    vec3 displaced = vec3(
      aBaseOffset.x + circleDir.x * radius + uDrift.x * lifeProgress,
      circleDir.y * radius * uHeight + uDrift.y * lifeProgress,
      aBaseOffset.y + uDrift.z * lifeProgress
    );

    vProgress = lifeProgress;
    vSeed = aSeed;
    vIntensity = uIntensity;

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    // Boost size based on intensity
    float size = uBaseSize * aSize * (1.0 - lifeProgress) * uIntensity;
    gl_PointSize = max(1.0, size / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uPrimaryColor;
  uniform vec3 uAccentColor;
  uniform float uSparklingAlpha;
  uniform float uSparklingFrequency;
  uniform float uSparklingDuration;
  uniform float uFadeIn;
  uniform float uFadeOut;
  uniform float uSolidRatio;
  uniform float uSolidAlpha;
  uniform float uOpacity;
  uniform float uGlowSpread;
  varying float vProgress;
  varying float vSeed;
  varying float vIntensity;
  void main() {
    vec2 coord = gl_PointCoord - 0.5;
    float dist = length(coord);
    float alpha = smoothstep(0.5, 0.0, dist * (1.0 + uGlowSpread * 4.0));
    float fade = 1.0;
    if (uFadeIn > 0.0 && vProgress < uFadeIn) {
      fade *= vProgress / max(uFadeIn, 0.0001);
    }
    if (uFadeOut > 0.0 && vProgress > 1.0 - uFadeOut) {
      fade *= (1.0 - vProgress) / max(uFadeOut, 0.0001);
    }
    if (uSolidRatio > 0.0 && vProgress < uSolidRatio) {
      float mixVal = vProgress / max(uSolidRatio, 0.0001);
      fade = mix(uSolidAlpha, fade, mixVal);
    }

    float sparkle = 0.0;
    if (uSparklingAlpha > 0.0 && uSparklingFrequency > 0.0 && uSparklingDuration > 0.0) {
      float wave = fract(vSeed + uTime * uSparklingFrequency);
      float start = 1.0 - clamp(uSparklingDuration, 0.001, 0.999);
      if (wave > start) {
        sparkle = ((wave - start) / (1.0 - start)) * uSparklingAlpha * vIntensity;
      }
    }

    vec3 color = mix(uAccentColor, uPrimaryColor, vProgress);
    // Boost opacity based on intensity
    float finalAlpha = alpha * fade * uOpacity * vIntensity + sparkle;
    if (finalAlpha <= 0.01) discard;
    gl_FragColor = vec4(color, finalAlpha);
  }
`

// Seeded random number generator for deterministic particles
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff
    return state / 0x7fffffff
  }
}

interface FrameBasedParticleStreamHandle {
  setTime: (timeSeconds: number, visible: boolean, intensity: number) => void
}

type FrameBasedParticleStreamProps = {
  basePosition: [number, number, number]
  color: [number, number, number]
  isBlack: boolean
  scaleFactor: number
  motionScale?: number
  settings: ParticleSettings
  particleCount: number
  noteNumber: number // Used for deterministic seeding
}

const FrameBasedParticleStream = forwardRef<FrameBasedParticleStreamHandle, FrameBasedParticleStreamProps>(
  function FrameBasedParticleStream(
    { basePosition, color, isBlack: isBlackKey, scaleFactor, motionScale = 1, settings, particleCount, noteNumber },
    ref
  ) {
    const {
      decayFrequency,
      velocityDamping,
      emitterRadius,
      emitterVelocityStrength,
      initialVelocityX,
      initialVelocityY,
      initialVelocityZ,
      initialRandomVelocity,
      gravityX,
      gravityY,
      gravityZ,
      colorIn,
      colorOut,
      fadeIn,
      fadeOut,
      size,
      glowSpread,
      solidRatio,
      solidAlpha,
      opacity,
      sparklingAlpha,
      sparklingFrequency,
      sparklingDuration,
      allowDownward,
    } = settings

    const pointsRef = useRef<THREE.Points>(null)
    const basePositionRef = useRef(basePosition)
    const geometry = useMemo(() => new THREE.BufferGeometry(), [])
    const seeds = useMemo(() => new Float32Array(particleCount), [particleCount])
    const lifetimes = useMemo(() => new Float32Array(particleCount), [particleCount])
    const speeds = useMemo(() => new Float32Array(particleCount), [particleCount])
    const radii = useMemo(() => new Float32Array(particleCount), [particleCount])
    const sizes = useMemo(() => new Float32Array(particleCount), [particleCount])
    const phases = useMemo(() => new Float32Array(particleCount), [particleCount])
    const angles = useMemo(() => new Float32Array(particleCount), [particleCount])
    const baseOffsets = useMemo(() => new Float32Array(particleCount * 2), [particleCount])
    const keyDimensions = isBlackKey ? black_key_dimensions : white_key_dimensions

    // Deterministic time offset based on note number
    const timeOffset = useMemo(() => {
      const rng = seededRandom(noteNumber * 12345)
      return rng() * 20
    }, [noteNumber])

    useEffect(() => {
      geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
      geometry.setAttribute('aLife', new THREE.BufferAttribute(lifetimes, 1))
      geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
      geometry.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1))
      geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
      geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
      geometry.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1))
      geometry.setAttribute('aBaseOffset', new THREE.BufferAttribute(baseOffsets, 2))
      return () => {
        geometry.deleteAttribute('aSeed')
        geometry.deleteAttribute('aLife')
        geometry.deleteAttribute('aSpeed')
        geometry.deleteAttribute('aRadius')
        geometry.deleteAttribute('aSize')
        geometry.deleteAttribute('aPhase')
        geometry.deleteAttribute('aAngle')
        geometry.deleteAttribute('aBaseOffset')
      }
    }, [geometry, seeds, lifetimes, speeds, radii, sizes, phases, angles, baseOffsets])

    useEffect(() => {
      geometry.setDrawRange(0, particleCount)
    }, [geometry, particleCount])

    useEffect(() => () => geometry.dispose(), [geometry])

    const populateAttributes = useCallback(() => {
      // Use seeded random for deterministic particles
      const rng = seededRandom(noteNumber * 67890)

      const width = keyDimensions.x * scaleFactor
      const baseSpread = width * (0.4 + emitterRadius * 1.5) * motionScale
      const depthRatio = keyDimensions.z / keyDimensions.x
      const halfWidth = Math.max(0.001, width * 0.5)
      const angleRange = allowDownward ? Math.PI : Math.PI * 0.5

      for (let i = 0; i < particleCount; i++) {
        seeds[i] = rng()
        const lifeBase = THREE.MathUtils.lerp(0.25, 1.2, 1 - decayFrequency)
        lifetimes[i] = lifeBase * (0.7 + rng() * 0.6)
        speeds[i] = 0.6 + rng() * 0.5 - velocityDamping * 0.4
        radii[i] = baseSpread * (0.35 + rng() * (0.65 + initialRandomVelocity))
        sizes[i] = 0.6 + rng() * 0.6
        phases[i] = rng() * 50
        angles[i] = rng() * angleRange
        const offsetIndex = i * 2
        baseOffsets[offsetIndex] = (rng() - 0.5) * width
        baseOffsets[offsetIndex + 1] = depthRatio * 0.05 * (rng() - 0.5)
        radii[i] = Math.min(radii[i], halfWidth)
      }

      const seedAttr = geometry.getAttribute('aSeed') as THREE.BufferAttribute | undefined
      const lifeAttr = geometry.getAttribute('aLife') as THREE.BufferAttribute | undefined
      const speedAttr = geometry.getAttribute('aSpeed') as THREE.BufferAttribute | undefined
      const radiusAttr = geometry.getAttribute('aRadius') as THREE.BufferAttribute | undefined
      const sizeAttr = geometry.getAttribute('aSize') as THREE.BufferAttribute | undefined
      const phaseAttr = geometry.getAttribute('aPhase') as THREE.BufferAttribute | undefined
      const angleAttr = geometry.getAttribute('aAngle') as THREE.BufferAttribute | undefined
      const baseAttr = geometry.getAttribute('aBaseOffset') as THREE.BufferAttribute | undefined
      if (seedAttr) seedAttr.needsUpdate = true
      if (lifeAttr) lifeAttr.needsUpdate = true
      if (speedAttr) speedAttr.needsUpdate = true
      if (radiusAttr) radiusAttr.needsUpdate = true
      if (sizeAttr) sizeAttr.needsUpdate = true
      if (phaseAttr) phaseAttr.needsUpdate = true
      if (angleAttr) angleAttr.needsUpdate = true
      if (baseAttr) baseAttr.needsUpdate = true
    }, [
      baseOffsets,
      radii,
      angles,
      decayFrequency,
      emitterRadius,
      geometry,
      initialRandomVelocity,
      keyDimensions.x,
      keyDimensions.z,
      particleCount,
      scaleFactor,
      seeds,
      lifetimes,
      speeds,
      sizes,
      phases,
      velocityDamping,
      allowDownward,
      motionScale,
      noteNumber,
    ])

    useEffect(() => {
      populateAttributes()
    }, [populateAttributes])

    const baseColor = useMemo(() => new THREE.Color().fromArray(color), [color])
    const accentColor = useMemo(() => new THREE.Color(colorIn).lerp(baseColor, 0.5), [colorIn, baseColor])
    const primaryColor = useMemo(() => new THREE.Color(colorOut).lerp(baseColor, 0.2), [colorOut, baseColor])

    const uniforms = useMemo(
      () => ({
        uTime: { value: 0 },
        uHeight: { value: 1 },
        uBaseSize: { value: 50 },
        uDrift: { value: new THREE.Vector3() },
        uPrimaryColor: { value: new THREE.Color() },
        uAccentColor: { value: new THREE.Color() },
        uSparklingAlpha: { value: 0 },
        uSparklingFrequency: { value: 0 },
        uSparklingDuration: { value: 0 },
        uFadeIn: { value: 0 },
        uFadeOut: { value: 0 },
        uSolidRatio: { value: 0 },
        uSolidAlpha: { value: 0 },
        uOpacity: { value: 1 },
        uGlowSpread: { value: 0 },
        uIntensity: { value: 1 },
      }),
      [],
    )

    useEffect(() => {
      const heightBase = (initialVelocityY + emitterVelocityStrength * 1.4 + Math.abs(gravityY) * 0.4) * scaleFactor * motionScale
      uniforms.uHeight.value = Math.max(0.4, heightBase)
      uniforms.uBaseSize.value = Math.max(15, size * 180 * Math.max(0.5, scaleFactor))
      uniforms.uDrift.value.set(
        (initialVelocityX * 0.5 * scaleFactor + gravityX * 0.1) * motionScale,
        (gravityY * 0.25 * scaleFactor) * motionScale,
        (initialVelocityZ * 0.5 * scaleFactor + gravityZ * 0.1) * motionScale,
      )
      uniforms.uPrimaryColor.value.copy(primaryColor)
      uniforms.uAccentColor.value.copy(accentColor)
      uniforms.uSparklingAlpha.value = sparklingAlpha
      uniforms.uSparklingFrequency.value = sparklingFrequency
      uniforms.uSparklingDuration.value = sparklingDuration
      uniforms.uFadeIn.value = fadeIn
      uniforms.uFadeOut.value = fadeOut
      uniforms.uSolidRatio.value = solidRatio
      uniforms.uSolidAlpha.value = solidAlpha
      uniforms.uOpacity.value = opacity
      uniforms.uGlowSpread.value = glowSpread
    }, [
      uniforms,
      initialVelocityY,
      emitterVelocityStrength,
      gravityY,
      gravityX,
      gravityZ,
      scaleFactor,
      motionScale,
      size,
      primaryColor,
      accentColor,
      sparklingAlpha,
      sparklingFrequency,
      sparklingDuration,
      fadeIn,
      fadeOut,
      solidRatio,
      solidAlpha,
      opacity,
      glowSpread,
      initialVelocityX,
      initialVelocityZ,
    ])

    useEffect(() => {
      basePositionRef.current = basePosition
      if (pointsRef.current) {
        pointsRef.current.position.set(basePosition[0], basePosition[1], basePosition[2])
      }
    }, [basePosition])

    // Expose setTime for imperative time updates with visibility and intensity control
    useImperativeHandle(ref, () => ({
      setTime: (timeSeconds: number, visible: boolean, intensity: number) => {
        uniforms.uTime.value = timeSeconds + timeOffset
        // Control visibility by setting opacity to 0 when not visible
        uniforms.uOpacity.value = visible ? opacity : 0
        // Set intensity for attack envelope effect
        uniforms.uIntensity.value = intensity
        const [x, y, z] = basePositionRef.current
        if (pointsRef.current) {
          pointsRef.current.position.set(x, y, z)
          pointsRef.current.visible = visible
        }
      }
    }), [uniforms, timeOffset, opacity])

    return (
      <points ref={pointsRef} geometry={geometry} visible={false}>
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          uniforms={uniforms}
        />
      </points>
    )
  }
)

const FrameBasedParticles = forwardRef<FrameBasedParticlesHandle, FrameBasedParticlesProps>(
  function FrameBasedParticles(
    { midiObject, layout, scaleMultiplier = 1, scaleFillRatio, scaleMax, lookahead = 3, blackKeyColor, whiteKeyColor, settings: settingsProp, zoomAdaptive = false, motionScaleMultiplier = 1 },
    ref
  ) {
    const { viewport } = useThree()
    const totalKeyboardWidth = getKeyboardWidth(layout)
    const storeSettings = useParticleSettingsStore((state) => state.settings)
    // Use prop settings if provided, otherwise fall back to store
    const settings = settingsProp ?? storeSettings
    const scaleFactor = scalingFactor(viewport.width, totalKeyboardWidth, {
      multiplier: scaleMultiplier,
      fillRatio: scaleFillRatio,
      maxScale: scaleMax,
    })
    const { keyboardY } = getKeyboardMetrics(viewport.height, scaleFactor)

    // Refs for each particle stream, keyed by noteNumber
    const streamRefs = useRef<Map<number, FrameBasedParticleStreamHandle>>(new Map())
    const currentTimeRef = useRef(0)
    const activeNotesRef = useRef<Set<number>>(new Set())

    // Build note position lookup table
    const notePositionTable = useMemo(() => {
      const minNote = layout.paddedMinNote ?? layout.minNote
      const maxNote = layout.paddedMaxNote ?? layout.maxNote
      const table = new Map<number, number>()
      for (let current = minNote; current <= maxNote; current++) {
        table.set(current, getNoteXPosition(current, layout))
      }
      return table
    }, [layout])

    // Pre-compute note timing data for efficient frame lookups
    const noteTimingData = useMemo(() => {
      if (!midiObject) return []
      return midiObject.map((note) => {
        const noteStartMs = Math.floor(note.Delta / 1000)
        const noteDurationMs = (note.Duration / 1000000) * 1000
        const noteEndMs = noteStartMs + noteDurationMs
        // Particles emit when keys are pressed (after lookahead delay)
        const keyPressDelayMs = lookahead * 1000
        const keyPressStartMs = noteStartMs + keyPressDelayMs
        const keyPressEndMs = noteEndMs + keyPressDelayMs
        return {
          noteNumber: note.NoteNumber,
          keyPressStartMs,
          keyPressEndMs,
        }
      })
    }, [midiObject, lookahead])

    // Attack envelope parameters
    const ATTACK_BOOST = 0.6 // 60% extra intensity at note start
    const DECAY_TIME_MS = 250 // Time to decay back to base level

    // Calculate active notes and their intensity for a given time
    const getActiveNotesWithIntensity = useCallback((currentTimeMs: number): Map<number, number> => {
      const activeWithIntensity = new Map<number, number>()
      for (const timing of noteTimingData) {
        if (currentTimeMs >= timing.keyPressStartMs && currentTimeMs <= timing.keyPressEndMs) {
          // Calculate time since note started
          const timeSinceStart = currentTimeMs - timing.keyPressStartMs
          // Exponential decay from attack boost to base level
          const intensity = 1.0 + ATTACK_BOOST * Math.exp(-timeSinceStart / DECAY_TIME_MS)
          // Keep the highest intensity if same note appears multiple times
          const existing = activeWithIntensity.get(timing.noteNumber)
          if (existing === undefined || intensity > existing) {
            activeWithIntensity.set(timing.noteNumber, intensity)
          }
        }
      }
      return activeWithIntensity
    }, [noteTimingData])

    // Expose setFrame for imperative control
    useImperativeHandle(ref, () => ({
      setFrame: (adjustedFrame: number) => {
        const currentTimeMs = adjustedFrame * FRAME_DURATION_MS
        const currentTimeSeconds = currentTimeMs / 1000
        currentTimeRef.current = currentTimeSeconds

        // Calculate which notes should be active and their intensity
        const activeNotesWithIntensity = getActiveNotesWithIntensity(currentTimeMs)
        activeNotesRef.current = new Set(activeNotesWithIntensity.keys())

        // Update all streams with visibility and intensity based on active state
        streamRefs.current.forEach((streamRef, noteNumber) => {
          const intensity = activeNotesWithIntensity.get(noteNumber)
          const isActive = intensity !== undefined
          streamRef.setTime(currentTimeSeconds, isActive, isActive ? intensity : 1.0)
        })
      }
    }), [getActiveNotesWithIntensity])

    // Build active note info for rendering
    const activeNoteInfos = useMemo((): ActiveNoteInfo[] => {
      if (!midiObject) return []

      // Get unique note numbers from MIDI
      const uniqueNotes = new Set<number>()
      midiObject.forEach((note) => uniqueNotes.add(note.NoteNumber))

      // Use provided colors or fall back to constants
      const effectiveBlackKeyColor = blackKeyColor ?? BLACK_KEY_COLOR
      const effectiveWhiteKeyColor = whiteKeyColor ?? WHITE_KEY_COLOR

      return Array.from(uniqueNotes).map((noteNumber) => {
        const keyIsBlack = isBlack(noteNumber)
        const keyColor = (keyIsBlack ? effectiveBlackKeyColor : effectiveWhiteKeyColor) as [number, number, number]
        return {
          noteNumber,
          isBlack: keyIsBlack,
          color: keyColor,
        }
      })
    }, [midiObject, blackKeyColor, whiteKeyColor])

    // Use a fixed particle count per stream to match real-time intensity
    // In real-time, single notes get full settings.count (4000 default)
    // We use a reasonable per-stream count that looks good regardless of total notes
    const densityScale = zoomAdaptive ? Math.max(0.25, 1 / Math.max(1, scaleFactor)) : 1
    const perStreamMin = zoomAdaptive ? 80 : 200
    const perStreamCount = Math.max(perStreamMin, Math.floor((settings.count / 4) * densityScale))
    const motionScale = (zoomAdaptive ? densityScale : 1) * (motionScaleMultiplier ?? 1)

    // Register stream ref
    const registerStreamRef = useCallback((noteNumber: number, handle: FrameBasedParticleStreamHandle | null) => {
      if (handle) {
        streamRefs.current.set(noteNumber, handle)
      } else {
        streamRefs.current.delete(noteNumber)
      }
    }, [])

    if (!midiObject || activeNoteInfos.length === 0) return null

    return (
      <>
        {activeNoteInfos.map((info) => {
          const relativeX = notePositionTable.get(info.noteNumber) ?? getNoteXPosition(info.noteNumber, layout)
          const worldX = relativeX * scaleFactor
          const baseZ = info.isBlack ? BLACK_KEY_Z : WHITE_KEY_Z
          return (
              <FrameBasedParticleStream
                key={info.noteNumber}
                ref={(handle) => registerStreamRef(info.noteNumber, handle)}
                basePosition={[worldX, keyboardY, baseZ]}
                color={info.color}
                isBlack={info.isBlack}
                scaleFactor={scaleFactor}
                motionScale={motionScale}
                settings={settings}
                particleCount={perStreamCount}
                noteNumber={info.noteNumber}
              />
          )
        })}
      </>
    )
  }
)

export default FrameBasedParticles
