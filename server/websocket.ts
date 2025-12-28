import WebSocket, { WebSocketServer } from 'ws'
import fs from 'fs/promises'
import path from 'path'
import { spawn } from 'child_process'

const TEMP_ROOT = path.join(process.cwd(), 'temp_frames')

async function removeDirRecursive(target: string) {
  try {
    const entries = await fs.readdir(target, { withFileTypes: true })
    await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(target, entry.name)
      if (entry.isDirectory()) {
        await removeDirRecursive(fullPath)
      } else {
        await fs.unlink(fullPath)
      }
    }))
    await fs.rmdir(target)
  } catch (error) {
    console.error(`⚠️ Failed to remove dir ${target}:`, error)
  }
}

async function pruneStaleSessions(maxAgeMs = 6 * 60 * 60 * 1000) {
  try {
    const now = Date.now()
    const entries = await fs.readdir(TEMP_ROOT, { withFileTypes: true })
    await Promise.all(entries.map(async (entry) => {
      if (!entry.isDirectory()) return
      const fullPath = path.join(TEMP_ROOT, entry.name)
      const stat = await fs.stat(fullPath)
      if (now - stat.mtimeMs > maxAgeMs) {
        console.log(`🧹 Removing stale session dir: ${fullPath}`)
        await removeDirRecursive(fullPath)
      }
    }))
  } catch (error) {
    if ((error as any)?.code !== 'ENOENT') {
      console.error('⚠️ Failed to prune stale temp_frames:', error)
    }
  }
}

// Store active recording sessions
const activeSessions = new Map<string, {
  sessionId: string
  sessionDir: string
  fps: number
  frameCount: number
  expectedFrames: number
  title: string
  artist: string
  audioPath?: string
  ws: WebSocket
}>()

// Sanitize filename to remove invalid characters
function sanitizeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
}

