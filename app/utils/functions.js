import { factor, note_positions } from './constants'


export function calculateHeight(dur, distance) {
    return distance*dur/1000000
  }
  
export function isBlack(numba) {
    return (numba % 12 === 1 || numba % 12 === 3 || numba % 12 === 6 || numba % 12 === 8 || numba % 12 === 10)
  }
  
  export function y_shader(note, height, top_of_screen_to_keys, half_screen, firstNoteDelta) {
    const position_array = note_positions[note.NoteNumber]
    // delta in milliseconds + 1000 milliseconds
    const newDelta = parseInt((note.Delta)/1000) - firstNoteDelta
    const new_position_array = [...position_array]
    new_position_array[0] = (half_screen + height/2) + top_of_screen_to_keys*(newDelta/1000-1) / factor
    
    // TODO No need to do this here, just when initialising
    new_position_array[1] = -0.05
    return new_position_array
  }


export function y(note, height, top_of_screen_to_keys, half_screen, firstNoteDelta) {
    const position_array = note_positions[note.NoteNumber]
    // delta in milliseconds + 1000 milliseconds
    const newDelta = parseInt((note.Delta)/1000) - firstNoteDelta
    const new_position_array = [...position_array]
    new_position_array[0] = (half_screen + height/2) + top_of_screen_to_keys*(newDelta/1000-1) / factor
    
    // TODO No need to do this here, just when initialising
    new_position_array[1] = -0.1
    return new_position_array
  }
  
export function groupByDelta(arr) {
    const grouped = new Map();
  
    arr.forEach(item => {
        const deltaKey = item.delta; 
        if (!grouped.has(deltaKey)) {
            grouped.set(deltaKey, []); 
        }
        grouped.get(deltaKey).push(item); 
    });
  
  
    const result = [];
    grouped.forEach((value, key) => {
      let groupObject = {};
      groupObject[key] = value;
      result.push(groupObject);
    });
    return result;
  }
  