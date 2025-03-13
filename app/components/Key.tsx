import {  useRef, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import { motion } from 'framer-motion-3d'
import { useFrame } from '@react-three/fiber';
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
// const black_color = "rgb(214, 13, 67)"
// const blackRgbValues = black_color.match(/\d+/g).map(Number);
// const normalizedBlackRGB = blackRgbValues.map(value => value / 255);

// const whiteRgbValues = white_color.match(/\d+/g).map(Number);
// const normalizedWhiteRGB = whiteRgbValues.map(value => value / 255);

function Scaffold(props) {
  const { noteNumber, pos, materials, color, geometryObject} = props;

  const pressed = useStore(state => state[noteNumber])
  // const highlight = color === "white" ? normalizedWhiteRGB : normalizedBlackRGB

  // const modelRef = useRef();
  // useFrame(() => {
  //       let box = new Box3().setFromObject(modelRef.current);
  //       let size = new Vector3();
  //       box.getSize(size);
  //       console.log('Size:', size);
  // })

  const standardMaterial = new MeshStandardMaterial({color: color === "white" ? white_color : black_color})
  const meshRef = useRef();
  const clonedMaterialRef = useRef(new MeshStandardMaterial()).current;
//   const originalMaterialRef = useRef()
  
  useEffect(() => {
    if (materials[color]) {
      clonedMaterialRef.copy(materials[color]);
      // if (!originalMaterialRef.current) {
      //   originalMaterialRef.current = meshRef.current.material;
      // }

      if (pressed) {

        // better
        // clonedMaterialRef.emissive.setRGB(0, 0, 0);
        // clonedMaterialRef.emissiveIntensity = 0;
        // clonedMaterialRef.roughness = 1;
        // clonedMaterialRef.metalness = 0.0;
        // clonedMaterialRef.clearcoat = 0;
        // clonedMaterialRef.clearcoatRoughness = 1;
        // better

        // console.log(clonedMaterialRef.material)
        // console.log("white color: ", white_color)
        // console.log("whitergbvalues: ", whiteRgbValues)
        // console.log("normalizsed white: ", normalizedWhiteRGB)
        if(meshRef.current) {
          meshRef.current.material  = standardMaterial
        }  

        // clonedMaterialRef.copy(standardMaterial)
        // clonedMaterialRef.emissive.setRGB(0, 0, 0);
        // clonedMaterialRef.emissiveIntensity = 0;
        // clonedMaterialRef.roughness = 1; // Non-reflective
        // clonedMaterialRef.metalness = 0; // Non-metallic
        // clonedMaterialRef.clearcoat = 0; // No clearcoat
        // clonedMaterialRef.clearcoatRoughness = 1; // No glossiness in clearcoat
        // clonedMaterialRef.transparent = true; // Ensure transparency is enabled
        // clonedMaterialRef.opacity = 1; // Fully opaque (adjust if needed)

        // clonedMaterialRef.color.setRGB(...highlight)
        // clonedMaterialRef.color.setRGB(0.96, 0.55, 0.7);
      } else {
        meshRef.current.material = clonedMaterialRef
      }
    }
  }, [pressed]);


  return (
    <group {...props} dispose={null}>
      <motion.group 
               initial={"open"}
               animate={pressed? "pressed" : "open"}
               transition={{ delay: 0, duration: 0.05, ease: "easeInOut"}}
               variants={variants}
              >
        <mesh 
              // ref={modelRef}
              geometry={geometryObject}
              material={clonedMaterialRef} 
              position={pos}
              rotation={[0, Math.PI, 0]}
              ref={meshRef}
              castShadow
              receiveShadow
              />
      </motion.group>
    </group>
  );
}

function Scaffold2(props) {
  const { noteNumber, pos, materials, color, geometryObject} = props;


  const stateRef = useRef(useStore.getState()[noteNumber])
  // console.log("stateRef: ", stateRef)

  // useEffect(()=> {
  //   console.log("useEffect stateRed: ", stateRef)
  //   console.log("noteNumber: ", noteNumber)
  // }, [stateRef.current])
  // const { pressed, duration } = useStore(
  //   useShallow((state) => ({ pressed: state[noteNumber].pressed, duration: state[noteNumber].duration })),
  // )
  const meshRef = useRef();
  const clonedMaterialRef = useRef(new MeshStandardMaterial()).current;
  useEffect(() => useStore.subscribe(
    state => (stateRef.current = state[noteNumber])
  ), [])

 const originalMaterialRef = useRef()
  useEffect(() => {
    if (meshRef.current) {
      // Store the original material
      originalMaterialRef.current = meshRef.current.material;
    }
  }, []); 


  useEffect(() => {
    // console.log("noteNumber: ", noteNumber)
    // console.log(stateRef.current)

    if (materials[color]) {
      clonedMaterialRef.copy(materials[color]);
      if (stateRef.current) {
        clonedMaterialRef.emissive.setRGB(1, 0, 0);
        clonedMaterialRef.color.setRGB(0.96, 0.55, 0.7);
      }
    }
  }, [stateRef.current]);

  let needsReset = false

  useFrame(() => {
    // console.log("stateRefCurrent useframe: ", stateRef.current)
    if (stateRef.current) {
      needsReset=true
      meshRef.current.rotation.z = -0.01;
      meshRef.current.material.emissive.setRGB(1, 0, 0);
      meshRef.current.material.color.setRGB(0.96, 0.55, 0.7);
    } else {
      if (needsReset) {
        meshRef.current.rotation.z = 0;
        meshRef.current.material.copy(materials[color]);
        needsReset = false;
      }
    }
  });

  return (
    <group {...props} dispose={null}>
      {/* <motion.group 
               initial={"open"}
               animate={pressed? "pressed" : "open"}
               transition={{ delay: 0, duration: 0.05, ease: "easeInOut"}}
               variants={variants}
              > */}
        <mesh 
              geometry={geometryObject}
              material={clonedMaterialRef} 
              position={pos}
              rotation={[0, Math.PI, 0]}
              ref={meshRef}
              />
      {/* </motion.group> */}
    </group>
  );
}

// export function A_rot(props) {
//   const {  pos} = props
//   const { nodes, materials } = useGLTF('/rotated/a_rotated_new2-transformed.glb')

//   return (
//     <Scaffold noteNumber={2} pos={pos} nodes={nodes} materials={materials} color={"white"} geometryObject={nodes.Cube1051.geometry}/>
//   )
// }



export function C(props) {
  const { noteNumber, pos} = props;
  const { nodes, materials } = useGLTF('/c-transformed.glb');
  
  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"white"} geometryObject={nodes.Cube1051.geometry} />
  )

  // const { pressed, duration } = useStore(
  //   useShallow((state) => ({ pressed: state[noteNumber].pressed, duration: state[noteNumber].duration })),
  // )
  // const meshRef = useRef();
  // const clonedMaterialRef = useRef(new MeshStandardMaterial()).current;

  // useEffect(() => {
  //   if (materials.black) {
  //     clonedMaterialRef.copy(materials.white);
  //     if (pressed) {
  //       clonedMaterialRef.emissive.setRGB(1, 0, 0);
  //       clonedMaterialRef.color.setRGB(0.96, 0.55, 0.7);
  //     }
  //   }
  // }, [pressed]);
  // return (
  //   <group {...props} dispose={null}>
  //     <motion.group 
  //             initial={"open"}
  //             animate={pressed? "pressed" : "open"}
  //             transition={{ delay: 0, duration: 0.05, ease: "easeInOut"}}
  //             variants={variants}
  //             >
  //       <mesh 
  //             geometry={nodes.Cube1051.geometry}
  //             material={clonedMaterialRef} 
  //             position={pos}
  //             // position={pos}
  //             // position={[-8.152, 0.556, 0.57 ]}
  //             rotation={[0, Math.PI, 0]}
  //             ref={meshRef}
  //             />
  //     </motion.group>
  //   </group>
  // );
}