// Generate video from saved frames
async function generateVideo(session: {
  sessionId: string
  sessionDir: string
  fps: number
  frameCount: number
  title: string
  artist: string
  audioPath?: string
}) {
  const displayName = sanitizeFileName(`${session.artist} - ${session.title}`)
  const videoFileName = `${displayName}.mp4`
  const outputPath = path.join(process.cwd(), 'videos', videoFileName)

  console.log(`🎬 Starting video generation for session ${session.sessionId}...`)
  console.log(`   Frames: ${session.frameCount}`)
  console.log(`   FPS: ${session.fps}`)
  console.log(`   Output: ${outputPath}`)
  console.log(`   Audio path: ${session.audioPath || '(none - video will have no audio)'}`)

  return new Promise<string>((resolve, reject) => {
    const ffmpegArgs = [
        '-y',
      '-framerate', session.fps.toString(),
      '-i', path.join(session.sessionDir, 'frame_%06d.jpg')
    ]

    // Add audio input if provided
    if (session.audioPath) {
      console.log(`🎵 Adding audio: ${session.audioPath}`)
      ffmpegArgs.push('-i', session.audioPath)
      ffmpegArgs.push('-c:a', 'aac')
      ffmpegArgs.push('-b:a', '192k')
    }

    // Video encoding settings - use hardware acceleration on Mac
    ffmpegArgs.push(
      '-c:v', 'h264_videotoolbox',
      '-b:v', '8M',
      '-pix_fmt', 'yuv420p'
    )

    // If audio is provided, ensure video and audio are same length
    if (session.audioPath) {
      ffmpegArgs.push('-shortest')
    }

    ffmpegArgs.push(outputPath)

    console.log(`🎬 FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`)
    const ffmpeg = spawn('ffmpeg', ffmpegArgs)

    ffmpeg.stderr.on('data', (data) => {
      console.log(`ffmpeg: ${data.toString().trim()}`)
    })

    ffmpeg.on('close', async (code) => {
      // Clean up temporary files
      try {
        console.log(`🧹 Cleaning up temp files in ${session.sessionDir}`)
        const files = await fs.readdir(session.sessionDir)
        await Promise.all(files.map(file => fs.unlink(path.join(session.sessionDir, file))))
        await fs.rmdir(session.sessionDir)
        console.log(`✅ Cleanup complete`)
      } catch (error) {
        console.error('⚠️ Cleanup error:', error)
      }

      if (code === 0) {
        const videoFileName = path.basename(outputPath)
        console.log(`✅ Video generated successfully: ${videoFileName}`)
        resolve(videoFileName)
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })

    ffmpeg.on('error', (error) => {
      reject(error)
    })
  })
}

export function setupWebSocketServer(server: any) {
  // Create WebSocket server without automatic server attachment
  const wss = new WebSocketServer({ noServer: true })
  pruneStaleSessions().catch(err => console.error('⚠️ Failed initial prune:', err))

  // Manually handle upgrade requests only for our path
  server.on('upgrade', (request: any, socket: any, head: any) => {
    const { pathname } = new URL(request.url, `http://${request.headers.host}`)

    if (pathname === '/ws/frames') {
      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        wss.emit('connection', ws, request)
      })
    }
    // Let other upgrade requests (like Vite HMR) pass through
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
              title: message.title || 'Untitled',
              artist: message.artist || 'Piano',
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
          console.log(`📦 [WS] Received finalize message for session ${message.sessionId}`)
          const session = activeSessions.get(message.sessionId)
          if (session) {
            console.log(`✅ [WS] Session finalized: ${message.sessionId}`)
            console.log(`   [WS] Frame count: ${session.frameCount}`)
            console.log(`   [WS] Has audio: ${!!session.audioPath}`)

            // Generate video
            try {
              const videoFileName = await generateVideo(session)

              ws.send(JSON.stringify({
                type: 'video-ready',
                sessionId: message.sessionId,
                videoUrl: `/videos/${videoFileName}`,
                frameCount: session.frameCount
              }))

              // Clean up session
              activeSessions.delete(message.sessionId)
            } catch (error) {
              console.error(`❌ Video generation failed:`, error)
              await removeDirRecursive(session.sessionDir)
              ws.send(JSON.stringify({
                type: 'error',
                error: error instanceof Error ? error.message : 'Video generation failed'
              }))
            }
          }
          }

          // Handle audio data
          else if (message.type === 'audio') {
            console.log(`🎵 [WS] Received audio message for session ${message.sessionId}`)
            const session = activeSessions.get(message.sessionId)
            if (session) {
              // Save audio file
              const audioPath = path.join(session.sessionDir, 'audio.wav')
              const audioDataLength = message.audioData?.length || 0
              console.log(`   [WS] Audio base64 data length: ${audioDataLength} chars`)

              if (audioDataLength === 0) {
                console.warn(`   [WS] ⚠️ Audio data is empty!`)
              }

              const audioBuffer = Buffer.from(message.audioData, 'base64')
              console.log(`   [WS] Audio buffer size: ${(audioBuffer.length / 1024).toFixed(1)} KB`)

              await fs.writeFile(audioPath, audioBuffer)
              session.audioPath = audioPath

              console.log(`🎵 [WS] Audio saved: ${audioPath}`)

              ws.send(JSON.stringify({
                type: 'audio-ack',
                sessionId: message.sessionId
              }))
              console.log(`   [WS] Audio-ack sent to client`)
            } else {
              console.error(`   [WS] ❌ Session not found for audio: ${message.sessionId}`)
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
          const filename = `frame_${String(frameNumber).padStart(6, '0')}.jpg`
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

          // Only log every 100th frame to reduce spam
          if (frameNumber % 100 === 0) {
            console.log(`✓ Frame ${frameNumber} saved (${session.frameCount} total)`)
          }
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
    ws.on('close', async () => {
      console.log('🔌 [WS] Client disconnected')
      console.log(`   [WS] Current session: ${currentSessionId || '(none)'}`)

      if (currentSessionId) {
        const session = activeSessions.get(currentSessionId)
        if (session && session.frameCount > 0) {
          console.log(`📦 [WS] Session ${currentSessionId} - generating video on disconnect`)
          console.log(`   [WS] Frame count: ${session.frameCount}`)
          console.log(`   [WS] Has audio: ${!!session.audioPath}`)
          if (session.audioPath) {
            console.log(`   [WS] Audio path: ${session.audioPath}`)
          } else {
            console.warn(`   [WS] ⚠️ NO AUDIO - video will be silent!`)
          }

          // Generate video automatically on disconnect
          try {
            const videoFileName = await generateVideo(session)
            console.log(`✅ [WS] Video generated on disconnect: ${videoFileName}`)
            activeSessions.delete(currentSessionId)
          } catch (error) {
            console.error(`❌ [WS] Video generation failed on disconnect:`, error)
          }
        } else if (session) {
          // No frames captured; clean up the empty session directory
          console.log(`   [WS] Session has no frames, cleaning up empty directory`)
          await removeDirRecursive(session.sessionDir)
          activeSessions.delete(currentSessionId)
        } else {
          console.log(`   [WS] Session not found in activeSessions`)
        }
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
