import { ShaderMaterial, Color, BoxGeometry } from 'three';
import { useMemo, useRef,  } from 'react';
import { useFrame } from '@react-three/fiber';
import CustomGeometryRectangles from './shaderRectangles';

const testBlocks = [

    {
      id: "0",
      noteNumber: 76,
      soundDuration: 26042,
      delta: 2000,
      duration: 0.026042,
      height: 0.4342096600845882,
      width: 2.4499999999999997,
      color: "rgb(240, 19, 71)",
      position: [27.074247687185153, -0.1, 23.406]
    },
    {
      id: "1",
      noteNumber: 60,
      soundDuration: 1635417,
      delta: 2000,
      duration: 1.635417,
      height: 27.26802318049908,
      width: 2.4499999999999997,
      color: "rgb(240, 19, 71)",
      position: [40.4911544473924, -0.1, 0.45599999999999996]
    },
    {   
        id: "2",
        noteNumber: 60,
        soundDuration: 1635417,
        delta: 2000,
        duration: 1.635417,
        height: 27.26802318049908,
        width: 2.4499999999999997,
        color: "rgb(240, 19, 71)",
        position: [-50, 0, 0]}

  ];

function Block({ color, width, height, duration, position, soundDuration }) {
//    const geometry = new BoxGeometry(height, 0, width);
   const mesh = useRef(null)
    console.log("color", color)
    // const material = new ShaderMaterial({
        
    //     uniforms: {
    //     color: { value: new Color(0xff0000) }
    //     },

    //     vertexShader: `
    //     varying vec2 vUv;
    //     void main() {
    //         vUv = uv;
    //         gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    //     }
    //     `,

    //     fragmentShader: `
    //     uniform vec3 color;
    //     varying vec2 vUv;
        
    //     void main() {
    //         vec3 finalColor = color;
    //         gl_FragColor = vec4(finalColor, 1.0);
    //     }
    //     `
    // });
   
        
       const  uniforms =  useMemo (
        () => ({
            u_time: {
                value: 1.0 
            },
        }), []
        )

        const vertexShader = `
        varying vec2 vUv;
        uniform float u_time;

        void main() {
            vUv = uv;
            vec4 modelPosition = modelMatrix * vec4(position, 1.0);
            modelPosition.x -= 1.0*u_time;

            vec4 viewPosition = viewMatrix * modelPosition;
            vec4 projectedPosition = projectionMatrix * viewPosition;

            gl_Position = projectedPosition;
        }
        `

        const fragmentShader = `
        varying vec2 vUv;

        vec3 colorA = vec3(0.912,0.191,0.652);
        vec3 colorB = vec3(1.000,0.777,0.052);

        void main() {
            vec2 normalizedPixel = gl_FragCoord.xy/600.0;
            vec3 color = mix(colorA, colorB, normalizedPixel.x);

            gl_FragColor = vec4(color,1.0);
        }
        `  
        useFrame((state) => {
            const { clock } = state;
            mesh.current.material.uniforms.u_time.value = clock.getElapsedTime();
          });
    return (
        // <mesh
        // geometry={geometry}
        // material={material}
        // position={position}
        // />
        <mesh ref={mesh}>

            {/* <planeGeometry args={[1,1,1,1]} rotation={[-Math.PI/2, 0, -Math.PI/2]} /> */}
            <boxGeometry args={[1,1,1]} />
            <shaderMaterial
                fragmentShader={fragmentShader}
                vertexShader={vertexShader}
                uniforms = {uniforms}/>

        </mesh>
    );
}


// function Block2({ color, width, height, duration, position }) {
//     const geometry = new BoxGeometry(5, 5, 1);

//   const material = new ShaderMaterial({
//     uniforms: {
//       color: { value: new Color(0xff0000) }
//     },
//     vertexShader: `
//       varying vec2 vUv;
//       void main() {
//         vUv = uv;
//         gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
//       }
//     `,
//     fragmentShader: `
//       uniform vec3 color;
//       varying vec2 vUv;
      
//       void main() {
//         vec3 finalColor = color;
//         gl_FragColor = vec4(finalColor, 1.0);
//       }
//     `
//     });

//     return (
//         <mesh
//         geometry={geometry}
//         material={material}
//         position={position}
//         />
//     );
// }

// function RedBox() {
//   const geometry = new BoxGeometry(5, 5, 1);

//   const material = new ShaderMaterial({
//     uniforms: {
//       color: { value: new Color(0xff0000) }
//     },
//     vertexShader: `
//       varying vec2 vUv;
//       void main() {
//         vUv = uv;
//         gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
//       }
//     `,
//     fragmentShader: `
//       uniform vec3 color;
//       varying vec2 vUv;
      
//       void main() {
//         vec3 finalColor = color;
//         gl_FragColor = vec4(finalColor, 1.0);
//       }
//     `
//   });

//   return (
//     <mesh
//       geometry={geometry}
//       material={material}
//       position={[-50, 0, 0]}
//       rotation={[0, 0, 0]}
//     />
//   );
// }

export default function ShaderBlocks() {
  return (
    <>
      {/* <RedBox /> */}
      {testBlocks.map((block) => (
        <Block key={block.id} {...block} />
      ))}
      <CustomGeometryRectangles count={10} />
    </>
  );
}