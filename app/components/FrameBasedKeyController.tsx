import { useRef, forwardRef, useImperativeHandle } from 'react'
import useKeyStore from '../store/keyPressStore'

interface MidiNote {
  Delta: number
  Duration: number
  NoteNumber: number
  Velocity: number
  SoundDuration: number
}

export interface FrameBasedKeyControllerHandle {
  setFrame: (adjustedFrame: number) => void
}

interface Props {
  midiObject: MidiNote[] | null
  lookahead?: number
}

const FRAME_DURATION_MS = 1000 / 60

const FrameBasedKeyController = forwardRef<FrameBasedKeyControllerHandle, Props>(
  function FrameBasedKeyController({ midiObject, lookahead = 3 }, ref) {
  const activeNotesRef = useRef<Set<number>>(new Set())

  useImperativeHandle(ref, () => ({
    setFrame: (adjustedFrame: number) => {
      if (!midiObject) return

      const currentTimeMs = adjustedFrame * FRAME_DURATION_MS
      // Key press is delayed by lookahead seconds so it syncs with notes reaching keyboard
      const keyPressDelayMs = lookahead * 1000

      // Calculate which notes should be active
      const newActiveNotes = new Set<number>()

      midiObject.forEach((note: MidiNote) => {
        const noteStartMs = Math.floor(note.Delta / 1000)
        const noteDurationMs = note.Duration / 1000000 * 1000
        const noteEndMs = noteStartMs + noteDurationMs

        const keyPressStartMs = noteStartMs + keyPressDelayMs
        const keyPressEndMs = noteEndMs + keyPressDelayMs

        if (currentTimeMs >= keyPressStartMs && currentTimeMs <= keyPressEndMs) {
          newActiveNotes.add(note.NoteNumber)
        }
      })

      // Update key states (only what changed)
      const keyStore = useKeyStore.getState()

      activeNotesRef.current.forEach(noteNumber => {
        if (!newActiveNotes.has(noteNumber)) {
          keyStore.setKey(noteNumber, false)
        }
      })

      newActiveNotes.forEach(noteNumber => {
        if (!activeNotesRef.current.has(noteNumber)) {
          keyStore.setKey(noteNumber, true)
        }
      })

      activeNotesRef.current = newActiveNotes
    }
  }), [midiObject, lookahead])

  return null
})

export default FrameBasedKeyController