export function C_Sharp(props) {

  const { noteNumber, pos} = props
  const { nodes, materials } = useGLTF('/c_sharp-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"black"} geometryObject={nodes.Black.geometry}/>
  )

  // const note_store = useStore(state => state[noteNumber])

  // const meshRef = useRef();
  // const clonedMaterial = useRef(new MeshStandardMaterial()).current;
  // const { nodes, materials } = useGLTF('/c_sharp-transformed.glb')
  // const { pressed, duration } = useStore(
  //   useShallow((state) => ({ pressed: state[noteNumber].pressed, duration: state[noteNumber].duration })),
  // )
  // useEffect(() => {

  //   if (materials.black) {
  //     clonedMaterial.copy(materials.black);
  //     if (pressed) {
  //       clonedMaterial.emissive.setRGB(0.9, 0, 0);
  //       clonedMaterial.color.setRGB(0.2, 0.1, 0.2);
  //     }
  //   }
  // }, [pressed]);

  // const positionFactor = (octave-4)*7*2.55
  // return (
  //   <group {...props} dispose={null} >
  //       <motion.group 
            
  //           initial={"open"}
  //           animate={pressed ? "pressed" : "open"}
  //           transition={{ delay: 0, duration: 0.05, ease: "easeInOut"}}
  //           variants={variants}
  //           >
  //         <mesh 
  //           geometry={nodes.Black.geometry} 
  //           material={clonedMaterial} 
  //           position={pos}
  //           rotation={[0,Math.PI, 0]}
  //           ref={meshRef}  
  //           // castShadow 
  //           />
  //     </motion.group>
  //   </group>
  // )
  
}

