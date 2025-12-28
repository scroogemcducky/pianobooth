// Renders the next MIDI in midi/video_queue/ to an MP4 using the /record page.
// - Preloads parsed MIDI data into localStorage so no file picker is needed
// - Programmatically starts recording
// - Watches public/ for the new MP4, then renames/moves it to videos/
// - Names output as "Artist - Song.mp4" (using LLM refinement when available)

import path from 'node:path'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright'

import { parseMidiFilePath, type MidiNote } from './parse_midi_to_json'

export type Options = {
  queueDir: string
  publicDir: string
  outDir: string
  baseUrl: string
  requireLLM: boolean
  llmModel: string
  keepMidi: boolean
  timeoutMs: number
  headless: boolean
  slowMo: number
  devtools: boolean
  devMidiPath: string | null
  count: number
  fallDuration: number
}

export const DEFAULTS: Options = {
  queueDir: 'midi/video_queue',
  publicDir: 'videos', // Changed from 'public' - videos now save directly to videos/
  outDir: 'videos',
  baseUrl: process.env.RENDER_BASE_URL || 'http://localhost:5173',
  requireLLM: true,
  llmModel: 'gpt-5',
  keepMidi: false,
  timeoutMs: 30 * 60 * 1000, // 30 minutes
  headless: false,
  slowMo: 0,
  devtools: false,
  devMidiPath: null,
  count: 1,
  fallDuration: 3, // Default fall duration in seconds
}

const KNOWN_COMPOSERS = /(bach|beethoven|chopin|debussy|mozart|liszt|schubert|schumann|rachmaninoff|handel|haydn|tchaikovsky|gershwin)/i
const COMMON_NAME_MAP: Array<[RegExp, string]> = [
  [/bach/i, 'Bach'],
  [/beethoven/i, 'Beethoven'],
  [/chopin/i, 'Chopin'],
  [/mozart/i, 'Mozart'],
  [/debussy/i, 'Debussy'],
  [/liszt/i, 'Liszt'],
  [/schubert/i, 'Schubert'],
  [/schumann/i, 'Schumann'],
  [/(rachmaninov|rachmaninoff)/i, 'Rachmaninoff'],
  [/handel/i, 'Handel'],
  [/haydn/i, 'Haydn'],
  [/(tchaikovsky|chaikovsky)/i, 'Tchaikovsky'],
  [/gershwin/i, 'Gershwin'],
]

function simplifyTitle(title: string): string {
  if (!title) return title
  let t = title
  const patterns = [
    /\b(das\s+wohltemperierte\s+klavier)\b/gi,
    /\b(the\s+well[-\s]?tempered\s+clavier)\b/gi,
    /\b(wohltemperierte\s+klavier)\b/gi,
    /\bwtc\b\s*[ivx]*/gi,
    /\bbook\s*[ivx]+\b/gi,
  ]
  for (const re of patterns) {
    t = t.replace(re, '').replace(/\s{2,}/g, ' ').trim()
  }
  t = t.replace(/^[\s\-:–]+/, '').replace(/[\s\-:–]+$/, '')
  t = t.replace(/[\-–]{2,}/g, '-').replace(/\s+/g, ' ').trim()
  return t
}

function canonicalizeCommonArtistName(artist: string): string {
  const a = artist || ''
  for (const [pattern, canon] of COMMON_NAME_MAP) {
    if (pattern.test(a)) return canon
  }
  return (artist || '').trim()
}

function inferArtistFromFilename(filePath: string): string | null {
  const base = path.basename(filePath, path.extname(filePath))
  const normalized = base.replace(/[_]+/g, ' ')
  const parts = normalized.split('-').map((p) => p.trim()).filter(Boolean)
  if (!parts.length) return null
  const candidate = parts[0]
  if (!candidate || candidate.length < 2) return null
  return canonicalizeCommonArtistName(candidate)
}

async function extractTitleArtist(filePath: string): Promise<{ title: string; artist: string; trackNames: string[] }> {
  const buf = await fs.readFile(filePath)
  const { Midi } = await import('@tonejs/midi')
  const midi = new Midi(buf)
  const headerName = (midi as any)?.header?.name?.trim?.() || ''
  const trackNames = midi.tracks.map((t: any) => (t.name || '').trim()).filter(Boolean)
  let title = headerName || ''
  if (!title && trackNames.length) {
    title = trackNames.reduce((a: string, b: string) => (b.length > a.length ? b : a), trackNames[0])
  }
  let artist = ''
  const artistCandidate = trackNames.find((n: string) => KNOWN_COMPOSERS.test(n)) || (headerName && KNOWN_COMPOSERS.test(headerName) ? headerName : '')
  if (artistCandidate) {
    const m = artistCandidate.match(KNOWN_COMPOSERS)
    if (m && m[1]) {
      const name = m[1]
      artist = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
    }
  }
  // If title has a composer prefix, strip it (e.g., "Bach - ...")
  if (title) {
    const m = title.match(/^(.*?)[-:\u2013]\s*(.+)$/)
    if (m && KNOWN_COMPOSERS.test(m[1] || '')) title = m[2].trim()
  }
  artist = canonicalizeCommonArtistName(artist || 'Piano')
  if (!title) title = 'Untitled'
  return { title, artist, trackNames }
}

