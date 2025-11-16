// Build static public pages data from MIDI files
// - Scans midi/public/**/*.mid
// - Parses to midiObject JSON using scripts/parse_midi_to_json
// - Extracts title/artist (heuristics)
// - Writes public/public_midi_json/<slug>.json containing { title, artist, durationMs, midiSha256, midiObject }
// - Appends catalog/public.jsonl entries for discovery

import path from 'node:path'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'

import { parseMidiFilePath, type MidiNote } from './parse_midi_to_json'

type BuildOptions = {
  srcDir: string
  outDir: string
  manifestPath: string
  overwrite: boolean
  requireLLM: boolean
  llmModel: string
  sitemapPath: string
  baseUrl: string
  noSitemap: boolean
}

const DEFAULTS: BuildOptions = {
  srcDir: 'midi/public',
  outDir: 'public/public_midi_json',
  manifestPath: 'catalog/public.jsonl',
  overwrite: false,
  requireLLM: false,
  llmModel: 'gpt-5',
  sitemapPath: 'public/sitemap.xml',
  baseUrl: process.env.SITE_BASE_URL || 'https://pianobooth.com',
  noSitemap: false,
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

function canonicalizeCommonArtistName(artist: string): string {
  const a = artist || ''
  for (const [pattern, canon] of COMMON_NAME_MAP) {
    if (pattern.test(a)) return canon
  }
  return artist.trim()
}

function slugify(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function listMidiFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  async function walk(p: string) {
    let entries: any[] = []
    try {
      entries = await fs.readdir(p, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = path.join(p, e.name)
      if (e.isDirectory()) {
        await walk(full)
      } else if (/\.(mid|midi|kar)$/i.test(e.name)) {
        out.push(full)
      }
    }
  }
  await walk(dir)
  return out.sort()
}

async function computeSha256(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath)
  const h = createHash('sha256').update(buf).digest('hex')
  return h
}

type LicenseInfo = {
  name?: string
  url?: string
  text?: string
  attribution?: string
}

async function findLicenseSidecar(filePath: string): Promise<LicenseInfo | undefined> {
  const dir = path.dirname(filePath)
  const base = path.basename(filePath, path.extname(filePath))
  const candidates = [
    path.join(dir, `${base}.license.json`),
    path.join(dir, `${base}.license.txt`),
    path.join(dir, `LICENSE`),
    path.join(dir, `LICENSE.txt`),
    path.join(dir, `LICENSE.md`),
    path.join(dir, `COPYING`),
    path.join(dir, `COPYRIGHT`),
  ]

  for (const p of candidates) {
    try {
      const stat = await fs.stat(p)
      if (!stat.isFile()) continue
      if (p.endsWith('.json')) {
        try {
          const raw = await fs.readFile(p, 'utf-8')
          const obj = JSON.parse(raw)
          const lic: LicenseInfo = {}
          if (typeof obj.name === 'string') lic.name = obj.name
          if (typeof obj.url === 'string') lic.url = obj.url
          if (typeof obj.text === 'string') lic.text = obj.text
          if (typeof obj.attribution === 'string') lic.attribution = obj.attribution
          if (Object.keys(lic).length) return lic
        } catch {}
      } else {
        const text = await fs.readFile(p, 'utf-8')
        const trimmed = text.trim()
        if (trimmed) {
          // Limit text to a sane length to avoid huge JSON
          const maxLen = 8000
          return { text: trimmed.length > maxLen ? trimmed.slice(0, maxLen) + '\n...\n' : trimmed }
        }
      }
    } catch {}
  }
  return undefined
}

async function extractTitleArtistFromFile(filePath: string): Promise<{ title: string; artist: string; trackNames: string[]; headerName: string }> {
  // Use @tonejs/midi to inspect header and track names
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
  } else if (trackNames.length) {
    const hyphen = trackNames.find((n: string) => n.includes('-'))
    if (hyphen) {
      const parts = hyphen.split('-').map((s) => s.trim())
      if (parts.length >= 2) {
        const [a, b] = parts
        if (a.length <= b.length) artist = a
        if (!title) title = b
      }
    }
  }

  // If the title contains the composer prefix like "Beethoven - Für Elise", strip it
  if (title) {
    const m = title.match(/^(.*?)[-:\u2013]\s*(.+)$/)
    if (m) {
      const maybeComposer = m[1].trim()
      const rest = m[2].trim()
      if (KNOWN_COMPOSERS.test(maybeComposer)) {
        title = rest
      }
    }
  }

  artist = canonicalizeCommonArtistName(artist || 'Piano')
  if (!title) title = 'Untitled'
  return { title, artist, trackNames, headerName }
}

function computeDurationMs(midiObject: MidiNote[]): number {
  let maxUs = 0
  for (const n of midiObject) {
    const end = (n.Delta || 0) + (n.Duration || 0)
    if (end > maxUs) maxUs = end
  }
  return Math.floor(maxUs / 1000)
}