export function D(props) {

  const { noteNumber, pos} = props
  const { nodes, materials } = useGLTF('/d-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"white"} geometryObject={nodes.Cube1055.geometry}/>
  )

  // const { pressed, duration } = useStore(
  //   useShallow((state) => ({ pressed: state[noteNumber].pressed, duration: state[noteNumber].duration })),
  // )
  // const meshRef = useRef();

  // const clonedMaterial = useRef(new MeshStandardMaterial()).current;
  // useEffect(() => {

  //   if (materials.white) {
  //     clonedMaterial.copy(materials.white);
  //     if (pressed) {
  //       clonedMaterial.emissive.setRGB(1, 0, 0);
  //       clonedMaterial.color.setRGB(0.96, 0.55, 0.7);
  //     }
  //   }
  // }, [pressed]);

  // return (
  //   <group {...props} dispose={null} >
  //     <motion.group 
  //           initial={"open"}
  //           animate={pressed ? "pressed" : "open"}
  //           transition={{ delay: 0, duration: 0.05, ease: "easeInOut"}}
  //           variants={variants}
  //           >
  //       <mesh 
  //         geometry={nodes.Cube1055.geometry} 
  //         material={clonedMaterial} 
  //         position={pos}
  //         rotation={[0,Math.PI, 0]}
  //         ref={meshRef}
  //         />
  //       {/* <mesh geometry={nodes.Cube1055_1.geometry} material={materials.Material} /> */}
  //     </motion.group>
  //   </group>
  // )
}

export function D_Sharp(props) {
  const { noteNumber, pos} = props
  const { nodes, materials } = useGLTF('/d_sharp-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"black"} geometryObject={nodes.Black001.geometry}/>
  )

  // const { pressed, duration } = useStore(
  //   useShallow((state) => ({ pressed: state[noteNumber].pressed, duration: state[noteNumber].duration })),
  // )
  // const meshRef = useRef();
  // const clonedMaterial = useRef(new MeshStandardMaterial()).current;

  // useEffect(() => {

  //   if (materials.black) {
  //     clonedMaterial.copy(materials.black);
  //     if (pressed) {
  //       clonedMaterial.emissive.setRGB(0.9, 0, 0);
  //       clonedMaterial.color.setRGB(0.2, 0.1, 0.2);
  //     }
  //   }
  // }, [pressed]);

  // return (
  //   <group {...props} dispose={null} >
  //     <motion.group
  //       initial={"open"}
  //       animate={pressed ? "pressed" : "open"}
  //       transition={{ delay: 0, duration: 0.05, ease: "easeInOut"}}
  //       variants={variants}>
  //         <mesh geometry={nodes.Black001.geometry} 
  //               material={clonedMaterial} 
  //               position={pos}
  //               rotation={[0,Math.PI, 0]}
  //               ref={meshRef}
  //               // castShadow 
  //               />
  //     </motion.group>
  //   </group>
  // )
}


