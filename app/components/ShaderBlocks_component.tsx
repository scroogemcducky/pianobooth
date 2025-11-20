import { useEffect, useState } from 'react'
import type { Ref } from 'react'
import InstancedShaderRectangles, { VisualizerHandle } from './Instances_component'
import { factor, black_width, white_width, white_color, black_color } from '../utils/constants'
import { calculateHeight, isBlack, groupByDelta, scalingFactor } from '../utils/functions.js'
import { useThree } from '@react-three/fiber'
import {
  type PianoLayout,
  DEFAULT_PIANO_LAYOUT,
  getKeyboardMetrics,
  getKeyboardWidth,
  getNoteXPosition,
} from '../utils/pianoLayout'

type MidiNote = {
  NoteNumber: number
  Delta: number
  Duration: number
  SoundDuration?: number
}

export default function ShaderBlocks_component({
  midiObject,
  layout,
  triggerVisibleNote,
  onPrepared,
  onTimeUpdate,
  visualizerRef,
}: {
  midiObject: MidiNote[]
  layout: PianoLayout
  triggerVisibleNote: (noteNumber: number, durationMs: number) => void
  onPrepared?: (info: { durationMs: number; firstNoteMs: number }) => void
  onTimeUpdate?: (ms: number) => void
  visualizerRef?: Ref<VisualizerHandle>
}) {
  const { viewport } = useThree()
  const [blocks, setBlocks] = useState<any[]>([])
  const [groupedBlocks, setGroupedBlocks] = useState<any[]>([])
  const [notes, setNotes] = useState<number[]>([])

  const activeLayout = layout ?? DEFAULT_PIANO_LAYOUT
  const totalKeyboardWidth = getKeyboardWidth(activeLayout)
  const scaleFactor = scalingFactor(viewport.width, totalKeyboardWidth)
  const { distance } = getKeyboardMetrics(viewport.height, scaleFactor)
  const half_screen = viewport.height / 2
  const firstNoteDelta = midiObject[0] ? parseInt(midiObject[0].Delta / 1000) + 1000 : 0

  useEffect(() => {
    if (!midiObject) return
    const newBlocks = midiObject.map((note, index) => {
      const height = calculateHeight(note.Duration, distance) / factor
      const deltaMs = parseInt(note.Delta / 1000)
      const xPosition = getNoteXPosition(note.NoteNumber, activeLayout)
      const yPosition = height / 2 + half_screen + (distance * deltaMs) / (1000 * factor)
      const position = [xPosition, yPosition, -0.05]
      const blockWidth = isBlack(note.NoteNumber) ? black_width : white_width - 0.1
      return {
        id: `${index}`,
        noteNumber: note.NoteNumber,
        soundDuration: note.SoundDuration,
        delta: parseInt(note.Delta / 1000) + firstNoteDelta + (factor - 1) * 1000,
        duration: note.Duration / 1000000,
        height,
        width: blockWidth,
        color: isBlack(note.NoteNumber) ? black_color : white_color,
        position,
        isBlack: isBlack(note.NoteNumber),
        scaleFactor,
      }
    })
    const grouped = groupByDelta(newBlocks)
    const preparedNotes = grouped.map((obj: any) => parseInt(Object.keys(obj)[0]))
    setBlocks(newBlocks)
    setGroupedBlocks(grouped)
    setNotes(preparedNotes)

    if (onPrepared && preparedNotes.length) {
      const durationMs = preparedNotes[preparedNotes.length - 1] + 2000 // add small tail
      onPrepared({ durationMs, firstNoteMs: preparedNotes[0] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayout, distance, firstNoteDelta, half_screen, midiObject, viewport.height, viewport.width])

  return (
    <>
      {blocks.length ? (
        <InstancedShaderRectangles
          blocks={blocks as any}
          groupedBlocks={groupedBlocks as any}
          triggerVisibleNote={triggerVisibleNote}
          notes={notes}
          distance={distance}
          scaleFactor={scaleFactor}
          onTimeUpdate={onTimeUpdate}
          visualizerRef={visualizerRef}
        />
      ) : null}
    </>
  )
}
