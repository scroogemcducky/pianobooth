// Renders the next MIDI in midi/video_queue/ to an MP4 using the /record_mobile page,
// then rotates the resulting landscape video 90 degrees clockwise for Shorts (portrait 9:16).

import path from 'node:path'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

import { parseMidiFilePath, type MidiNote } from './parse_midi_to_json'
import { createNormalizedMidi } from './normalize_midi'
import { COLOR_PRESETS } from '../app/utils/colorPresets'

const TEASER_FADE_START_SECONDS = 40
const TEASER_FADE_DURATION_SECONDS = 2

type Options = {
  queueDir: string
  publicDir: string
  outDir: string
  baseUrl: string
  timeoutMs: number
  headless: boolean
  slowMo: number
  devtools: boolean
  devMidiPath: string | null
  count: number
  fallDuration: number
  keepLandscape: boolean
  consumeMidi: boolean
}

const DEFAULTS: Options = {
  queueDir: 'midi/video_queue',
  publicDir: 'videos',
  outDir: 'videos/mobile',
  baseUrl: process.env.RENDER_BASE_URL || 'http://localhost:5173',
  timeoutMs: 30 * 60 * 1000,
  headless: false,
  slowMo: 0,
  devtools: false,
  devMidiPath: null,
  count: 1,
  fallDuration: 2,
  keepLandscape: false,
  consumeMidi: false,
}

const KNOWN_COMPOSERS = /(bach|beethoven|chopin|debussy|mozart|liszt|schubert|schumann|rachmaninoff|handel|haydn|tchaikovsky|gershwin|albeniz)/i

function sanitizeFileName(s: string): string {
  return (s || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
}

function parseArgs(argv: string[]): Partial<Options> {
  const out: Partial<Options> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    if (a === '--queue-dir' && next) out.queueDir = next, i++
    else if (a === '--public-dir' && next) out.publicDir = next, i++
    else if (a === '--out-dir' && next) out.outDir = next, i++
    else if (a === '--base-url' && next) out.baseUrl = next, i++
    else if (a === '--timeout-ms' && next) out.timeoutMs = Number(next), i++
    else if (a === '--headless') out.headless = true
    else if (a === '--slow-mo' && next) out.slowMo = Number(next), i++
    else if (a === '--devtools') out.devtools = true
    else if (a === '--dev-midi' && next) out.devMidiPath = next, i++
    else if (a === '--count' && next) out.count = Number(next), i++
    else if (a === '--fall-duration' && next) out.fallDuration = Number(next), i++
    else if (a === '--keep-landscape') out.keepLandscape = true
    else if (a === '--consume-midi') out.consumeMidi = true
  }
  return out
}

async function pickNextMidi(queueDir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(queueDir)
    const mids = entries.filter((f) => /\.(mid|midi)$/i.test(f)).sort()
    if (!mids.length) return null
    return path.join(queueDir, mids[0])
  } catch {
    return null
  }
}

function inferMetaFromFilename(filePath: string): { title: string; artist: string } {
  const stripParens = (s: string) => s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  const base = stripParens(path.basename(filePath, path.extname(filePath)).replace(/_/g, ' ').trim())
  const parts = base.split('-').map((p) => p.trim()).filter(Boolean)

  if (parts.length >= 2) {
    const first = stripParens(parts[0])
    const last = stripParens(parts[parts.length - 1])
    const rest = stripParens(parts.slice(1, parts.length - 1).join(' - '))

    const firstLooksComposer = KNOWN_COMPOSERS.test(first)
    const lastLooksComposer = KNOWN_COMPOSERS.test(last)

    if (firstLooksComposer) {
      return { artist: first || 'Piano', title: stripParens(parts.slice(1).join(' - ')) || 'Untitled' }
    }
    if (lastLooksComposer) {
      return { artist: last || 'Piano', title: stripParens(parts.slice(0, -1).join(' - ')) || 'Untitled' }
    }

    // Default: treat trailing segment as artist (common for pop MIDIs like "Song - Artist (Easy Piano)")
    const artist = last || 'Piano'
    const title = stripParens([first, rest].filter(Boolean).join(' - ')) || 'Untitled'
    return { artist, title }
  }

  return { artist: 'Piano', title: stripParens(base) || 'Untitled' }
}

async function getUniqueFilePath(dir: string, baseName: string, ext: string): Promise<string> {
  const clean = sanitizeFileName(baseName) || 'Untitled'
  for (let i = 0; i < 1000; i++) {
    const suffix = i === 0 ? '' : `_${i + 1}`
    const candidate = path.join(dir, `${clean}${suffix}${ext}`)
    try {
      await fs.access(candidate)
    } catch {
      return candidate
    }
  }
  return path.join(dir, `${clean}_${Date.now()}${ext}`)
}

