// Minimal WebSocket server for debugging
import { createServer } from 'http'
import { WebSocketServer } from 'ws'

const PORT = 8080

// Create HTTP server
const httpServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('WebSocket server running')
})

// Create WebSocket server
const wss = new WebSocketServer({ noServer: true })

// Handle upgrade
httpServer.on('upgrade', (request, socket, head) => {
  console.log('📡 Upgrade request received')
  console.log('   URL:', request.url)
  console.log('   Headers:', request.headers)

  wss.handleUpgrade(request, socket, head, (ws) => {
    console.log('🔗 handleUpgrade callback - about to emit connection')
    wss.emit('connection', ws, request)
  })
})

// Handle connections
wss.on('connection', (ws) => {
  console.log('✅ Client connected!')

  ws.on('message', (data) => {
    console.log('📨 Received:', data.toString())
    ws.send('Echo: ' + data.toString())
  })

  ws.on('close', () => {
    console.log('🔌 Client disconnected')
  })

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error)
  })

  // Send welcome message
  ws.send('Welcome to minimal WebSocket server!')
})

// Start server
httpServer.listen(PORT, () => {
  console.log(`✅ Minimal WebSocket server listening on port ${PORT}`)
  console.log(`   Test with: ws://localhost:${PORT}`)
})