export function E(props) {
  const { noteNumber, pos } = props
  const { nodes, materials } = useGLTF('/e-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"white"} geometryObject={nodes.Cube1056.geometry}/>
  )

  // const { pressed, duration } = useStore(
  //   useShallow((state) => ({ pressed: state[noteNumber].pressed, duration: state[noteNumber].duration })),
  // )
  // const meshRef = useRef();

  // const clonedMaterial = useRef(new MeshStandardMaterial()).current;
  // useEffect(() => {

  //   if (materials.white) {
  //     clonedMaterial.copy(materials.white);
  //     // clonedMaterial.emissive.setRGB(0.01, 1, 1);
  //     // clonedMaterial.color.setRGB(1, 0.1, 0.1);
  //     if (pressed) {
  //       clonedMaterial.emissive.setRGB(1, 0, 0);
  //       clonedMaterial.color.setRGB(0.96, 0.55, 0.7);
  //     }
  //   }
  // }, [pressed]);

  // return (
  //   <group {...props} dispose={null} >
  //     <motion.group 
          
  //         initial={"open"}
  //         animate={pressed ? "pressed" : "open"}
  //         transition={{ delay: 0, duration: 0.05, ease: "easeInOut"}}
  //         variants={variants}>
  //       <mesh 
  //         geometry={nodes.Cube1056.geometry} 
  //         material={clonedMaterial} 
  //         position={pos}
  //         rotation={[0,Math.PI, 0]}
  //         ref={meshRef}
  //         />
  //       {/* <mesh geometry={nodes.Cube1056_1.geometry} material={materials.Material} /> */}
  //     </motion.group>
  //   </group>
  // )
}

export function F(props) {
  const { noteNumber, pos } = props
  const { nodes, materials } = useGLTF('/f-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"white"} geometryObject={nodes.Cube1057.geometry}/>
  )

  // const { pressed, duration } = useStore(
  //   useShallow((state) => ({ pressed: state[noteNumber].pressed, duration: state[noteNumber].duration })),
  // )
  // const meshRef = useRef();

  // const clonedMaterial = useRef(new MeshStandardMaterial()).current;
  // useEffect(() => {

  //   if (materials.white) {
  //     clonedMaterial.copy(materials.white);
  //     if (pressed) {
  //       clonedMaterial.emissive.setRGB(1, 0, 0);
  //       clonedMaterial.color.setRGB(0.96, 0.55, 0.7);
  //     }
  //   }
  // }, [pressed]);

  // return (
  //   <group {...props} dispose={null} >
  //     <motion.group 
          
  //         initial={"open"}
  //         animate={pressed ? "pressed" : "open"}
  //         transition={{ delay: 0, duration: 0.05, ease: "easeInOut"}}
  //         variants={variants}
  //         >
  //       <mesh geometry={nodes.Cube1057.geometry} 
  //             material={clonedMaterial} 
  //             position={pos}
  //             rotation={[0,Math.PI, 0]}
  //             ref={meshRef}/>
  //       {/* <mesh geometry={nodes.Cube1057_1.geometry} material={materials.Material} /> */}
  //     </motion.group>
  //   </group>
  // )
}

export function F_Sharp(props) {
  const { noteNumber, pos} = props
  const { nodes, materials } = useGLTF('/f_sharp-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"black"} geometryObject={nodes.Black002.geometry}/>
  )

  // const { pressed, duration } = useStore(
  //   useShallow((state) => ({ pressed: state[noteNumber].pressed, duration: state[noteNumber].duration })),
  // )
  // const meshRef = useRef();
  // const clonedMaterial = useRef(new MeshStandardMaterial()).current;

  // useEffect(() => {
  //   if (materials.black) {
  //     clonedMaterial.copy(materials.black);
  //     if (pressed) {
  //       clonedMaterial.emissive.setRGB(0.9, 0, 0);
  //       clonedMaterial.color.setRGB(0.2, 0.1, 0.2);
  //     }
  //   }
  // }, [pressed]);

  // return (
  //   <group {...props} dispose={null} >
  //     <motion.group
  //       initial={"open"}
  //       animate={pressed ? "pressed" : "open"}
  //       transition={{ delay: 0, duration: 0.05, ease: "easeInOut"}}
  //       variants={variants}>

  //       <mesh geometry={nodes.Black002.geometry} 
  //             material={clonedMaterial} 
  //             position={pos}
  //             rotation={[0,Math.PI, 0]}
  //             ref={meshRef}
  //             // castShadow
  //             />
  //     </motion.group>
  //   </group>
  // )
}

