import path from 'node:path'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'

type UsedEntry = {
  midi: string
  outFolder: string
  usedAt: string
}

type UsageFile = {
  version: 1
  used: Record<string, UsedEntry[]>
}

const DEFAULT_USAGE_FILE = '.song_usage.json'
const DEFAULT_BASE_URL = 'http://localhost:5173'

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function canReachBaseUrl(baseUrl: string, timeoutMs = 2000): Promise<boolean> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(baseUrl, { method: 'GET', signal: controller.signal })
    return !!res
  } catch {
    return false
  } finally {
    clearTimeout(id)
  }
}

async function listMidiFilesRecursive(rootDir: string): Promise<string[]> {
  const out: string[] = []

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      const fullPath = path.join(dir, e.name)
      if (e.isDirectory()) await walk(fullPath)
      else if (e.isFile() && /\.(mid|midi|kar)$/i.test(e.name)) out.push(fullPath)
    }
  }

  await walk(rootDir)
  return out
}

function sanitizePathSegment(s: string): string {
  return (s || '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    || 'Untitled'
}

function stripParens(s: string): string {
  return (s || '').replace(/\([^)]*\)/g, ' ')
}

function normalizeForCompare(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function cleanSongNameFromFileBase(fileBase: string, artist: string): string {
  const base = stripParens(fileBase)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!base) return 'Untitled'

  const artistKey = normalizeForCompare(artist)
  if (!artistKey) return base

  const parts = base.split('-').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const firstKey = normalizeForCompare(parts[0]!)
    const lastKey = normalizeForCompare(parts[parts.length - 1]!)
    if (lastKey && lastKey === artistKey) return parts.slice(0, -1).join(' - ').trim() || 'Untitled'
    if (firstKey && firstKey === artistKey) return parts.slice(1).join(' - ').trim() || 'Untitled'
  }

  return base
}

async function getUniqueFolderPath(parentDir: string, baseName: string): Promise<string> {
  const basePath = path.join(parentDir, baseName)
  try {
    await fs.access(basePath)
  } catch {
    return basePath
  }
  for (let counter = 2; counter < 10_000; counter++) {
    const candidate = path.join(parentDir, `${baseName}_${counter}`)
    try {
      await fs.access(candidate)
    } catch {
      return candidate
    }
  }
  return path.join(parentDir, `${baseName}_${Date.now()}`)
}

async function readUsageFile(filePath: string): Promise<UsageFile> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && parsed.version === 1 && typeof parsed.used === 'object' && parsed.used) {
      return parsed as UsageFile
    }
  } catch {}
  return { version: 1, used: {} }
}

