import { white_width, note_positions } from './constants'

const WHITE_KEY_WIDTH = white_width
export const OCTAVE_WIDTH = 7 * WHITE_KEY_WIDTH
export const BASE_NOTE_NUMBER = 24
const BASE_CENTER_OCTAVE = 3
const BASE_KEY_OFFSET = -0.116
const SHARP_OFFSET = WHITE_KEY_WIDTH / 2

const KEY_X_OFFSETS = [
  BASE_KEY_OFFSET + 0 * WHITE_KEY_WIDTH, // C
  BASE_KEY_OFFSET + SHARP_OFFSET, // C#
  BASE_KEY_OFFSET + 1 * WHITE_KEY_WIDTH, // D
  BASE_KEY_OFFSET + 1 * WHITE_KEY_WIDTH + SHARP_OFFSET, // D#
  BASE_KEY_OFFSET + 2 * WHITE_KEY_WIDTH, // E
  BASE_KEY_OFFSET + 3 * WHITE_KEY_WIDTH, // F
  BASE_KEY_OFFSET + 3 * WHITE_KEY_WIDTH + SHARP_OFFSET, // F#
  BASE_KEY_OFFSET + 4 * WHITE_KEY_WIDTH, // G
  BASE_KEY_OFFSET + 4 * WHITE_KEY_WIDTH + SHARP_OFFSET, // G#
  BASE_KEY_OFFSET + 5 * WHITE_KEY_WIDTH, // A
  BASE_KEY_OFFSET + 5 * WHITE_KEY_WIDTH + SHARP_OFFSET, // A#
  BASE_KEY_OFFSET + 6 * WHITE_KEY_WIDTH, // B
]

export const MIN_MIDI_NOTE = 24
export const MAX_MIDI_NOTE = 107
const MIN_OCTAVE_INDEX = Math.floor((MIN_MIDI_NOTE - BASE_NOTE_NUMBER) / 12)
const MAX_OCTAVE_INDEX = Math.floor((MAX_MIDI_NOTE - BASE_NOTE_NUMBER) / 12)

export type PianoLayout = {
  minNote: number
  maxNote: number
  paddedMinNote: number
  paddedMaxNote: number
  startOctave: number
  endOctave: number
  octaveCount: number
  centerOctave: number
  minX: number
  maxX: number
  centerX: number
}

const getBaseNotePosition = (noteNumber: number) => {
  const mapped = note_positions[String(noteNumber)]
  if (mapped) return mapped[0]
  const clamped = Math.min(MAX_MIDI_NOTE, Math.max(MIN_MIDI_NOTE, noteNumber))
  const octaveIndex = Math.floor((clamped - BASE_NOTE_NUMBER) / 12)
  const keyIndex = ((clamped - BASE_NOTE_NUMBER) % 12 + 12) % 12
  const baseOffset = KEY_X_OFFSETS[keyIndex] ?? 0
  const relativeOctaveOffset = (octaveIndex - BASE_CENTER_OCTAVE) * OCTAVE_WIDTH
  return relativeOctaveOffset + baseOffset
}

const DEFAULT_MIN_X = getBaseNotePosition(24)
const DEFAULT_MAX_X = getBaseNotePosition(95)
const DEFAULT_CENTER_X = (DEFAULT_MIN_X + DEFAULT_MAX_X) / 2

export const DEFAULT_PIANO_LAYOUT: PianoLayout = {
  minNote: 24,
  maxNote: 95,
  paddedMinNote: 24,
  paddedMaxNote: 95,
  startOctave: 0,
  endOctave: 5,
  octaveCount: 6,
  centerOctave: 2.5,
  minX: DEFAULT_MIN_X,
  maxX: DEFAULT_MAX_X,
  centerX: DEFAULT_CENTER_X,
}

const clampNote = (note: number) => Math.min(MAX_MIDI_NOTE, Math.max(MIN_MIDI_NOTE, note))
const clampOctave = (octave: number) => Math.min(MAX_OCTAVE_INDEX, Math.max(MIN_OCTAVE_INDEX, octave))
const toDisplayOctave = (note: number) => Math.floor((note - BASE_NOTE_NUMBER) / 12)

export function computePianoLayout(
  notes: { NoteNumber: number }[],
  options?: { paddingNotes?: number; minOctaves?: number },
): PianoLayout | null {
  if (!notes || notes.length === 0) return null
  let min = MAX_MIDI_NOTE
  let max = MIN_MIDI_NOTE
  for (const note of notes) {
    const value = clampNote(note.NoteNumber)
    if (value < min) min = value
    if (value > max) max = value
  }
  if (min > max) return null

  const padding = options?.paddingNotes ?? 1
  const minOctaves = options?.minOctaves ?? 2

  const paddedMin = clampNote(min - padding)
  const paddedMax = clampNote(max + padding)

  const mainStartOctave = clampOctave(toDisplayOctave(min))
  const mainEndOctave = clampOctave(toDisplayOctave(max))

  let startOctave = clampOctave(Math.min(mainStartOctave, toDisplayOctave(paddedMin)))
  let endOctave = clampOctave(Math.max(mainEndOctave, toDisplayOctave(paddedMax - 1)))
  let octaveCount = endOctave - startOctave + 1

  if (octaveCount < minOctaves) {
    const needed = minOctaves - octaveCount
    startOctave = clampOctave(startOctave - Math.ceil(needed / 2))
    endOctave = clampOctave(endOctave + Math.floor(needed / 2))
    octaveCount = endOctave - startOctave + 1
  }

  const centerOctave = startOctave + (octaveCount - 1) / 2
  const minX = getBaseNotePosition(paddedMin)
  const maxX = getBaseNotePosition(paddedMax)
  const centerX = (minX + maxX) / 2

  return {
    minNote: min,
    maxNote: max,
    paddedMinNote: paddedMin,
    paddedMaxNote: paddedMax,
    startOctave,
    endOctave,
    octaveCount,
    centerOctave,
    minX,
    maxX,
    centerX,
  }
}

export const getKeyboardWidth = (layout: PianoLayout) => layout.octaveCount * OCTAVE_WIDTH

export const DEFAULT_KEYBOARD_WIDTH = DEFAULT_PIANO_LAYOUT.octaveCount * OCTAVE_WIDTH

export function getNoteXPosition(noteNumber: number, layout: PianoLayout): number {
  const clamped = clampNote(noteNumber)
  const basePosition = getBaseNotePosition(clamped)
  return basePosition - layout.centerX
}

export function getKeyboardMetrics(viewportHeight: number, scaleFactor: number) {
  const whiteKeyHeight = 16
  const renderedKeyHeight = whiteKeyHeight * scaleFactor
  const bottomMargin = viewportHeight * 0.05
  const screenBottom = -viewportHeight / 2
  const safeBottom = screenBottom + bottomMargin
  const maxKeyboardY = safeBottom + renderedKeyHeight
  const minMovement = viewportHeight * 0.05
  const keyboardY = maxKeyboardY < -minMovement ? maxKeyboardY : 0
  const distance = viewportHeight / 2 + -keyboardY
  return { keyboardY, screenBottom, distance }
}
