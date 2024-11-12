import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const testBlocks = [
    // {
    //   height: 1.4342096600845882,
    //   width: 2.4499999999999997,
    //   position: [27.074247687185153, -0.1, 23.406]
    // },
    // {
    //   height: 27.26802318049908,
    //   width: 2.4499999999999997,
    //   position: [40.4911544473924, -0.1, 0.45599999999999996]
    // },
    // {   
    //     height: 27.26802318049908,
    //     width: 2.4499999999999997,
    //     position: [-50, 0, 0]
    // }
    {
        height: 10,
        width: 5,
        position: [27.074247687185153, -0.1, 23.406]
      },
    //   {
    //     height: 27.26802318049908,
    //     width: 2.4499999999999997,
    //     position: [40.4911544473924, -0.1, 0.45599999999999996]
    //   },
    //   {   
    //       height: 27.26802318049908,
    //       width: 2.4499999999999997,
    //       position: [-50, -0.1, 10]
    //   }
  ];



const vertexShader = `
uniform float uTime;
uniform float uRadius;

void main() {
  
  vec3 particlePosition = position;

  vec4 modelPosition = modelMatrix * vec4(particlePosition, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  vec4 projectedPosition = projectionMatrix * viewPosition;

  gl_Position = projectedPosition;
  gl_PointSize = 3.0;
}
`
const fragmentShader = `
void main() {
  gl_FragColor = vec4(0.34, 0.53, 0.96, 1.0);
}
`

const CustomGeometryParticles = (props) => {
  const { count } = props;
  const radius = 2;

  // This reference gives us direct access to our points
  const points = useRef();

  // Generate our positions attributes array
//   const particlesPosition = useMemo(() => {
//     const positions = new Float32Array(count * 3);
    
//     for (let i = 0; i < count; i++) {
//       let x = 1.0*i;
//       let y =1.0*i;
//       let z = 1.0*i;
//       positions.set([x, y, z], i * 3);
//     }
//     return positions;
//   }, [count]);
const particlesPosition = useMemo(() => {
    console.log("testBlocks.length" ,testBlocks.length)
    const positions = new Float32Array(testBlocks.length * 3 * 3);

    console.log("position.length: ", positions.length)
    for (let i = 0; i < testBlocks.length; i++) {

        let x = testBlocks[i]["position"][0]
        let y =testBlocks[i]["position"][1]
        let z = testBlocks[i]["position"][2]
        console.log("x, y, z: ", x, y, z)
        positions.set([x, y, z], 3*i );

        x = testBlocks[i]["position"][0]
        y =testBlocks[i]["position"][1] + testBlocks[i]["width"]
        z = testBlocks[i]["position"][2]
        console.log("x, y, z: ", x, y, z)
        positions.set([x, y, z], 3*i + 3);

        x = testBlocks[i]["position"][0]
        y =testBlocks[i]["position"][1] + testBlocks[i]["width"]
        z = testBlocks[i]["position"][2] + testBlocks[i]["height"]
        console.log("x, y, z: ", x, y, z)
        console.log(3*9)
        positions.set([x, y, z], 3*i + 3 + 3);


    }
    console.log("positions: ", positions)
    return positions;
    
  }, [count]);

  const vertices = [];
  const indices = [];
  
  testBlocks.forEach((block, blockIndex) => {
    const [x, y, z] = block.position;
    const width = block.width ;
    const height = block.height;
    
    // Add 4 vertices for this rectangle
    vertices.push(
      // Bottom left
      x , y, z,
      // Bottom right
      x, y , z + width,
      // Top right
      x + height, y, z + width,
      // Top left
      x + height, y , z + width
    );
    console.log("Vertices: ", vertices)
    // Add indices for the two triangles of this rectangle
    const vertexOffset = blockIndex * 4;  // 4 vertices per rectangle
    indices.push(
      // First triangle
      vertexOffset + 0, vertexOffset + 1, vertexOffset + 2,
      // Second triangle
      vertexOffset + 0, vertexOffset + 2, vertexOffset + 3
    );
    console.log("Indices: ", indices)
  });


  const uniforms = useMemo(() => ({
    uTime: {
      value: 0.0
    },
    uRadius: {
      value: radius
    }
  }), [])

  useFrame((state) => {
    const { clock } = state;

    // points.current.material.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh ref={points}>
         <bufferGeometry>
            <bufferAttribute
                attach="attributes-position"
                count={vertices.length / 3}
                array={new Float32Array(vertices)}
                itemSize={3}
                />
            <bufferAttribute
                attach="attributes-index"
                array={new Uint16Array(indices)}
                count={indices.length}
                itemSize={1}
                />
        </bufferGeometry>
        <meshBasicMaterial side={THREE.DoubleSide} />
    </mesh>
    // <points ref={points}>
    //   <bufferGeometry>
    //     <bufferAttribute
    //       attach="attributes-position"
    //       count={particlesPosition.length / 3}
    //       array={particlesPosition}
    //       itemSize={3}
    //     />
    //   </bufferGeometry>
    //   <shaderMaterial
    //     depthWrite={false}
    //     fragmentShader={fragmentShader}
    //     vertexShader={vertexShader}
    //     uniforms={uniforms}
    //   />
    // </points>
  );
};

const Scene = () => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <CustomGeometryParticles count={4000} />
      <OrbitControls />
    </>
  );
};


export default Scene;
