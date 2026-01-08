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
type SessionStatus = 'recording' | 'finalizing' | 'encoding' | 'done' | 'failed'

type RecordingSession = {
  sessionId: string
  sessionDir: string
  fps: number
  frameCount: number
  expectedFrames: number
  title: string
  artist: string
  audioPath?: string
  ws: WebSocket
  status: SessionStatus
  finalizeReceived?: boolean
  encodePromise?: Promise<string>
  encodingStartedAt?: number
}

const activeSessions = new Map<string, RecordingSession>()

// Sanitize filename to remove invalid characters
function sanitizeFileName(s: string): string {
  const cleaned = (s || '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || 'Untitled'
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
    const ffmpegLogLevel = (process.env.PIANO_FFMPEG_LOGLEVEL || 'error').trim() || 'error'
    const ffmpegArgs = [
      '-y',
      '-hide_banner',
      '-loglevel', ffmpegLogLevel,
      '-nostats',
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
      const line = data.toString().trim()
      if (line) console.log(`ffmpeg: ${line}`)
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

function safeWsSend(ws: WebSocket, message: unknown) {
  try {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message))
  } catch (error) {
    console.warn('⚠️ Failed to send WS message:', error)
  }
}

function ensureVideoEncoded(sessionId: string, reason: string): Promise<string> {
  const session = activeSessions.get(sessionId)
  if (!session) return Promise.reject(new Error(`Session not found: ${sessionId}`))

  if (session.encodePromise) return session.encodePromise

  session.status = 'encoding'
  session.encodingStartedAt = Date.now()
  console.log(`🎬 [WS] Starting encoding for session ${sessionId} (reason: ${reason})`)

  session.encodePromise = (async () => {
    try {
      const videoFileName = await generateVideo(session)
      session.status = 'done'
      return videoFileName
    } catch (error) {
      session.status = 'failed'
      // Best-effort cleanup if ffmpeg didn't remove the temp dir.
      await removeDirRecursive(session.sessionDir).catch(() => {})
      throw error
    } finally {
      activeSessions.delete(sessionId)
    }
  })()

  return session.encodePromise
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
    let lastSaveProgressAt = 0
    let lastSaveLineLen = 0
    let saveProgressFinished = false

    const renderSaveProgress = (session: { frameCount: number; expectedFrames: number }) => {
      const total = session.expectedFrames
      if (!total || total <= 0) return

      const isTTY = !!process.stdout.isTTY
      const now = Date.now()
      if (now - lastSaveProgressAt < 200 && session.frameCount < total) return
      lastSaveProgressAt = now

      const ratio = Math.min(1, Math.max(0, session.frameCount / total))
      const pct = Math.floor(ratio * 100)
      const width = 30
      const filled = Math.round(ratio * width)
      const bar = `${'='.repeat(filled)}${' '.repeat(Math.max(0, width - filled))}`
      const line = `Frames [${bar}] ${pct}% (${session.frameCount}/${total})`

      if (isTTY) {
        const padding = lastSaveLineLen > line.length ? ' '.repeat(lastSaveLineLen - line.length) : ''
        process.stdout.write(`\r${line}${padding}`)
        lastSaveLineLen = line.length
        if (session.frameCount >= total && !saveProgressFinished) {
          saveProgressFinished = true
          process.stdout.write('\n')
        }
      } else {
        const step = Math.max(1, Math.floor(total / 10))
        if (session.frameCount % step === 0 || session.frameCount >= total) {
          console.log(line)
        }
      }
    }

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
              ws,
              status: 'recording',
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
            session.finalizeReceived = true
            if (session.status === 'recording') session.status = 'finalizing'
            console.log(`✅ [WS] Session finalized: ${message.sessionId}`)
            console.log(`   [WS] Frame count: ${session.frameCount}`)
            console.log(`   [WS] Has audio: ${!!session.audioPath}`)

            // Trigger encoding (idempotent); don't block the message handler.
            ensureVideoEncoded(message.sessionId, 'finalize')
              .then((videoFileName) => {
                safeWsSend(ws, {
                  type: 'video-ready',
                  sessionId: message.sessionId,
                  videoUrl: `/videos/${videoFileName}`,
                  frameCount: session.frameCount,
                })
              })
              .catch((error) => {
                console.error(`❌ Video generation failed:`, error)
                safeWsSend(ws, {
                  type: 'error',
                  error: error instanceof Error ? error.message : 'Video generation failed',
                })
              })
          }
          }

          // Handle pre-generated audio file path (from server-side FluidSynth)
          else if (message.type === 'audio-path') {
            console.log(`🎵 [WS] Received audio-path message for session ${message.sessionId}`)
            const session = activeSessions.get(message.sessionId)
            if (session) {
              const audioPath = message.audioPath
              console.log(`   [WS] Pre-generated audio path: ${audioPath}`)

              // Verify the file exists
              try {
                await fs.access(audioPath)
                const stat = await fs.stat(audioPath)
                console.log(`   [WS] Audio file exists: ${(stat.size / 1024).toFixed(1)} KB`)
                session.audioPath = audioPath

                safeWsSend(ws, { type: 'audio-ack', sessionId: message.sessionId })
                console.log(`   [WS] Audio-ack sent to client`)
              } catch (error) {
                console.error(`   [WS] ❌ Audio file not found: ${audioPath}`)
                safeWsSend(ws, { type: 'error', error: `Audio file not found: ${audioPath}` })
              }
            } else {
              console.error(`   [WS] ❌ Session not found for audio-path: ${message.sessionId}`)
            }
          }

          // Handle audio data (base64 from browser)
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

              safeWsSend(ws, { type: 'audio-ack', sessionId: message.sessionId })
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
          safeWsSend(ws, { type: 'frame-ack', frameNumber, totalFrames: session.frameCount })

	          renderSaveProgress({ frameCount: session.frameCount, expectedFrames: session.expectedFrames })
	        }
	      } catch (error) {
	        console.error('❌ Error processing message:', error)
	        safeWsSend(ws, { type: 'error', error: error instanceof Error ? error.message : 'Unknown error' })
      }
    })

    // Handle disconnection
    ws.on('close', async () => {
      // If we were rendering an in-place progress line, finish it with a newline.
      if (process.stdout.isTTY && lastSaveLineLen > 0 && !saveProgressFinished) {
        process.stdout.write('\n')
        saveProgressFinished = true
      }
      console.log('🔌 [WS] Client disconnected')
      console.log(`   [WS] Current session: ${currentSessionId || '(none)'}`)

      if (currentSessionId) {
        const session = activeSessions.get(currentSessionId)
        if (session && session.frameCount > 0) {
          console.log(`📦 [WS] Session ${currentSessionId} - ensuring video on disconnect`)
          console.log(`   [WS] Frame count: ${session.frameCount}`)
          console.log(`   [WS] Has audio: ${!!session.audioPath}`)
          if (session.audioPath) {
            console.log(`   [WS] Audio path: ${session.audioPath}`)
          } else {
            console.warn(`   [WS] ⚠️ NO AUDIO - video will be silent!`)
          }

          // Ensure encoding happens at most once per session.
          ensureVideoEncoded(currentSessionId, 'disconnect')
            .then((videoFileName) => {
              console.log(`✅ [WS] Video generated on disconnect: ${videoFileName}`)
            })
            .catch((error) => {
              console.error(`❌ [WS] Video generation failed on disconnect:`, error)
            })
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
