// Generate thumbnail previews for each artist image and open them in Preview.app
// Usage: bun scripts/preview_thumbnails.ts <artist-slug> <song-slug> [--style cutout|side|full]

import path from 'node:path'
import fs from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { chromium } from 'playwright'

async function main() {
  const args = process.argv.slice(2)
  if (args.length < 2) {
    console.log('Usage: bun scripts/preview_thumbnails.ts <artist-slug> <song-slug> [--style cutout|side|full]')
    process.exit(1)
  }

  const artistSlug = args[0]
  const songSlug = args[1]
  let style = 'cutout'
  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--style' && args[i + 1]) style = args[++i]
  }

  const baseUrl = process.env.THUMBNAIL_BASE_URL || 'http://localhost:5173'

  // Read manifest to get images for this artist
  const manifestPath = path.join('recording/thumbnail_images/manifest.json')
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'))
  const entry = manifest[artistSlug]
  if (!entry) {
    console.error(`No manifest entry for "${artistSlug}"`)
    process.exit(1)
  }
  const images: string[] = Array.isArray(entry) ? entry : entry.images || []
  if (images.length === 0) {
    console.error(`No images found for "${artistSlug}"`)
    process.exit(1)
  }

  const outDir = path.join('tmp', 'thumbnail_previews')
  await fs.mkdir(outDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const outputPaths: string[] = []

  for (const image of images) {
    const imageName = path.basename(image, path.extname(image))
    const outPath = path.resolve(outDir, `${artistSlug}_${songSlug}_${imageName}.png`)

    console.log(`Generating: ${imageName}...`)

    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    const page = await context.newPage()

    // Build the thumbnail URL - force a specific image by overriding manifest randomness
    // We do this by intercepting the manifest request and returning a modified version
    await page.route('**/recording-assets/thumbnail_images/manifest.json', async (route) => {
      const singleImageEntry = Array.isArray(entry)
        ? [image]
        : { ...entry, images: [image] }
      const modifiedManifest = { ...manifest, [artistSlug]: singleImageEntry }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(modifiedManifest),
      })
    })

    const url = `${baseUrl}/thumbnail/${encodeURIComponent(artistSlug)}/${encodeURIComponent(songSlug)}?style=${style}`
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(4000)

    const container = await page.$('#thumbnail-container')
    if (container) {
      await container.screenshot({ path: outPath, type: 'png' })
      outputPaths.push(outPath)
      console.log(`  -> ${outPath}`)
    } else {
      console.error(`  Container not found for ${imageName}`)
    }

    await context.close()
  }

  await browser.close()

  if (outputPaths.length > 0) {
    console.log(`\nOpening ${outputPaths.length} thumbnail(s) in Preview...`)
    await new Promise<void>((resolve, reject) => {
      execFile('open', outputPaths, (error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }
}

if (import.meta.main) {
  main().catch(e => { console.error(e); process.exit(1) })
}
