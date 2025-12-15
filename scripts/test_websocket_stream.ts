// Test script for WebSocket video streaming
// Loads a test MIDI and records using WebSocket frame streaming

import path from 'node:path'
import fs from 'node:fs/promises'
import { chromium } from 'playwright'
import { parseMidiFilePath, type MidiNote } from './parse_midi_to_json'

const TEST_MIDI = 'midi/test_videos/test.mid'
const BASE_URL = process.env.RENDER_BASE_URL || 'http://localhost:5173'
const HEADLESS = process.argv.includes('--headless')
const TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

async function main() {
  console.log('🧪 Testing WebSocket streaming...')
  console.log(`   MIDI: ${TEST_MIDI}`)
  console.log(`   URL: ${BASE_URL}`)
  console.log(`   Mode: ${HEADLESS ? 'headless' : 'headful'}`)

  // Check if test MIDI exists
  const midiPath = path.resolve(TEST_MIDI)
  try {
    await fs.access(midiPath)
  } catch {
    console.error(`❌ Test MIDI not found: ${midiPath}`)
    console.error(`   Please place a MIDI file at: ${TEST_MIDI}`)
    process.exit(1)
  }

  // Parse MIDI to JSON
  console.log('📝 Parsing MIDI file...')
  const midiObject: MidiNote[] = await parseMidiFilePath(midiPath)
  console.log(`   Notes: ${midiObject.length}`)

  // Extract basic metadata
  const { Midi } = await import('@tonejs/midi')
  const buf = await fs.readFile(midiPath)
  const midi = new Midi(buf)
  const title = (midi as any)?.header?.name?.trim?.() || 'Test Song'
  const artist = 'Test Artist'

  console.log(`   Title: ${title}`)
  console.log(`   Artist: ${artist}`)

  // Launch browser
  console.log('🌐 Launching browser...')
  const browser = await chromium.launch({
    headless: HEADLESS,
    slowMo: 0
  })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  })

  // Preload MIDI data into localStorage
  await context.addInitScript((payload) => {
    try {
      window.localStorage.setItem('processedMidiData', payload.data as string)
    } catch {}
    try {
      window.localStorage.setItem('midiMeta', payload.meta as string)
    } catch {}
  }, {
    data: JSON.stringify(midiObject),
    meta: JSON.stringify({ title, artist }),
  })

  const page = await context.newPage()

  // Listen to console messages for debugging (set up BEFORE navigation)
  page.on('console', msg => {
    const text = msg.text()
    if (
      text.includes('WebSocket') ||
      text.includes('Frame') ||
      text.includes('Session') ||
      text.includes('Video') ||
      text.includes('Error') ||
      text.includes('error')
    ) {
      console.log(`   [Browser] ${text}`)
    }
  })

  // Listen for page errors
  page.on('pageerror', error => {
    console.error(`   [Browser Error] ${error.message}`)
  })

  // Wait for key console signals (set up AFTER console listener)
  const websocketReady = page.waitForEvent('console', {
    predicate: (msg) => msg.text().includes('WebSocket connected'),
    timeout: 120_000,
  })
  const videoReady = page.waitForEvent('console', {
    predicate: (msg) => msg.text().includes('Video generated on server'),
    timeout: TIMEOUT_MS,
  })

  // Navigate to record page
  console.log(`🎬 Opening ${BASE_URL}/record ...`)
  await page.goto(`${BASE_URL}/record`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000
  })

  // Wait for record button to be enabled
  console.log('⏳ Waiting for record button...')
  await page.waitForSelector('#record-button', {
    state: 'visible',
    timeout: 120_000
  })
  await page.waitForFunction(() => {
    const btn = document.querySelector('#record-button') as HTMLButtonElement | null
    return !!btn && !btn.disabled
  }, undefined, { timeout: 120_000 })

  // Ensure WebSocket is actually connected before starting
  console.log('⏳ Waiting for WebSocket connection...')
  await websocketReady
  console.log('✅ WebSocket ready')

  // Click record button
  console.log('🔴 Starting recording...')
  const startTime = Date.now()
  await page.click('#record-button')

  // Wait for recording to complete
  console.log('⏳ Recording in progress...')

  try {
    // Wait for the in-page console signal that video generation finished
    await videoReady

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`✅ Video-ready signal received in ${duration}s`)
  } catch (error) {
    console.error('❌ Recording or video generation timeout/error')
    throw error
  }

  // Give the filesystem a brief moment before scanning
  await page.waitForTimeout(1000)

  // Check for the expected video file
  const expectedVideoName = `${artist} - ${title}.mp4`
  const expectedVideoPath = path.resolve('videos', expectedVideoName)
  console.log(`📁 Checking for: ${expectedVideoName}`)

  try {
    const stat = await fs.stat(expectedVideoPath)
    console.log(`✅ Video found: ${expectedVideoName} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`)
  } catch {
    console.log(`⚠️  Expected video not found: ${expectedVideoName}`)
  }

  // Close browser
  await page.close()
  await context.close()
  await browser.close()

  console.log('✅ Test complete!')
}

if (import.meta.main) {
  main().catch((e) => {
    console.error('❌ Test failed:', e)
    process.exit(1)
  })
}
