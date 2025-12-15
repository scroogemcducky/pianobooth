// Debug script to see all browser console messages
import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:5173'

async function main() {
  console.log('🔍 Debugging WebSocket console messages...')

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  })

  // Preload MIDI data
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem('processedMidiData', JSON.stringify([
        { Delta: 0, Duration: 500000, NoteNumber: 60, Velocity: 80, SoundDuration: 500 }
      ]))
      window.localStorage.setItem('midiMeta', JSON.stringify({ title: 'Test', artist: 'Test Artist' }))
    } catch {}
  })

  const page = await context.newPage()

  // Log ALL console messages
  page.on('console', msg => {
    console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`)
  })

  // Log page errors
  page.on('pageerror', error => {
    console.error(`[Browser Error] ${error.message}`)
    console.error(error.stack)
  })

  // Log request failures
  page.on('requestfailed', request => {
    console.error(`[Request Failed] ${request.url()}: ${request.failure()?.errorText}`)
  })

  // Navigate
  console.log('🎬 Opening /record ...')
  await page.goto(`${BASE_URL}/record`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  })

  // Wait for page to be fully loaded
  console.log('⏳ Waiting for page to settle...')
  await page.waitForTimeout(5000)

  // Check if record button exists
  const recordButton = await page.$('#record-button')
  console.log(`📊 Record button exists: ${recordButton !== null}`)

  if (recordButton) {
    const isDisabled = await recordButton.getAttribute('disabled')
    console.log(`📊 Record button disabled: ${isDisabled !== null}`)
  }

  // Check for canvas
  const canvas = await page.$('canvas')
  console.log(`📊 Canvas exists: ${canvas !== null}`)

  // Wait longer for the first websocket to potentially connect
  console.log('⏳ Waiting 10s for WebSocket to connect...')
  await page.waitForTimeout(10000)

  // Check if WebSocket connected message appeared
  const wsConnectedAppeared = await page.evaluate(() => {
    return (window as any).wsConnected || false
  })
  console.log(`📊 WebSocket connected state: ${wsConnectedAppeared}`)

  // Wait and observe
  console.log('⏳ Waiting 20 more seconds to observe console output...')
  await page.waitForTimeout(20000)

  await browser.close()
  console.log('✅ Debug complete')
}

if (import.meta.main) {
  main().catch(console.error)
}
