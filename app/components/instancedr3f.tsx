import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useEffect } from "react";
import usePlayStore from '../store/playStore'
import { factor, speed } from '../utils/constants';
import * as THREE from 'three';
import { extend } from "@react-three/fiber";
import { ShaderMaterial } from "three";

// 

class CustomShaderMaterial extends ShaderMaterial {
  constructor() {
    super({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uDelta: { value: 0.0 },
        uAccum: { value: 0.0 },
        uMovement: { value: 0.0 }
      },
      transparent: true,
      side: THREE.DoubleSide,
    });
  }
}

extend({ CustomShaderMaterial });


const vertexShader = `
    uniform float uTime;
    uniform float speed;
    uniform float uAccum;

    attribute float isBlackKey;
    attribute vec3 instancePosition;
    attribute float instanceHeight;
    attribute float instanceWidth;
    varying float vIsBlackKey;

    void main() {
        vIsBlackKey = isBlackKey;
        
        // Start with base position
        vec3 transformed = position.xyz;
        
        // Scale the plane - height along Y axis, width along Z axis
        transformed.y *= instanceHeight;
        // transformed.z *= 0.01 * instanceWidth;
        transformed.x *= instanceWidth;
        
        // First rotate 90 degrees around X axis to make it vertical
        float angleX = -3.14159 / 2.0;
        float cosX = cos(angleX);
        float sinX = sin(angleX);
        vec3 rotatedX = vec3(
            transformed.x,
            transformed.y * cosX - transformed.z * sinX,
            transformed.y * sinX + transformed.z * cosX
        );
        
        // Then rotate 90 degrees around Y axis to face forward
        float angleY = 3.14159 / 2.0;
        float cosY = cos(angleY);
        float sinY = sin(angleY);
        vec3 rotatedXY = vec3(
            rotatedX.x * cosY + rotatedX.z * sinY,
            rotatedX.y,
            -rotatedX.x * sinY + rotatedX.z * cosY
        );
        
        // Add instance offset and movement along X axis
        vec3 finalPosition = rotatedXY + instancePosition;
        finalPosition.x -= uAccum;  // Apply movement to X axis before model view transform
        
        // Transform to clip space
        gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPosition, 1.0);
    }
`;

const fragmentShader = `
    varying float vIsBlackKey;

    void main() {
        vec3 color = vIsBlackKey > 0.5 ?
            vec3(0.80, 0.05, 0.33) :
            vec3(0.95, 0.120, 0.28);
        gl_FragColor = vec4(color, 1.0);
    }
`;

const CustomGeometryParticles: React.FC<CustomGeometryParticlesProps> = ({
  blocks,
  distance,
  groupedBlocks,
  keys,
  triggerVisibleNote
}) => {
    const playingRef = useRef(usePlayStore.getState().playing);
    const materialRef = useRef<CustomShaderMaterial>(null);
    const accumulatedRef = useRef(0.0);

    useEffect(() => usePlayStore.subscribe(
        state => (playingRef.current = state.playing)
    ), []);

    const geometry = useMemo(() => {
        if (!blocks.length) return null;

        const baseGeometry = new THREE.PlaneGeometry(1, 1);
        const instancedGeometry = new THREE.InstancedBufferGeometry();

        // Copy attributes from the base geometry
        Object.keys(baseGeometry.attributes).forEach(key => {
            instancedGeometry.setAttribute(key, baseGeometry.attributes[key]);
        });
        instancedGeometry.index = baseGeometry.index;

        // Create instanced attributes
        const instancePositions = new Float32Array(blocks.length * 3);
        const instanceHeights = new Float32Array(blocks.length);
        const instanceWidths = new Float32Array(blocks.length);
        const instanceColors = new Float32Array(blocks.length);

        blocks.forEach((block, i) => {
            const [x, y, z] = block.position;
            instancePositions[i * 3] = x;
            instancePositions[i * 3 + 1] = y;
            instancePositions[i * 3 + 2] = z;
            instanceHeights[i] = block.height;
            instanceWidths[i] = block.width;
            instanceColors[i] = block.isBlack ? 1.0 : 0.0;
        });

        // console.log("First 2 instanceWidths:", Array.from(instanceWidths.slice(0, 2)));

        instancedGeometry.setAttribute(
            'instancePosition',
            new THREE.InstancedBufferAttribute(instancePositions, 3)
        );
        instancedGeometry.setAttribute(
            'instanceHeight',
            new THREE.InstancedBufferAttribute(instanceHeights, 1)
        );
        instancedGeometry.setAttribute(
            'instanceWidth',
            new THREE.InstancedBufferAttribute(instanceWidths, 1)
        );
        instancedGeometry.setAttribute(
            'isBlackKey',
            new THREE.InstancedBufferAttribute(instanceColors, 1)
        );

        // Set instance count
        instancedGeometry.instanceCount = blocks.length;

        return instancedGeometry;
    }, [blocks]);

    let idx = 0;
    const timeRef = useRef(0);
    useFrame((_, delta) => {
        if (playingRef.current && materialRef.current) {
            const speed_in_seconds = speed * 1000;
            timeRef.current += delta * speed_in_seconds;

            accumulatedRef.current += (distance * delta * speed) / factor;
            materialRef.current.uniforms.uAccum.value = accumulatedRef.current;

            while (idx < keys.length && timeRef.current >= keys[idx]) {
                const currentBlocks = groupedBlocks[idx][keys[idx]];
                currentBlocks.forEach(block => {
                  triggerVisibleNote(block.noteNumber, block.duration * 1000 / speed);
                });
                idx += 1;
              }
        }
    });

    if (!blocks.length || !geometry) return null;
    console.log("instancede3f")
    return (
        <mesh>
            <primitive object={geometry} attach="geometry" />
            <customShaderMaterial
                ref={materialRef}
                key={blocks.length}
                attach="material"
            />
        </mesh>
    );
};

export default CustomGeometryParticles;


// interface Block {
//       position: [number, number, number];
//       height: number;
//       width: number;
//       isBlack: boolean;
//     }
    
//     interface GroupedBlock {
//       noteId: string;
//       blocks: Block[];
//     }
    
//     interface CustomGeometryParticlesProps {
//       blocks: Block[];
//       groupedBlocks?: Record<string, GroupedBlock>;
//       triggerVisibleNote?: (note: string) => void;
//       keys?: Set<string>;
//       distance: number;
//     }