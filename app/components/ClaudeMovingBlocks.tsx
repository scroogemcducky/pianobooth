import { useEffect, useRef, useMemo } from "react";
import { useThree, useFrame } from '@react-three/fiber';
import { Object3D, Color, PlaneGeometry, MeshBasicMaterial } from 'three';
import { factor, speed, white_size_vector, black_width, white_width, white_color, black_color } from '../utils/constants';
import { y, calculateHeight, isBlack, groupByDelta } from '../utils/functions.js';

function MovingBlocks({ playing, triggerVisibleNote, midiObject }) {
  const { viewport } = useThree();
  
  // Refs for persistent values
  const meshRef = useRef();
  const timeRef = useRef(0);
  const blocksRef = useRef([]);
  const idxRef = useRef(0);
  const groupedBlocksRef = useRef([]);
  const keysRef = useRef([]);

  // Memoized constants
  const sceneConstants = useMemo(() => ({
    half_screen: viewport.height / 2,
    distance: viewport.height - (white_size_vector.x + 5),
    firstNoteDelta: midiObject?.[0] ? parseInt(midiObject[0].Delta / 1000) - 1000 : 0
  }), [viewport.height, midiObject]);

  // Memoized Three.js objects
  const staticObjects = useMemo(() => ({
    tempObject: new Object3D(),
    tempColor: new Color(),
    geometry: new PlaneGeometry(1, 1),
    material: new MeshBasicMaterial({ transparent: true, opacity: 0.55 })
  }), []);

  // Initialize tempObject rotation once
  staticObjects.tempObject.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);

  // Process MIDI data
  useEffect(() => {
    if (!midiObject) return;

    const { distance, half_screen, firstNoteDelta } = sceneConstants;

    const newBlocks = midiObject.map((note, index) => {
      const height = calculateHeight(note.Duration, distance) / factor;
      const position = y(note, height, distance, half_screen, firstNoteDelta);
      
      return {
        id: index,
        noteNumber: note.NoteNumber,
        soundDuration: note.SoundDuration,
        delta: parseInt(note.Delta / 1000) - firstNoteDelta + (factor - 1) * 1000,
        duration: note.Duration / 1000000,
        height,
        width: isBlack(note.NoteNumber) ? black_width : (white_width - 0.1),
        color: isBlack(note.NoteNumber) ? black_color : white_color,
        position: position.slice(), // Create a copy of the position array
      };
    });

    const grouped = groupByDelta(newBlocks);
    
    blocksRef.current = newBlocks;
    groupedBlocksRef.current = grouped;
    keysRef.current = grouped.map(obj => parseInt(Object.keys(obj)[0]));
    idxRef.current = 0;
    timeRef.current = 0;

    // Initial setup of instances
    if (meshRef.current) {
      updateInstances(newBlocks, staticObjects.tempObject, staticObjects.tempColor, meshRef.current);
    }
  }, [midiObject, sceneConstants]);

  // Animation frame
  useFrame((_, delta) => {
    if (!meshRef.current || !playing || blocksRef.current.length === 0) return;

    const { distance } = sceneConstants;
    const { tempObject, tempColor } = staticObjects;
    const blocks = blocksRef.current;
    
    const speed_in_seconds = speed * 1000;
    timeRef.current += delta * speed_in_seconds;

    const movement = (distance * delta * speed) / factor;

    // Update positions and matrices
    let needsUpdate = false;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      block.position[0] -= movement;

      tempObject.position.set(
        block.position[0],
        block.position[1],
        block.position[2]
      );

      tempObject.scale.set(block.width, block.height, 1);
      tempObject.updateMatrix();
      
      meshRef.current.setMatrixAt(i, tempObject.matrix);
      tempColor.set(block.color);
      meshRef.current.setColorAt(i, tempColor);
      
      needsUpdate = true;
    }

    if (needsUpdate) {
      meshRef.current.instanceMatrix.needsUpdate = true;
      meshRef.current.instanceColor.needsUpdate = true;
    }

    // Trigger notes
    while (idxRef.current < keysRef.current.length && 
           timeRef.current >= keysRef.current[idxRef.current]) {
      const currentKey = keysRef.current[idxRef.current];
      const currentBlocks = groupedBlocksRef.current[idxRef.current][currentKey];
      
      currentBlocks.forEach(block => {
        triggerVisibleNote(block.noteNumber, block.duration * 1000 / speed);
      });
      
      idxRef.current++;
    }
  });

  if (!midiObject || blocksRef.current.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      ref={meshRef}
      args={[staticObjects.geometry, staticObjects.material, blocksRef.current.length]}
    />
  );
}

// Helper function to update instances
function updateInstances(blocks, tempObject, tempColor, mesh) {
  blocks.forEach((block, i) => {
    tempObject.position.set(
      block.position[0],
      block.position[1],
      block.position[2]
    );
    tempObject.scale.set(block.width, block.height, 1);
    tempObject.updateMatrix();
    mesh.setMatrixAt(i, tempObject.matrix);
    tempColor.set(block.color);
    mesh.setColorAt(i, tempColor);
  });

  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
}

export default MovingBlocks;