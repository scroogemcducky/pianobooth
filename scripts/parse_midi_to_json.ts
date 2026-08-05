// Standalone MIDI -> note-events JSON parser for Node/CLI usage
// Mirrors the logic in app/utils/MidiParser.ts without requiring a browser File.

import ConvertToNoteEventsJSON from '../app/utils/getNoteEventsJSON'

// Read a MIDI from an ArrayBuffer using @tonejs/midi
const readMidiFromArrayBuffer = async (arrayBuffer: ArrayBuffer) => {
  const { Midi } = await import('@tonejs/midi')
  const midi = new Midi(arrayBuffer)
  return midi
}

// Same constant extraction as app/utils/MidiParser.ts
// Yield helper (kept for parity with existing logic)
const yieldToMain = () => {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(resolve)
    } else {
      setTimeout(resolve, 0)
    }
  })
}

export type MidiNote = {
  NoteNumber: number
  Velocity: number
  Duration: number
  SoundDuration?: number
  Delta: number
}

// Parse from an ArrayBuffer (core logic)
export async function parseMidiArrayBuffer(arrayBuffer: ArrayBuffer): Promise<MidiNote[]> {
  await yieldToMain()
  const midiObject = await readMidiFromArrayBuffer(arrayBuffer)
  await yieldToMain()
  const noteEvents = ConvertToNoteEventsJSON(midiObject)
  return noteEvents
}

// Parse from a file path (Node usage)
export async function parseMidiFilePath(filePath: string): Promise<MidiNote[]> {
  const fs = await import('node:fs/promises')
  const buf = await fs.readFile(filePath)
  // Ensure we pass a standalone ArrayBuffer
  const bytes = new Uint8Array(buf)
  return parseMidiArrayBuffer(bytes.buffer)
}

export default parseMidiFilePath

