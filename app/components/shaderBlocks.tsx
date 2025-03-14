import {  useEffect, useState  } from 'react';
import InstancedShaderRectangles from './Instances';
import {factor, speed, white_size_vector, black_width, white_width, white_color, black_color} from '../utils/constants';
import { y_shader, calculateHeight, isBlack, groupByDelta } from '../utils/functions.js';

import { useThree } from "@react-three/fiber";

export default function ShaderBlocks({ midiObject, triggerVisibleNote }) {

    const { viewport } = useThree();
    const [blocks, setBlocks] = useState([]);
    const [groupedBlocks, setGroupedBlocks] = useState([]);
    const [notes, setNotes] = useState<number[]>([]); // array of note start times

    const half_screen = viewport.height / 2
    const distance = viewport.height / 2
    const firstNoteDelta = midiObject[0] ? parseInt(midiObject[0].Delta / 1000) + 1000  : 0;

    // const distance = viewport.height - (white_size_vector.y);
    // const firstNoteDelta = midiObject[0] ? parseInt(midiObject[0].Delta / 1000) - 1000 : 0;
    useEffect(() => {
        if (midiObject) {
        const newBlocks = midiObject.map((note, index) => {
            const height = calculateHeight(note.Duration, distance) / factor;
            const position = y_shader(note, height, distance, half_screen, firstNoteDelta);
            return {
              id: `${index}`,
              noteNumber: note.NoteNumber,
              soundDuration: note.SoundDuration,
              delta: parseInt(note.Delta / 1000) + firstNoteDelta + (factor-1) * 1000, // TODO - correct?
              //delta: parseInt(note.Delta / 1000) - firstNoteDelta + (factor - 1) * 1000,
              duration: note.Duration / 1000000,
              height: height,
              width: isBlack(note.NoteNumber) ? (black_width) : (white_width-0.1),
              color: isBlack(note.NoteNumber) ? black_color : white_color,
              position: position,
              isBlack: isBlack(note.NoteNumber)
            };
        });

        const grouped = groupByDelta(newBlocks);
        setBlocks(newBlocks);
        setGroupedBlocks(grouped);
        //WHY?
        setNotes(grouped.map(obj => parseInt(Object.keys(obj)[0])));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [midiObject, viewport.height]);
  return (
    <>
      {blocks.length && <InstancedShaderRectangles blocks={blocks}  groupedBlocks={groupedBlocks} triggerVisibleNote={triggerVisibleNote} notes={notes} distance={distance}/>}
    </>
  );
}