// Parse MIDI files for a pop artist from pop/{ArtistName}/ into recording-only JSON.
// Uses filenames as title source since pop MIDI files often lack metadata

import path from 'node:path'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { parseMidiFilePath, type MidiNote } from './parse_midi_to_json'

const DEFAULT_OUT_ROOT = path.join('tmp', 'recording_midi_json', 'pop')
const PUBLIC_MIDI_JSON_ROOT = path.resolve('public', 'public_midi_json')

function slugify(s: string): string {
  return (s || '')
    .normalize('NFKD')
    .replace(/['']/g, '')
    .replace(/[#♯]/g, '-sharp')
    .replace(/[♭]/g, '-flat')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function titleFromFilename(filename: string): string {
  const base = path.basename(filename, path.extname(filename))
  // Replace underscores with spaces, clean up
  return base
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function computeDurationMs(midiObject: MidiNote[]): number {
  let maxUs = 0
  for (const n of midiObject) {
    const end = (n.Delta || 0) + (n.Duration || 0)
    if (end > maxUs) maxUs = end
  }
  return Math.floor(maxUs / 1000)
}

function assertRecordingOnlyOutDir(outDir: string) {
  const resolved = path.resolve(outDir)
  if (resolved === PUBLIC_MIDI_JSON_ROOT || resolved.startsWith(`${PUBLIC_MIDI_JSON_ROOT}${path.sep}`)) {
    throw new Error(
      'Refusing to write pop recording data under public/public_midi_json. Use tmp/recording_midi_json/pop or another non-public output directory.',
    )
  }
}

function parseArgs(argv: string[]) {
  const artistDirName = argv[0]
  let outRoot = DEFAULT_OUT_ROOT

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]
    if (arg === '--out-root' && next) {
      outRoot = next
      i++
    }
  }

  return { artistDirName, outRoot }
}

async function main() {
  const { artistDirName, outRoot } = parseArgs(process.argv.slice(2))
  if (!artistDirName) {
    console.log('Usage: bun run scripts/parse_pop_artist.ts <ArtistDirName> [--out-root <dir>]')
    console.log(`Default output root: ${DEFAULT_OUT_ROOT}`)
    process.exit(1)
  }

  const srcDir = path.join('pop', artistDirName)
  const artistSlug = slugify(artistDirName)
  const outDir = path.join(outRoot, artistSlug)
  assertRecordingOnlyOutDir(outDir)

  // Check source directory exists
  try {
    await fs.access(srcDir)
  } catch {
    console.error(`Source directory not found: ${srcDir}`)
    process.exit(1)
  }

  await fs.mkdir(outDir, { recursive: true })

  const entries = await fs.readdir(srcDir)
  const midiFiles = entries.filter(f => /\.(mid|midi)$/i.test(f)).sort()

  if (midiFiles.length === 0) {
    console.log(`No MIDI files found in ${srcDir}`)
    return
  }

  console.log(`Processing ${midiFiles.length} MIDI file(s) for ${artistDirName}...`)

  // Track used slugs to handle duplicates
  const usedSlugs = new Set<string>()
  let wrote = 0

  for (const file of midiFiles) {
    const filePath = path.join(srcDir, file)
    const title = titleFromFilename(file)
    let songSlug = slugify(title)

    // Handle duplicate slugs by appending a number
    if (usedSlugs.has(songSlug)) {
      let i = 2
      while (usedSlugs.has(`${songSlug}-${i}`)) i++
      songSlug = `${songSlug}-${i}`
    }
    usedSlugs.add(songSlug)

    try {
      const buf = await fs.readFile(filePath)
      const midiSha256 = createHash('sha256').update(buf).digest('hex')
      const midiObject = await parseMidiFilePath(filePath)
      const durationMs = computeDurationMs(midiObject)

      const outJson = {
        title,
        artist: artistDirName,
        durationMs,
        midiSha256,
        midiObject,
      }

      const outPath = path.join(outDir, `${songSlug}.json`)
      await fs.writeFile(outPath, JSON.stringify(outJson))
      wrote++
      console.log(`  ${file} -> ${artistSlug}/${songSlug} (${midiObject.length} notes, ${Math.round(durationMs / 1000)}s)`)
    } catch (e) {
      console.error(`  Error processing ${file}:`, e)
    }
  }

  console.log(`Done. Wrote ${wrote} JSON file(s) to ${outDir}`)
}

if (import.meta.main) {
  main().catch(e => { console.error(e); process.exit(1) })
}
