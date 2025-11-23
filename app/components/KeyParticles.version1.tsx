import React, { useMemo, useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { useThree, useFrame } from '@react-three/fiber'
import { scalingFactor } from '../utils/functions'
import { white_key_dimensions, black_key_dimensions } from '../utils/constants'
import { type PianoLayout, getKeyboardMetrics, getKeyboardWidth, getNoteXPosition } from '../utils/pianoLayout'
import useParticleSettingsStore, { type ParticleSettings } from '../store/particleSettingsStore'

export type ActiveKeyParticle = {
  noteNumber: number
  startedAt: number
  durationMs: number
  color: [number, number, number]
  isBlack: boolean
}

type KeyParticlesProps = {
  layout: PianoLayout
  notes?: ActiveKeyParticle[] | null
}

const WHITE_KEY_Z = 2.2
const BLACK_KEY_Z = 2.4

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uHeight;
  uniform float uBaseSize;
  uniform vec3 uDrift;
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
  void main() {
    float lifeTime = uTime * aSpeed + aPhase;
    float lifeProgress = fract(lifeTime / aLife);
    float radius = aRadius * lifeProgress;
    float theta = aAngle;
    vec2 circleDir = vec2(sin(theta), abs(cos(theta)));

    vec3 displaced = vec3(
      aBaseOffset.x + circleDir.x * radius + uDrift.x * lifeProgress,
      circleDir.y * radius * uHeight + uDrift.y * lifeProgress,
      aBaseOffset.y + uDrift.z * lifeProgress
    );

    vProgress = lifeProgress;
    vSeed = aSeed;

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    float size = uBaseSize * aSize * (1.0 - lifeProgress);
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
        sparkle = ((wave - start) / (1.0 - start)) * uSparklingAlpha;
      }
    }

    vec3 color = mix(uAccentColor, uPrimaryColor, vProgress);
    float finalAlpha = alpha * fade * uOpacity + sparkle;
    if (finalAlpha <= 0.01) discard;
    gl_FragColor = vec4(color, finalAlpha);
  }
`

const KeyParticles: React.FC<KeyParticlesProps> = ({ layout, notes }) => {
  const activeNotes = notes ?? []
  const { viewport } = useThree()
  const totalKeyboardWidth = getKeyboardWidth(layout)
  const settings = useParticleSettingsStore((state) => state.settings)
  const scaleFactor = scalingFactor(viewport.width, totalKeyboardWidth)
  const { keyboardY } = getKeyboardMetrics(viewport.height, scaleFactor)

  const notePositionTable = useMemo(() => {
    const minNote = layout.paddedMinNote ?? layout.minNote
    const maxNote = layout.paddedMaxNote ?? layout.maxNote
    const table = new Map<number, number>()
    for (let current = minNote; current <= maxNote; current++) {
      table.set(current, getNoteXPosition(current, layout))
    }
    return table
  }, [layout])

  if (!activeNotes.length) return null

  const perStreamCount = Math.max(50, Math.floor(settings.count / activeNotes.length))

  return (
    <>
      {activeNotes.map((active) => {
        const relativeX = notePositionTable.get(active.noteNumber) ?? getNoteXPosition(active.noteNumber, layout)
        const worldX = relativeX * scaleFactor
        const baseZ = active.isBlack ? BLACK_KEY_Z : WHITE_KEY_Z
        return (
          <ParticleStream
            key={active.noteNumber}
            basePosition={[worldX, keyboardY, baseZ]}
            color={active.color}
            isBlack={active.isBlack}
            scaleFactor={scaleFactor}
            settings={settings}
            particleCount={perStreamCount}
          />
        )
      })}
    </>
  )
}

type ParticleStreamProps = {
  basePosition: [number, number, number]
  color: [number, number, number]
  isBlack: boolean
  scaleFactor: number
  settings: ParticleSettings
  particleCount: number
}

const ParticleStream: React.FC<ParticleStreamProps> = ({
  basePosition,
  color,
  isBlack,
  scaleFactor,
  settings,
  particleCount,
}) => {
  const {
    decayFrequency,
    velocityDamping,
    emitterRadius,
    emitterVelocityStrength,
    initialVelocityX,
    initialVelocityY,
    initialVelocityZ,
    initialRandomVelocity,
    turbulenceStrength,
    turbulenceTimeFrequeny,
    turbulencePositionFrequeny,
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
  const keyDimensions = isBlack ? black_key_dimensions : white_key_dimensions

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
    const width = keyDimensions.x * scaleFactor
    const baseSpread = width * (0.4 + emitterRadius * 1.5)
    const depthRatio = keyDimensions.z / keyDimensions.x
    const halfWidth = Math.max(0.001, width * 0.5)
    for (let i = 0; i < particleCount; i++) {
      seeds[i] = Math.random()
      const lifeBase = THREE.MathUtils.lerp(0.25, 1.2, 1 - decayFrequency)
      lifetimes[i] = lifeBase * (0.7 + Math.random() * 0.6)
      speeds[i] = 0.6 + Math.random() * 0.5 - velocityDamping * 0.4
      radii[i] = baseSpread * (0.35 + Math.random() * (0.65 + initialRandomVelocity))
      sizes[i] = 0.6 + Math.random() * 0.6
      phases[i] = Math.random() * 50
      angles[i] = Math.random() * (Math.PI * 0.5)
      const offsetIndex = i * 2
      baseOffsets[offsetIndex] = (Math.random() - 0.5) * width
      baseOffsets[offsetIndex + 1] = depthRatio * 0.05 * (Math.random() - 0.5)
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
    }),
    [],
  )

  useEffect(() => {
    const heightBase = (initialVelocityY + emitterVelocityStrength * 1.4 + Math.abs(gravityY) * 0.4) * scaleFactor
    uniforms.uHeight.value = Math.max(0.4, heightBase)
    uniforms.uBaseSize.value = Math.max(15, size * 180 * Math.max(0.5, scaleFactor))
    uniforms.uDrift.value.set(
      initialVelocityX * 0.5 * scaleFactor + gravityX * 0.1,
      gravityY * 0.25 * scaleFactor,
      initialVelocityZ * 0.5 * scaleFactor + gravityZ * 0.1,
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

  const timeOffset = useRef(Math.random() * 20)

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime + timeOffset.current
    const [x, y, z] = basePositionRef.current
    if (pointsRef.current) {
      pointsRef.current.position.set(x, y, z)
    }
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
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

export default KeyParticles
