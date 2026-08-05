import ConvertToNoteEventsJSON from './getNoteEventsJSON';

const ReadMidiFile = async (arrayBuffer: ArrayBuffer) => {
  const { Midi } = await import('@tonejs/midi');
  const midi = new Midi(arrayBuffer);
  return midi;
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
   
    // Yield control before heavy note processing
    await yieldToMain();
    
    // Convert to note events JSON
    const noteEvents = ConvertToNoteEventsJSON(midiObject);
  
    return noteEvents;
  };
  
  export default parseMidiFile;