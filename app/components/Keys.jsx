import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei'
import useStore from '../store/keyPressStore'
import * as THREE from 'three'

const redMaterial = new THREE.MeshStandardMaterial({
  color: 'red',
  roughness: 0.5,
  metalness: 0.2,
  emissive: '#ff3333',
  emissiveIntensity: 0.2
})

const offset = 7*2.55

const Keys = () => {
  const { viewport } = useThree();
  return <>
    <Octave octave={0} />
    <Octave octave={1} />
    <Octave octave={2} />
    <Octave octave={3} />
    <Octave octave={4} />
    <Octave octave={5} />

    <mesh position={[0, -viewport.height/4 , 0]}>
            <planeGeometry args={[viewport.width, viewport.height / 2]} />
            <meshBasicMaterial color="black" />
    </mesh>
    </>;
};


function Octave( { octave }) {
    return (
        <group position={[(octave-3)*offset, 0,0]}>
            <C_new       pitch={"C"}  noteNumber={24 + (octave)*12}/>
            <C_sharp_new pitch={"C#"} noteNumber={25 + (octave)*12}/>
            <D_new       pitch={"D"}  noteNumber={26 + (octave)*12}/>
            <D_sharp_new pitch={"D#"} noteNumber={27 + (octave)*12}/>
            <E_new       pitch={"E"}  noteNumber={28 + (octave)*12}/>
            <F_new       pitch={"F"}  noteNumber={29 + (octave)*12}/>
            <F_sharp_new pitch={"F#"} noteNumber={30 + (octave)*12}/>
            <G_new       pitch={"G"}  noteNumber={31 + (octave)*12}/>
            <G_sharp_new pitch={"G#"} noteNumber={32 + (octave)*12}/>
            <A_new       pitch={"A"}  noteNumber={33 + (octave)*12}/>
            <A_sharp_new pitch={"A#"} noteNumber={34 + (octave)*12}/>
            <B_new       pitch={"B"}  noteNumber={35 + (octave)*12}/>
         </group>
    )
}



function C_new({ noteNumber }) {
    const { nodes, materials } = useGLTF('/c_new-transformed.glb')
    const isPressed = useStore(state => state[noteNumber])
    // Bypass react rendering
    // useEffect(() => {
    //   if (materials[color]) {
    //     clonedMaterialRef.copy(materials[color]);
    //     if (pressed) {
    //       if(meshRef.current) {
    //         meshRef.current.material  = standardMaterial
    //       }  
    //     } else {
    //       meshRef.current.material = clonedMaterialRef
    //     }
    //   }
    // }, [pressed]);
  
    return (
        <group position={[-0.116, 0, -1.695]} rotation={[0, 0, -Math.PI / 2]}>
          <mesh geometry={nodes.Cube1051.geometry} material={isPressed ? redMaterial : materials.white} />
          {/* <mesh geometry={nodes.Cube1051_1.geometry} material={materials.Material} /> */}
        </group>
    )
}
  
function C_sharp_new({ noteNumber }) {
    const isPressed = useStore(state => state[noteNumber])
    const { nodes, materials } = useGLTF('/c_sharp_new-transformed.glb')
    return (
    <group dispose={null}>
        <mesh geometry={nodes.Black.geometry} material={isPressed ? redMaterial : materials.Material} position={[1.133, 0, 1.922]} rotation={[0, 0, -Math.PI / 2]} />
    </group>
    )
}
  
function D_new({ noteNumber}) {
    const isPressed = useStore(state => state[noteNumber])
    const { nodes, materials } = useGLTF('/d_new-transformed.glb')
    return (
        <group position={[2.434, 0, -1.683]} rotation={[0, 0, -Math.PI / 2]}>
            <mesh geometry={nodes.Cube1055.geometry} material={isPressed ? redMaterial : materials.white} />
            {/* <mesh geometry={nodes.Cube1055_1.geometry} material={materials.Material} /> */}
        </group>
    )
}
  
function D_sharp_new({noteNumber}) {
    const isPressed = useStore(state => state[noteNumber])
    const { nodes, materials } = useGLTF('/d_sharp_new-transformed.glb')
    return (
    <group dispose={null}>
        <mesh geometry={nodes.Black001.geometry} material={isPressed ? redMaterial : materials.Material} position={[3.755, 0, 1.922]} rotation={[0, 0, -Math.PI / 2]} />
    </group>
    )
}

