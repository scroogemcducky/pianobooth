import WebSocket, { WebSocketServer } from 'ws'
import fs from 'fs/promises'
import path from 'path'

// Store active recording sessions
const activeSessions = new Map<string, {
  sessionId: string
  sessionDir: string
  fps: number
  frameCount: number
  expectedFrames: number
  ws: WebSocket
}>()

export function setupWebSocketServer(server: any) {
  // Create WebSocket server on same HTTP server
  const wss = new WebSocketServer({
    server,
    path: '/ws/frames' // WebSocket endpoint
  })

  console.log('✅ WebSocket server ready at ws://localhost:PORT/ws/frames')

  wss.on('connection', (ws: WebSocket) => {
    console.log('🔌 Client connected')

    let currentSessionId: string | null = null

    // Handle incoming messages
    ws.on('message', async (data: Buffer) => {
      try {
        // Try to parse as JSON (for control messages)
        const text = data.toString('utf8')

        // Check if it's a JSON message
        if (text.startsWith('{')) {
          const message = JSON.parse(text)

          // Handle session initialization
          if (message.type === 'init') {
            currentSessionId = message.sessionId
            const sessionDir = path.join(process.cwd(), 'temp_frames', message.sessionId)

            // Create session directory
            await fs.mkdir(sessionDir, { recursive: true })

            // Store session info
            activeSessions.set(message.sessionId, {
              sessionId: message.sessionId,
              sessionDir,
              fps: message.fps || 60,
              frameCount: 0,
              expectedFrames: message.expectedFrames || 0,
              ws
            })

            // Save metadata
            const metadata = {
              sessionId: message.sessionId,
              fps: message.fps,
              startTime: Date.now(),
              frameCount: 0
            }
            await fs.writeFile(
              path.join(sessionDir, 'metadata.json'),
              JSON.stringify(metadata, null, 2)
            )

            console.log(`📝 Session initialized: ${message.sessionId}`)

            // Acknowledge
            ws.send(JSON.stringify({
              type: 'init-ack',
              sessionId: message.sessionId
            }))
          }

          // Handle finalize request
          else if (message.type === 'finalize') {
            const session = activeSessions.get(message.sessionId)
            if (session) {
              ws.send(JSON.stringify({
                type: 'finalize-ack',
                sessionId: message.sessionId,
                frameCount: session.frameCount
              }))

              // Don't delete session yet - will be cleaned up after video generation
              console.log(`✅ Session finalized: ${message.sessionId} (${session.frameCount} frames)`)
            }
          }
        }
        // Otherwise, it's binary frame data
        else {
          if (!currentSessionId) {
            console.error('❌ Received frame data before session init')
            return
          }

          const session = activeSessions.get(currentSessionId)
          if (!session) {
            console.error(`❌ Session not found: ${currentSessionId}`)
            return
          }

          // Frame data format: [4 bytes frame number][remaining bytes: PNG data]
          const frameNumber = data.readUInt32BE(0)
          const frameData = data.subarray(4)

          // Save frame to disk
          const filename = `frame_${String(frameNumber).padStart(6, '0')}.png`
          const filepath = path.join(session.sessionDir, filename)
          await fs.writeFile(filepath, frameData)

          // Update frame count
          session.frameCount++

          // Send progress update
          ws.send(JSON.stringify({
            type: 'frame-ack',
            frameNumber,
            totalFrames: session.frameCount
          }))

          console.log(`✓ Frame ${frameNumber} saved (${session.frameCount} total)`)
        }
      } catch (error) {
        console.error('❌ Error processing message:', error)
        ws.send(JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      }
    })

    // Handle disconnection
    ws.on('close', () => {
      console.log('🔌 Client disconnected')
      if (currentSessionId) {
        // Keep session data for video generation
        console.log(`📦 Session ${currentSessionId} ready for video generation`)
      }
    })

    // Handle errors
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error)
    })
  })

  return wss
}

// Export function to get session info (for video generation)
export function getSession(sessionId: string) {
  return activeSessions.get(sessionId)
}

export function deleteSession(sessionId: string) {
  activeSessions.delete(sessionId)
}