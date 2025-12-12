import WebSocket, { WebSocketServer } from 'ws'
import fs from 'fs/promises'
import { appendFileSync, writeFileSync } from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { PROJECT_ROOT, VIDEO_OUT_DIR, TEMP_FRAMES_DIR, sanitizeFileName } from '../app/utils/paths'

const TEMP_ROOT = TEMP_FRAMES_DIR
const LOG_FILE = path.join(PROJECT_ROOT, 'recording-debug.log')

// File-based logger for debugging (overwrites on each new session)
function log(message: string) {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] ${message}\n`
  console.log(message)
  try {
    appendFileSync(LOG_FILE, line)
  } catch {}
}

function clearLog() {
  try {
    writeFileSync(LOG_FILE, `=== Recording Debug Log ===\nStarted: ${new Date().toISOString()}\n\n`)
  } catch {}
}

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
    log(`⚠️ Failed to remove dir ${target}: ${error}`)
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
        log(`🧹 Removing stale session dir: ${fullPath}`)
        await removeDirRecursive(fullPath)
      }
    }))
  } catch (error) {
    if ((error as any)?.code !== 'ENOENT') {
      log(`⚠️ Failed to prune stale temp_frames: ${error}`)
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
  const outputPath = path.join(VIDEO_OUT_DIR, videoFileName)

  log(`🎬 Starting video generation for session ${session.sessionId}...`)
  log(`   Frames: ${session.frameCount}`)
  log(`   FPS: ${session.fps}`)
  log(`   Output: ${outputPath}`)
  log(`   Audio path: ${session.audioPath || 'NONE'}`)

  // Ensure output directory exists
  await fs.mkdir(VIDEO_OUT_DIR, { recursive: true })

  return new Promise<string>((resolve, reject) => {
    const ffmpegArgs = [
        '-y',
      '-framerate', session.fps.toString(),
      '-i', path.join(session.sessionDir, 'frame_%06d.jpg')
    ]

    // Add audio input if provided
    if (session.audioPath) {
      log(`🎵 Adding audio: ${session.audioPath}`)
      ffmpegArgs.push('-i', session.audioPath)
      ffmpegArgs.push('-c:a', 'aac')
      ffmpegArgs.push('-b:a', '192k')
    } else {
      log(`⚠️ NO AUDIO - session.audioPath is undefined`)
    }

    // Video encoding settings
    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'fast',
      '-crf', '18'
    )

    // If audio is provided, ensure video and audio are same length
    if (session.audioPath) {
      ffmpegArgs.push('-shortest')
    }

    ffmpegArgs.push(outputPath)

    log(`🎬 FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`)
    const ffmpeg = spawn('ffmpeg', ffmpegArgs)

    ffmpeg.stderr.on('data', (data) => {
      // Only log important ffmpeg messages (not progress)
      const msg = data.toString().trim()
      if (msg.includes('Error') || msg.includes('error') || msg.includes('Invalid')) {
        log(`ffmpeg ERROR: ${msg}`)
      }
    })

    ffmpeg.on('close', async (code) => {
      // Clean up temporary files
      try {
        log(`🧹 Cleaning up temp files in ${session.sessionDir}`)
        const files = await fs.readdir(session.sessionDir)
        await Promise.all(files.map(file => fs.unlink(path.join(session.sessionDir, file))))
        await fs.rmdir(session.sessionDir)
        log(`✅ Cleanup complete`)
      } catch (error) {
        log(`⚠️ Cleanup error: ${error}`)
      }

      if (code === 0) {
        const videoFileName = path.basename(outputPath)
        log(`✅ Video generated successfully: ${videoFileName}`)
        resolve(videoFileName)
      } else {
        log(`❌ FFmpeg exited with code ${code}`)
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })

    ffmpeg.on('error', (error) => {
      log(`❌ FFmpeg spawn error: ${error}`)
      reject(error)
    })
  })
}

export function setupWebSocketServer(server: any) {
  // Create WebSocket server without automatic server attachment
  const wss = new WebSocketServer({ noServer: true })
  pruneStaleSessions().catch(err => log(`⚠️ Failed initial prune: ${err}`))

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

  log('✅ WebSocket server ready at ws://localhost:PORT/ws/frames')

  wss.on('connection', (ws: WebSocket) => {
    log('🔌 Client connected')

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
            // Clear log file for new recording session
            clearLog()
            log(`📝 NEW SESSION: ${message.sessionId}`)
            log(`   Title: ${message.title || 'Untitled'}`)
            log(`   Artist: ${message.artist || 'Piano'}`)
            log(`   Expected frames: ${message.expectedFrames || 0}`)
            log(`   FPS: ${message.fps || 60}`)

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

            log(`✅ Session initialized: ${message.sessionId}`)

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
            log(`✅ Session finalized: ${message.sessionId} (${session.frameCount} frames)`)
            log(`   Audio path at finalize: ${session.audioPath || 'NONE'}`)

            // Generate video
            try {
              const videoFileName = await generateVideo(session)

              ws.send(JSON.stringify({
                type: 'video-ready',
                sessionId: message.sessionId,
                videoUrl: `/${videoFileName}`,
                frameCount: session.frameCount
              }))

              // Clean up session
              activeSessions.delete(message.sessionId)
            } catch (error) {
              log(`❌ Video generation failed: ${error}`)
              await removeDirRecursive(session.sessionDir)
              ws.send(JSON.stringify({
                type: 'error',
                error: error instanceof Error ? error.message : 'Video generation failed'
              }))
            }
          } else {
            log(`⚠️ Finalize called but session not found: ${message.sessionId}`)
          }
          }

          // Handle audio data
          else if (message.type === 'audio') {
            const session = activeSessions.get(message.sessionId)
            if (session) {
              log(`🎵 Received audio data for session ${message.sessionId}`)
              log(`   Audio data size: ${message.audioData?.length || 0} bytes (base64)`)

              // Save audio file
              const audioPath = path.join(session.sessionDir, 'audio.wav')
              const audioBuffer = Buffer.from(message.audioData, 'base64')
              await fs.writeFile(audioPath, audioBuffer)
              session.audioPath = audioPath

              log(`🎵 Audio saved: ${audioPath} (${audioBuffer.length} bytes)`)

              ws.send(JSON.stringify({
                type: 'audio-ack',
                sessionId: message.sessionId
              }))
            } else {
              log(`⚠️ Audio received but session not found: ${message.sessionId}`)
            }
          }
        }
        // Otherwise, it's binary frame data
        else {
          if (!currentSessionId) {
            log('❌ Received frame data before session init')
            return
          }

          const session = activeSessions.get(currentSessionId)
          if (!session) {
            log(`❌ Session not found: ${currentSessionId}`)
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

          // Log every 100th frame to avoid spam
          if (frameNumber % 100 === 0) {
            log(`✓ Frame ${frameNumber} saved (${session.frameCount} total)`)
          }
        }
      } catch (error) {
        log(`❌ Error processing message: ${error}`)
        ws.send(JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      }
    })

    // Handle disconnection
    ws.on('close', async () => {
      log('🔌 Client disconnected')
      if (currentSessionId) {
        const session = activeSessions.get(currentSessionId)
        log(`   Session ID: ${currentSessionId}`)
        log(`   Session found: ${!!session}`)
        log(`   Frame count: ${session?.frameCount || 0}`)
        log(`   Audio path: ${session?.audioPath || 'NONE'}`)

        if (session && session.frameCount > 0) {
          log(`📦 Session ${currentSessionId} starting video generation ON DISCONNECT`)

          // Generate video automatically on disconnect
          try {
            const videoFileName = await generateVideo(session)
            log(`✅ Video generated on disconnect: ${videoFileName}`)
            activeSessions.delete(currentSessionId)
          } catch (error) {
            log(`❌ Video generation failed on disconnect: ${error}`)
          }
        } else if (session) {
          // No frames captured; clean up the empty session directory
          log(`🧹 No frames captured, cleaning up session directory`)
          await removeDirRecursive(session.sessionDir)
          activeSessions.delete(currentSessionId)
        }
      } else {
        log('   No active session on disconnect')
      }
    })

    // Handle errors
    ws.on('error', (error) => {
      log(`❌ WebSocket error: ${error}`)
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
