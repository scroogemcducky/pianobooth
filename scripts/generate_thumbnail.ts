// Generates a YouTube thumbnail (1280x720) for a given MIDI piece
// Uses Playwright to screenshot the /thumbnail route

import path from 'node:path'
import fs from 'node:fs/promises'
import { chromium, type Browser, type Page } from 'playwright'

type Options = {
  baseUrl?: string
  timeout?: number
  headless?: boolean
  font?: string
  preset?: number
}

type InlineMidiData = {
  title: string
  artist: string
  durationMs: number
  timePositionMs: number
  midiObject: unknown[]
}

const DEFAULTS = {
  baseUrl: process.env.THUMBNAIL_BASE_URL || 'http://localhost:5173',
  timeout: 30000,
  headless: true,
}

/**
 * Generate a thumbnail for a single MIDI piece
 */
export async function generateThumbnail(
  artistSlug: string,
  songSlug: string,
  outputPath: string,
  options: Options = {}
): Promise<{ success: boolean; error?: string }> {
  const opts = { ...DEFAULTS, ...options }

  let browser: Browser | null = null

  try {
    browser = await chromium.launch({ headless: opts.headless })
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    })
    const page = await context.newPage()

    const result = await captureThumbnail(page, artistSlug, songSlug, outputPath, {
      baseUrl: opts.baseUrl,
      timeout: opts.timeout,
      font: opts.font,
    })

    await browser.close()
    return result
  } catch (error: unknown) {
    if (browser) await browser.close()
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}

/**
 * Capture thumbnail using an existing page (for batch processing)
 */
export async function captureThumbnail(
  page: Page,
  artistSlug: string,
  songSlug: string,
  outputPath: string,
  options: { baseUrl: string; timeout: number; font?: string; preset?: number; inlineMidiData?: InlineMidiData }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath)
    await fs.mkdir(outputDir, { recursive: true })

    // Navigate to thumbnail route with optional parameters
    const url = new URL(options.baseUrl)
    url.pathname = `/thumbnail/${encodeURIComponent(artistSlug)}/${encodeURIComponent(songSlug)}`
    if (options.font) url.searchParams.set('font', options.font)
    if (typeof options.preset === 'number' && Number.isFinite(options.preset)) {
      url.searchParams.set('preset', String(options.preset))
    }
    if (options.inlineMidiData) {
      url.searchParams.set('inline', '1')
      // Avoid an extra navigation to baseUrl; set localStorage before the /thumbnail page scripts run.
      await page.addInitScript((payload) => {
        try { window.localStorage.setItem('thumbnailMidiData', JSON.stringify(payload)) } catch {}
      }, options.inlineMidiData)
    }
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: options.timeout })

    // Wait for the ready indicator
    await page.waitForSelector('#thumbnail-ready', { timeout: options.timeout })

    // Additional wait for WebGL to finish rendering
    await page.waitForTimeout(300)

    // Take screenshot of the container
    const container = await page.$('#thumbnail-container')
    if (!container) {
      return { success: false, error: 'Thumbnail container not found' }
    }

    // Use PNG for lossless quality
    const isPng = outputPath.toLowerCase().endsWith('.png')
    if (isPng) {
      await container.screenshot({
        path: outputPath,
        type: 'png',
      })
    } else {
      await container.screenshot({
        path: outputPath,
        type: 'jpeg',
        quality: 100,
      })
    }

    return { success: true }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2)

  if (args.length < 3) {
    console.log('Usage: bun run scripts/generate_thumbnail.ts <artist-slug> <song-slug> <output-path>')
    console.log('')
    console.log('Options:')
    console.log('  --base-url <url>  Base URL (default: http://localhost:5173)')
    console.log('  --timeout <ms>    Timeout in milliseconds (default: 30000)')
    console.log('  --headful         Run browser in headful mode')
    console.log('  --preset <index>  Color preset index (default: 0)')
    console.log('')
    console.log('Example:')
    console.log('  bun run scripts/generate_thumbnail.ts bach prelude-in-c-major ./thumbnails/bach-prelude.jpg')
    process.exit(1)
  }

  const artistSlug = args[0]
  const songSlug = args[1]
  const outputPath = args[2]

  const options: Options = {}

  for (let i = 3; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--base-url' && args[i + 1]) {
      options.baseUrl = args[++i]
    } else if (arg === '--timeout' && args[i + 1]) {
      options.timeout = parseInt(args[++i], 10)
    } else if (arg === '--headful') {
      options.headless = false
    } else if (arg === '--preset' && args[i + 1]) {
      options.preset = parseInt(args[++i], 10)
    }
  }

  console.log(`Generating thumbnail for ${artistSlug}/${songSlug}...`)
  console.log(`Output: ${outputPath}`)

  const result = await generateThumbnail(artistSlug, songSlug, outputPath, options)

  if (result.success) {
    console.log('Thumbnail generated successfully!')
  } else {
    console.error(`Failed to generate thumbnail: ${result.error}`)
    process.exit(1)
  }
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
