import {  useRef, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import { motion } from 'framer-motion-3d'
// import { useFrame } from '@react-three/fiber';
import { white_color, black_color } from '../utils/constants'  
import { MeshStandardMaterial } from 'three'
import useStore from '../store/keyPressStore'


const variants = {
  pressed: {
    rotateZ: -0.065,
  },
  open: {
    rotateZ: 0,
  },
};

function Scaffold(props) {
  const { noteNumber, pos, materials, color, geometryObject} = props;

  const pressed = useStore(state => state[noteNumber])

  const standardMaterial = new MeshStandardMaterial({color: color === "white" ? white_color : black_color})
  const meshRef = useRef();
  const clonedMaterialRef = useRef(new MeshStandardMaterial()).current;
  
  useEffect(() => {
    if (materials[color]) {
      clonedMaterialRef.copy(materials[color]);
      if (pressed) {
        if(meshRef.current) {
          meshRef.current.material  = standardMaterial
        }  
      } else {
        meshRef.current.material = clonedMaterialRef
      }
    }
  }, [pressed]);


  return (
    <group {...props}  position={pos} dispose={null} rotation={[0, 0, -Math.PI/2]} >
      <motion.group 
               initial={"open"}
               animate={pressed? "pressed" : "open"}
               transition={{ delay: 0, duration: 0.05, ease: "easeInOut"}}
               variants={variants}     
              >
        <mesh 
              geometry={geometryObject}
              material={clonedMaterialRef} 
              ref={meshRef}
              castShadow
              receiveShadow
              />
      </motion.group>
    </group>
  );
}

export function C(props) {
  const { noteNumber, pos} = props;
  const { nodes, materials } = useGLTF('/c_new-transformed.glb');
  
  return (
    <Scaffold noteNumber={noteNumber} 
              pos={pos} 
              nodes={nodes} 
              materials={materials} 
              color={"white"} 
              geometryObject={nodes.Cube1051.geometry} />
  )
}

export function C_Sharp(props) {

  const { noteNumber, pos} = props
  const { nodes, materials } = useGLTF('/c_sharp_new-transformed.glb')
  
  return (
    <Scaffold noteNumber={noteNumber} 
              pos={pos} 
              nodes={nodes} 
              materials={materials} 
              color={"black"} 
              geometryObject={nodes.Black.geometry}/>
  )
}

export function D(props) {

  const { noteNumber, pos} = props
  const { nodes, materials } = useGLTF('/d_new-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} 
              pos={pos} 
              nodes={nodes} 
              materials={materials} 
              color={"white"} 
              geometryObject={nodes.Cube1055.geometry}/>
  )
}

export function D_Sharp(props) {
  const { noteNumber, pos} = props
  const { nodes, materials } = useGLTF('/d_sharp_new-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"black"} geometryObject={nodes.Black001.geometry}/>
  )
}


export function E(props) {
  const { noteNumber, pos } = props
  const { nodes, materials } = useGLTF('/e_new-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"white"} geometryObject={nodes.Cube1056.geometry}/>
  )
}

export function F(props) {
  const { noteNumber, pos } = props
  const { nodes, materials } = useGLTF('/f_new-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"white"} geometryObject={nodes.Cube1057.geometry}/>
  )
}

export function F_Sharp(props) {
  const { noteNumber, pos} = props
  const { nodes, materials } = useGLTF('/f_sharp_new-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"black"} geometryObject={nodes.Black002.geometry}/>
  )

}

export function G(props) {
  const { noteNumber, pos } = props
  const { nodes, materials } = useGLTF('/g_new-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"white"} geometryObject={nodes.Cube1058.geometry}/>
  )
  
}

export function G_Sharp(props) {
  const { noteNumber, pos } = props
  const { nodes, materials } = useGLTF('/g_sharp_new-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"black"} geometryObject={nodes.Black003.geometry}/>
  )
}

export function A(props) {
  const { noteNumber, pos } = props
  const { nodes, materials } = useGLTF('/a_new-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"white"} geometryObject={nodes.Cube1059.geometry}/>
  )

}

export function A_Sharp(props) {
  const { noteNumber, pos } = props
  const { nodes, materials } = useGLTF('/a_sharp_new-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"black"} geometryObject={nodes.Black004.geometry}/>
  )
}

export function B(props) {
  const { noteNumber, pos } = props
  const { nodes, materials } = useGLTF('/b_new-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"white"} geometryObject={nodes.Cube1060.geometry}/>
  )
}

// function Scaffold2(props) {
//     const { noteNumber, pos, materials, color, geometryObject} = props;
//     const stateRef = useRef(useStore.getState()[noteNumber])
  
//     const meshRef = useRef();
//     const clonedMaterialRef = useRef(new MeshStandardMaterial()).current;
//     useEffect(() => useStore.subscribe(
//       state => (stateRef.current = state[noteNumber])
//     ), [])
  
//    const originalMaterialRef = useRef()
//     useEffect(() => {
//       if (meshRef.current) {
//         // Store the original material
//         originalMaterialRef.current = meshRef.current.material;
//       }
//     }, []); 
  
//     useEffect(() => {
//       if (materials[color]) {
//         clonedMaterialRef.copy(materials[color]);
//         if (stateRef.current) {
//           clonedMaterialRef.emissive.setRGB(1, 0, 0);
//           clonedMaterialRef.color.setRGB(0.96, 0.55, 0.7);
//         }
//       }
//     }, [stateRef.current]);
  
//     let needsReset = false
  
//     useFrame(() => {
//       if (stateRef.current) {
//         needsReset=true
//         meshRef.current.rotation.z = -0.01;
//         meshRef.current.material.emissive.setRGB(1, 0, 0);
//         meshRef.current.material.color.setRGB(0.96, 0.55, 0.7);
//       } else {
//         if (needsReset) {
//           meshRef.current.rotation.z = 0;
//           meshRef.current.material.copy(materials[color]);
//           needsReset = false;
//         }
//       }
//     });
  
//     return (
//       <group {...props} dispose={null}>
//         {/* <motion.group 
//                  initial={"open"}
//                  animate={pressed? "pressed" : "open"}
//                  transition={{ delay: 0, duration: 0.05, ease: "easeInOut"}}
//                  variants={variants}
//                 > */}
//           <mesh 
//                 geometry={geometryObject}
//                 material={clonedMaterialRef} 
//                 position={pos}
//                 rotation={[0, Math.PI, 0]}
//                 ref={meshRef}
//                 />
//         {/* </motion.group> */}
//       </group>
//     );
//   }