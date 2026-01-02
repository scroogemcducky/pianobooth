import React, { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { scalingFactor, isBlack } from '../../utils/functions'
import { white_key_dimensions, black_key_dimensions, BLACK_KEY_COLOR, WHITE_KEY_COLOR } from '../../utils/constants'
import { type PianoLayout, getKeyboardMetrics, getKeyboardWidth, getNoteXPosition } from '../../utils/pianoLayout'
import useParticleSettingsStore from '../../store/particleSettingsStore'

const WHITE_KEY_Z = 2.2
const BLACK_KEY_Z = 2.4

// Simplified vertex shader for static particles
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
    vec2 circleDir = vec2(sin(theta), cos(theta));

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

// Simplified fragment shader for static particles
const fragmentShader = /* glsl */ `
  uniform vec3 uPrimaryColor;
  uniform vec3 uAccentColor;
  uniform float uOpacity;
  uniform float uGlowSpread;
  uniform float uFadeIn;
  uniform float uFadeOut;
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
    vec3 color = mix(uAccentColor, uPrimaryColor, vProgress);
    float finalAlpha = alpha * fade * uOpacity;
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

type Props = {
  activeNotes: Set<number>
  layout: PianoLayout
  scaleMultiplier?: number
}

type ParticleStreamProps = {
  noteNumber: number
  basePosition: [number, number, number]
  color: [number, number, number]
  isBlackKey: boolean
  scaleFactor: number
  particleCount: number
}

function StaticParticleStream({
  noteNumber,
  basePosition,
  color,
  isBlackKey,
  scaleFactor,
  particleCount,
}: ParticleStreamProps) {
  const settings = useParticleSettingsStore((state) => state.settings)
  const keyDimensions = isBlackKey ? black_key_dimensions : white_key_dimensions

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
    opacity,
    allowDownward,
  } = settings

  // Use a small deterministic time offset to add variety without hiding particles
  // Keep offsets small so all particles are visible at similar phases
  const timeOffset = useMemo(() => {
    const rng = seededRandom(noteNumber * 12345)
    return rng() * 0.5 // Small offset (0-0.5s) instead of large (0-20s)
  }, [noteNumber])

  const geometry = useMemo(() => new THREE.BufferGeometry(), [])

  // Generate particle attributes
  const attributes = useMemo(() => {
    const rng = seededRandom(noteNumber * 67890)
    const width = keyDimensions.x * scaleFactor
    const baseSpread = width * (0.4 + emitterRadius * 1.5)
    const depthRatio = keyDimensions.z / keyDimensions.x
    const halfWidth = Math.max(0.001, width * 0.5)
    const angleRange = allowDownward ? Math.PI : Math.PI * 0.5

    const seeds = new Float32Array(particleCount)
    const lifetimes = new Float32Array(particleCount)
    const speeds = new Float32Array(particleCount)
    const radii = new Float32Array(particleCount)
    const sizes = new Float32Array(particleCount)
    const phases = new Float32Array(particleCount)
    const angles = new Float32Array(particleCount)
    const baseOffsets = new Float32Array(particleCount * 2)

    for (let i = 0; i < particleCount; i++) {
      seeds[i] = rng()
      const lifeBase = THREE.MathUtils.lerp(0.25, 1.2, 1 - decayFrequency)
      lifetimes[i] = lifeBase * (0.7 + rng() * 0.6)
      speeds[i] = 0.6 + rng() * 0.5 - velocityDamping * 0.4
      radii[i] = Math.min(baseSpread * (0.35 + rng() * (0.65 + initialRandomVelocity)), halfWidth)
      sizes[i] = 0.6 + rng() * 0.6
      phases[i] = rng() * 50
      angles[i] = rng() * angleRange
      const offsetIndex = i * 2
      baseOffsets[offsetIndex] = (rng() - 0.5) * width
      baseOffsets[offsetIndex + 1] = depthRatio * 0.05 * (rng() - 0.5)
    }

    return { seeds, lifetimes, speeds, radii, sizes, phases, angles, baseOffsets }
  }, [
    noteNumber,
    particleCount,
    keyDimensions.x,
    keyDimensions.z,
    scaleFactor,
    emitterRadius,
    decayFrequency,
    velocityDamping,
    initialRandomVelocity,
    allowDownward,
  ])

  // Set up geometry attributes
  useEffect(() => {
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(attributes.seeds, 1))
    geometry.setAttribute('aLife', new THREE.BufferAttribute(attributes.lifetimes, 1))
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(attributes.speeds, 1))
    geometry.setAttribute('aRadius', new THREE.BufferAttribute(attributes.radii, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(attributes.sizes, 1))
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(attributes.phases, 1))
    geometry.setAttribute('aAngle', new THREE.BufferAttribute(attributes.angles, 1))
    geometry.setAttribute('aBaseOffset', new THREE.BufferAttribute(attributes.baseOffsets, 2))
    geometry.setDrawRange(0, particleCount)
    return () => geometry.dispose()
  }, [geometry, attributes, particleCount])

  const baseColor = useMemo(() => new THREE.Color().fromArray(color), [color])
  const accentColor = useMemo(() => new THREE.Color(colorIn).lerp(baseColor, 0.5), [colorIn, baseColor])
  const primaryColor = useMemo(() => new THREE.Color(colorOut).lerp(baseColor, 0.2), [colorOut, baseColor])

  const uniforms = useMemo(() => ({
    uTime: { value: 2.5 + timeOffset }, // Fixed time for static rendering (mid-lifecycle for visibility)
    uHeight: { value: (initialVelocityY + emitterVelocityStrength * 1.4 + Math.abs(gravityY) * 0.4) * scaleFactor * 1.5 },
    uBaseSize: { value: Math.max(25, size * 250 * Math.max(0.5, scaleFactor)) }, // Larger particles for thumbnails
    uDrift: {
      value: new THREE.Vector3(
        initialVelocityX * 0.5 * scaleFactor + gravityX * 0.1,
        gravityY * 0.25 * scaleFactor,
        initialVelocityZ * 0.5 * scaleFactor + gravityZ * 0.1
      ),
    },
    uPrimaryColor: { value: primaryColor },
    uAccentColor: { value: accentColor },
    uOpacity: { value: Math.max(opacity, 0.8) }, // Ensure high visibility for thumbnails
    uGlowSpread: { value: Math.max(glowSpread, 0.3) }, // More glow for thumbnails
    uFadeIn: { value: fadeIn * 0.5 }, // Faster fade in
    uFadeOut: { value: fadeOut * 0.5 }, // Faster fade out (more visible in middle)
  }), [
    timeOffset,
    initialVelocityY,
    emitterVelocityStrength,
    gravityY,
    scaleFactor,
    size,
    initialVelocityX,
    gravityX,
    initialVelocityZ,
    gravityZ,
    primaryColor,
    accentColor,
    opacity,
    glowSpread,
    fadeIn,
    fadeOut,
  ])

  return (
    <points geometry={geometry} position={basePosition}>
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

// Main component that renders particles for all active notes
export default function ThumbnailStaticParticles({
  activeNotes,
  layout,
  scaleMultiplier = 1,
}: Props) {
  const { viewport } = useThree()
  const settings = useParticleSettingsStore((state) => state.settings)
  const totalKeyboardWidth = getKeyboardWidth(layout)
  const scaleFactor = scalingFactor(viewport.width, totalKeyboardWidth, {
    multiplier: scaleMultiplier,
  })
  const { keyboardY } = getKeyboardMetrics(viewport.height, scaleFactor)

  // Per-stream particle count
  const perStreamCount = Math.max(200, Math.floor(settings.count / 4))

  // Build note info for rendering
  const noteInfos = useMemo(() => {
    return Array.from(activeNotes).map((noteNumber) => {
      const keyIsBlack = isBlack(noteNumber)
      const keyColor = (keyIsBlack ? BLACK_KEY_COLOR : WHITE_KEY_COLOR) as [number, number, number]
      const relativeX = getNoteXPosition(noteNumber, layout)
      const worldX = relativeX * scaleFactor
      const baseZ = keyIsBlack ? BLACK_KEY_Z : WHITE_KEY_Z
      return {
        noteNumber,
        isBlack: keyIsBlack,
        color: keyColor,
        position: [worldX, keyboardY, baseZ] as [number, number, number],
      }
    })
  }, [activeNotes, layout, scaleFactor, keyboardY])

  if (activeNotes.size === 0) return null

  return (
    <>
      {noteInfos.map((info) => (
        <StaticParticleStream
          key={info.noteNumber}
          noteNumber={info.noteNumber}
          basePosition={info.position}
          color={info.color}
          isBlackKey={info.isBlack}
          scaleFactor={scaleFactor}
          particleCount={perStreamCount}
        />
      ))}
    </>
  )
}