// Optional LLM refinement using OpenAI Chat Completions
async function aiRefineMetadata(params: {
  filename: string
  guessedTitle: string
  guessedArtist: string
  trackNames: string[]
  apiKey?: string
  model?: string
  timeoutMs?: number
}): Promise<{ title?: string; artist?: string; title_short?: string; artist_short?: string } | null> {
  const { filename, guessedTitle, guessedArtist, trackNames } = params
  const apiKey = params.apiKey || process.env.OPENAI_API_KEY
  const model = params.model || 'gpt-5'
  const timeoutMs = params.timeoutMs || 30000
  if (!apiKey) return null
  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    const system = (
      'You are a precise metadata normalizer for classical piano MIDI files. ' +
      'Respond with a strict JSON object only. ' +
      "For classical composers, use the most common short canonical name for the artist (last name only), e.g., 'Bach', 'Beethoven', 'Chopin', 'Mozart', 'Debussy', 'Liszt', 'Schubert', 'Schumann', 'Rachmaninoff', 'Handel', 'Haydn', 'Tchaikovsky', 'Gershwin'. " +
      'Return both a display title/artist and concise short variants for slugs. '
    )
    const user = {
      instruction:
        "Given MIDI hints, return best-guess fields artist and title. " +
        "Favor the most common short canonical name for the artist (e.g., 'Bach' not 'Johann Sebastian Bach'). " +
        "Provide short variants optimized for URL slugs: 'artist_short' and 'title_short'. " +
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
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
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
    const title = typeof obj?.title === 'string' ? obj.title.trim() : undefined
    const artist = typeof obj?.artist === 'string' ? obj.artist.trim() : undefined
    const title_short = typeof obj?.title_short === 'string' ? obj.title_short.trim() : undefined
    const artist_short = typeof obj?.artist_short === 'string' ? obj.artist_short.trim() : undefined
    return { title, artist, title_short, artist_short }
  } catch {
    return null
  }
}

function simplifyTitle(title: string): string {
  if (!title) return title
  let t = title
  // Drop collection names and abbreviations (WTC) and book markers anywhere they appear
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
  // Remove leftover leading/trailing punctuation from removed tokens
  t = t.replace(/^[\s\-:–]+/, '').replace(/[\s\-:–]+$/, '')
  // Collapse repeated separators
  t = t.replace(/[\-–]{2,}/g, '-').replace(/\s+/g, ' ').trim()
  return t
}

function makeSlugs(artist: string, title: string): { artistSlug: string; songSlug: string } {
  const a = slugify(artist)
  const s = slugify(simplifyTitle(title))
  return { artistSlug: a || 'piano', songSlug: s || 'untitled' }
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true })
}

async function writeJson(outPath: string, data: any, overwrite: boolean) {
  try {
    if (!overwrite) {
      await fs.access(outPath)
      // exists and no overwrite: skip
      return false
    }
  } catch {
    // not exists -> ok
  }
  await ensureDir(path.dirname(outPath))
  await fs.writeFile(outPath, JSON.stringify(data))
  return true
}

async function appendManifest(manifestPath: string, entry: any) {
  await ensureDir(path.dirname(manifestPath))
  const line = JSON.stringify(entry) + '\n'
  await fs.appendFile(manifestPath, line)
}

async function readManifestEntries(manifestPath: string): Promise<any[]> {
  const entries: any[] = []
  try {
    const raw = await fs.readFile(manifestPath, 'utf-8')
    for (const line of raw.split(/\r?\n/)) {
      const l = line.trim()
      if (!l) continue
      try { entries.push(JSON.parse(l)) } catch {}
    }
  } catch {}
  return entries
}

function normalizeBaseUrl(u: string): string {
  if (!u) return ''
  return u.replace(/\/$/, '')
}

async function writeSitemap(manifestPath: string, sitemapPath: string, baseUrl: string) {
  const entries = await readManifestEntries(manifestPath)
  if (!entries.length) return
  const seen = new Set<string>()
  const urls: string[] = []
  const origin = normalizeBaseUrl(baseUrl)
  for (const e of entries) {
    let route = e.url as string | undefined
    if (!route) {
      const a = e.artistSlug, s = e.songSlug
      if (a && s) route = `/${a}/${s}`
    }
    if (!route) continue
    const loc = origin ? `${origin}${route}` : route
    if (!seen.has(loc)) { seen.add(loc); urls.push(loc) }
  }

  const parts: string[] = []
  parts.push('<?xml version="1.0" encoding="UTF-8"?>')
  parts.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
  for (const loc of urls) {
    parts.push('  <url>')
    parts.push(`    <loc>${loc}</loc>`)
    parts.push('  </url>')
  }
  parts.push('</urlset>')

  const xml = parts.join('\n')
  await ensureDir(path.dirname(sitemapPath))
  await fs.writeFile(sitemapPath, xml)
}

