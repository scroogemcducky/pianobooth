import ConvertToNoteEventsJSON from './getNoteEventsJSON';

const ReadMidiFile = async (arrayBuffer: ArrayBuffer) => {
  const { Midi } = await import('@tonejs/midi');
  const midi = new Midi(arrayBuffer);
  return midi;
};




interface TimeSignature {
  numerator: number;
  denominator: number;
  metronome: number;
  thirtyseconds: number;
}

const getConstantDataFromMidiFile = (midi: any) => {
    const { header } = midi;
    
    // Tone.js provides time signature data differently
    let timeSignature: TimeSignature | undefined;
    
    // Look for time signature in tracks
    for (const track of midi.tracks) {
      if (track.timeSignatures && track.timeSignatures.length > 0) {
        const ts = track.timeSignatures[0];
        timeSignature = {
          numerator: ts.numerator,
          denominator: ts.denominator,
          metronome: ts.metronome ?? 24,
          thirtyseconds: ts.thirtyseconds ?? 8
        };
        break;
      }
    }
  
    return {
      denominator: timeSignature?.denominator ?? 4,
      numerator: timeSignature?.numerator ?? 4,
      metronome: timeSignature?.metronome ?? 24,
      thirtyseconds: timeSignature?.thirtyseconds ?? 8,
      division: header.ticksPerQuarter
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
    const midiObject = await ReadMidiFile(buffer);
   
    // Get constant data
    const constantData = getConstantDataFromMidiFile(midiObject);
  
    // Yield control before heavy note processing
    await yieldToMain();
    
    // Convert to note events JSON
    const noteEvents = ConvertToNoteEventsJSON(midiObject, 500000, constantData);
  
    return noteEvents;
  };
  
  export default parseMidiFile;