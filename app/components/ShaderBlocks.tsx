import { useEffect, useMemo } from 'react'
import type { Ref } from 'react'
import InstancedShaderRectangles, { PLAYBACK_TAIL_MS, VisualizerHandle } from './Instances_component'
import { black_width, white_width, white_color, black_color } from '../utils/constants'
import usePlayStore from '../store/playStore'
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

// One falling block, in world units, ready for the instanced renderer.
type BlockData = {
  id: string
  noteNumber: number
  soundDuration?: number
  delta: number
  duration: number
  height: number
  width: number
  color: string
  position: [number, number, number]
  isBlack: boolean
  scaleFactor: number
}

export default function ShaderBlocks({
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
  const lookahead = usePlayStore(state => state.lookahead)

  // `viewport` is already measured by the time scene children render: <Canvas>
  // gates rendering on a non-zero container size, so these are real values on the
  // very first pass and need no mount-then-measure round trip.
  const activeLayout = layout ?? DEFAULT_PIANO_LAYOUT
  const totalKeyboardWidth = getKeyboardWidth(activeLayout)
  const scaleFactor = scalingFactor(viewport.width, totalKeyboardWidth)
  const { distance } = getKeyboardMetrics(viewport.height, scaleFactor)
  const half_screen = viewport.height / 2
  const firstNoteDelta = midiObject[0] ? Math.floor(midiObject[0].Delta / 1000) + lookahead * 1000 : 0

  // Pure derivation of the props above, so it belongs in render rather than in an
  // effect: computing it here means the first render already has the right blocks
  // instead of rendering empty, committing, then re-rendering.
  //
  // NOTE: `activeLayout` is compared by identity. Parents pass it from state, so
  // it is stable between pieces; creating it inline in a parent would make this
  // memo recompute every render and thrash the GPU buffers downstream.
  const { blocks, groupedBlocks, notes } = useMemo(() => {
    if (!midiObject?.length) {
      return { blocks: [] as BlockData[], groupedBlocks: [] as any[], notes: [] as number[] }
    }

    const newBlocks: BlockData[] = midiObject.map((note, index) => {
      const height = calculateHeight(note.Duration, distance) / lookahead
      const deltaMs = Math.floor(note.Delta / 1000)
      const xPosition = getNoteXPosition(note.NoteNumber, activeLayout)
      const yPosition = height / 2 + half_screen + (distance * deltaMs) / (1000 * lookahead)
      const isBlackKey = isBlack(note.NoteNumber)
      const zPosition = isBlackKey ? -0.05 : -0.07
      const blockWidth = isBlackKey ? black_width : white_width - 0.1
      return {
        id: `${index}`,
        noteNumber: note.NoteNumber,
        soundDuration: note.SoundDuration,
        delta: deltaMs + firstNoteDelta,
        duration: note.Duration / 1000000,
        height,
        width: blockWidth,
        color: isBlackKey ? black_color : white_color,
        position: [xPosition, yPosition, zPosition],
        isBlack: isBlackKey,
        scaleFactor,
      }
    })

    const grouped = groupByDelta(newBlocks)
    const preparedNotes: number[] = grouped.map((obj: any) => Number(Object.keys(obj)[0]))
    return { blocks: newBlocks, groupedBlocks: grouped, notes: preparedNotes }
  }, [midiObject, activeLayout, distance, half_screen, firstNoteDelta, lookahead, scaleFactor])

  // Telling the parent the timeline length is a side effect, so it stays an
  // effect. `onPrepared` is omitted from the deps because callers pass an inline
  // arrow, which would make this fire on every render.
  useEffect(() => {
    if (!onPrepared || !notes.length) return
    onPrepared({ durationMs: notes[notes.length - 1] + PLAYBACK_TAIL_MS, firstNoteMs: notes[0] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes])
  return (
    <>
      {blocks.length ? (
        <InstancedShaderRectangles
          blocks={blocks}
          // groupByDelta returns an array of { [delta]: notes[] }, which the
          // GroupedBlocks type in Instances_component does not describe. Cast
          // retained until that type is corrected.
          groupedBlocks={groupedBlocks as any}
          triggerVisibleNote={triggerVisibleNote}
          notes={notes}
          distance={distance}
          scaleFactor={scaleFactor}
          onTimeUpdate={onTimeUpdate}
          visualizerRef={visualizerRef}
          songToken={midiObject}
        />
      ) : null}
    </>
  )
}