async function aiRefineMetadata(params: {
  filename: string
  guessedTitle: string
  guessedArtist: string
  trackNames: string[]
  model?: string
  timeoutMs?: number
}): Promise<{ title?: string; artist?: string; title_short?: string; artist_short?: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  const { filename, guessedTitle, guessedArtist, trackNames } = params
  const model = params.model || 'gpt-5'
  const timeoutMs = params.timeoutMs || 30000
  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    const system = (
      'You are a precise metadata normalizer for classical piano MIDI files. ' +
      'Respond with a strict JSON object only. ' +
      "For classical composers, use the most common short canonical name for the artist (last name only), e.g., 'Bach', 'Beethoven', 'Chopin', 'Mozart', 'Debussy', 'Liszt', 'Schubert', 'Schumann', 'Rachmaninoff', 'Handel', 'Haydn', 'Tchaikovsky', 'Gershwin'. " +
      'Return both a display title/artist and concise short variants for filenames. '
    )
    const user = {
      instruction:
        "Given MIDI hints, return best-guess fields artist and title. " +
        "Favor the most common short canonical name for the artist (e.g., 'Bach' not 'Johann Sebastian Bach'). " +
        "Provide short variants optimized for filenames: 'artist_short' and 'title_short'. " +
        "Do NOT include collection names like 'Well-Tempered Clavier' (WTC) or 'Book I/II' markers in title_short. " +
        "Keep catalog numbers (e.g., 'BWV 846') and key (e.g., 'in C major') when known. " +
        'If unknown, use empty string.',
      filename,
      guessed: { artist: guessedArtist, title: guessedTitle },
      track_names: trackNames.slice(0, 25),
      output_schema: { artist: 'string', title: 'string', artist_short: 'string', title_short: 'string' },
    }
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(user) },
        ],
      }),
      signal: controller.signal,
    })
    clearTimeout(id)
    if (!resp.ok) return null
    const data = await resp.json()
    const content = (data?.choices?.[0]?.message?.content || '').trim()
    if (!content) return null
    const obj = JSON.parse(content)
    return {
      title: typeof obj?.title === 'string' ? obj.title.trim() : undefined,
      artist: typeof obj?.artist === 'string' ? obj.artist.trim() : undefined,
      title_short: typeof obj?.title_short === 'string' ? obj.title_short.trim() : undefined,
      artist_short: typeof obj?.artist_short === 'string' ? obj.artist_short.trim() : undefined,
    }
  } catch {
    return null
  }
}

function sanitizeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
}

async function listMp4(dir: string): Promise<{ name: string; path: string; mtimeMs: number; size: number }[]> {
  let entries: any[] = []
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch { return [] }
  const out: { name: string; path: string; mtimeMs: number; size: number }[] = []
  for (const e of entries) {
    if (!e.isFile()) continue
    if (!/\.mp4$/i.test(e.name)) continue
    const p = path.join(dir, e.name)
    const st = await fs.stat(p)
    out.push({ name: e.name, path: p, mtimeMs: st.mtimeMs, size: st.size })
  }
  return out
}

async function waitForNewVideo(publicDir: string, sinceMs: number, timeoutMs: number): Promise<string> {
  const start = Date.now()
  const lastSeen: Record<string, number> = {}
  while (Date.now() - start < timeoutMs) {
    const files = await listMp4(publicDir)
    const candidates = files.filter(f => f.mtimeMs >= sinceMs)
    for (const f of candidates) {
      const prev = lastSeen[f.path]
      if (prev && prev === f.size) {
        return f.path
      }
      if (prev !== undefined && prev !== f.size) {
        console.log(`Progress: ${path.basename(f.path)} size ${prev} -> ${f.size} bytes`)
      } else if (prev === undefined) {
        console.log(`Detected new file: ${path.basename(f.path)} (${f.size} bytes)`)        
      }
      lastSeen[f.path] = f.size
    }
    await new Promise(r => setTimeout(r, 2000))
  }
  throw new Error('Timed out waiting for new video in public/')
}