async function listMp4(dir: string): Promise<Array<{ filePath: string; mtimeMs: number; size: number }>> {
  let entries: string[] = []
  try {
    entries = await fs.readdir(dir)
  } catch {
    return []
  }
  const out: Array<{ filePath: string; mtimeMs: number; size: number }> = []
  for (const name of entries) {
    if (!/\.mp4$/i.test(name)) continue
    const filePath = path.join(dir, name)
    try {
      const st = await fs.stat(filePath)
      out.push({ filePath, mtimeMs: st.mtimeMs, size: st.size })
    } catch {}
  }
  out.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return out
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function waitForNewVideo(dir: string, sinceMs: number, timeoutMs: number): Promise<string> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const files = (await listMp4(dir)).filter((f) => f.mtimeMs >= sinceMs)
    if (files.length) {
      const candidate = files[0].filePath
      return candidate
    }
    await sleep(1000)
  }
  throw new Error(`Timed out waiting for MP4 in ${dir}`)
}

async function isValidMp4(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
  } catch {
    return false
  }
  return new Promise<boolean>((resolve) => {
    const proc = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', filePath], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    proc.stdout.on('data', (d) => { out += d.toString() })
    proc.on('close', (code) => {
      if (code !== 0) return resolve(false)
      const duration = parseFloat((out || '').trim())
      resolve(Number.isFinite(duration) && duration > 0)
    })
    proc.on('error', () => resolve(false))
  })
}

async function probeDurationSeconds(filePath: string): Promise<number | null> {
  try {
    await fs.access(filePath)
  } catch {
    return null
  }
  return new Promise<number | null>((resolve) => {
    const proc = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', filePath], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    proc.stdout.on('data', (d) => { out += d.toString() })
    proc.on('close', (code) => {
      if (code !== 0) return resolve(null)
      const duration = parseFloat((out || '').trim())
      resolve(Number.isFinite(duration) && duration > 0 ? duration : null)
    })
    proc.on('error', () => resolve(null))
  })
}

async function probeHasAudio(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
  } catch {
    return false
  }
  return new Promise<boolean>((resolve) => {
    const proc = spawn('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_type', '-of', 'default=nw=1:nk=1', filePath], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    proc.stdout.on('data', (d) => { out += d.toString() })
    proc.on('close', (code) => {
      if (code !== 0) return resolve(false)
      resolve((out || '').trim() === 'audio')
    })
    proc.on('error', () => resolve(false))
  })
}

async function waitForValidMp4(filePath: string, timeoutMs: number): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await isValidMp4(filePath)) return
    await sleep(1000)
  }
  throw new Error(`Timed out waiting for valid MP4 (ffprobe) at ${filePath}`)
}

async function generateAudioFromMidi(midiPath: string, outputPath: string, audioDelaySeconds: number): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('uv', ['run', 'scripts/generate_audio.py', midiPath, outputPath, '--delay', String(audioDelaySeconds)], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    proc.stdout.on('data', (d) => process.stdout.write(d.toString()))
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve(true)
      else {
        console.error(`❌ Audio generation failed (exit ${code}): ${stderr}`)
        resolve(false)
      }
    })
    proc.on('error', (e) => {
      console.error(`❌ Failed to spawn audio generator: ${e.message}`)
      resolve(false)
    })
  })
}

async function rotateClockwise90(inputPath: string, outputPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const args = [
      '-y',
      '-i', inputPath,
      '-vf', 'transpose=1',
      '-map', '0:v:0',
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'fast',
      '-crf', '18',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      outputPath,
    ]
    const ffmpeg = spawn('ffmpeg', args, { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] })
    ffmpeg.stdout.on('data', (d) => process.stdout.write(d.toString()))
    ffmpeg.stderr.on('data', (d) => process.stdout.write(d.toString()))
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg rotate failed (exit ${code})`))
    })
    ffmpeg.on('error', (e) => reject(e))
  })
}

async function createTeaserVideo(params: {
  inputPath: string
  outputPath: string
  fadeStartSeconds: number
  fadeDurationSeconds: number
  maxDurationSeconds: number
}): Promise<void> {
  const hasAudio = await probeHasAudio(params.inputPath)
  await new Promise<void>((resolve, reject) => {
    const vf = `fade=t=out:st=${params.fadeStartSeconds}:d=${params.fadeDurationSeconds}`
    const args = [
      '-y',
      '-i', params.inputPath,
      '-t', String(params.maxDurationSeconds),
      '-vf', vf,
      '-map', '0:v:0',
      '-map', '0:a?',
    ]
    if (hasAudio) {
      const af = `afade=t=out:st=${params.fadeStartSeconds}:d=${params.fadeDurationSeconds}`
      args.push('-af', af)
    }
    args.push(
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'fast',
      '-crf', '18',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      params.outputPath,
    )
    const ffmpeg = spawn('ffmpeg', args, { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] })
    ffmpeg.stdout.on('data', (d) => process.stdout.write(d.toString()))
    ffmpeg.stderr.on('data', (d) => process.stdout.write(d.toString()))
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg teaser failed (exit ${code})`))
    })
    ffmpeg.on('error', (e) => reject(e))
  })
}

