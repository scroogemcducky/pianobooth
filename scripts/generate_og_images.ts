// Generates Open Graph images for all pieces in the catalog
// Uses Playwright to screenshot the /og-image route for each piece
// Output: public/og-images/{artistSlug}/{songSlug}.png

import path from 'node:path'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

type CatalogEntry = {
  artistSlug?: string
  songSlug?: string
  title: string
  artist: string
  url?: string
}

type Options = {
  catalogPath: string
  outputDir: string
  baseUrl: string
  concurrency: number
  headless: boolean
  timeout: number
  skipExisting: boolean
  filter?: string
}

const DEFAULTS: Options = {
  catalogPath: 'catalog/public.jsonl',
  outputDir: 'public/og-images',
  baseUrl: process.env.OG_BASE_URL || 'http://localhost:5173',
  concurrency: 3,
  headless: true,
  timeout: 30000,
  skipExisting: true,
}

async function readCatalog(catalogPath: string): Promise<CatalogEntry[]> {
  const entries: CatalogEntry[] = []
  const seen = new Set<string>()

  const fileStream = createReadStream(catalogPath)
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity })

  for await (const line of rl) {
    if (!line.trim()) continue
    try {
      const entry = JSON.parse(line) as CatalogEntry
      // Only process entries with the new artistSlug/songSlug format
      if (entry.artistSlug && entry.songSlug) {
        const key = `${entry.artistSlug}/${entry.songSlug}`
        if (!seen.has(key)) {
          seen.add(key)
          entries.push(entry)
        }
      }
    } catch {
      // Skip invalid JSON lines
    }
  }

  return entries
}

async function generateOGImage(
  page: any,
  entry: CatalogEntry,
  outputDir: string,
  baseUrl: string,
  timeout: number
): Promise<{ success: boolean; error?: string }> {
  const { artistSlug, songSlug, title, artist } = entry
  if (!artistSlug || !songSlug) {
    return { success: false, error: 'Missing artistSlug or songSlug' }
  }

  const outputPath = path.join(outputDir, artistSlug, `${songSlug}.png`)
  const outputFolder = path.dirname(outputPath)

  try {
    // Ensure output directory exists
    await fs.mkdir(outputFolder, { recursive: true })

    // Navigate to OG image route
    const url = `${baseUrl}/og-image/${encodeURIComponent(artistSlug)}/${encodeURIComponent(songSlug)}`
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout })

    // Wait for the ready indicator
    await page.waitForSelector('#og-ready', { timeout })

    // Additional wait for WebGL to finish rendering
    await page.waitForTimeout(300)

    // Take screenshot of the container
    const container = await page.$('#og-image-container')
    if (!container) {
      return { success: false, error: 'OG image container not found' }
    }

    await container.screenshot({
      path: outputPath,
      type: 'png',
    })

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message || String(error) }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const opts: Options = { ...DEFAULTS }

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--catalog' && args[i + 1]) opts.catalogPath = args[++i]
    else if (a === '--output' && args[i + 1]) opts.outputDir = args[++i]
    else if (a === '--base-url' && args[i + 1]) opts.baseUrl = args[++i]
    else if (a === '--concurrency' && args[i + 1]) opts.concurrency = parseInt(args[++i], 10)
    else if (a === '--headful' || a === '--no-headless') opts.headless = false
    else if (a === '--timeout' && args[i + 1]) opts.timeout = parseInt(args[++i], 10)
    else if (a === '--no-skip' || a === '--force') opts.skipExisting = false
    else if (a === '--filter' && args[i + 1]) opts.filter = args[++i]
  }

  console.log('Reading catalog...')
  let entries = await readCatalog(opts.catalogPath)
  console.log(`Found ${entries.length} unique pieces with artistSlug/songSlug`)

  // Apply filter if specified
  if (opts.filter) {
    const filterLower = opts.filter.toLowerCase()
    entries = entries.filter(
      (e) =>
        e.artistSlug?.toLowerCase().includes(filterLower) ||
        e.songSlug?.toLowerCase().includes(filterLower) ||
        e.title?.toLowerCase().includes(filterLower) ||
        e.artist?.toLowerCase().includes(filterLower)
    )
    console.log(`Filtered to ${entries.length} entries matching "${opts.filter}"`)
  }

  // Skip existing if requested
  if (opts.skipExisting) {
    const toGenerate: CatalogEntry[] = []
    for (const entry of entries) {
      const outputPath = path.join(opts.outputDir, entry.artistSlug!, `${entry.songSlug}.png`)
      try {
        await fs.access(outputPath)
        // File exists, skip
      } catch {
        toGenerate.push(entry)
      }
    }
    console.log(`Skipping ${entries.length - toGenerate.length} existing images`)
    entries = toGenerate
  }

  if (entries.length === 0) {
    console.log('No images to generate.')
    return
  }

  console.log(`Generating ${entries.length} OG images...`)
  console.log(`Base URL: ${opts.baseUrl}`)
  console.log(`Output: ${opts.outputDir}`)
  console.log(`Concurrency: ${opts.concurrency}`)

  // Launch browser
  const browser = await chromium.launch({ headless: opts.headless })

  // Process in batches for concurrency
  let completed = 0
  let failed = 0
  const total = entries.length

  // Create pages for concurrent processing
  const pages = await Promise.all(
    Array.from({ length: opts.concurrency }, async () => {
      const context = await browser.newContext({ viewport: { width: 1200, height: 630 } })
      return context.newPage()
    })
  )

  // Process entries
  const queue = [...entries]
  const workers = pages.map(async (page, workerIndex) => {
    while (queue.length > 0) {
      const entry = queue.shift()
      if (!entry) break

      const result = await generateOGImage(page, entry, opts.outputDir, opts.baseUrl, opts.timeout)
      completed++

      if (result.success) {
        console.log(`[${completed}/${total}] Generated: ${entry.artistSlug}/${entry.songSlug}`)
      } else {
        failed++
        console.error(
          `[${completed}/${total}] Failed: ${entry.artistSlug}/${entry.songSlug} - ${result.error}`
        )
      }
    }
  })

  await Promise.all(workers)

  // Cleanup
  await browser.close()

  console.log(`\nCompleted: ${completed - failed} successful, ${failed} failed`)
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
