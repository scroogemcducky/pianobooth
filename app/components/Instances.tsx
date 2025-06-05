// types.ts

import * as THREE from 'three';
import { ShaderMaterial } from 'three';
import { extend, useFrame } from '@react-three/fiber';
import { useMemo, useRef, useEffect } from 'react';
import usePlayStore from '../store/playStore';
import { factor, speed, BLACK_KEY_COLOR, WHITE_KEY_COLOR } from '../utils/constants';
// import { BLACK_KEY_COLOR, WHITE_KEY_COLOR } from '../utils/constants';

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

interface CustomGeometryParticlesProps {
  blocks: Block[]
  distance: number
  groupedBlocks: GroupedBlocks
  notes: number[]
  triggerVisibleNote: (note: number, duration: number) => void
  scaleFactor?: number
}
  
// shaders/vertex.glsl
const fragmentShader = /* glsl */ `
    varying float vIsBlackKey;

    void main() {
        vec3 color = vIsBlackKey > 0.5 ?
            vec3(${BLACK_KEY_COLOR[0]}, ${BLACK_KEY_COLOR[1]}, ${BLACK_KEY_COLOR[2]}) :
            vec3(${WHITE_KEY_COLOR[0]}, ${WHITE_KEY_COLOR[1]}, ${WHITE_KEY_COLOR[2]});
        gl_FragColor = vec4(color, 1.0);
    }
`;

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
`;
  
  
class CustomShaderMaterial extends ShaderMaterial {
  constructor() {
    super({
      vertexShader,
      fragmentShader,
      uniforms: {
        uAccum: { value: 0.0 }
      },
      transparent: true,
      side: THREE.DoubleSide,
    });
  }
}
  
extend({ CustomShaderMaterial });

// CustomGeometryParticles.tsx
const CustomGeometryParticles: React.FC<CustomGeometryParticlesProps> = ({
  blocks,
  distance,
  groupedBlocks,
  notes,
  triggerVisibleNote,
  scaleFactor = 1
}) => {
  const playing = usePlayStore(state => state.playing)
  const speed = usePlayStore(state => state.speed)
  const materialRef = useRef<CustomShaderMaterial>(null)

  const timeRef = useRef(0)
  const indexRef = useRef(0)
  
  const geometry = useMemo(() => {
    if (!blocks.length) return null

    const baseGeometry = new THREE.PlaneGeometry(1, 1)
    const instancedGeometry = new THREE.InstancedBufferGeometry()

    // Copy base attributes
    for (const key in baseGeometry.attributes) {
      instancedGeometry.setAttribute(key, baseGeometry.attributes[key])
    }
    instancedGeometry.index = baseGeometry.index

    // Pre-allocate buffers
    const count = blocks.length
    instancedGeometry.setAttribute(
      'instancePosition',
      new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)
    )
    instancedGeometry.setAttribute(
      'instanceHeight',
      new THREE.InstancedBufferAttribute(new Float32Array(count), 1) 
    )
    instancedGeometry.setAttribute(
      'instanceWidth',
      new THREE.InstancedBufferAttribute(new Float32Array(count), 1)
    )
    instancedGeometry.setAttribute(
      'isBlackKey',
      new THREE.InstancedBufferAttribute(new Float32Array(count), 1)
    )

    instancedGeometry.instanceCount = count
    return instancedGeometry
  }, []) 

  // Update attributes when blocks change
  useEffect(() => {
    if (!geometry) return
    // console.log("Changing attributes")
    const positions = geometry.attributes.instancePosition.array as Float32Array
    const heights = geometry.attributes.instanceHeight.array as Float32Array
    const widths = geometry.attributes.instanceWidth.array as Float32Array 
    const colors = geometry.attributes.isBlackKey.array as Float32Array

    blocks.forEach((block, i) => {
      const [x, y, z] = block.position
      // Apply scaling factor to x position to match keyboard scaling
      positions[i * 3] = x * scaleFactor
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      heights[i] = block.height
      // Apply scaling factor to width to match keyboard scaling
      widths[i] = block.width * scaleFactor
      colors[i] = block.isBlack ? 1 : 0
    })

    geometry.attributes.instancePosition.needsUpdate = true
    geometry.attributes.instanceHeight.needsUpdate = true
    geometry.attributes.instanceWidth.needsUpdate = true
    geometry.attributes.isBlackKey.needsUpdate = true
  }, [blocks, geometry, scaleFactor])

  const speedAdjusted = speed * distance / factor
  const speed_ms = speed * 1000
  const block_duration_factor = 1000 / speed
  // console.log("groupedBlocks: ", groupedBlocks)
  // console.log("notes: ", notes)
  useFrame((_, delta) => {
    if (!playing || !materialRef.current) return

    timeRef.current += delta * speed_ms
    materialRef.current.uniforms.uAccum.value += delta * speedAdjusted
    
    let nextNoteTime = notes[indexRef.current]
    while (indexRef.current < notes.length && timeRef.current >= nextNoteTime) {
      const currentBlocks = groupedBlocks[indexRef.current][nextNoteTime];

      currentBlocks.forEach(block => {
        triggerVisibleNote(block.noteNumber, block.duration * block_duration_factor);
      });

      indexRef.current++;
      nextNoteTime = notes[indexRef.current]
    }
  })

  if (!blocks.length || !geometry) return null

  return (
    <mesh>
      <primitive object={geometry} attach="geometry" />
      <customShaderMaterial ref={materialRef} key={blocks.length} />
    </mesh>
  )
}

export default CustomGeometryParticles