function E_new({noteNumber}) {
    const isPressed = useStore(state => state[noteNumber])
    const { nodes, materials } = useGLTF('/e_new-transformed.glb')
    return (
        <group position={[4.984, 0, -1.683]} rotation={[0, 0, -Math.PI / 2]}>
            <mesh geometry={nodes.Cube1056.geometry} material={isPressed ? redMaterial : materials.white} />
            {/* <mesh geometry={nodes.Cube1056_1.geometry} material={materials.Material} /> */}
        </group>
    )
}
    
function F_new({noteNumber}) {
    const isPressed = useStore(state => state[noteNumber])
    const { nodes, materials } = useGLTF('/f_new-transformed.glb')
    return (
        <group position={[7.534, 0, -1.683]} rotation={[0, 0, -Math.PI / 2]}>
            <mesh geometry={nodes.Cube1057.geometry} material={isPressed ? redMaterial : materials.white} />
            {/* <mesh geometry={nodes.Cube1057_1.geometry} material={materials.Material} /> */}
        </group>
    )
}

function F_sharp_new({noteNumber}) {
    const isPressed = useStore(state => state[noteNumber])
    const { nodes, materials } = useGLTF('/f_sharp_new-transformed.glb')
    return (
        <mesh geometry={nodes.Black002.geometry} material={isPressed ? redMaterial : materials.Material} position={[8.816, 0, 1.922]} rotation={[0, 0, -Math.PI / 2]} />
    )
}
    
function G_new({noteNumber}) {
    const isPressed = useStore(state => state[noteNumber])
    const { nodes, materials } = useGLTF('/g_new-transformed.glb')
    return (
        <group position={[10.084, 0, -1.692]} rotation={[0, 0, -Math.PI / 2]}>
            <mesh geometry={nodes.Cube1058.geometry} material={isPressed ? redMaterial : materials.white} />
            {/* <mesh geometry={nodes.Cube1058_1.geometry} material={materials.Material} /> */}
        </group>
    )
}

function G_sharp_new({noteNumber}) {
    const isPressed = useStore(state => state[noteNumber])
    const { nodes, materials } = useGLTF('/g_sharp_new-transformed.glb')
    return (

        <mesh geometry={nodes.Black003.geometry} material={isPressed ? redMaterial : materials.Material} position={[11.345, 0, 1.922]} rotation={[0, 0, -Math.PI / 2]} />

    )
}
    
function A_new({noteNumber}) {
    const isPressed = useStore(state => state[noteNumber])
    const { nodes, materials } = useGLTF('/a_new-transformed.glb')
    return (
        <group position={[12.634, 0, -1.683]} rotation={[0, 0, -Math.PI / 2]}>
        <mesh geometry={nodes.Cube1059.geometry} material={isPressed ? redMaterial : materials.white} />
        {/* <mesh geometry={nodes.Cube1059_1.geometry} material={materials.Material} /> */}
        </group>
    )
}
    
  
function A_sharp_new({noteNumber}) {
    const isPressed = useStore(state => state[noteNumber])
    const { nodes, materials } = useGLTF('/a_sharp_new-transformed.glb')
    return (
        <mesh geometry={nodes.Black004.geometry} material={isPressed ? redMaterial : materials.Material} position={[13.879, 0, 1.922]} rotation={[0, 0, -Math.PI / 2]} />
    )
}
    
function B_new({noteNumber}) {
    const isPressed = useStore(state => state[noteNumber])
    const { nodes, materials } = useGLTF('/b_new-transformed.glb')
    return (
        <group position={[15.184, 0, -1.683]} rotation={[0, 0, -Math.PI / 2]}>
        <mesh geometry={nodes.Cube1060.geometry} material={isPressed ? redMaterial : materials.white} />
        {/* <mesh geometry={nodes.Cube1060_1.geometry} material={materials.Material} /> */}
        </group>
    )
}
    
  
  useGLTF.preload(['/c_new-transformed.glb', '/c_sharp_new-transformed.glb', '/d_new-transformed.glb', '/d_sharp_new-transformed.glb', '/e_new-transformed.glb', '/f_new-transformed.glb', '/f_sharp_new-transformed.glb', '/g_new-transformed.glb', '/g_sharp_new-transformed.glb', '/a_new-transformed.glb', '/a_sharp_new-transformed.glb', '/b_new-transformed.glb'])
  
  

export default Keys;