export function G(props) {
  const { noteNumber, pos } = props
  const { nodes, materials } = useGLTF('/g-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"white"} geometryObject={nodes.Cube1058.geometry}/>
  )
  // const { pressed, duration } = useStore(
  //   useShallow((state) => ({ pressed: state[noteNumber].pressed, duration: state[noteNumber].duration })),
  // )
  // const meshRef = useRef();

  // const clonedMaterial = useRef(new MeshStandardMaterial()).current;
  // useEffect(() => {
  //   if (materials.white) {
  //     clonedMaterial.copy(materials.white);
  //     if (pressed) {
  //       clonedMaterial.emissive.setRGB(1, 0, 0);
  //       clonedMaterial.color.setRGB(0.96, 0.55, 0.7);
  //     }
  //   }
  // }, [pressed]);

  // return (
  //   <group {...props} dispose={null} >
  //     <motion.group 
  //         initial={"open"}
  //         animate={pressed ? "pressed" : "open"}
  //         transition={{ delay: 0, duration: 0.05, ease: "easeInOut"}}
  //         variants={variants}
  //         >
  //       <mesh  geometry={nodes.Cube1058.geometry} 
  //              material={clonedMaterial}
  //              position={pos}
  //              rotation={[0,Math.PI, 0]}
  //              ref={meshRef} />
  //       {/* <mesh geometry={nodes.Cube1058_1.geometry} material={materials.Material} /> */}
  //     </motion.group>
  //   </group>
  // )
}

export function G_Sharp(props) {
  const { noteNumber, pos } = props
  const { nodes, materials } = useGLTF('/g_sharp-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"black"} geometryObject={nodes.Black003.geometry}/>
  )
  // const { pressed, duration } = useStore(
  //   useShallow((state) => ({ pressed: state[noteNumber].pressed, duration: state[noteNumber].duration })),
  // )
  // const meshRef = useRef();
  // const clonedMaterial = useRef(new MeshStandardMaterial()).current;

  // useEffect(() => {
  //   if (materials.black) {
  //     clonedMaterial.copy(materials.black);
  //     if (pressed) {
  //       clonedMaterial.emissive.setRGB(0.9, 0, 0);
  //       clonedMaterial.color.setRGB(0.2, 0.1, 0.2);
  //     }
  //   }
  // }, [pressed]);
  // return (
  //   <group {...props} dispose={null}>
  //     <motion.group
  //       initial={"open"}
  //       animate={pressed ? "pressed" : "open"}
  //       transition={{ delay: 0, duration: 0.05, ease: "easeInOut"}}
  //       variants={variants}
  //       >
  //       <mesh geometry={nodes.Black003.geometry} 
  //             material={clonedMaterial} 
  //             position={pos}
  //             rotation={[0,Math.PI, 0]}
  //             ref={meshRef}
  //             // castShadow
  //             />
  //     </motion.group>
  //   </group>
  // )
}

