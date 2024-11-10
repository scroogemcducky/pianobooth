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
  
  const parseMidiFile = async (midiData: MidiData) => {
    if (midiData.type !== 'audio/midi' && midiData.type !== 'audio/mid') {
      throw new Error('Invalid MIDI file type');
    }
  
    // Convert base64 to ArrayBuffer
    const base64 = midiData.data.split(',')[1];
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const buffer = bytes.buffer;
  
    // Parse MIDI file
    const MidiObject = await ReadMidiFile(buffer);
  
    // Get constant data
    const constantData = getConstantDataFromMidiFile(MidiObject);
  
    // Convert to note events JSON
    const noteEvents = ConvertToNoteEventsJSON(MidiObject, 500000, constantData);
  
    return noteEvents;
  };
  
  export default parseMidiFile;