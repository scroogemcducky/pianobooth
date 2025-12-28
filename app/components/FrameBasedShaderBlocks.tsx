import { useEffect, useState, useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { extend, useThree } from '@react-three/fiber'
import { factor, speed, black_width, white_width, BLACK_KEY_COLOR, WHITE_KEY_COLOR } from '../utils/constants'
import { calculateHeight, isBlack, scalingFactor } from '../utils/functions.js'
import {
  type PianoLayout,
  DEFAULT_PIANO_LAYOUT,
  getKeyboardMetrics,
  getKeyboardWidth,
  getNoteXPosition,
} from '../utils/pianoLayout'

const FRAME_DURATION_MS = 1000 / 60

export interface FrameBasedShaderBlocksHandle {
  setFrame: (adjustedFrame: number) => void
}

interface MidiNote {
  Delta: number;
  Duration: number;
  NoteNumber: number;
  Velocity: number;
  SoundDuration: number;
}

interface Block {
  position: [number, number, number];
  height: number;
  width: number;
  isBlack: boolean;
  noteNumber: number;
  duration: number;
  delta: number;
}

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

class CustomShaderMaterial extends THREE.ShaderMaterial {
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

// Extend so JSX knows about customShaderMaterial
declare module '@react-three/fiber' {
  namespace JSX {
    interface IntrinsicElements {
      customShaderMaterial: any;
    }
  }
}

extend({ CustomShaderMaterial });

interface FrameBasedInstancesHandle {
  setTime: (currentTimeMs: number) => void
}

interface FrameBasedInstancesProps {
  blocks: Block[];
  scaleFactor: number
  distance: number
  lookahead: number
}

const FrameBasedInstances = forwardRef<FrameBasedInstancesHandle, FrameBasedInstancesProps>(
  function FrameBasedInstances({ blocks, scaleFactor, distance, lookahead }, ref) {
  const materialRef = useRef<CustomShaderMaterial>(null);

  useImperativeHandle(ref, () => ({
    setTime: (currentTimeMs: number) => {
      if (!materialRef.current) return
      // Fall speed adjusted for desired fall duration
      // Blocks should fall 'distance' units in 'lookahead' seconds
      const speedAdjusted = speed * distance / lookahead
      const accumValue = (currentTimeMs / 1000) * speedAdjusted
      materialRef.current.uniforms.uAccum.value = accumValue
    }
  }), [distance, lookahead])

  const geometry = useMemo(() => {
    if (!blocks.length) return null;

    const baseGeometry = new THREE.PlaneGeometry(1, 1);
    const instancedGeometry = new THREE.InstancedBufferGeometry();

    // Copy base attributes
    for (const key in baseGeometry.attributes) {
      instancedGeometry.setAttribute(key, baseGeometry.attributes[key]);
    }
    instancedGeometry.index = baseGeometry.index;

    // Pre-allocate buffers
    const count = blocks.length;
    instancedGeometry.setAttribute(
      'instancePosition',
      new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3)
    );
    instancedGeometry.setAttribute(
      'instanceHeight',
      new THREE.InstancedBufferAttribute(new Float32Array(count), 1) 
    );
    instancedGeometry.setAttribute(
      'instanceWidth',
      new THREE.InstancedBufferAttribute(new Float32Array(count), 1)
    );
    instancedGeometry.setAttribute(
      'isBlackKey',
      new THREE.InstancedBufferAttribute(new Float32Array(count), 1)
    );

    instancedGeometry.instanceCount = count;
    return instancedGeometry;
  }, [blocks.length]);

  // Update attributes when blocks change
  useEffect(() => {
    if (!geometry) return;

    const positions = geometry.attributes.instancePosition.array as Float32Array;
    const heights = geometry.attributes.instanceHeight.array as Float32Array;
    const widths = geometry.attributes.instanceWidth.array as Float32Array;
    const colors = geometry.attributes.isBlackKey.array as Float32Array;

    blocks.forEach((block, i) => {
      const [x, y, z] = block.position;
      positions[i * 3] = x * scaleFactor;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      heights[i] = block.height;
      widths[i] = block.width * scaleFactor;
      colors[i] = block.isBlack ? 1 : 0;
    });

    geometry.attributes.instancePosition.needsUpdate = true;
    geometry.attributes.instanceHeight.needsUpdate = true;
    geometry.attributes.instanceWidth.needsUpdate = true;
    geometry.attributes.isBlackKey.needsUpdate = true;
  }, [blocks, geometry, scaleFactor]);

  if (!blocks.length || !geometry) return null;

  return (
    <mesh>
      <primitive object={geometry} />
      <customShaderMaterial ref={materialRef} />
    </mesh>
  );
})

interface FrameBasedShaderBlocksProps {
  midiObject: MidiNote[]
  layout?: PianoLayout
  scaleMultiplier?: number
  scaleFillRatio?: number
  scaleMax?: number
  lookahead?: number
}

const FrameBasedShaderBlocks = forwardRef<FrameBasedShaderBlocksHandle, FrameBasedShaderBlocksProps>(
  function FrameBasedShaderBlocks({
    midiObject,
    layout,
    scaleMultiplier = 1,
    scaleFillRatio,
    scaleMax,
    lookahead = 3,
  }, ref) {
  const { viewport } = useThree()
  const [blocks, setBlocks] = useState<Block[]>([])
  const instancesRef = useRef<FrameBasedInstancesHandle>(null)
  const activeLayout = layout ?? DEFAULT_PIANO_LAYOUT

  const totalKeyboardWidth = getKeyboardWidth(activeLayout)
  const scaleFactor = scalingFactor(viewport.width, totalKeyboardWidth, {
    multiplier: scaleMultiplier,
    fillRatio: scaleFillRatio,
    maxScale: scaleMax,
  })
  const { distance } = getKeyboardMetrics(viewport.height, scaleFactor)
  const half_screen = viewport.height / 2

  useImperativeHandle(ref, () => ({
    setFrame: (adjustedFrame: number) => {
      const currentTimeMs = adjustedFrame * FRAME_DURATION_MS
      instancesRef.current?.setTime(currentTimeMs)
    }
  }), [])

  useEffect(() => {
    if (midiObject) {
      const newBlocks = midiObject.map((note) => {
        // Block height is inversely proportional to lookahead
        // When blocks fall slower (higher lookahead), they need to be shorter
        // so they cover the keyboard for the same visual duration
        const height = calculateHeight(note.Duration, distance) / lookahead
        const deltaMs = Math.floor(note.Delta / 1000)
        const xPosition = getNoteXPosition(note.NoteNumber, activeLayout)
        // At time=deltaMs, block should be 'lookahead' seconds worth of falling away from keyboard
        // Fall speed = distance / lookahead
        // At T=deltaMs: initial_Y - (deltaMs/1000) * (distance/lookahead) = half_screen
        // Therefore: initial_Y = height/2 + half_screen + (distance * deltaMs) / (1000 * lookahead)
        const yPosition = height / 2 + half_screen + (distance * deltaMs) / (1000 * lookahead)
        const isBlackKey = isBlack(note.NoteNumber)
        const zPosition = isBlackKey ? -0.05 : -0.07
        const blockWidth = isBlackKey ? black_width : white_width - 0.1
        return {
          noteNumber: note.NoteNumber,
          soundDuration: note.SoundDuration,
          delta: deltaMs,
          duration: note.Duration / 1000000,
          height,
          width: blockWidth,
          position: [xPosition, yPosition, zPosition] as [number, number, number],
          isBlack: isBlackKey,
        }
      })

      setBlocks(newBlocks)
    }
  }, [activeLayout, midiObject, viewport.height, viewport.width, half_screen, distance, scaleFactor, lookahead])

  return (
    <>
      {blocks.length > 0 && (
        <FrameBasedInstances
          ref={instancesRef}
          blocks={blocks}
          scaleFactor={scaleFactor}
          distance={distance}
          lookahead={lookahead}
        />
      )}
    </>
  )
})

export default FrameBasedShaderBlocks
