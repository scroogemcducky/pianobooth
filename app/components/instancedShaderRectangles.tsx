import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useEffect } from "react";
import usePlayStore from '../store/playStore'
import { factor, speed } from '../utils/constants';
import * as THREE from 'three';
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";

interface Block {
  position: [number, number, number];
  height: number;
  width: number;
  isBlack: boolean;
}

interface CustomGeometryParticlesProps {
  blocks: Block[];
  groupedBlocks?: any; // Add proper type if needed
  triggerVisibleNote?: (note: any) => void; // Add proper type if needed
  keys?: any; // Add proper type if needed
  distance: number;
}

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
        
        // Scale the plane
        transformed.x *= instanceHeight;
        transformed.z *= instanceWidth;
        
        // Add instance offset
        transformed += instancePosition;
        
        // Apply movement
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        mvPosition.x -= uAccum;
        
        gl_Position = projectionMatrix * mvPosition;
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
}) => {
    const playingRef = useRef(usePlayStore.getState().playing);
    const points = useRef<THREE.Mesh>(null);
    const accumulatedRef = useRef(0.0);

    useEffect(() => usePlayStore.subscribe(
        state => (playingRef.current = state.playing)
    ), []);

    const geometry = useMemo(() => {
        if (!blocks.length) return null;

        // Create instanced buffer geometry
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

    const uniforms = useMemo(() => ({
        uTime: { value: 0.0 },
        uDelta: { value: 0.0 },
        uAccum: { value: 0.0 },
        uMovement: { value: 0.0 }
    }), []);

    useFrame((_, delta) => {
        if (playingRef.current && points.current?.material) {
            accumulatedRef.current += (distance * delta * speed) / factor;
            (points.current.material as THREE.ShaderMaterial).uniforms.uAccum.value = 
              accumulatedRef.current;
        }
    });

    if (!blocks.length || !geometry) return null;

    return (
        <>
            <PerspectiveCamera
                makeDefault
                position={[30, 10, 50]}
                fov={75}
                near={0.1}
                far={1000}
            />
            <OrbitControls />
            <mesh ref={points}>
                <primitive object={geometry} />
                <shaderMaterial
                    key={blocks.length}
                    fragmentShader={fragmentShader}
                    vertexShader={vertexShader}
                    uniforms={uniforms}
                    transparent={true}
                    side={THREE.DoubleSide}
                />
            </mesh>
            <gridHelper args={[100, 100]} />
            <axesHelper args={[5]} />
        </>
    );
};

export default CustomGeometryParticles;