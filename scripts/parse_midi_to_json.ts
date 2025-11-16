// Standalone MIDI -> note-events JSON parser for Node/CLI usage
// Mirrors the logic in app/utils/MidiParser.ts without requiring a browser File.

import ConvertToNoteEventsJSON from '../app/utils/getNoteEventsJSON'

// Read a MIDI from an ArrayBuffer using @tonejs/midi
const readMidiFromArrayBuffer = async (arrayBuffer: ArrayBuffer) => {
  const { Midi } = await import('@tonejs/midi')
  const midi = new Midi(arrayBuffer)
  return midi
}

interface TimeSignature {
  numerator: number
  denominator: number
  metronome: number
  thirtyseconds: number
}

// Same constant extraction as app/utils/MidiParser.ts
const getConstantDataFromMidiFile = (midi: any) => {
  const { header } = midi

  // Tone.js provides time signature data per track as events
  let timeSignature: TimeSignature | undefined

  // Look for time signature in tracks
  for (const track of midi.tracks) {
    if (track.timeSignatures && track.timeSignatures.length > 0) {
      const ts = track.timeSignatures[0]
      timeSignature = {
        numerator: ts.numerator,
        denominator: ts.denominator,
        metronome: ts.metronome ?? 24,
        thirtyseconds: ts.thirtyseconds ?? 8,
      }
      break
    }
  }

  return {
    denominator: timeSignature?.denominator ?? 4,
    numerator: timeSignature?.numerator ?? 4,
    metronome: timeSignature?.metronome ?? 24,
    thirtyseconds: timeSignature?.thirtyseconds ?? 8,
    division: header.ticksPerQuarter,
  }
}

// Yield helper (kept for parity with existing logic)
const yieldToMain = () => {
  return new Promise((resolve) => {
    // @ts-ignore requestIdleCallback may not exist in Node
    if (typeof requestIdleCallback !== 'undefined') {
      // @ts-ignore
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
  const constantData = getConstantDataFromMidiFile(midiObject)
  await yieldToMain()
  const noteEvents = ConvertToNoteEventsJSON(midiObject, 500000, constantData)
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