async function pickNextMidi(queueDir: string): Promise<string | null> {
  let entries: any[] = []
  try {
    entries = await fs.readdir(queueDir, { withFileTypes: true })
  } catch { return null }
  const files: { name: string; path: string; mtimeMs: number }[] = []
  for (const e of entries) {
    if (!e.isFile()) continue
    if (!/\.(mid|midi|kar)$/i.test(e.name)) continue
    const p = path.join(queueDir, e.name)
    const st = await fs.stat(p)
    files.push({ name: e.name, path: p, mtimeMs: st.mtimeMs })
  }
  files.sort((a, b) => a.mtimeMs - b.mtimeMs)
  return files.length ? files[0].path : null
}

export async function processOneVideo(opts: Options, videoNumber?: number): Promise<boolean> {
  const prefix = videoNumber !== undefined ? `[${videoNumber}] ` : ''

  // Pick next MIDI (support dev override)
  let midiPath: string | null = null
  if (opts.devMidiPath) {
    const candidate = path.isAbsolute(opts.devMidiPath)
      ? opts.devMidiPath
      : path.resolve(opts.devMidiPath)
    try {
      await fs.access(candidate)
      midiPath = candidate
      console.log(`${prefix}Dev mode enabled: rendering ${candidate}`)
    } catch {
      console.error(`${prefix}Dev MIDI not found at ${candidate}. Place test.mid in midi/test_videos/ and try again.`)
      return false
    }
  } else {
    midiPath = await pickNextMidi(opts.queueDir)
  }
  if (!midiPath) {
    console.log(`${prefix}No MIDI files found in queue.`)
    return false
  }
  console.log(`${prefix}Rendering next: ${midiPath}`)

  // Parse MIDI to note events (what the page consumes via localStorage)
  const midiObject: MidiNote[] = await parseMidiFilePath(midiPath)

  // Extract metadata and refine via LLM for naming
  const { title: guessedTitle, artist: guessedArtist, trackNames } = await extractTitleArtist(midiPath)
  let title = guessedTitle
  let artist = guessedArtist
  const refined = await aiRefineMetadata({ filename: path.basename(midiPath), guessedTitle, guessedArtist, trackNames, model: opts.llmModel })
  if (refined?.title) title = refined.title
  if (refined?.artist) artist = refined.artist
  if (!artist || /^piano$/i.test(artist)) {
    const inferred = inferArtistFromFilename(midiPath)
    if (inferred) artist = inferred
  }
  artist = canonicalizeCommonArtistName(artist || 'Piano')

  const fileTitle = refined?.title_short ? refined.title_short : simplifyTitle(title)
  const displayName = sanitizeFileName(`${artist} - ${fileTitle}`)
  const targetName = `${displayName}.mp4`
  const targetPath = path.join(opts.outDir, targetName)

  await fs.mkdir(opts.outDir, { recursive: true })

  // Launch browser and preload localStorage
  const browser = await chromium.launch({ headless: opts.headless, slowMo: opts.slowMo, devtools: opts.devtools })
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  // Preload localStorage with processed MIDI
  console.log(`${prefix}Setting fallDuration in localStorage: ${opts.fallDuration}`)
  await context.addInitScript((payload) => {
    try { window.localStorage.setItem('processedMidiData', payload.data as string) } catch {}
    try { window.localStorage.setItem('midiMeta', payload.meta as string) } catch {}
    try { 
      window.localStorage.setItem('fallDuration', payload.fallDuration as string)
      console.log('✅ localStorage.fallDuration set to:', payload.fallDuration)
    } catch (e) {
      console.error('❌ Failed to set fallDuration:', e)
    }
  }, {
    data: JSON.stringify(midiObject),
    meta: JSON.stringify({ title: fileTitle, artist }),
    fallDuration: String(opts.fallDuration),
  })
  const page = await context.newPage()

  // Listen for page errors
  page.on('pageerror', (error) => {
    console.error(`${prefix}[PAGE ERROR]`, error.message)
  })
  // Log all console messages to file for debugging
  const logFile = path.join(process.cwd(), 'logs', `recording-${Date.now()}.log`)
  await fs.mkdir(path.join(process.cwd(), 'logs'), { recursive: true })
  
  page.on('console', async (msg) => {
    const text = msg.text()
    const logLine = `[${new Date().toISOString()}] ${text}\n`
    await fs.appendFile(logFile, logLine).catch(() => {})
    
    // Only show errors in console
    if (text.includes('Error') || text.includes('error') || text.includes('Failed')) {
      console.log(`${prefix}[CONSOLE]`, text)
    }
  })

  // const beforeFiles = await listMp4(opts.publicDir)
  const since = Date.now()

  const recordUrl = `${opts.baseUrl}/record`
  console.log(`${prefix}Opening ${recordUrl} ...`)

  try {
    // Vite/Remix dev servers keep HMR connections open; avoid networkidle here
    await page.goto(recordUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  } catch (error) {
    console.error(`${prefix}Failed to load page:`, error)
    throw error
  }

  console.log(`${prefix}Page loaded, waiting for record button...`)

  // Ensure the record button is visible and enabled before clicking
  try {
    await page.waitForSelector('#record-button', { state: 'visible', timeout: 120_000 })
  } catch (error) {
    console.error(`${prefix}Record button not found. Taking screenshot...`)
    await page.screenshot({ path: `error-${Date.now()}.png` })
    throw error
  }
  await page.waitForFunction(() => {
    const btn = document.querySelector('#record-button') as HTMLButtonElement | null
    return !!btn && !btn.disabled
  }, undefined, { timeout: 120_000 })
  console.log(`${prefix}Starting recording...`)
  await page.click('#record-button')

  // Wait for finalization to complete
  // The page sets window.__FINALIZATION_COMPLETE__ when audio has been generated and sent
  console.log(`${prefix}Waiting for recording and finalization to complete...`)
  await page.waitForFunction(() => {
    return (window as any).__FINALIZATION_COMPLETE__ === true
  }, undefined, { timeout: opts.timeoutMs })

  console.log(`${prefix}Finalization complete, closing browser...`)

  // Close browser - this triggers the WebSocket disconnect which generates the video
  await page.close()
  await context.close()
  await browser.close()

  console.log(`${prefix}Waiting for video generation...`)

  // Wait for new mp4 file in videos directory to stabilize
  const newVideoPath = await waitForNewVideo(opts.publicDir, since, opts.timeoutMs)
  console.log(`${prefix}New video detected: ${path.basename(newVideoPath)}`)

  // Move/rename into videos directory (only if paths differ)
  if (path.resolve(newVideoPath) !== path.resolve(targetPath)) {
    await fs.rename(newVideoPath, targetPath)
    console.log(`${prefix}Saved video: ${targetPath}`)
  } else {
    console.log(`${prefix}Video already in correct location: ${targetPath}`)
  }

  // Delete MIDI from queue if requested (default)
  if (!opts.keepMidi) {
    try { await fs.unlink(midiPath); console.log(`${prefix}Deleted source MIDI: ${midiPath}`) } catch {}
  }

  return true
}

async function main() {
  const args = process.argv.slice(2)
  const opts: Options = { ...DEFAULTS }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--queue-dir' && args[i + 1]) opts.queueDir = args[++i]
    else if (a === '--out-dir' && args[i + 1]) opts.outDir = args[++i]
    else if (a === '--public-dir' && args[i + 1]) opts.publicDir = args[++i]
    else if (a === '--base-url' && args[i + 1]) opts.baseUrl = args[++i]
    else if (a === '--keep-midi') opts.keepMidi = true
    else if (a === '--no-llm') opts.requireLLM = false
    else if (a === '--model' && args[i + 1]) opts.llmModel = args[++i]
    else if (a === '--timeout' && args[i + 1]) opts.timeoutMs = parseInt(args[++i]!, 10)
    else if (a === '--headful' || a === '--no-headless') opts.headless = false
    else if (a === '--slowmo' && args[i + 1]) opts.slowMo = parseInt(args[++i]!, 10)
    else if (a === '--devtools') opts.devtools = true
    else if (a === '-n' && args[i + 1]) opts.count = parseInt(args[++i]!, 10)
    else if (a.startsWith('-n') && a.length > 2) {
      // Support -n5 syntax
      const num = parseInt(a.substring(2), 10)
      if (!isNaN(num)) opts.count = num
    }
    else if (a === '-t' && args[i + 1]) {
      const fallDuration = parseFloat(args[++i]!)
      if (!isNaN(fallDuration) && fallDuration > 0) opts.fallDuration = fallDuration
    }
    else if (a === '--dev') {
      opts.devMidiPath = path.join('midi', 'test_videos', 'test.mid')
      opts.keepMidi = true
    }
  }

  if (opts.requireLLM && !process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY is required (or pass --no-llm to proceed without it).')
    process.exit(2)
  }

  console.log(`🎬 Processing ${opts.count} video${opts.count !== 1 ? 's' : ''} from queue...`)
  console.log('')

  let processed = 0
  for (let i = 1; i <= opts.count; i++) {
    try {
      const success = await processOneVideo(opts, opts.count > 1 ? i : undefined)
      if (success) {
        processed++
      } else {
        console.log(`\nQueue exhausted after ${processed} video${processed !== 1 ? 's' : ''}. Stopping.`)
        break
      }
      if (i < opts.count) {
        console.log('\n' + '='.repeat(60) + '\n')
      }
    } catch (error) {
      console.error(`\n❌ Error processing video ${i}:`, error)
      console.log(`Stopping after ${processed} successful video${processed !== 1 ? 's' : ''}.`)
      throw error
    }
  }

  console.log(`\n✅ Complete! Processed ${processed}/${opts.count} video${opts.count !== 1 ? 's' : ''}.`)
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
