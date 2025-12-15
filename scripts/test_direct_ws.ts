// Test WebSocket directly without browser
import WebSocket from 'ws'

async function testDirectConnection() {
  console.log('🧪 Testing direct WebSocket connection (no browser)...')

  const ws = new WebSocket('ws://localhost:5174/ws/frames')

  ws.on('open', () => {
    console.log('✅ WebSocket opened!')
    ws.close()
  })

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message)
  })

  ws.on('close', () => {
    console.log('🔌 WebSocket closed')
  })

  // Wait 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000))

  if (ws.readyState === WebSocket.OPEN) {
    console.log('✅ Still open after 5s')
  } else {
    console.log(`❌ WebSocket state after 5s: ${ws.readyState} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)`)
  }
}

testDirectConnection().then(() => {
  console.log('Test complete')
  process.exit(0)
}).catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
