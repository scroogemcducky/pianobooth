import { useEffect, useState, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { factor, black_width, white_width, white_color, black_color } from '../../utils/constants'
import { calculateHeight, isBlack, scalingFactor } from '../../utils/functions.js'
import {
  type PianoLayout,
  DEFAULT_PIANO_LAYOUT,
  getKeyboardMetrics,
  getKeyboardWidth,
  getNoteXPosition,
} from '../../utils/pianoLayout'

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

// Static blocks visualization for OG images - renders a snapshot of the piece
export default function StaticBlocks({
  midiObject,
  layout,
}: {
  midiObject: MidiNote[]
  layout: PianoLayout
}) {
  const { viewport } = useThree()
  const [blocks, setBlocks] = useState<Block[]>([])

  const activeLayout = layout ?? DEFAULT_PIANO_LAYOUT
  const totalKeyboardWidth = getKeyboardWidth(activeLayout)
  const scaleFactor = scalingFactor(viewport.width, totalKeyboardWidth)
  const { distance } = getKeyboardMetrics(viewport.height, scaleFactor)
  const half_screen = viewport.height / 2

  useEffect(() => {
    if (!midiObject || midiObject.length === 0) return

    // Find a good starting point - show blocks from early in the piece
    // but not the very start to have some visual interest
    const firstNoteDelta = midiObject[0] ? midiObject[0].Delta / 1000 : 0

    // Show blocks positioned as if we're at the start of the piece
    // but offset so the notes are visible coming down from the top
    const timeOffsetMs = firstNoteDelta + 2000 // 2 seconds ahead of first note

    const newBlocks: Block[] = []

    for (let i = 0; i < midiObject.length; i++) {
      const note = midiObject[i]
      const height = calculateHeight(note.Duration, distance) / factor
      const deltaMs = note.Delta / 1000
      const xPosition = getNoteXPosition(note.NoteNumber, activeLayout)

      // Calculate Y position relative to time offset
      const relativeTime = deltaMs - timeOffsetMs
      const yPosition = height / 2 + half_screen + (distance * relativeTime) / (1000 * factor)

      // Only include blocks that are visible in the viewport
      // Show blocks from below the screen to above
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
      }

      // Stop after we have enough blocks for the preview
      if (newBlocks.length > 500) break
    }

    setBlocks(newBlocks)
  }, [activeLayout, distance, half_screen, midiObject, viewport.height, viewport.width])

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
