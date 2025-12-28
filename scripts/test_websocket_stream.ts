// Test script for WebSocket video streaming
// Uses the same logic as render_next_video.ts but with a test MIDI file and doesn't delete it
import path from 'node:path'
import { processOneVideo, DEFAULTS, type Options } from './render_next_video'

async function main() {
  console.log('🧪 Testing WebSocket streaming with production logic...')

  // Parse command line arguments
  const args = process.argv.slice(2)
  const opts: Options = { 
    ...DEFAULTS,
    devMidiPath: 'midi/test_videos/test.mid', // Use test MIDI instead of queue
    keepMidi: true, // Don't delete the test MIDI file
    requireLLM: false, // Don't require LLM for test
  }

  // Parse command line overrides
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '-t' && args[i + 1]) {
      const fallDuration = parseFloat(args[++i]!)
      if (!isNaN(fallDuration) && fallDuration > 0) opts.fallDuration = fallDuration
    }
    else if (a === '-n' && args[i + 1]) {
      opts.count = parseInt(args[++i]!, 10)
    }
    else if (a.startsWith('-n') && a.length > 2) {
      const num = parseInt(a.substring(2), 10)
      if (!isNaN(num)) opts.count = num
    }
    else if (a === '--headless') opts.headless = true
    else if (a === '--slowmo' && args[i + 1]) opts.slowMo = parseInt(args[++i]!, 10)
    else if (a === '--devtools') opts.devtools = true
  }

  // Run the actual production logic
  const success = await processOneVideo(opts)

  if (success) {
    console.log('\n✅ Test complete!')
    console.log(`   Note: Test MIDI file NOT deleted (${opts.devMidiPath})`)
  } else {
    console.error('\n❌ Test failed: No video was produced')
    process.exit(1)
  }
}

if (import.meta.main) {
  main().catch((e) => {
    console.error('❌ Test failed:', e)
    process.exit(1)
  })
}
