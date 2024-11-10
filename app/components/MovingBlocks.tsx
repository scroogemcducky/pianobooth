import { useEffect, useState, useRef, useMemo } from "react";
import { useThree, useFrame } from '@react-three/fiber';
import {  Object3D, Color, PlaneGeometry, MeshBasicMaterial } from 'three';
import {factor, speed, white_size_vector, black_width, white_width, white_color, black_color} from '../utils/constants';
import { y, calculateHeight, isBlack, groupByDelta } from '../utils/functions.js';

let idx = 0

function MovingBlocks({ playing, triggerVisibleNote, midiObject }) {
    
  const { viewport } = useThree();
  const [blocks, setBlocks] = useState([]);
  const [groupedBlocks, setGroupedBlocks] = useState([]);
  const [keys, setKeys] = useState([]);

  const meshRef = useRef();
  const timeRef = useRef(0);


  const half_screen = viewport.height / 2;
  const distance = viewport.height - (white_size_vector.x + 5);
  const firstNoteDelta = midiObject[0] ? parseInt(midiObject[0].Delta / 1000) - 1000 : 0;

  useEffect(() => {
    if (midiObject) {
      const newBlocks = midiObject.map((note, index) => {
        const height = calculateHeight(note.Duration, distance) / factor;
        const position = y(note, height, distance, half_screen, firstNoteDelta);
        return {
          id: `${index}`,
          noteNumber: note.NoteNumber,
          soundDuration: note.SoundDuration,
          delta: parseInt(note.Delta / 1000) - firstNoteDelta + (factor - 1) * 1000,
          duration: note.Duration / 1000000,
          height: height,
          width: isBlack(note.NoteNumber) ? (black_width) : (white_width-0.1),
          color: isBlack(note.NoteNumber) ? black_color : white_color,
          position: position,
        };
      });

      const grouped = groupByDelta(newBlocks);
      setBlocks(newBlocks);
      setGroupedBlocks(grouped);
      setKeys(grouped.map(obj => parseInt(Object.keys(obj)[0])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midiObject, viewport.height]);

  const tempObject = useMemo(() => new Object3D(), []);
  tempObject.rotation.set(-Math.PI/2, 0, -Math.PI/2);

  const tempColor = useMemo(() => new Color(), []);
  const geometry = useMemo(() => new PlaneGeometry(1, 1), []);
  const material = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0.75 }), []);

  useFrame((_, delta) => {
    if (meshRef.current && playing && blocks.length > 0) {
      const speed_in_seconds = speed * 1000;
      timeRef.current += delta * speed_in_seconds;

      const movement = (distance * delta * speed) / factor;

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
      }

      meshRef.current.instanceMatrix.needsUpdate = true;
      meshRef.current.instanceColor.needsUpdate = true;

      while (idx < keys.length && timeRef.current >= keys[idx]) {
        const currentBlocks = groupedBlocks[idx][keys[idx]];
        currentBlocks.forEach(block => {
          triggerVisibleNote(block.noteNumber, block.duration * 1000 / speed);
        });
        idx += 1;
      }
    }
  });

  if (!midiObject || blocks.length === 0) {
    return null; 
  }

  return (
    <instancedMesh 
      ref={meshRef} 
      args={[geometry, material, blocks.length]}
    />
  );
}

export default MovingBlocks;