async function buildOne(filePath: string, opts: BuildOptions) {
  const midiSha256 = await computeSha256(filePath)
  const midiObject = await parseMidiFilePath(filePath)
  const durationMs = computeDurationMs(midiObject)
  const { title: guessedTitle, artist: guessedArtist, trackNames, headerName } = await extractTitleArtistFromFile(filePath)

  // Optionally refine via LLM
  let title = guessedTitle
  let artist = guessedArtist
  let slugTitleHint: string | undefined
  let slugArtistHint: string | undefined
  const apiKeyPresent = !!process.env.OPENAI_API_KEY
  if (apiKeyPresent) {
    const refined = await aiRefineMetadata({
      filename: path.basename(filePath),
      guessedTitle,
      guessedArtist,
      trackNames,
      model: opts.llmModel,
    })
    if (refined?.title) title = refined.title
    if (refined?.artist) artist = refined.artist
    if (refined?.title_short) slugTitleHint = refined.title_short
    if (refined?.artist_short) slugArtistHint = refined.artist_short
  } else if (opts.requireLLM) {
    throw new Error('OPENAI_API_KEY not set but --require-llm specified')
  }
  artist = canonicalizeCommonArtistName(artist)
  title = simplifyTitle(title)

  const artistForSlug = canonicalizeCommonArtistName(slugArtistHint || artist)
  const titleForSlug = simplifyTitle(slugTitleHint || title)
  const { artistSlug, songSlug } = makeSlugs(artistForSlug, titleForSlug)

  const license = await findLicenseSidecar(filePath)

  const outJson = {
    title,
    artist,
    durationMs,
    midiSha256,
    midiObject,
    ...(license ? { license } : {}),
  }

  const outPath = path.join(opts.outDir, artistSlug, `${songSlug}.json`)
  const wrote = await writeJson(outPath, outJson, opts.overwrite)
  if (!wrote) {
    return { skipped: true, artistSlug, songSlug, outPath, title, artist, durationMs, midiSha256 }
  }

  await appendManifest(opts.manifestPath, {
    artistSlug,
    songSlug,
    title,
    artist,
    durationMs,
    midiSha256,
    jsonPath: `public_midi_json/${artistSlug}/${songSlug}.json`,
    url: `/${artistSlug}/${songSlug}`,
    ...(license ? { license } : {}),
  })

  return { skipped: false, artistSlug, songSlug, outPath, title, artist, durationMs, midiSha256 }
}

async function main() {
  const args = process.argv.slice(2)
  const opts: BuildOptions = { ...DEFAULTS }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--src' && args[i + 1]) opts.srcDir = args[++i]
    else if (a === '--out-dir' && args[i + 1]) opts.outDir = args[++i]
    else if (a === '--manifest' && args[i + 1]) opts.manifestPath = args[++i]
    else if (a === '--overwrite') opts.overwrite = true
    else if (a === '--require-llm') opts.requireLLM = true
    else if (a === '--model' && args[i + 1]) opts.llmModel = args[++i]
    else if (a === '--sitemap' && args[i + 1]) opts.sitemapPath = args[++i]
    else if (a === '--base-url' && args[i + 1]) opts.baseUrl = args[++i]
    else if (a === '--no-sitemap') opts.noSitemap = true
  }

  if (opts.requireLLM && !process.env.OPENAI_API_KEY) {
    console.error('Error: --require-llm specified but OPENAI_API_KEY is not set')
    process.exit(2)
  }

  const files = await listMidiFiles(opts.srcDir)
  if (files.length === 0) {
    console.log(`No MIDI files found under ${opts.srcDir}`)
    return
  }

  console.log(`Found ${files.length} MIDI file(s). Building public JSON…`)

  let wrote = 0
  for (const f of files) {
    try {
      const res = await buildOne(f, opts)
      if (res.skipped) {
        console.log(`skip  ${path.relative(process.cwd(), f)} -> ${res.artistSlug}/${res.songSlug}`)
      } else {
        wrote++
        console.log(`write ${path.relative(process.cwd(), f)} -> ${res.artistSlug}/${res.songSlug}`)
      }
    } catch (e) {
      console.error(`error ${f}:`, e)
    }
  }

  console.log(`Done. Wrote ${wrote} JSON file(s) to ${opts.outDir}`)
  // Generate sitemap.xml unless disabled
  if (!opts.noSitemap) {
    if (!opts.baseUrl) {
      console.log('Note: SITE_BASE_URL not set and --base-url not provided; writing sitemap with path-only loc values.')
    }
    try {
      await writeSitemap(opts.manifestPath, opts.sitemapPath, opts.baseUrl)
      console.log(`Sitemap written to ${opts.sitemapPath}`)
    } catch (e) {
      console.warn('Failed to write sitemap:', e)
    }
  }
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
