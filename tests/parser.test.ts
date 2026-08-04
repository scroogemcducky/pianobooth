// Golden-file tests for the MIDI -> note-event parser.
//
// Each fixture in tests/fixtures/*.mid is parsed and compared against the
// committed baseline in tests/fixtures/expected/*.json. Numeric fields are
// compared with a small tolerance so an upstream @tonejs/midi change that shifts
// a timing value by a microsecond does not fail the suite.
//
//   bun run test              check against baselines
//   bun run test --update     rewrite baselines (review the diff before committing)

import fs from 'node:fs'
import path from 'node:path'
import { parseMidiFilePath, type MidiNote } from '../scripts/parse_midi_to_json'

const FIXTURE_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures')
const EXPECTED_DIR = path.join(FIXTURE_DIR, 'expected')

// Durations and deltas are integers in microseconds; allow a couple of
// microseconds of drift from floating-point time arithmetic upstream.
const TOLERANCE_US = 2

const update = process.argv.includes('--update')

type Failure = { fixture: string; detail: string }

function isCloseEnough(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= TOLERANCE_US
}

function compareNote(actual: MidiNote, expected: MidiNote, index: number): string | null {
  if (actual.NoteNumber !== expected.NoteNumber) {
    return `note ${index}: NoteNumber ${actual.NoteNumber} !== ${expected.NoteNumber}`
  }
  if (actual.Velocity !== expected.Velocity) {
    return `note ${index}: Velocity ${actual.Velocity} !== ${expected.Velocity}`
  }
  for (const field of ['Delta', 'Duration', 'SoundDuration'] as const) {
    const a = actual[field]
    const e = expected[field]
    if (a === undefined && e === undefined) continue
    if (a === undefined || e === undefined) {
      return `note ${index}: ${field} presence differs (${a} vs ${e})`
    }
    if (!isCloseEnough(a, e)) {
      return `note ${index}: ${field} ${a} !== ${e} (tolerance ${TOLERANCE_US}us)`
    }
  }
  return null
}

function compare(fixture: string, actual: MidiNote[], expected: MidiNote[]): string | null {
  if (actual.length !== expected.length) {
    return `note count ${actual.length} !== ${expected.length}`
  }
  for (let i = 0; i < actual.length; i++) {
    const detail = compareNote(actual[i], expected[i], i)
    if (detail) return detail
  }
  return null
}

const fixtures = fs
  .readdirSync(FIXTURE_DIR)
  .filter((name) => name.endsWith('.mid'))
  .sort()

if (fixtures.length === 0) {
  console.error('No fixtures found. Run: bun tests/fixtures/generate_fixtures.ts')
  process.exit(1)
}

fs.mkdirSync(EXPECTED_DIR, { recursive: true })

const failures: Failure[] = []
let passed = 0

for (const fixture of fixtures) {
  const name = path.basename(fixture, '.mid')
  const expectedPath = path.join(EXPECTED_DIR, `${name}.json`)
  const actual = await parseMidiFilePath(path.join(FIXTURE_DIR, fixture))

  if (update || !fs.existsSync(expectedPath)) {
    fs.writeFileSync(expectedPath, JSON.stringify(actual, null, 2) + '\n')
    console.log(`  baseline written  ${name} (${actual.length} notes)`)
    continue
  }

  const expected = JSON.parse(fs.readFileSync(expectedPath, 'utf8')) as MidiNote[]
  const detail = compare(name, actual, expected)
  if (detail) {
    failures.push({ fixture: name, detail })
    console.log(`  FAIL  ${name} - ${detail}`)
  } else {
    passed++
    console.log(`  ok    ${name} (${actual.length} notes)`)
  }
}

if (update) {
  console.log('\nBaselines updated. Review the diff before committing.')
  process.exit(0)
}

console.log(`\n${passed}/${fixtures.length} passed`)
if (failures.length > 0) {
  console.error(`${failures.length} failing fixture(s). If the change is intended, re-run with --update.`)
  process.exit(1)
}
