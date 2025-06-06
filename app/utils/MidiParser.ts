// import { parseArrayBuffer } from 'midi-json-parser';
import ConvertToNoteEventsJSON from './getNoteEventsJSON';

let midiParser;

const loadParser  = async () => {
  if (typeof window !== 'undefined'){
    const parser = await import('midi-json-parser')
    midiParser = parser.parseArrayBuffer;
  }
}
const ReadMidiFile = async (input) => {
  if (typeof window === 'undefined') {
    throw new Error("Server side")
  }
  if (!midiParser) {
    await loadParser();
  }
  
  const convertToArrayBuffer = async (data) => {
    if (data instanceof ArrayBuffer) return data;
    if (data instanceof Blob) return await data.arrayBuffer();
    if (typeof data === 'string') {
      const binaryString = atob(data);
      return Uint8Array.from(binaryString, c => c.charCodeAt(0)).buffer;
    }
    throw new Error('Unsupported input type');
  };

  
  const arrayBuffer = await convertToArrayBuffer(input);
  // return await parseArrayBuffer(arrayBuffer);
  return await midiParser(arrayBuffer)
 
};



interface MidiData {
  data: string;
  type: string;
}

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

  const parseMidiFile = async (midiFile: File | MidiData) => {
    let buffer: ArrayBuffer;
    
    if (midiFile instanceof File) {
      // Direct File object - convert to ArrayBuffer (non-blocking)
      buffer = await midiFile.arrayBuffer();
    } else {
      // Legacy base64 format for backwards compatibility
      if (midiFile.type !== 'audio/midi' && midiFile.type !== 'audio/mid') {
        throw new Error('Invalid MIDI file type');
      }
      
      const base64 = midiFile.data.split(',')[1];
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      buffer = bytes.buffer;
    }
  
    // Yield control before heavy parsing
    await yieldToMain();
    
    // Parse MIDI file
    const MidiObject = await ReadMidiFile(buffer);
    // console.log("MidiObject format:", MidiObject.format, "Number of tracks:", MidiObject.tracks.length);
    // MidiObject.tracks.forEach((track, index) => {
    //   const noteOnEvents = track.filter(event => 'noteOn' in event).length;
    //   const noteOffEvents = track.filter(event => 'noteOff' in event).length;
    //   // console.log(`Track ${index}: ${track.length} events, ${noteOnEvents} noteOn, ${noteOffEvents} noteOff`);
    // });
  
    // Get constant data
    const constantData = getConstantDataFromMidiFile(MidiObject);
  
    // Yield control before heavy note processing
    await yieldToMain();
    
    // Convert to note events JSON
    const noteEvents = ConvertToNoteEventsJSON(MidiObject, 500000, constantData);
  
    return noteEvents;
  };
  
  export default parseMidiFile;