async function processOneMobileVideo(opts: Options, videoNumber?: number): Promise<boolean> {
  const prefix = videoNumber !== undefined ? `[${videoNumber}] ` : ''

  const midiPath =
    opts.devMidiPath
      ? (path.isAbsolute(opts.devMidiPath) ? opts.devMidiPath : path.resolve(opts.devMidiPath))
      : await pickNextMidi(opts.queueDir)

  if (!midiPath) {
    console.log(`${prefix}No MIDI files found in queue.`)
    return false
  }

  const originalMidiPath = midiPath
  console.log(`${prefix}Rendering (mobile): ${originalMidiPath}`)

  const midiObject: MidiNote[] = await parseMidiFilePath(originalMidiPath)

  // Hash for uniqueness/debugging only
  const midiBuffer = await fs.readFile(originalMidiPath)
  const midiHash = createHash('sha256').update(midiBuffer).digest('hex').slice(0, 8)

  const meta = inferMetaFromFilename(originalMidiPath)
  const displayName = sanitizeFileName(`${meta.artist} - ${meta.title}`) || `Piano - Untitled_${midiHash}`

  await fs.mkdir(opts.outDir, { recursive: true })
  const portraitTargetPath = await getUniqueFilePath(opts.outDir, displayName, '.mp4')
  const teaserTargetPath = await getUniqueFilePath(opts.outDir, `${displayName}_teaser`, '.mp4')
  const landscapeTempPath = portraitTargetPath.replace(/\.mp4$/i, '_landscape.mp4')

  // Audio delay = NOTE_START_DELAY_SECONDS (0) + fallDuration (time to reach keys)
  const NOTE_START_DELAY_SECONDS = 0
  const audioDelay = NOTE_START_DELAY_SECONDS + opts.fallDuration

  const tempAudioDir = path.join(process.cwd(), 'temp_audio')
  await fs.mkdir(tempAudioDir, { recursive: true })
  const audioBaseName = path.basename(portraitTargetPath, '.mp4')
  const audioPath = path.join(tempAudioDir, `${audioBaseName}.wav`)
  const normalizedMidiPath = path.join(tempAudioDir, `${audioBaseName}_normalized.mid`)

  try {
    await createNormalizedMidi(originalMidiPath, normalizedMidiPath)
  } catch (e) {
    console.warn(`${prefix}⚠️ Failed to normalize MIDI for audio sync, using original:`, e)
  }

  let midiForAudio = originalMidiPath
  try {
    await fs.access(normalizedMidiPath)
    midiForAudio = normalizedMidiPath
  } catch {}

  const audioGenerated = await generateAudioFromMidi(midiForAudio, audioPath, audioDelay)
  if (!audioGenerated) console.warn(`${prefix}⚠️ Audio generation failed; video may be silent`)

  const presetIndex = Math.floor(Math.random() * COLOR_PRESETS.length)
  const browser = await chromium.launch({ headless: opts.headless, slowMo: opts.slowMo, devtools: opts.devtools })
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })

  await context.addInitScript((payload) => {
    try { window.localStorage.setItem('processedMidiData', payload.data as string) } catch {}
    try { window.localStorage.setItem('midiMeta', payload.meta as string) } catch {}
    try { window.localStorage.setItem('fallDuration', payload.fallDuration as string) } catch {}
    try { window.localStorage.setItem('fallDurationMobile', payload.fallDuration as string) } catch {}
    try {
      window.localStorage.setItem('preGeneratedAudioPath', payload.audioPath as string)
      window.localStorage.setItem('skipBrowserAudio', payload.skipBrowserAudio as string)
    } catch {}
  }, {
    data: JSON.stringify(midiObject),
    meta: JSON.stringify({ title: meta.title, artist: meta.artist }),
    fallDuration: String(opts.fallDuration),
    audioPath: audioGenerated ? audioPath : '',
    skipBrowserAudio: audioGenerated ? 'true' : 'false',
  })

  const page = await context.newPage()
  const since = Date.now()
  const recordUrl = `${opts.baseUrl}/record_mobile?preset=${presetIndex}`
  console.log(`${prefix}Opening ${recordUrl} ...`)

  try {
    await page.goto(opts.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.goto(recordUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  } catch (e) {
    console.error(`${prefix}Failed to load /record_mobile:`, e)
    await browser.close()
    throw e
  }

  await page.waitForSelector('#record-button', { state: 'visible', timeout: 120_000 })
  await page.waitForFunction(() => {
    const btn = document.querySelector('#record-button') as HTMLButtonElement | null
    return !!btn && !btn.disabled
  }, undefined, { timeout: 120_000 })

  await page.waitForFunction(() => (window as any).__COLOR_PRESET_READY__ === true, undefined, { timeout: 30_000 })
  await page.waitForTimeout(1000)

  console.log(`${prefix}Starting recording...`)
  await page.click('#record-button')

  console.log(`${prefix}Waiting for finalization...`)
  await page.waitForFunction(() => (window as any).__FINALIZATION_COMPLETE__ === true, undefined, { timeout: opts.timeoutMs })

  await page.close()
  await context.close()
  await browser.close()

  console.log(`${prefix}Waiting for landscape MP4...`)
  const newVideoPath = await waitForNewVideo(opts.publicDir, since, opts.timeoutMs)
  await waitForValidMp4(newVideoPath, Math.min(opts.timeoutMs, 5 * 60 * 1000))
  await fs.rename(newVideoPath, landscapeTempPath)
  console.log(`${prefix}Saved landscape: ${landscapeTempPath}`)

  console.log(`${prefix}Rotating to portrait...`)
  await rotateClockwise90(landscapeTempPath, portraitTargetPath)
  console.log(`${prefix}Saved portrait: ${portraitTargetPath}`)

  // Create teaser (fade video + audio starting at 40s, 2s fade; end at fade end)
  const durationSec = await probeDurationSeconds(portraitTargetPath)
  const effectiveFadeStart =
    typeof durationSec === 'number' && durationSec < (TEASER_FADE_START_SECONDS + TEASER_FADE_DURATION_SECONDS)
      ? Math.max(0, durationSec - TEASER_FADE_DURATION_SECONDS)
      : TEASER_FADE_START_SECONDS
  const teaserMaxDuration =
    typeof durationSec === 'number'
      ? Math.min(durationSec, effectiveFadeStart + TEASER_FADE_DURATION_SECONDS)
      : (effectiveFadeStart + TEASER_FADE_DURATION_SECONDS)

  console.log(`${prefix}Creating teaser: fade at ${effectiveFadeStart.toFixed(2)}s for ${TEASER_FADE_DURATION_SECONDS}s...`)
  await createTeaserVideo({
    inputPath: portraitTargetPath,
    outputPath: teaserTargetPath,
    fadeStartSeconds: effectiveFadeStart,
    fadeDurationSeconds: TEASER_FADE_DURATION_SECONDS,
    maxDurationSeconds: teaserMaxDuration,
  })
  console.log(`${prefix}Saved teaser: ${teaserTargetPath}`)

  if (!opts.keepLandscape) {
    try { await fs.unlink(landscapeTempPath) } catch {}
  }

  // By default, do not modify or move the MIDI file. Opt-in consumption is available.
  if (!opts.devMidiPath && opts.consumeMidi) {
    try {
      const doneDir = path.join(path.dirname(opts.queueDir), 'video_done')
      await fs.mkdir(doneDir, { recursive: true })
      const finalMidiName = path.basename(originalMidiPath)
      const dest = path.join(doneDir, finalMidiName)
      await fs.rename(originalMidiPath, dest)
      console.log(`${prefix}Moved MIDI to: ${dest}`)
    } catch (e) {
      console.warn(`${prefix}⚠️ Failed to move MIDI to video_done:`, e)
    }
  }

  return true
}

async function main() {
  const opts: Options = { ...DEFAULTS, ...parseArgs(process.argv.slice(2)) } as Options
  if (!opts.baseUrl) throw new Error('Missing --base-url (or RENDER_BASE_URL)')
  if (!Number.isFinite(opts.fallDuration) || opts.fallDuration <= 0) throw new Error('--fall-duration must be > 0')

  for (let i = 0; i < (opts.count || 1); i++) {
    const ok = await processOneMobileVideo(opts, opts.count > 1 ? i + 1 : undefined)
    if (!ok) break
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
