import { useEffect, useState, useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { extend, useThree } from '@react-three/fiber'
import { factor, speed, black_width, white_width, BLACK_KEY_COLOR, WHITE_KEY_COLOR } from '../../utils/constants'
import { calculateHeight, isBlack, scalingFactor } from '../../utils/functions.js'
import {
  type PianoLayout,
  DEFAULT_PIANO_LAYOUT,
  getKeyboardMetrics,
  getKeyboardWidth,
  getNoteXPosition,
} from '../../utils/pianoLayout'

const FRAME_DURATION_MS = 1000 / 60
const BLOOM_LAYER = 1

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
    uniform vec3 uBlackKeyColor;
    uniform vec3 uWhiteKeyColor;
    varying float vIsBlackKey;

    void main() {
        vec3 color = vIsBlackKey > 0.5 ? uBlackKeyColor : uWhiteKeyColor;
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
  constructor(blackKeyColor: number[] = BLACK_KEY_COLOR, whiteKeyColor: number[] = WHITE_KEY_COLOR) {
    super({
      vertexShader,
      fragmentShader,
      uniforms: {
        uAccum: { value: 0.0 },
        uBlackKeyColor: { value: new THREE.Vector3(...blackKeyColor) },
        uWhiteKeyColor: { value: new THREE.Vector3(...whiteKeyColor) },
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
  setColors: (blackKeyColor: number[], whiteKeyColor: number[]) => void
}

interface FrameBasedInstancesProps {
  blocks: Block[];
  scaleFactor: number
  distance: number
  lookahead: number
  blackKeyColor?: number[]
  whiteKeyColor?: number[]
}

const FrameBasedInstances = forwardRef<FrameBasedInstancesHandle, FrameBasedInstancesProps>(
  function FrameBasedInstances({ blocks, scaleFactor, distance, lookahead, blackKeyColor, whiteKeyColor }, ref) {
  const materialRef = useRef<CustomShaderMaterial>(null);
  const meshRef = useRef<THREE.Mesh | null>(null)

  useEffect(() => {
    if (!meshRef.current) return
    meshRef.current.layers.enable(BLOOM_LAYER)
  }, [])

  // Create material with initial colors
  const material = useMemo(() => {
    return new CustomShaderMaterial(blackKeyColor, whiteKeyColor)
  }, [])

  useImperativeHandle(ref, () => ({
    setTime: (currentTimeMs: number) => {
      if (!materialRef.current) return
      // Fall speed adjusted for desired fall duration
      // Blocks should fall 'distance' units in 'lookahead' seconds
      const speedAdjusted = speed * distance / lookahead
      const accumValue = (currentTimeMs / 1000) * speedAdjusted
      materialRef.current.uniforms.uAccum.value = accumValue
    },
    setColors: (blackColor: number[], whiteColor: number[]) => {
      if (!materialRef.current) return
      materialRef.current.uniforms.uBlackKeyColor.value.set(...blackColor)
      materialRef.current.uniforms.uWhiteKeyColor.value.set(...whiteColor)
    }
  }), [distance, lookahead])

  // Update colors when props change
  useEffect(() => {
    if (materialRef.current && blackKeyColor) {
      materialRef.current.uniforms.uBlackKeyColor.value.set(...blackKeyColor)
    }
  }, [blackKeyColor?.[0], blackKeyColor?.[1], blackKeyColor?.[2]])

  useEffect(() => {
    if (materialRef.current && whiteKeyColor) {
      materialRef.current.uniforms.uWhiteKeyColor.value.set(...whiteKeyColor)
    }
  }, [whiteKeyColor?.[0], whiteKeyColor?.[1], whiteKeyColor?.[2]])

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

  // Assign material to ref on mount
  if (!materialRef.current) {
    (materialRef as React.MutableRefObject<CustomShaderMaterial | null>).current = material
  }

  if (!blocks.length || !geometry) return null;

  return (
    <mesh ref={meshRef}>
      <primitive object={geometry} />
      <primitive object={material} ref={materialRef} attach="material" />
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
  blackKeyColor?: number[]
  whiteKeyColor?: number[]
}

const FrameBasedShaderBlocks = forwardRef<FrameBasedShaderBlocksHandle, FrameBasedShaderBlocksProps>(
  function FrameBasedShaderBlocks({
    midiObject,
    layout,
    scaleMultiplier = 1,
    scaleFillRatio,
    scaleMax,
    lookahead = 3,
    blackKeyColor,
    whiteKeyColor,
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
          blackKeyColor={blackKeyColor}
          whiteKeyColor={whiteKeyColor}
        />
      )}
    </>
  )
})

export default FrameBasedShaderBlocks
