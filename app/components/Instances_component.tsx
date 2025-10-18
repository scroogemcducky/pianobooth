import * as THREE from 'three'
import { ShaderMaterial } from 'three'
import { extend, useFrame } from '@react-three/fiber'
import React, { useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import usePlayStore from '../store/playStore'
import { factor, BLACK_KEY_COLOR, WHITE_KEY_COLOR } from '../utils/constants'

interface Block {
  position: [number, number, number]
  height: number
  width: number
  isBlack: boolean
  noteNumber: number
  duration: number
}

interface GroupedBlocks {
  [timestamp: string]: {
    [noteId: string]: Block[]
  }
}

export interface CustomGeometryParticlesProps {
  blocks: Block[]
  distance: number
  groupedBlocks: GroupedBlocks
  notes: number[]
  triggerVisibleNote: (note: number, duration: number) => void
  scaleFactor?: number
  onTimeUpdate?: (timeMs: number) => void
}

export type VisualizerHandle = {
  seek: (ms: number) => void
  getCurrentTimeMs: () => number
}

const fragmentShader = /* glsl */ `
  varying float vIsBlackKey;
  void main() {
    vec3 color = vIsBlackKey > 0.5 ?
      vec3(${BLACK_KEY_COLOR[0]}, ${BLACK_KEY_COLOR[1]}, ${BLACK_KEY_COLOR[2]}) :
      vec3(${WHITE_KEY_COLOR[0]}, ${WHITE_KEY_COLOR[1]}, ${WHITE_KEY_COLOR[2]});
    gl_FragColor = vec4(color, 1.0);
  }
`

const vertexShader = /* glsl */ `
  uniform float uAccum;
  attribute float isBlackKey;
  attribute vec3 instancePosition;
  attribute float instanceHeight;
  attribute float instanceWidth;
  varying float vIsBlackKey;
  void main() {
    vIsBlackKey = isBlackKey;
    vec3 transformed = position.xyz;
    transformed.y *= instanceHeight;
    transformed.x *= instanceWidth;
    vec3 finalPosition = transformed + instancePosition;
    finalPosition.y -= uAccum;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPosition, 1.0);
  }
`

class CustomShaderMaterial extends ShaderMaterial {
  constructor() {
    super({
      vertexShader,
      fragmentShader,
      uniforms: { uAccum: { value: 0.0 } },
      transparent: true,
      side: THREE.DoubleSide,
    })
  }
}

extend({ CustomShaderMaterial })

const CustomGeometryParticles = forwardRef<VisualizerHandle, CustomGeometryParticlesProps>(
({
  blocks,
  distance,
  groupedBlocks,
  notes,
  triggerVisibleNote,
  scaleFactor = 1,
  onTimeUpdate,
}, ref) => {
  const playing = usePlayStore((state) => state.playing)
  const speed = usePlayStore((state) => state.speed)
  const materialRef = useRef<CustomShaderMaterial>(null)

  const timeRef = useRef(0)
  const indexRef = useRef(0)
  const lastUpdateRef = useRef(0)

  const geometry = useMemo(() => {
    if (!blocks.length) return null
    const baseGeometry = new THREE.PlaneGeometry(1, 1)
    const instancedGeometry = new THREE.InstancedBufferGeometry()
    for (const key in baseGeometry.attributes) {
      instancedGeometry.setAttribute(key, (baseGeometry.attributes as any)[key])
    }
    instancedGeometry.index = baseGeometry.index
    const count = blocks.length
    instancedGeometry.setAttribute('instancePosition', new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3))
    instancedGeometry.setAttribute('instanceHeight', new THREE.InstancedBufferAttribute(new Float32Array(count), 1))
    instancedGeometry.setAttribute('instanceWidth', new THREE.InstancedBufferAttribute(new Float32Array(count), 1))
    instancedGeometry.setAttribute('isBlackKey', new THREE.InstancedBufferAttribute(new Float32Array(count), 1))
    instancedGeometry.instanceCount = count
    return instancedGeometry
  }, [])

  useEffect(() => {
    if (!geometry) return
    const positions = geometry.attributes.instancePosition.array as Float32Array
    const heights = geometry.attributes.instanceHeight.array as Float32Array
    const widths = geometry.attributes.instanceWidth.array as Float32Array
    const colors = geometry.attributes.isBlackKey.array as Float32Array
    blocks.forEach((block, i) => {
      const [x, y, z] = block.position
      positions[i * 3] = x * scaleFactor
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      heights[i] = block.height
      widths[i] = block.width * scaleFactor
      colors[i] = block.isBlack ? 1 : 0
    })
    geometry.attributes.instancePosition.needsUpdate = true
    geometry.attributes.instanceHeight.needsUpdate = true
    geometry.attributes.instanceWidth.needsUpdate = true
    geometry.attributes.isBlackKey.needsUpdate = true
  }, [blocks, geometry, scaleFactor])

  // Expose imperative seek + current time getters
  useImperativeHandle(ref, () => ({
    seek: (ms: number) => {
      timeRef.current = ms
      if (materialRef.current) {
        materialRef.current.uniforms.uAccum.value = (distance / factor) * (ms / 1000)
      }
      // Binary search to find first note strictly after ms
      let lo = 0
      let hi = notes.length
      while (lo < hi) {
        const mid = (lo + hi) >>> 1
        if (notes[mid] <= ms) lo = mid + 1
        else hi = mid
      }
      indexRef.current = lo
    },
    getCurrentTimeMs: () => timeRef.current,
  }), [distance, notes])

  const speedAdjusted = useMemo(() => speed * distance / factor, [speed, distance])
  const speed_ms = useMemo(() => speed * 1000, [speed])
  const block_duration_factor = useMemo(() => 1000 / speed, [speed])

  useFrame((_, delta) => {
    if (!materialRef.current) return
    if (playing) {
      timeRef.current += delta * speed_ms
      materialRef.current.uniforms.uAccum.value += delta * speedAdjusted

      let nextNoteTime = notes[indexRef.current]
      while (indexRef.current < notes.length && timeRef.current >= nextNoteTime) {
        const currentBlocks = groupedBlocks[indexRef.current][nextNoteTime]
        currentBlocks.forEach((block) => {
          triggerVisibleNote(block.noteNumber, block.duration * block_duration_factor)
        })
        indexRef.current++
        nextNoteTime = notes[indexRef.current]
      }
    }
    // Throttle progress updates to ~20fps
    if (onTimeUpdate) {
      const now = performance.now()
      if (now - lastUpdateRef.current > 50) {
        lastUpdateRef.current = now
        onTimeUpdate(timeRef.current)
      }
    }
  })

  if (!blocks.length || !geometry) return null

  return (
    <mesh>
      <primitive object={geometry} attach="geometry" />
      <customShaderMaterial ref={materialRef as any} key={blocks.length} />
    </mesh>
  )
})

export default CustomGeometryParticles
