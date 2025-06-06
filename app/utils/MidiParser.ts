import ConvertToNoteEventsJSON from './getNoteEventsJSON';

let midiParser;

const loadParser  = async () => {
  if (typeof window !== 'undefined'){
    const parser = await import('midi-json-parser')
    midiParser = parser.parseArrayBuffer;
  }
}
const ReadMidiFile = async (arrayBuffer: ArrayBuffer) => {
  if (typeof window === 'undefined') {
    throw new Error("Server side")
  }
  if (!midiParser) {
    await loadParser();
  }
  
  return await midiParser(arrayBuffer);
};




interface TimeSignature {
  numerator: number;
  denominator: number;
  metronome: number;
  thirtyseconds: number;
}

const getConstantDataFromMidiFile = (file: any) => {
    const { division } = file;
    let timeSignature: TimeSignature | undefined;
  
    for (const track of file.tracks) {
      timeSignature = track.find(event => 'timeSignature' in event)?.timeSignature as TimeSignature;
      if (timeSignature) break;
    }
  
    return {
      denominator: timeSignature?.denominator ?? 4,
      numerator: timeSignature?.numerator ?? 4,
      metronome: timeSignature?.metronome ?? 24,
      thirtyseconds: timeSignature?.thirtyseconds ?? 8,
      division
    };
  };
  
  // Helper to yield control back to the browser
  const yieldToMain = () => {
    return new Promise(resolve => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(resolve);
      } else {
        setTimeout(resolve, 0);
      }
    });
  };

  const parseMidiFile = async (midiFile: File) => {
    // Direct File object - convert to ArrayBuffer (non-blocking)
    const buffer = await midiFile.arrayBuffer();
  
    // Yield control before heavy parsing
    await yieldToMain();
    
    // Parse MIDI file
    const MidiObject = await ReadMidiFile(buffer);
   
    // Get constant data
    const constantData = getConstantDataFromMidiFile(MidiObject);
  
    // Yield control before heavy note processing
    await yieldToMain();
    
    // Convert to note events JSON
    const noteEvents = ConvertToNoteEventsJSON(MidiObject, 500000, constantData);
  
    return noteEvents;
  };
  
  export default parseMidiFile;