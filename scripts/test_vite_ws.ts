// Test WebSocket on Vite server (port 5173)
import WebSocket from 'ws'

console.log('🧪 Testing WebSocket on Vite server (port 5173)...')

const ws = new WebSocket('ws://localhost:5173/ws/frames')

ws.on('open', () => {
  console.log('✅ WebSocket OPENED!')
  ws.close()
})

ws.on('message', (data) => {
  console.log('📨 Received:', data.toString())
})

ws.on('close', () => {
  console.log('🔌 WebSocket closed')
  process.exit(0)
})

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message)
  process.exit(1)
})

setTimeout(() => {
  console.log('⏱️ Timeout - State:', ws.readyState)
  if (ws.readyState !== WebSocket.OPEN) {
    console.error('❌ Failed to connect')
    process.exit(1)
  }
}, 5000)
