// Generates the synthetic MIDI fixtures used by tests/parser.test.ts.
//
// Fixtures are synthetic rather than real recordings so they carry no third-party
// licence, stay tiny, and can target specific parser branches directly. The
// generated .mid files are committed; re-run this only when adding a new case.
//
//   bun tests/fixtures/generate_fixtures.ts

import { Midi } from '@tonejs/midi'
import fs from 'node:fs'
import path from 'node:path'

const FIXTURE_DIR = path.dirname(new URL(import.meta.url).pathname)

const SUSTAIN_CC = 64
const PEDAL_DOWN = 127
const PEDAL_UP = 0

type Builder = (midi: Midi) => void

const fixtures: Record<string, Builder> = {
  // Plain ascending scale: the baseline happy path.
  'basic-scale': (midi) => {
    const track = midi.addTrack()
    for (let i = 0; i < 8; i++) {
      track.addNote({ midi: 60 + i, time: i * 0.5, duration: 0.4, velocity: 0.8 })
    }
  },

  // Notes under a held sustain pedal. The parser ignores CC64 by design, so this
  // guards against sustain accidentally being reintroduced into visual durations.
  'sustain-pedal': (midi) => {
    const track = midi.addTrack()
    track.addCC({ number: SUSTAIN_CC, value: PEDAL_DOWN, time: 0 })
    for (let i = 0; i < 6; i++) {
      track.addNote({ midi: 55 + i * 2, time: i * 0.4, duration: 0.3, velocity: 0.7 })
    }
    track.addCC({ number: SUSTAIN_CC, value: PEDAL_UP, time: 2.5 })
    track.addNote({ midi: 72, time: 3, duration: 0.5, velocity: 0.9 })
  },

  // Repeated same-pitch notes that overlap, plus notes that butt up against each
  // other. Exercises both branches of normalizeOverlappingNotes.
  'overlapping-same-pitch': (midi) => {
    const track = midi.addTrack()
    track.addNote({ midi: 64, time: 0, duration: 1.0, velocity: 0.8 })
    track.addNote({ midi: 64, time: 0.5, duration: 1.0, velocity: 0.6 })
    track.addNote({ midi: 64, time: 1.2, duration: 0.5, velocity: 0.9 })
    // Exactly touching (no gap) - should get a visible separation carved out.
    track.addNote({ midi: 67, time: 2.0, duration: 0.5, velocity: 0.7 })
    track.addNote({ midi: 67, time: 2.5, duration: 0.5, velocity: 0.7 })
  },

  // A chord plus near-simultaneous duplicates of the same pitch, which multi-track
  // exports commonly produce. Exercises the same-start dedup path.
  'chord-and-duplicates': (midi) => {
    const track = midi.addTrack()
    for (const note of [60, 64, 67]) {
      track.addNote({ midi: note, time: 0, duration: 1, velocity: 0.75 })
    }
    // Same pitch, a hair later (inside sameStartEpsilonUs) and longer.
    track.addNote({ midi: 60, time: 0.001, duration: 1.5, velocity: 0.85 })
  },

  // Notes outside the 88-key piano range (below A0 / above C8) must be dropped.
  'out-of-piano-range': (midi) => {
    const track = midi.addTrack()
    track.addNote({ midi: 10, time: 0, duration: 0.5, velocity: 0.8 }) // too low
    track.addNote({ midi: 20, time: 0.5, duration: 0.5, velocity: 0.8 }) // just below A0
    track.addNote({ midi: 21, time: 1.0, duration: 0.5, velocity: 0.8 }) // A0, lowest valid
    track.addNote({ midi: 60, time: 1.5, duration: 0.5, velocity: 0.8 }) // middle C
    track.addNote({ midi: 108, time: 2.0, duration: 0.5, velocity: 0.8 }) // C8, highest valid
    track.addNote({ midi: 109, time: 2.5, duration: 0.5, velocity: 0.8 }) // just above C8
    track.addNote({ midi: 120, time: 3.0, duration: 0.5, velocity: 0.8 }) // too high
  },

  // Notes spread across tracks with the pedal isolated in its own track, mirroring
  // how many exports lay out a score.
  'multi-track': (midi) => {
    const melody = midi.addTrack()
    for (let i = 0; i < 4; i++) {
      melody.addNote({ midi: 72 + i, time: i * 0.5, duration: 0.4, velocity: 0.9 })
    }
    const bass = midi.addTrack()
    for (let i = 0; i < 4; i++) {
      bass.addNote({ midi: 48 - i, time: i * 0.5, duration: 0.45, velocity: 0.6 })
    }
    const pedal = midi.addTrack()
    pedal.addCC({ number: SUSTAIN_CC, value: PEDAL_DOWN, time: 0.25 })
    pedal.addCC({ number: SUSTAIN_CC, value: PEDAL_UP, time: 1.75 })
  },

  // Velocity boundaries: 1 is the quietest real MIDI velocity (0 means note-off),
  // 127 the loudest.
  'velocity-extremes': (midi) => {
    const track = midi.addTrack()
    track.addNote({ midi: 60, time: 0, duration: 0.5, velocity: 1 / 127 })
    track.addNote({ midi: 62, time: 0.5, duration: 0.5, velocity: 64 / 127 })
    track.addNote({ midi: 64, time: 1.0, duration: 0.5, velocity: 1 })
  },
}

let written = 0
for (const [name, build] of Object.entries(fixtures)) {
  const midi = new Midi()
  build(midi)
  const outPath = path.join(FIXTURE_DIR, `${name}.mid`)
  fs.writeFileSync(outPath, Buffer.from(midi.toArray()))
  written++
  console.log(`wrote ${path.basename(outPath)}`)
}
console.log(`\n${written} fixtures written to tests/fixtures/`)
