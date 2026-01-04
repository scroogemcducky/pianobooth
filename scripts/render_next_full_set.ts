// Generates a full asset set for one MIDI:
// 1) Normal (landscape) video + thumbnails (via scripts/render_next_video.ts)
// 2) Mobile portrait video + teaser (via scripts/render_next_mobile_video.ts)
// Ensures mobile outputs land in the same folder as the normal outputs.

import path from 'node:path'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'

type Options = {
  baseUrl: string
  outDir: string
  queueDir: string
  publicDir: string
  devMidiPath: string | null
  noLlm: boolean
  model: string | null
  timeoutMs: number | null
  consumeMidi: boolean
}

const DEFAULTS: Options = {
  baseUrl: process.env.RENDER_BASE_URL || 'http://localhost:5173',
  outDir: 'videos',
  queueDir: 'midi/video_queue',
  publicDir: 'videos',
  devMidiPath: null,
  noLlm: false,
  model: null,
  timeoutMs: null,
  consumeMidi: false,
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { ...DEFAULTS }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = argv[i + 1]
    if (a === '--base-url' && next) opts.baseUrl = next, i++
    else if (a === '--out-dir' && next) opts.outDir = next, i++
    else if (a === '--queue-dir' && next) opts.queueDir = next, i++
    else if (a === '--public-dir' && next) opts.publicDir = next, i++
    else if (a === '--dev-midi' && next) opts.devMidiPath = next, i++
    else if (a === '--no-llm') opts.noLlm = true
    else if (a === '--model' && next) opts.model = next, i++
    else if (a === '--timeout-ms' && next) opts.timeoutMs = Number(next), i++
    else if (a === '--consume-midi') opts.consumeMidi = true
  }
  return opts
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
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

function extractFirstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re)
  return m && m[1] ? m[1].trim() : null
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (!opts.baseUrl) throw new Error('Missing --base-url (or RENDER_BASE_URL)')

  const normalArgs = [
    'scripts/render_next_video.ts',
    '--out-dir', opts.outDir,
    '--public-dir', opts.publicDir,
    '--queue-dir', opts.queueDir,
    '--base-url', opts.baseUrl,
    '--keep-midi',
    '-n', '1',
  ]
  if (opts.noLlm) normalArgs.push('--no-llm')
  if (opts.model) normalArgs.push('--model', opts.model)
  if (opts.timeoutMs) normalArgs.push('--timeout', String(opts.timeoutMs))
  if (opts.devMidiPath) normalArgs.push('--dev-midi', opts.devMidiPath)

  console.log(`\n=== Normal (landscape) + thumbnails ===\n`)
  const normal = await run('bun', normalArgs)
  if (normal.code !== 0) process.exit(normal.code)

  const midiPathUsed =
    extractFirstMatch(normal.stdout, /^Rendering next:\s+(.+)$/m) ||
    extractFirstMatch(normal.stdout, /^Dev mode enabled: rendering\s+(.+)$/m) ||
    extractFirstMatch(normal.stdout, /^Rendering:\s+(.+)$/m)

  const folderName = extractFirstMatch(normal.stdout, /^Output folder:\s+(.+?)\/\s*$/m)
  if (!folderName) {
    console.error('\n❌ Could not determine output folder from render_next_video logs.\n')
    process.exit(2)
  }
  const outputFolder = path.join(opts.outDir, folderName)
  if (!(await fileExists(outputFolder))) {
    console.error(`\n❌ Output folder not found: ${outputFolder}\n`)
    process.exit(2)
  }
  if (!midiPathUsed) {
    console.error('\n❌ Could not determine which MIDI was rendered (needed for mobile render).\n')
    process.exit(2)
  }

  console.log(`\n=== Mobile (portrait + teaser) into ${outputFolder} ===\n`)
  const mobileArgs = [
    'scripts/render_next_mobile_video.ts',
    '--dev-midi', midiPathUsed,
    '--out-dir', outputFolder,
    '--public-dir', opts.publicDir,
    '--base-url', opts.baseUrl,
  ]
  if (opts.timeoutMs) mobileArgs.push('--timeout-ms', String(opts.timeoutMs))
  const mobile = await run('bun', mobileArgs)
  if (mobile.code !== 0) process.exit(mobile.code)

  if (!opts.devMidiPath && opts.consumeMidi) {
    try {
      await fs.unlink(midiPathUsed)
      console.log(`\n🧹 Deleted source MIDI: ${midiPathUsed}`)
    } catch (e) {
      console.warn(`\n⚠️ Failed to delete MIDI (${midiPathUsed}):`, e)
    }
  } else {
    console.log(`\nℹ️ MIDI preserved: ${midiPathUsed}`)
  }

  console.log(`\n✅ Done. Outputs in: ${outputFolder}\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

