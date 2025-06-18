import {  useEffect, useState  } from 'react';
import InstancedShaderRectangles from './Instances';
import {factor, speed, white_size_vector, black_width, white_width, white_color, black_color} from '../utils/constants';
import { y_shader, calculateHeight, isBlack, groupByDelta, scalingFactor } from '../utils/functions.js';

import { useThree } from "@react-three/fiber";

function ShaderBlocks({ midiObject, triggerVisibleNote }) {

    const { viewport } = useThree();
    const [blocks, setBlocks] = useState([]);
    const [groupedBlocks, setGroupedBlocks] = useState([]);
    const [notes, setNotes] = useState<number[]>([]); // array of note start times
    const octaves = 6;
    // Calculate the same aggressive scaling factor used in Keys.jsx
    const offset = 7*2.55;
    const totalKeyboardWidth = octaves * offset;
    const scaleFactor = scalingFactor(viewport.width, totalKeyboardWidth)
    // More aggressive scaling - using 0.8 as a multiplier to scale down further
    // const scaleFactor = Math.min(1.1, viewport.width / totalKeyboardWidth * 0.9);

    const half_screen = viewport.height / 2
    
    // Calculate keyboard position using same logic as Keys.jsx
    const whiteKeyHeight = 16;
    const renderedKeyHeight = whiteKeyHeight * scaleFactor;
    const bottomMargin = viewport.height * 0.05;
    const screenBottom = -viewport.height / 2;
    const safeBottom = screenBottom + bottomMargin;
    const maxKeyboardY = safeBottom + renderedKeyHeight;
    const minMovement = viewport.height * 0.05;
    const keyboardY = maxKeyboardY < -minMovement ? maxKeyboardY : 0;
    
    const distance = viewport.height / 2 + (-keyboardY)
    const firstNoteDelta = midiObject[0] ? parseInt(midiObject[0].Delta / 1000) + 1000  : 0;

    useEffect(() => {
        if (midiObject) {
        const newBlocks = midiObject.map((note, index) => {
            const height = calculateHeight(note.Duration, distance) / factor;
            const position = y_shader(note, height, distance, half_screen, firstNoteDelta);
            
            // Apply the same scaling to block widths to match keyboard
            const blockWidth = isBlack(note.NoteNumber) ? (black_width) : (white_width-0.1);
            
            return {
              id: `${index}`,
              noteNumber: note.NoteNumber,
              soundDuration: note.SoundDuration,
              delta: parseInt(note.Delta / 1000) + firstNoteDelta + (factor-1) * 1000,
              duration: note.Duration / 1000000,
              height: height,
              width: blockWidth,
              color: isBlack(note.NoteNumber) ? black_color : white_color,
              position: position,
              isBlack: isBlack(note.NoteNumber),
              scaleFactor: scaleFactor // Pass scaling factor to Instances component
            };
        });

        const grouped = groupByDelta(newBlocks);
        setBlocks(newBlocks);
        setGroupedBlocks(grouped);
        setNotes(grouped.map(obj => parseInt(Object.keys(obj)[0])));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [midiObject, viewport.height, viewport.width]);
  return (
    <>
      {blocks.length && <InstancedShaderRectangles 
        blocks={blocks} 
        groupedBlocks={groupedBlocks} 
        triggerVisibleNote={triggerVisibleNote} 
        notes={notes} 
        distance={distance}
        scaleFactor={scaleFactor}
      />}
    </>
  );
}

export default ShaderBlocks;