// Test client for minimal WebSocket server
import WebSocket from 'ws'

const ws = new WebSocket('ws://localhost:8080')

ws.on('open', () => {
  console.log('✅ WebSocket OPENED!')
  ws.send('Hello from client')
})

ws.on('message', (data) => {
  console.log('📨 Received from server:', data.toString())
  ws.close()
})

ws.on('close', () => {
  console.log('🔌 WebSocket closed')
  process.exit(0)
})

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error)
  process.exit(1)
})

setTimeout(() => {
  console.log('⏱️ Timeout - WebSocket state:', ws.readyState)
  console.log('   0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED')
  if (ws.readyState !== WebSocket.OPEN) {
    console.error('❌ WebSocket failed to connect within 5 seconds')
    process.exit(1)
  }
}, 5000)
