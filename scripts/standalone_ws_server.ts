// Standalone WebSocket server on port 5174 (matches our setup)
// Run this independently from Vite to test
import { createServer } from 'http'
import { setupWebSocketServer } from '../server/websocket'

const PORT = 5174

console.log('🚀 Starting standalone WebSocket server...')

const httpServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('WebSocket server running')
})

// Use our actual setupWebSocketServer function
setupWebSocketServer(httpServer)

httpServer.listen(PORT, () => {
  console.log(`✅ Standalone WebSocket server listening on port ${PORT}`)
  console.log(`   Test with: ws://localhost:${PORT}/ws/frames`)
})

httpServer.on('error', (err) => {
  console.error('❌ Server error:', err)
  process.exit(1)
})
