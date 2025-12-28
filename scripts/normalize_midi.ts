/**
 * Normalize MIDI timing to eliminate tempo interpretation differences.
 *
 * Problem: @tonejs/midi and FluidSynth interpret MIDI tempo changes differently.
 * For complex pieces with many tempo changes (like Hammerklavier with 1096 tempo changes),
 * small differences compound to noticeable drift (audio out of sync at 9:25 in a 12min piece).
 *
 * Solution: Create a "normalized" MIDI file with a fixed tempo (120 BPM) where all notes
 * are positioned at ticks corresponding to their absolute time as calculated by @tonejs/midi.
 * This ensures FluidSynth produces audio with identical timing to the video visualization.
 */

import { Midi, Track, Header } from '@tonejs/midi'
import fs from 'node:fs/promises'
import path from 'node:path'

// Fixed tempo for normalized MIDI (in BPM)
const NORMALIZED_BPM = 120
// Standard ticks per quarter note
const TICKS_PER_QUARTER = 480

/**
 * Convert absolute time (seconds) to MIDI ticks at the normalized tempo
 */
function secondsToTicks(seconds: number): number {
  // At 120 BPM, one quarter note = 0.5 seconds
  // So 1 second = 2 quarter notes = 2 * TICKS_PER_QUARTER ticks
  const ticksPerSecond = (NORMALIZED_BPM / 60) * TICKS_PER_QUARTER
  return Math.round(seconds * ticksPerSecond)
}

/**
 * Create a normalized MIDI file from parsed note data.
 *
 * @param parsedNotes - Array of notes with absolute timing (from @tonejs/midi parsing)
 * @param outputPath - Path to write the normalized MIDI
 */
export async function createNormalizedMidi(
  inputMidiPath: string,
  outputPath: string
): Promise<{ originalDuration: number; normalizedDuration: number; noteCount: number }> {
  // Read and parse the original MIDI
  const inputBuffer = await fs.readFile(inputMidiPath)
  const inputMidi = new Midi(inputBuffer)

  // Create a new MIDI with fixed tempo
  const outputMidi = new Midi()

  // Set up header with our normalized tempo (PPQ defaults to 480 which matches TICKS_PER_QUARTER)
  outputMidi.header.setTempo(NORMALIZED_BPM)

  // Create a single track for all notes
  const track = outputMidi.addTrack()
  track.name = 'Normalized Piano'
  track.channel = 0

  // Find the earliest note time to normalize to 0
  let minTime = Infinity
  let maxEndTime = 0
  let totalNotes = 0

  // Collect all notes from all tracks
  for (const inputTrack of inputMidi.tracks) {
    for (const note of inputTrack.notes) {
      if (note.time < minTime) minTime = note.time
      const endTime = note.time + note.duration
      if (endTime > maxEndTime) maxEndTime = endTime
      totalNotes++
    }
  }

  // If no notes, return early
  if (totalNotes === 0) {
    await fs.writeFile(outputPath, Buffer.from(outputMidi.toArray()))
    return { originalDuration: 0, normalizedDuration: 0, noteCount: 0 }
  }

  // Normalize minTime to 0 if there's a gap at the start
  const timeOffset = minTime > 0.1 ? minTime : 0 // Only offset if > 100ms gap

  // Add notes with normalized timing
  for (const inputTrack of inputMidi.tracks) {
    for (const note of inputTrack.notes) {
      const normalizedTime = note.time - timeOffset

      track.addNote({
        midi: note.midi,
        time: normalizedTime,
        duration: note.duration,
        velocity: note.velocity,
      })
    }
  }

  // Write the normalized MIDI
  const outputBuffer = Buffer.from(outputMidi.toArray())
  await fs.writeFile(outputPath, outputBuffer)

  const normalizedDuration = maxEndTime - timeOffset

  return {
    originalDuration: maxEndTime,
    normalizedDuration,
    noteCount: totalNotes,
  }
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.log('Usage: bun run scripts/normalize_midi.ts <input.mid> <output.mid>')
    process.exit(1)
  }

  const [inputPath, outputPath] = args

  try {
    console.log(`Normalizing MIDI: ${inputPath}`)
    console.log(`Output: ${outputPath}`)
    console.log(`Fixed tempo: ${NORMALIZED_BPM} BPM`)

    const result = await createNormalizedMidi(inputPath, outputPath)

    console.log(`\nNormalization complete:`)
    console.log(`  Notes: ${result.noteCount}`)
    console.log(`  Original duration: ${result.originalDuration.toFixed(3)}s`)
    console.log(`  Normalized duration: ${result.normalizedDuration.toFixed(3)}s`)

    // Verify the output
    const verifyBuffer = await fs.readFile(outputPath)
    const verifyMidi = new Midi(verifyBuffer)
    console.log(`  Output tempo changes: ${verifyMidi.header.tempos.length}`)
    if (verifyMidi.header.tempos.length > 0) {
      console.log(`  Output tempo: ${verifyMidi.header.tempos[0].bpm.toFixed(2)} BPM`)
    }

  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

if (import.meta.main) {
  main()
}

export default createNormalizedMidi
