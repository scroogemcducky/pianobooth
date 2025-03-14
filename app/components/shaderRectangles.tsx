// import { useFrame } from "@react-three/fiber";
// import { useMemo, useRef, useEffect } from "react";
// import usePlayStore from '../store/playStore'
// import { factor, speed } from '../utils/constantsOriginal';

// const vertexShader = `
//     uniform float uTime;
//     uniform float speed;
//     uniform float uAccum;

//     attribute float isBlackKey;  // Add this attribute
//     varying float vIsBlackKey;   // Add varying to pass to fragment shader

//     void main() {

//         vIsBlackKey = isBlackKey;  // Pass to fragment shader

//         vec4 modelPosition = modelMatrix * vec4(position, 1.0);
//         modelPosition.x -= uAccum;
//         vec4 viewPosition = viewMatrix * modelPosition;
//         vec4 projectedPosition = projectionMatrix * viewPosition;

//         gl_Position = projectedPosition;
//     }
// `
// const fragmentShader = `
//     varying float vIsBlackKey; // receiving value

//     void main() {
//         vec3 color = vIsBlackKey > 0.5 ?
//             vec3(0.80, 0.05, 0.33) : // darker
//             vec3(0.95, 0.120, 0.28); // lighter
//         gl_FragColor = vec4(color, 1.0);
//     }
// `
// const CustomGeometryParticles = ({blocks, groupedBlocks, triggerVisibleNote, keys, distance}) => {

//     const playingRef = useRef(usePlayStore.getState().playing)

//     // Connect to the store on mount, disconnect on unmount, catch state-changes in a reference
//     useEffect(() => usePlayStore.subscribe(
//         state => (playingRef.current = state.playing)
//     ), [])

//     const points = useRef();
//     // BULD these arrays eaerlier and pass here. 
//     const vertices = [];
//     const indices = [];
//     const colors = [];

//     if (blocks.length) {
//         blocks.forEach((block, blockIndex) => {
           
//             const [x, y, z] = block.position;
//             const width = block.width ;
//             const height = block.height;
           
//           // Add 4 vertices for this rectangle
//             vertices.push(
//                 x, y, z - width/2,                     // Bottom left
//                 x, y , z + width/2,                    // Bottom right
//                 x + height, y, z + width/2,            // Top right
//                 x + height, y, z - width/2             // Top left
//             );

//             const isBlackKey = block.isBlack ? 1.0 : 0.0;

//             colors.push(
//                 isBlackKey, isBlackKey, isBlackKey, isBlackKey
//             )
        
//             // Add indices for the two triangles of this rectangle
//             const vertexOffset = blockIndex * 4;  // 4 vertices per rectangle
//             indices.push(
//                 // First triangle
//                 vertexOffset + 0, vertexOffset + 1, vertexOffset + 2,
//                 // Second triangle
//                 vertexOffset + 0, vertexOffset + 2, vertexOffset + 3
//             );
//         });
//     }

//     const uniforms = useMemo(() => ({
//         uTime: {
//         value: 0.0
//         },
//         uDelta: {
//             value: 0.0
//         },
//         uAccum: {
//             value:0.0
//         },
//         uMovement: {
//             value: 0.0
//         }
//     }), [])

//     const timeRef  = useRef(0)
//     let accumulated = 0.0
//     let idx = 0

//     const speed_in_seconds = speed * 1000;
//     useFrame((_, delta) => {
       
//         if(playingRef.current){
//             timeRef.current += delta * speed_in_seconds;
//             // const movement = (distance * delta * speed) / factor;
//             accumulated += (distance * delta * speed) / factor;
//             // accumulated += delta
//             points.current.material.uniforms.uAccum.value = accumulated;
//         } 
        

//         // while (idx < groupedBlocks.length && timeRef.current >= keys[idx]) {
//         //     const currentBlocks = groupedBlocks[idx][keys[idx]];
//         //     currentBlocks.forEach(block => {

//         //         triggerVisibleNote(block.noteNumber, block.duration * 1000 / speed);
//         //     });
//         //     idx += 1;
//         //   }
//     });

//   return (
//         <mesh ref={points}>
//             <bufferGeometry>
//                 <bufferAttribute
//                         attach="attributes-position"
//                         count={vertices.length /3}
//                         array={new Float32Array(vertices)}
//                         itemSize={3}
//                         />
//                 <bufferAttribute
//                         attach="index"
//                         array={new Uint16Array(indices)}
//                         count={indices.length}
//                         itemSize={1}
//                         />   
//                 <bufferAttribute
//                         attach="attributes-isBlackKey"
//                         count={colors.length}
//                         array={new Float32Array(colors)}
//                         itemSize={1}
//                         /> 
//             </bufferGeometry>
//             <shaderMaterial
//                 fragmentShader={fragmentShader}
//                 vertexShader={vertexShader}
//                 uniforms={uniforms}
//                 />
//         </mesh>
//   );
// };

// export default CustomGeometryParticles;

