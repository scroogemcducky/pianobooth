import { useEffect, useState, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { factor, black_width, white_width, white_color, black_color } from '../utils/constants'
import { calculateHeight, isBlack, scalingFactor } from '../utils/functions.js'
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

type Block = {
  id: string
  noteNumber: number
  height: number
  width: number
  color: string
  position: [number, number, number]
  isBlack: boolean
}

type Props = {
  midiObject: MidiNote[]
  layout: PianoLayout
  timePositionMs: number
  onActiveNotesChange?: (activeNotes: Set<number>) => void
}

// Static blocks visualization for thumbnails - renders a snapshot at a specific time position
export default function ThumbnailStaticBlocks({ midiObject, layout, timePositionMs, onActiveNotesChange }: Props) {
  const { viewport } = useThree()
  const [blocks, setBlocks] = useState<Block[]>([])

  const activeLayout = layout ?? DEFAULT_PIANO_LAYOUT
  const totalKeyboardWidth = getKeyboardWidth(activeLayout)
  const scaleFactor = scalingFactor(viewport.width, totalKeyboardWidth)
  const { distance, keyboardY } = getKeyboardMetrics(viewport.height, scaleFactor)
  const half_screen = viewport.height / 2

  // Lookahead determines how far ahead we show notes (in seconds)
  const lookahead = 3

  // The keyboard Y position in unscaled coordinates (used for note rendering)
  const keyboardYUnscaled = keyboardY / scaleFactor

  useEffect(() => {
    if (!midiObject || midiObject.length === 0) return

    // Calculate time offset to show notes around the specified position
    // Notes should appear falling from above the keyboard
    const timeOffsetMs = timePositionMs - lookahead * 1000

    const newBlocks: Block[] = []
    const activeNotes = new Set<number>()

    for (let i = 0; i < midiObject.length; i++) {
      const note = midiObject[i]
      const height = calculateHeight(note.Duration, distance) / factor
      const deltaMs = note.Delta / 1000
      const xPosition = getNoteXPosition(note.NoteNumber, activeLayout)

      // Calculate Y position relative to time offset
      const relativeTime = deltaMs - timeOffsetMs
      const yPosition = height / 2 + half_screen + (distance * relativeTime) / (1000 * factor)

      // Only include blocks that are visible in the viewport
      const blockTop = yPosition + height / 2
      const blockBottom = yPosition - height / 2
      const viewportTop = half_screen * 1.5
      const viewportBottom = -half_screen * 0.5

      if (blockTop >= viewportBottom && blockBottom <= viewportTop) {
        const blockWidth = isBlack(note.NoteNumber) ? black_width : white_width - 0.1
        newBlocks.push({
          id: `${i}`,
          noteNumber: note.NoteNumber,
          height,
          width: blockWidth,
          color: isBlack(note.NoteNumber) ? black_color : white_color,
          position: [xPosition, yPosition, -0.05],
          isBlack: isBlack(note.NoteNumber),
        })

        // A note is "active" (key pressed) when its block is touching or below the keyboard level
        // The keyboard is at keyboardYUnscaled, notes above it are falling toward it
        // A note touches the keyboard when its bottom edge reaches the keyboard level
        if (blockBottom <= keyboardYUnscaled + 0.5) { // Small threshold for visual alignment
          activeNotes.add(note.NoteNumber)
        }
      }

      // Stop after we have enough blocks for the preview
      if (newBlocks.length > 500) break
    }

    setBlocks(newBlocks)

    // Report active notes to parent
    if (onActiveNotesChange) {
      onActiveNotesChange(activeNotes)
    }
  }, [activeLayout, distance, half_screen, midiObject, timePositionMs, viewport.height, viewport.width, keyboardYUnscaled, onActiveNotesChange])

  // Memoize geometry and materials
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const whiteMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: white_color, side: THREE.DoubleSide }),
    []
  )
  const blackMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: black_color, side: THREE.DoubleSide }),
    []
  )

  return (
    <group scale={[scaleFactor, scaleFactor, 1]}>
      {blocks.map((block) => (
        <mesh
          key={block.id}
          geometry={geometry}
          material={block.isBlack ? blackMaterial : whiteMaterial}
          position={block.position}
          scale={[block.width, block.height, 1]}
        />
      ))}
    </group>
  )
}
