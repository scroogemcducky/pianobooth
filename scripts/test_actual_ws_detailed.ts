// Detailed test of actual WebSocket server with logging
import WebSocket from 'ws'

console.log('🧪 Testing actual WebSocket server with detailed logging...')
console.log('   Connecting to: ws://localhost:5174/ws/frames')

const ws = new WebSocket('ws://localhost:5174/ws/frames')

// Log all state changes
let lastState = ws.readyState
setInterval(() => {
  if (ws.readyState !== lastState) {
    console.log(`📊 State changed: ${lastState} → ${ws.readyState}`)
    lastState = ws.readyState
  }
}, 100)

ws.on('open', () => {
  console.log('✅ WebSocket OPENED!')
  console.log('   ReadyState:', ws.readyState)
  ws.close()
})

ws.on('message', (data) => {
  console.log('📨 Received:', data.toString())
})

ws.on('close', (code, reason) => {
  console.log('🔌 WebSocket closed')
  console.log('   Code:', code)
  console.log('   Reason:', reason.toString())
  console.log('   Final state:', ws.readyState)
  process.exit(0)
})

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error)
  console.error('   State at error:', ws.readyState)
})

// Log connection attempts
console.log('📡 Connection initiated, waiting...')
setTimeout(() => console.log('   1s: State =', ws.readyState), 1000)
setTimeout(() => console.log('   2s: State =', ws.readyState), 2000)
setTimeout(() => console.log('   3s: State =', ws.readyState), 3000)

setTimeout(() => {
  console.log('⏱️ 5s timeout reached')
  console.log('   Final state:', ws.readyState, '(0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)')
  if (ws.readyState !== WebSocket.OPEN) {
    console.error('❌ WebSocket failed to connect')
    process.exit(1)
  }
}, 5000)
