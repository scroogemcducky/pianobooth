import React, { useEffect, useMemo, useRef, createContext, useContext } from 'react'
import { useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import useStore from '../../store/keyPressStore'
import { scalingFactor } from '../../utils/functions'
import { BLACK_KEY_COLOR, WHITE_KEY_COLOR } from '../../utils/constants'
import {
  BASE_NOTE_NUMBER,
  DEFAULT_PIANO_LAYOUT,
  OCTAVE_WIDTH,
  type PianoLayout,
  getKeyboardMetrics,
  getKeyboardWidth,
} from '../../utils/pianoLayout'

const BLOOM_LAYER = 1

function setBloomLayer(object: THREE.Object3D | null, enabled: boolean) {
  if (!object) return
  if (enabled) object.layers.enable(BLOOM_LAYER)
  else object.layers.disable(BLOOM_LAYER)
}

// Context for dynamic key colors
type KeyMaterialsContextType = {
  blackMaterial: THREE.MeshBasicMaterial
  whiteMaterial: THREE.MeshBasicMaterial
}

const KeyMaterialsContext = createContext<KeyMaterialsContextType | null>(null)

function useKeyMaterials() {
  const context = useContext(KeyMaterialsContext)
  if (!context) {
    // Fallback to default materials
    return {
      blackMaterial: new THREE.MeshBasicMaterial({ color: new THREE.Color(...BLACK_KEY_COLOR) }),
      whiteMaterial: new THREE.MeshBasicMaterial({ color: new THREE.Color(...WHITE_KEY_COLOR) }),
    }
  }
  return context
}

type RecordKeysProps = {
  layout?: PianoLayout | null
  scaleMultiplier?: number
  scaleFillRatio?: number
  scaleMax?: number
  blackKeyColor?: number[]
  whiteKeyColor?: number[]
}

const RecordKeys: React.FC<RecordKeysProps> = ({
  layout,
  scaleMultiplier = 1.5,
  scaleFillRatio = 1,
  scaleMax = 2,
  blackKeyColor,
  whiteKeyColor,
}) => {
  const { viewport } = useThree()
  const activeLayout = layout ?? DEFAULT_PIANO_LAYOUT
  const octaveIndices = useMemo(
    () => Array.from({ length: activeLayout.octaveCount }, (_, idx) => activeLayout.startOctave + idx),
    [activeLayout.startOctave, activeLayout.octaveCount],
  )

  // Create dynamic materials based on props
  const materials = useMemo(() => {
    const black = blackKeyColor ?? BLACK_KEY_COLOR
    const white = whiteKeyColor ?? WHITE_KEY_COLOR
    return {
      blackMaterial: new THREE.MeshBasicMaterial({ color: new THREE.Color(...black) }),
      whiteMaterial: new THREE.MeshBasicMaterial({ color: new THREE.Color(...white) }),
    }
  }, [blackKeyColor?.[0], blackKeyColor?.[1], blackKeyColor?.[2], whiteKeyColor?.[0], whiteKeyColor?.[1], whiteKeyColor?.[2]])

  const totalKeyboardWidth = getKeyboardWidth(activeLayout)
  const scaleFactor = scalingFactor(viewport.width, totalKeyboardWidth, {
    multiplier: scaleMultiplier,
    fillRatio: scaleFillRatio,
    maxScale: scaleMax,
  })
  const { keyboardY, screenBottom } = getKeyboardMetrics(viewport.height, scaleFactor)

  return (
    <KeyMaterialsContext.Provider value={materials}>
      <group scale={[scaleFactor, scaleFactor, 1]} position={[0, keyboardY, 0]}>
        <group position={[-activeLayout.centerX, 0, 0]}>
          {octaveIndices.map((octaveIndex) => (
            <Octave key={octaveIndex} octaveIndex={octaveIndex} />
          ))}
        </group>
      </group>

      <mesh position={[0, (keyboardY + screenBottom) / 2, 0]}>
        <planeGeometry args={[viewport.width, keyboardY - screenBottom]} />
        <meshBasicMaterial color="black" />
      </mesh>
    </KeyMaterialsContext.Provider>
  )
}

type OctaveProps = {
  octaveIndex: number
}

function Octave({ octaveIndex }: OctaveProps) {
  const groupX = (octaveIndex - 3) * OCTAVE_WIDTH
  const baseNote = BASE_NOTE_NUMBER + octaveIndex * 12
  return (
    <group position={[groupX, 0, 0]}>
      <CKey noteNumber={baseNote} />
      <CSharpKey noteNumber={baseNote + 1} />
      <DKey noteNumber={baseNote + 2} />
      <DSharpKey noteNumber={baseNote + 3} />
      <EKey noteNumber={baseNote + 4} />
      <FKey noteNumber={baseNote + 5} />
      <FSharpKey noteNumber={baseNote + 6} />
      <GKey noteNumber={baseNote + 7} />
      <GSharpKey noteNumber={baseNote + 8} />
      <AKey noteNumber={baseNote + 9} />
      <ASharpKey noteNumber={baseNote + 10} />
      <BKey noteNumber={baseNote + 11} />
    </group>
  )
}

type NoteProps = { noteNumber: number }

function CKey({ noteNumber }: NoteProps) {
  const { nodes, materials }: any = useGLTF('/keys/c.glb')
  const isPressed = useStore((state) => state[noteNumber])
  const { whiteMaterial } = useKeyMaterials()
  const meshRef = useRef<THREE.Mesh | null>(null)
  useEffect(() => setBloomLayer(meshRef.current, isPressed), [isPressed])
  return (
    <group position={[-0.116, 0, -1.695]} rotation={[0, 0, -Math.PI / 2]}>
      <mesh ref={meshRef} geometry={nodes.Cube1051.geometry} material={isPressed ? whiteMaterial : materials.white} />
    </group>
  )
}

function CSharpKey({ noteNumber }: NoteProps) {
  const { nodes, materials }: any = useGLTF('/keys/c_sharp.glb')
  const isPressed = useStore((state) => state[noteNumber])
  const { blackMaterial } = useKeyMaterials()
  const meshRef = useRef<THREE.Mesh | null>(null)
  useEffect(() => setBloomLayer(meshRef.current, isPressed), [isPressed])
  return (
    <group dispose={null}>
      <mesh
        ref={meshRef}
        geometry={nodes.Black.geometry}
        material={isPressed ? blackMaterial : materials.Material}
        position={[1.133, 0, 1.922]}
        rotation={[0, 0, -Math.PI / 2]}
      />
    </group>
  )
}

function DKey({ noteNumber }: NoteProps) {
  const { nodes, materials }: any = useGLTF('/keys/d.glb')
  const isPressed = useStore((state) => state[noteNumber])
  const { whiteMaterial } = useKeyMaterials()
  const meshRef = useRef<THREE.Mesh | null>(null)
  useEffect(() => setBloomLayer(meshRef.current, isPressed), [isPressed])
  return (
    <group position={[2.434, 0, -1.683]} rotation={[0, 0, -Math.PI / 2]}>
      <mesh ref={meshRef} geometry={nodes.Cube1055.geometry} material={isPressed ? whiteMaterial : materials.white} />
    </group>
  )
}

function DSharpKey({ noteNumber }: NoteProps) {
  const { nodes, materials }: any = useGLTF('/keys/d_sharp.glb')
  const isPressed = useStore((state) => state[noteNumber])
  const { blackMaterial } = useKeyMaterials()
  const meshRef = useRef<THREE.Mesh | null>(null)
  useEffect(() => setBloomLayer(meshRef.current, isPressed), [isPressed])
  return (
    <group dispose={null}>
      <mesh
        ref={meshRef}
        geometry={nodes.Black001.geometry}
        material={isPressed ? blackMaterial : materials.Material}
        position={[3.755, 0, 1.922]}
        rotation={[0, 0, -Math.PI / 2]}
      />
    </group>
  )
}

function EKey({ noteNumber }: NoteProps) {
  const { nodes, materials }: any = useGLTF('/keys/e.glb')
  const isPressed = useStore((state) => state[noteNumber])
  const { whiteMaterial } = useKeyMaterials()
  const meshRef = useRef<THREE.Mesh | null>(null)
  useEffect(() => setBloomLayer(meshRef.current, isPressed), [isPressed])
  return (
    <group position={[4.984, 0, -1.683]} rotation={[0, 0, -Math.PI / 2]}>
      <mesh ref={meshRef} geometry={nodes.Cube1056.geometry} material={isPressed ? whiteMaterial : materials.white} />
    </group>
  )
}

function FKey({ noteNumber }: NoteProps) {
  const { nodes, materials }: any = useGLTF('/keys/f.glb')
  const isPressed = useStore((state) => state[noteNumber])
  const { whiteMaterial } = useKeyMaterials()
  const meshRef = useRef<THREE.Mesh | null>(null)
  useEffect(() => setBloomLayer(meshRef.current, isPressed), [isPressed])
  return (
    <group position={[7.534, 0, -1.683]} rotation={[0, 0, -Math.PI / 2]}>
      <mesh ref={meshRef} geometry={nodes.Cube1057.geometry} material={isPressed ? whiteMaterial : materials.white} />
    </group>
  )
}

function FSharpKey({ noteNumber }: NoteProps) {
  const { nodes, materials }: any = useGLTF('/keys/f_sharp.glb')
  const isPressed = useStore((state) => state[noteNumber])
  const { blackMaterial } = useKeyMaterials()
  const meshRef = useRef<THREE.Mesh | null>(null)
  useEffect(() => setBloomLayer(meshRef.current, isPressed), [isPressed])
  return (
    <mesh
      ref={meshRef}
      geometry={nodes.Black002.geometry}
      material={isPressed ? blackMaterial : materials.Material}
      position={[8.816, 0, 1.922]}
      rotation={[0, 0, -Math.PI / 2]}
    />
  )
}

function GKey({ noteNumber }: NoteProps) {
  const { nodes, materials }: any = useGLTF('/keys/g.glb')
  const isPressed = useStore((state) => state[noteNumber])
  const { whiteMaterial } = useKeyMaterials()
  const meshRef = useRef<THREE.Mesh | null>(null)
  useEffect(() => setBloomLayer(meshRef.current, isPressed), [isPressed])
  return (
    <group position={[10.084, 0, -1.692]} rotation={[0, 0, -Math.PI / 2]}>
      <mesh ref={meshRef} geometry={nodes.Cube1058.geometry} material={isPressed ? whiteMaterial : materials.white} />
    </group>
  )
}

function GSharpKey({ noteNumber }: NoteProps) {
  const { nodes, materials }: any = useGLTF('/keys/g_sharp.glb')
  const isPressed = useStore((state) => state[noteNumber])
  const { blackMaterial } = useKeyMaterials()
  const meshRef = useRef<THREE.Mesh | null>(null)
  useEffect(() => setBloomLayer(meshRef.current, isPressed), [isPressed])
  return (
    <mesh
      ref={meshRef}
      geometry={nodes.Black003.geometry}
      material={isPressed ? blackMaterial : materials.Material}
      position={[11.345, 0, 1.922]}
      rotation={[0, 0, -Math.PI / 2]}
    />
  )
}

function AKey({ noteNumber }: NoteProps) {
  const { nodes, materials }: any = useGLTF('/keys/a.glb')
  const isPressed = useStore((state) => state[noteNumber])
  const { whiteMaterial } = useKeyMaterials()
  const meshRef = useRef<THREE.Mesh | null>(null)
  useEffect(() => setBloomLayer(meshRef.current, isPressed), [isPressed])
  return (
    <group position={[12.634, 0, -1.683]} rotation={[0, 0, -Math.PI / 2]}>
      <mesh ref={meshRef} geometry={nodes.Cube1059.geometry} material={isPressed ? whiteMaterial : materials.white} />
    </group>
  )
}

function ASharpKey({ noteNumber }: NoteProps) {
  const { nodes, materials }: any = useGLTF('/keys/a_sharp.glb')
  const isPressed = useStore((state) => state[noteNumber])
  const { blackMaterial } = useKeyMaterials()
  const meshRef = useRef<THREE.Mesh | null>(null)
  useEffect(() => setBloomLayer(meshRef.current, isPressed), [isPressed])
  return (
    <mesh
      ref={meshRef}
      geometry={nodes.Black004.geometry}
      material={isPressed ? blackMaterial : materials.Material}
      position={[13.879, 0, 1.922]}
      rotation={[0, 0, -Math.PI / 2]}
    />
  )
}

function BKey({ noteNumber }: NoteProps) {
  const { nodes, materials }: any = useGLTF('/keys/b.glb')
  const isPressed = useStore((state) => state[noteNumber])
  const { whiteMaterial } = useKeyMaterials()
  const meshRef = useRef<THREE.Mesh | null>(null)
  useEffect(() => setBloomLayer(meshRef.current, isPressed), [isPressed])
  return (
    <group position={[15.184, 0, -1.683]} rotation={[0, 0, -Math.PI / 2]}>
      <mesh ref={meshRef} geometry={nodes.Cube1060.geometry} material={isPressed ? whiteMaterial : materials.white} />
    </group>
  )
}

useGLTF.preload([
  '/keys/c.glb',
  '/keys/c_sharp.glb',
  '/keys/d.glb',
  '/keys/d_sharp.glb',
  '/keys/e.glb',
  '/keys/f.glb',
  '/keys/f_sharp.glb',
  '/keys/g.glb',
  '/keys/g_sharp.glb',
  '/keys/a.glb',
  '/keys/a_sharp.glb',
  '/keys/b.glb',
])

export default RecordKeys
