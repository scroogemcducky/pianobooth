import { factor, note_positions } from './constants'


export function calculateHeight(dur, distance) {
    return distance*dur/1000000
  }
  
export function isBlack(numba) {
    return (numba % 12 === 1 || numba % 12 === 3 || numba % 12 === 6 || numba % 12 === 8 || numba % 12 === 10)
  }
  
export function scalingFactor(width, keyboardWidth, options = {}){
  const fillRatio = options.fillRatio ?? 0.9
  const maxScale = options.maxScale ?? 1.1
  const multiplier = options.multiplier ?? 1
  const raw = (width / keyboardWidth) * fillRatio * multiplier
  return Math.min(maxScale, raw);
}
export function y_shader(note, height, distance, half_screen, firstNoteDelta) {
    const position_array = note_positions[note.NoteNumber]
    // delta in milliseconds + 1000 milliseconds
    const newDelta = parseInt((note.Delta)/1000) 
    const new_position_array = [...position_array]
    
    // Calculate vertical position to ensure notes fall correctly
    new_position_array[1] = height/2 + half_screen + distance*(newDelta/1000)/factor
    
    // Position slightly in front of keys so they're visible
    new_position_array[2] = -0.05
    return new_position_array
  }


export function y(note, height, top_of_screen_to_keys, half_screen, firstNoteDelta) {
    const position_array = note_positions[note.NoteNumber]
    // delta in milliseconds + 1000 milliseconds
    const newDelta = parseInt((note.Delta)/1000) - firstNoteDelta
    const new_position_array = [...position_array]
    new_position_array[1] = (half_screen + height/2) + top_of_screen_to_keys*(newDelta/1000-1) / factor
    
    // TODO No need to do this here, just when initialising
    new_position_array[2] = -0.1
    return new_position_array
  }
  
export function groupByDelta(arr) {
    const grouped = new Map();
    arr.forEach(item => {
      const deltaKey = item.delta; 
      if (!grouped.has(deltaKey)) {
        grouped.set(deltaKey, []); 
      }
        grouped.get(deltaKey).push({
            noteNumber: item.noteNumber,
            duration: item.duration
        });

        // grouped.get(deltaKey).push(item); 
    });
  
  
    const result = [];
    grouped.forEach((value, key) => {
      let groupObject = {};
      groupObject[key] = value;
      result.push(groupObject);
    });
    return result;
  }
  