async function writeUsageFile(filePath: string, data: UsageFile): Promise<void> {
  const tmp = `${filePath}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8')
  await fs.rename(tmp, filePath)
}

function normalizeRel(p: string): string {
  return path.relative(process.cwd(), p).split(path.sep).join('/')
}

const KNOWN_COMPOSERS = /(bach|beethoven|chopin|debussy|mozart|liszt|schubert|schumann|rachmaninov|rachmaninoff|handel|haydn|tchaikovsky|chaikovsky|gershwin|albeniz)/i

function inferArtistAndSong(categoryDir: string, midiPath: string): { artist: string; song: string } {
  const rel = path.relative(categoryDir, midiPath)
  const parts = rel.split(path.sep).filter(Boolean)
  const fileBase = path.basename(rel, path.extname(rel)) || 'Untitled'

  if (parts.length >= 2) {
    const artist = parts[0] || 'Unknown'
    const song = cleanSongNameFromFileBase(fileBase, artist)
    return { artist, song }
  }

  const base = stripParens(fileBase.replace(/_/g, ' ').trim()).replace(/\s+/g, ' ').trim()
  const nameParts = base.split('-').map((p) => p.trim()).filter(Boolean)
  if (nameParts.length >= 2) {
    const first = stripParens(nameParts[0]!)
    const last = stripParens(nameParts[nameParts.length - 1]!)
    if (KNOWN_COMPOSERS.test(first)) {
      return { artist: first || 'Piano', song: stripParens(nameParts.slice(1).join(' - ')) || 'Untitled' }
    }
    if (KNOWN_COMPOSERS.test(last)) {
      return { artist: last || 'Piano', song: stripParens(nameParts.slice(0, -1).join(' - ')) || 'Untitled' }
    }
    return { artist: last || 'Unknown', song: stripParens(nameParts.slice(0, -1).join(' - ')) || 'Untitled' }
  }

  return { artist: 'Unknown', song: base || 'Untitled' }
}

type CliOptions = {
  category: string
  songsDir: string
  usageFile: string
  baseUrl: string | null
  bloom: boolean
  noLlm: boolean
  model: string | null
  timeoutMs: number | null
  dryRun: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const category = argv[0]
  if (!category) {
    console.error('Usage: bun scripts/record_category.ts <category> [--songs-dir <dir>] [--usage-file <file>] [--base-url <url>] [--bloom|-b] [--dry-run]')
    process.exit(2)
  }

  const opts: CliOptions = {
    category,
    songsDir: category,
    usageFile: DEFAULT_USAGE_FILE,
    baseUrl: null,
    bloom: false,
    noLlm: false,
    model: null,
    timeoutMs: null,
    dryRun: false,
  }

  for (let i = 1; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    if (a === '--songs-dir' && next) opts.songsDir = next, i++
    else if (a === '--usage-file' && next) opts.usageFile = next, i++
    else if (a === '--base-url' && next) opts.baseUrl = next, i++
    else if (a === '--bloom' || a === '-b') opts.bloom = true
    else if (a === '--no-llm') opts.noLlm = true
    else if (a === '--model' && next) opts.model = next, i++
    else if (a === '--timeout-ms' && next) opts.timeoutMs = Number(next), i++
    else if (a === '--dry-run') opts.dryRun = true
  }

  return opts
}

type RunResult = { code: number; stdout: string; stderr: string }

async function run(cmd: string, args: string[], opts?: { cwd?: string }): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts?.cwd ?? process.cwd(), env: process.env })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      const s = d.toString()
      stdout += s
      process.stdout.write(s)
    })
    child.stderr.on('data', (d) => {
      const s = d.toString()
      stderr += s
      process.stderr.write(s)
    })
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const shouldStripMetaTrailingIndex = ['pop', 'theme', 'finnish'].includes(opts.category)
  const baseUrl = opts.baseUrl || process.env.RENDER_BASE_URL || DEFAULT_BASE_URL

  const categoryDir = path.resolve(opts.songsDir)
  if (!(await fileExists(categoryDir))) {
    console.error(`Error: songs dir not found: ${categoryDir}`)
    process.exit(2)
  }

  const allMidis = await listMidiFilesRecursive(categoryDir)
  if (!allMidis.length) {
    console.error(`Error: no MIDI files found under: ${categoryDir}`)
    process.exit(2)
  }

  const usage = await readUsageFile(opts.usageFile)
  const usedForCategory = new Set((usage.used[opts.category] || []).map((e) => e.midi))

  const candidates = allMidis
    .map((p) => ({ abs: p, rel: normalizeRel(p) }))
    .filter((m) => !usedForCategory.has(m.rel))

  if (!candidates.length) {
    console.log(`No unused songs left for "${opts.category}".`)
    process.exit(0)
  }

  const picked = candidates[Math.floor(Math.random() * candidates.length)]!
  const { artist, song } = inferArtistAndSong(categoryDir, picked.abs)
  const artistDirName = sanitizePathSegment(artist)
  const songDirName = sanitizePathSegment(song)

  const categoryVideosDir = path.join('videos', opts.category)
  const artistVideosDir = path.join(categoryVideosDir, artistDirName)
  const desiredSongDir = path.join(artistVideosDir, songDirName)
  const outFolder = await getUniqueFolderPath(path.resolve(artistVideosDir), path.basename(desiredSongDir))

  console.log(`\nPicked: ${picked.rel}`)
  console.log(`Output: ${normalizeRel(outFolder)}\n`)

  if (opts.dryRun) return

  const reachable = await canReachBaseUrl(baseUrl)
  if (!reachable) {
    console.error(`Error: could not reach render server at ${baseUrl}`)
    console.error(`- Start it with: bun run dev`)
    console.error(`- Or pass a reachable URL: bun run ${opts.category} -- --base-url http://localhost:5173`)
    process.exit(2)
  }

  await fs.mkdir(path.dirname(outFolder), { recursive: true })
  const outFolderExisted = await fileExists(outFolder)

  const fullArgs: string[] = [
    'run',
    'record:full',
    '--dev-midi', picked.abs,
    '--out-folder', outFolder,
    '--base-url', baseUrl,
  ]
  if (opts.noLlm) fullArgs.push('--no-llm')
  if (opts.model) fullArgs.push('--model', opts.model)
  if (opts.timeoutMs) fullArgs.push('--timeout-ms', String(opts.timeoutMs))
  if (shouldStripMetaTrailingIndex) fullArgs.push('--strip-meta-trailing-index')
  if (opts.bloom) fullArgs.push('--bloom')

  const result = await run('bun', fullArgs)
  if (result.code !== 0) {
    if (!outFolderExisted) {
      try {
        const safePrefix = path.resolve(categoryVideosDir) + path.sep
        const resolvedOutFolder = path.resolve(outFolder)
        if (resolvedOutFolder.startsWith(safePrefix)) {
          await fs.rm(resolvedOutFolder, { recursive: true, force: true })
        }
      } catch {}
    }
    process.exit(result.code)
  }

  usage.used[opts.category] ||= []
  if (!usage.used[opts.category]!.some((e) => e.midi === picked.rel)) {
    usage.used[opts.category]!.push({
      midi: picked.rel,
      outFolder: normalizeRel(outFolder),
      usedAt: new Date().toISOString(),
    })
    await writeUsageFile(opts.usageFile, usage)
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