export function A(props) {
  const { noteNumber, pos } = props
  const { nodes, materials } = useGLTF('/a-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"white"} geometryObject={nodes.Cube1059.geometry}/>
  )

  // const { pressed, duration } = useStore(
  //   useShallow((state) => ({ pressed: state[noteNumber].pressed, duration: state[noteNumber].duration })),
  // )
  // const meshRef = useRef();

  // const clonedMaterial = useRef(new MeshStandardMaterial()).current;
  // useEffect(() => {
  //   if (materials.white) {
  //     clonedMaterial.copy(materials.white);
   
  //     if (pressed) {
  //       clonedMaterial.emissive.setRGB(1, 0, 0);
  //       clonedMaterial.color.setRGB(0.96, 0.55, 0.7);
  //     }
  //   }
  // }, [pressed]);

  // return (
  //   <group {...props} dispose={null}>
  //     <group name="Scene">
  //       <motion.group name="White005" 
  //           initial={"open"}
  //           animate={pressed ? "pressed" : "open"}
  //           transition={{ delay: 0, duration: 0.05, ease: "easeInOut"}}
  //           variants={variants}
  //           >
  //         <mesh name="Cube1059" 
  //           geometry={nodes.Cube1059.geometry} 
  //           material={clonedMaterial} 
  //           position={pos}
  //           rotation={[0, Math.PI,0]}
  //           ref={meshRef} 
  //           />
  //         {/* <mesh name="Cube1059_1" geometry={nodes.Cube1059_1.geometry} material={materials.Material} /> */}
  //       </motion.group>
  //     </group>
  //   </group>
  // )
}


export function A_Sharp(props) {
  const { noteNumber, pos } = props
  const { nodes, materials } = useGLTF('/a_sharp-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"black"} geometryObject={nodes.Black004.geometry}/>
  )

  // const { pressed, duration } = useStore(
  //   useShallow((state) => ({ pressed: state[noteNumber].pressed, duration: state[noteNumber].duration })),
  // )
  // const meshRef = useRef();
  // const clonedMaterial = useRef(new MeshStandardMaterial()).current;

  // useEffect(() => {
  //   if (materials.black) {
  //     clonedMaterial.copy(materials.black);
  //     if (pressed) {
  //       clonedMaterial.emissive.setRGB(0.9, 0, 0);
  //       clonedMaterial.color.setRGB(0.2, 0.1, 0.2);
  //     }
  //   }
  // }, [pressed]);
  // return (
  //   <group {...props} dispose={null}>
  //     <motion.group 
  //     initial={"open"}
  //     animate={pressed ? "pressed" : "open"}
  //     transition={{ delay: 0, duration: 0.05, ease: "easeInOut"}}
  //     variants={variants}
  //     >

  //     <mesh geometry={nodes.Black004.geometry} 
  //           material={clonedMaterial}
  //           // position={[-8.094, -0.052, -13.879]} 
  //           // position={pos}
  //           rotation={[0,Math.PI, 0]}
  //           position={pos}
  //           ref={meshRef} 
  //           // castShadow
  //           />
  //     </motion.group>
  //   </group>
  // )
}

export function B(props) {
  const { noteNumber, pos } = props
  const { nodes, materials } = useGLTF('/b-transformed.glb')

  return (
    <Scaffold noteNumber={noteNumber} pos={pos} nodes={nodes} materials={materials} color={"white"} geometryObject={nodes.Cube1060.geometry}/>
  )

  // const { pressed, duration } = useStore(
  //   useShallow((state) => ({ pressed: state[noteNumber].pressed, duration: state[noteNumber].duration })),
  // )
  // const meshRef = useRef();
  // const clonedMaterial = useRef(new MeshStandardMaterial()).current;

  // useEffect(() => {
  //   if (materials.white) {
  //     clonedMaterial.copy(materials.white);
  //     // clonedMaterial.emissive.setRGB(0.01, 1, 1);
  //     // clonedMaterial.color.setRGB(1, 0.1, 0.1);
  //     if (pressed ) {
  //       clonedMaterial.emissive.setRGB(1, 0, 0);
  //       clonedMaterial.color.setRGB(0.96, 0.55, 0.7);
  //     }
  //   }
  // }, [pressed]);

  // return (
  //   <group {...props} dispose={null} >
  //     <motion.group 
  //      initial={"open"}
  //       animate={pressed ? "pressed" : "open"}
  //       transition={{ delay: 0, duration: 0.05, ease: "easeInOut"}}
  //       variants={variants}
  //       >
  //       <mesh geometry={nodes.Cube1060.geometry} 
  //           material={clonedMaterial}
  //           position={pos}
  //           rotation={[0,Math.PI, 0]}
  //           ref={meshRef}
  //           />
  //       {/* <mesh geometry={nodes.Cube1060_1.geometry} material={materials.Material} /> */}
  //     </motion.group>
  //   </group>
  // )
}