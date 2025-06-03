import { useEffect, useState, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { extend, useThree } from '@react-three/fiber';
import { factor, speed, black_width, white_width, BLACK_KEY_COLOR, WHITE_KEY_COLOR } from '../utils/constants';
import { y_shader, calculateHeight, isBlack, scalingFactor } from '../utils/functions.js';

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

interface FrameBasedInstancesProps {
  blocks: Block[];
  scaleFactor: number;
  currentTimeMs: number;
  distance: number;
}

function FrameBasedInstances({ blocks, scaleFactor, currentTimeMs, distance }: FrameBasedInstancesProps) {
  const materialRef = useRef<CustomShaderMaterial>(null);

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

  // Update shader based on current time
  useEffect(() => {
    if (!materialRef.current) return;

    const speedAdjusted = speed * distance / factor;
    const accumValue = (currentTimeMs / 1000) * speedAdjusted;
    materialRef.current.uniforms.uAccum.value = accumValue;
  }, [currentTimeMs, distance]);

  if (!blocks.length || !geometry) return null;

  return (
    <mesh>
      <primitive object={geometry} />
      <customShaderMaterial ref={materialRef} />
    </mesh>
  );
}

interface FrameBasedShaderBlocksProps {
  midiObject: MidiNote[];
  currentFrame: number;
}

function FrameBasedShaderBlocks({ midiObject, currentFrame }: FrameBasedShaderBlocksProps) {
  const { viewport } = useThree();
  const [blocks, setBlocks] = useState<Block[]>([]);
  
  const offset = 7 * 2.55;
  const totalKeyboardWidth = 6 * offset;
  const scaleFactor = scalingFactor(viewport.width, totalKeyboardWidth);
  
  const half_screen = viewport.height / 2;
  const distance = viewport.height / 2;
  const firstNoteDelta = midiObject[0] ? parseInt(midiObject[0].Delta.toString()) + 1000 : 0;

  useEffect(() => {
    if (midiObject) {
      const newBlocks = midiObject.map((note, index) => {
        const height = calculateHeight(note.Duration, distance) / factor;
        const position = y_shader(note, height, distance, half_screen, firstNoteDelta) as [number, number, number];
        
        const blockWidth = isBlack(note.NoteNumber) ? black_width : (white_width - 0.1);
        
        return {
          noteNumber: note.NoteNumber,
          soundDuration: note.SoundDuration,
          delta: parseInt(note.Delta.toString()) + firstNoteDelta + (factor - 1) * 1000,
          duration: note.Duration / 1000000,
          height: height,
          width: blockWidth,
          position: position,
          isBlack: isBlack(note.NoteNumber),
        };
      });

      setBlocks(newBlocks);
    }
  }, [midiObject, viewport.height, viewport.width, half_screen, distance, firstNoteDelta]);

  const currentTimeMs = currentFrame * (1000 / 60); // 60 FPS

  return (
    <>
      {blocks.length > 0 && (
        <FrameBasedInstances 
          blocks={blocks}
          scaleFactor={scaleFactor}
          currentTimeMs={currentTimeMs}
          distance={distance}
        />
      )}
    </>
  );
}

export default FrameBasedShaderBlocks; 