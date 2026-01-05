import path from 'node:path'
import fs from 'node:fs/promises'

type UsedEntry = { midi: string; outFolder: string; usedAt: string }
type UsageFile = { version: 1; used: Record<string, UsedEntry[]> }

function decodeHtmlEntities(s: string): string {
  return (s || '')
    .replace(/&amp;/g, '&')
    .replace(/&#0*39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
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

function cleanSongDisplayName(fileBase: string, artistFolderName: string): string {
  let base = decodeHtmlEntities(fileBase)
  base = stripParens(base)
  base = base.replace(/[–—]/g, '-') // normalize en/em dash
  base = base.replace(/_/g, ' ')
  base = base.replace(/\s+/g, ' ').trim()
  if (!base) return 'Untitled'

  // Convert "... by X" into "... - X" (but keep arranger-style "Arrangement by X" intact)
  {
    const m = base.match(/^(.*?)\bby\b\s+(.+)$/i)
    if (m && m[1] && m[2]) {
      const left = m[1].trim().replace(/[-:,]+$/g, '').trim()
      const right = m[2].trim().replace(/^[-:,]+/g, '').trim()
      const leftIsArrangerish = /\b(arrangement|arr\.?|cover|tutorial|lesson|transcription)\b/i.test(left)
      const rightWordCount = right.split(/\s+/).filter(Boolean).length
      if (!leftIsArrangerish && rightWordCount > 0 && rightWordCount <= 6) {
        base = `${left} - ${right}`.replace(/\s+/g, ' ').trim()
      }
    }
  }

  // Remove dangling "by" if it's already been separated (e.g., "Arcade by")
  base = base.replace(/^\s*by\b\s+/i, '').replace(/\s+\bby\b\s*$/i, '').trim()
  if (!base) return 'Untitled'

  const artistKey = normalizeForCompare(artistFolderName)
  if (!artistKey) return base

  const artistRe = escapeRegExp(artistFolderName)

  const parts = base.split('-').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const firstKey = normalizeForCompare(parts[0]!)
    const lastKey = normalizeForCompare(parts[parts.length - 1]!)
    if (lastKey && lastKey === artistKey) return parts.slice(0, -1).join(' - ').trim() || 'Untitled'
    if (firstKey && firstKey === artistKey) return parts.slice(1).join(' - ').trim() || 'Untitled'
  }

  // Remove artist prefix even if not dash-separated (e.g., "Leonard Cohen Hallelujah")
  if (normalizeForCompare(base).startsWith(artistKey)) {
    const re = new RegExp(`^\\s*${artistRe}(?:\\s+|\\s*[-:_,]+\\s*)`, 'i')
    const withoutPrefix = base.replace(re, '').trim()
    if (withoutPrefix) base = withoutPrefix
  }

  // Remove artist suffix even if not dash-separated (e.g., "... Renaud")
  if (normalizeForCompare(base).endsWith(artistKey)) {
    const re = new RegExp(`(?:\\s+|\\s*[-:_,]+\\s*)(?:by\\s+)?${artistRe}\\s*$`, 'i')
    const withoutSuffix = base.replace(re, '').trim()
    if (withoutSuffix) base = withoutSuffix
  }

  // Clean up dangling connector again after removals (e.g., "Arcade by")
  base = base.replace(/^\s*by\b\s+/i, '').replace(/\s+\bby\b\s*$/i, '').trim()
  if (!base) return 'Untitled'

  // Remove artist occurrences anywhere (defensive against messy names like "... - Taylor Swift ...")
  base = base.replace(new RegExp(`(^|[\\s\\-_,:])${artistRe}([\\s\\-_,:]|$)`, 'ig'), '$1$2')
  base = base
    .replace(/\bby\b\s+(?=(from|for|in|on|with)\b)/ig, '')
    .replace(/\s*[,]+(\s*[,]+)+/g, ', ')
    .replace(/(^|[\s-])[,]+(?=$|[\s-])/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s+/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/(?:\s*-\s*){2,}/g, ' - ')
    .trim()
  base = base.replace(/^[-\s]+|[-\s]+$/g, '').trim()
  if (!base) return 'Untitled'

  // Collapse duplicates like "Style - Style"
  {
    const segs = base.split('-').map((p) => p.trim()).filter(Boolean)
    if (segs.length >= 2) {
      const first = segs[0]!
      const last = segs[segs.length - 1]!
      if (normalizeForCompare(first) && normalizeForCompare(first) === normalizeForCompare(last)) {
        base = first
      }
    }
  }

  return base
}

function toFileBase(name: string): string {
  const base = (name || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!base) return 'Untitled'
  return base.replace(/ /g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
}

function escapeRegExp(s: string): string {
  return (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function readUsageFile(filePath: string): Promise<UsageFile | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && parsed.version === 1 && typeof parsed.used === 'object' && parsed.used) return parsed as UsageFile
  } catch {}
  return null
}

async function writeUsageFile(filePath: string, data: UsageFile): Promise<void> {
  const tmp = `${filePath}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8')
  await fs.rename(tmp, filePath)
}

function normalizeRel(p: string): string {
  return path.relative(process.cwd(), p).split(path.sep).join('/')
}

type Rename = { fromAbs: string; toAbs: string; fromRel: string; toRel: string }

async function listMidiFiles(rootDir: string): Promise<string[]> {
  const out: string[] = []
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      const full = path.join(dir, e.name)
      if (e.isDirectory()) await walk(full)
      else if (e.isFile() && /\.(mid|midi|kar)$/i.test(e.name)) out.push(full)
    }
  }
  await walk(rootDir)
  return out
}

async function getUniqueTargetPath(dir: string, baseName: string, ext: string): Promise<string> {
  const candidate = path.join(dir, `${baseName}${ext}`)
  if (!(await fileExists(candidate))) return candidate
  for (let i = 2; i < 10_000; i++) {
    const next = path.join(dir, `${baseName}_${i}${ext}`)
    if (!(await fileExists(next))) return next
  }
  return path.join(dir, `${baseName}_${Date.now()}${ext}`)
}

async function safeRename(fromAbs: string, toAbs: string): Promise<void> {
  const fromDir = path.dirname(fromAbs)
  if (path.resolve(fromDir) !== path.resolve(path.dirname(toAbs))) {
    throw new Error(`Refusing to move across directories: ${fromAbs} -> ${toAbs}`)
  }

  if (path.resolve(fromAbs) === path.resolve(toAbs)) return

  const tmp = path.join(fromDir, `.rename_tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`)
  await fs.rename(fromAbs, tmp)
  await fs.rename(tmp, toAbs)
}

type CliOptions = { categoryDir: string; apply: boolean; usageFile: string | null; categoryName: string | null }

function parseArgs(argv: string[]): CliOptions {
  const categoryDir = argv[0]
  if (!categoryDir) {
    console.error('Usage: bun scripts/normalize_category_midi_filenames.ts <categoryDir> [--apply] [--usage-file <file>] [--category <name>]')
    process.exit(2)
  }
  const opts: CliOptions = { categoryDir, apply: false, usageFile: '.song_usage.json', categoryName: null }
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    if (a === '--apply') opts.apply = true
    else if (a === '--usage-file' && next) opts.usageFile = next, i++
    else if (a === '--no-usage-file') opts.usageFile = null
    else if (a === '--category' && next) opts.categoryName = next, i++
  }
  return opts
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const rootDir = path.resolve(opts.categoryDir)
  if (!(await fileExists(rootDir))) {
    console.error(`Error: category dir not found: ${rootDir}`)
    process.exit(2)
  }

  const files = await listMidiFiles(rootDir)
  if (!files.length) {
    console.log('No MIDI files found.')
    return
  }

  const renames: Rename[] = []
  for (const abs of files) {
    const dir = path.dirname(abs)
    const ext = path.extname(abs)
    const fileBase = path.basename(abs, ext)

    const artistFolderName = path.basename(dir)
    const cleanedDisplay = cleanSongDisplayName(fileBase, artistFolderName)
    const cleanedBase = toFileBase(cleanedDisplay)
    const desired = path.join(dir, `${cleanedBase}${ext}`)

    if (path.resolve(desired) === path.resolve(abs)) continue

    const target = await getUniqueTargetPath(dir, cleanedBase, ext)
    renames.push({ fromAbs: abs, toAbs: target, fromRel: normalizeRel(abs), toRel: normalizeRel(target) })
  }

  if (!renames.length) {
    console.log('Nothing to rename.')
    return
  }

  for (const r of renames) {
    console.log(`${r.fromRel} -> ${r.toRel}`)
  }

  if (!opts.apply) {
    console.log(`\nDry run: ${renames.length} rename(s). Re-run with --apply to perform.`)
    return
  }

  const usage = opts.usageFile ? await readUsageFile(opts.usageFile) : null

  const renameMap = new Map<string, string>(renames.map((r) => [r.fromRel, r.toRel]))
  let usageUpdates = 0
  if (usage) {
    const categoryName = opts.categoryName
    const categories = categoryName ? [categoryName] : Object.keys(usage.used || {})
    for (const c of categories) {
      const entries = usage.used[c]
      if (!entries) continue
      for (const e of entries) {
        const next = renameMap.get(e.midi)
        if (next && next !== e.midi) {
          e.midi = next
          usageUpdates++
        }
      }
    }
  }

  for (const r of renames) {
    await safeRename(r.fromAbs, r.toAbs)
  }

  if (usage && opts.usageFile && usageUpdates > 0) {
    await writeUsageFile(opts.usageFile, usage)
    console.log(`\nUpdated ${usageUpdates} usage entr${usageUpdates === 1 ? 'y' : 'ies'} in ${opts.usageFile}.`)
  }

  console.log(`\nDone: ${renames.length} rename(s).`)
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
