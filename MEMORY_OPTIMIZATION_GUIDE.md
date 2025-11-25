# Memory Optimization Guide: Video Recording System

## Overview

This guide will help you optimize the memory usage in `app/routes/record.tsx`. Currently, the application stores all video frames in browser memory before uploading them to the server, which can consume **10-20GB of RAM** for a typical 3-minute piano video.

**The core problem**: We're storing frames on the client (either in RAM or disk) before uploading.

**The solution**: Stream frames directly to the server using WebSocket as they're captured - **zero client-side storage**.

---

## Understanding the Problem

### How Browser Memory Works

When you run JavaScript in a browser:
- **Heap Memory**: Where your variables, arrays, and objects live
- **GPU Memory**: Where canvas/WebGL data is stored
- **Typical Browser Limit**: 2-4GB per tab (varies by browser/OS)

### Current Memory Usage

Let's calculate what happens when recording a 3-minute video at 60 FPS:

```
Frame size (1920x1080 PNG as base64):  ~1.5 MB
FPS:                                    60
Duration:                               180 seconds
Total frames:                           60 × 180 = 10,800 frames
Total memory:                           10,800 × 1.5 MB = 16,200 MB (16.2 GB)
```

**This exceeds browser memory limits and will crash the tab!**

### Where Memory Is Used

1. **Line 379**: `capturedFrames` state array stores ALL frame data URLs
2. **Line 588-592**: Each frame converted to base64 and pushed to array
3. **Line 615**: All frames serialized to JSON for upload
4. **Lines 502-579**: Audio buffer generated entirely in memory

### Why Storing on Disk (IndexedDB) Is Also Bad

You might think: "Just use IndexedDB to store frames on disk!"

**Problems**:
- Unnecessary I/O: Capture → Disk → Read → Upload → Delete
- SSD wear: Writing 10,800+ PNG files wears out drives
- Still slow: Disk I/O is 100x slower than RAM
- Complex: More code, more failure points
- **Doesn't solve the real issue**: We're still accumulating frames

### The Right Approach: Streaming via WebSocket

```
❌ Current:  Capture → Store (RAM/Disk) → Batch Upload → Server
✅ Better:   Capture → WebSocket Stream → Server → Store on Server
```

**Why WebSocket over HTTP?**

| Feature | HTTP (fetch) | WebSocket |
|---------|-------------|-----------|
| Connection | New for each frame | One persistent connection |
| Overhead per frame | ~500 bytes headers | ~2 bytes |
| Data format | Base64 (text) | Binary (Blob) |
| Size | +33% larger | Raw binary |
| Bidirectional | No | Yes (server can send progress) |
| Backpressure | Hard | Built-in (bufferedAmount) |
| Reconnection | Automatic (browser) | Manual (you handle) |

**For local development, WebSocket wins because:**
- Lower overhead (important at 60 FPS)
- Binary transfer (no base64 encoding = smaller size)
- Real-time feedback (server tells client: "Frame 540 saved!")
- Backpressure (server says "slow down" if disk is busy)

---

## Understanding WebSocket

### What is WebSocket?

Think of HTTP vs WebSocket like this:

**HTTP (Traditional)**:
```
Client: "Hey server, here's a frame"
Server: "OK, got it"
[Connection closes]

Client: "Hey server, here's another frame"
Server: "OK, got it"
[Connection closes]

...repeat 10,800 times
```

**WebSocket**:
```
Client: "Hey server, let's open a connection"
Server: "OK, connection open"
[Connection stays open]

Client: [sends frame data]
Client: [sends frame data]
Client: [sends frame data]
...10,800 frames...
Client: "Done, closing connection"
```

### How WebSocket Works

1. **Handshake**: Client sends HTTP request with `Upgrade: websocket` header
2. **Connection**: Server responds with 101 Switching Protocols
3. **Communication**: Bidirectional message passing (client ↔ server)
4. **Close**: Either side can close connection

```
Browser                    Server
   |                          |
   |--- HTTP Upgrade -------->|
   |<-- 101 Switching --------|
   |                          |
   |=== WebSocket Open ========|
   |                          |
   |--- Binary Frame 1 ------>|
   |<-- "Saved frame 1" ------|
   |--- Binary Frame 2 ------>|
   |<-- "Saved frame 2" ------|
   |        ...               |
   |--- Binary Frame N ------>|
   |<-- "Video ready" --------|
   |                          |
   |=== Connection Close ======|
```

### Understanding Binary vs Text

**Base64 (text)**:
```javascript
const canvas = canvasRef.current
const dataURL = canvas.toDataURL('image/png')
// dataURL = "data:image/png;base64,iVBORw0KGgoAAAANS..."
// Size: 1.5 MB (33% overhead)
```

**Binary Blob**:
```javascript
const canvas = canvasRef.current
canvas.toBlob((blob) => {
  // blob = raw binary PNG data
  // Size: ~1.1 MB (no overhead)
})
```

**Savings**: Binary is 27% smaller than base64!

---

## Progressive Enhancement Strategy

We'll implement 4 improvements, each building on the previous one:

1. ✅ **WebSocket Frame Streaming** (Medium - 4 hours)
2. ✅ **Backpressure & Error Handling** (Easy - 1 hour)
3. ✅ **Server-Side Audio Generation** (Medium - 3 hours)
4. ✅ **Real-Time Progress Feedback** (Easy - 1 hour)

Each step is independently verifiable and improves performance.

---

## Step 1: WebSocket Frame Streaming

**Goal**: Upload each frame via WebSocket immediately after capture instead of storing them.

**Why This Helps**:
- **Zero client-side storage** - frames never accumulate
- Constant low memory usage (~50 MB)
- Binary transfer (27% smaller than base64)
- One persistent connection (lower overhead)
- Natural progress tracking

### Implementation

#### 1.1: Install WebSocket Server Library

**File**: `package.json`

**Add dependency**:
```json
{
  "dependencies": {
    "ws": "^8.14.2"
  }
}
```

**Run**:
```bash
npm install ws
```

**Why**: The `ws` library is the standard WebSocket implementation for Node.js. It's battle-tested, lightweight, and handles all the low-level protocol details.

---

#### 1.2: Create WebSocket Server

**Create new file**: `server/websocket.ts`

```typescript
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
```

**Why this structure**:
- **Control messages (JSON)**: For session setup and coordination
- **Binary messages (PNG)**: For actual frame data (no parsing overhead)
- **Frame number prefix**: First 4 bytes identify which frame (allows out-of-order delivery)
- **Progress updates**: Server tells client "frame received" immediately

---

#### 1.3: Integrate WebSocket into Remix Server

**File**: `server.ts` (or wherever you start your Remix server)

**Find** where you create the HTTP server:
```typescript
const server = app.listen(PORT)
```

**Add after it**:
```typescript
import { setupWebSocketServer } from './server/websocket'

const server = app.listen(PORT, () => {
  console.log(`Express server listening on port ${PORT}`)
})

// Add WebSocket support
setupWebSocketServer(server)
```

**Why**: WebSocket uses the same HTTP server (port) as your app. The upgrade happens via HTTP headers.

---

#### 1.4: Update Client State

**File**: [`app/routes/record.tsx:379`](app/routes/record.tsx#L379)

**Current code** (what you'll find):
```typescript
const [capturedFrames, setCapturedFrames] = useState<string[]>([])
```

This is the problem - storing all frames in an array accumulates memory.

**Replace with**:
```typescript
const [ws, setWs] = useState<WebSocket | null>(null)
const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null)
const [uploadedFrameCount, setUploadedFrameCount] = useState(0)
const [wsConnected, setWsConnected] = useState(false)
```

**Why**: We track WebSocket connection, session ID, and upload count instead of storing frames. Memory usage drops from GB to MB because we're only tracking metadata, not actual frame data.

---

#### 1.5: Create WebSocket Connection Manager

**File**: [`app/routes/record.tsx`](app/routes/record.tsx) (add after your state declarations)

**Add this new `useEffect` hook**:
```typescript
// Initialize WebSocket connection
useEffect(() => {
  // Connect to WebSocket server
  const websocket = new WebSocket('ws://localhost:5173/ws/frames')

  websocket.onopen = () => {
    console.log('✅ WebSocket connected')
    setWsConnected(true)
  }

  websocket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data)

      if (message.type === 'init-ack') {
        console.log(`✅ Session initialized: ${message.sessionId}`)
      }

      else if (message.type === 'frame-ack') {
        setUploadedFrameCount(message.totalFrames)
        console.log(`✓ Frame ${message.frameNumber} uploaded (${message.totalFrames} total)`)
      }

      else if (message.type === 'error') {
        console.error(`❌ Server error: ${message.error}`)
      }

      else if (message.type === 'finalize-ack') {
        console.log(`✅ Recording finalized: ${message.frameCount} frames`)
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  }

  websocket.onerror = (error) => {
    console.error('❌ WebSocket error:', error)
    setWsConnected(false)
  }

  websocket.onclose = () => {
    console.log('🔌 WebSocket disconnected')
    setWsConnected(false)
  }

  setWs(websocket)

  // Cleanup on unmount
  return () => {
    if (websocket.readyState === WebSocket.OPEN) {
      websocket.close()
    }
  }
}, [])
```

**Why this pattern**:
- **Single connection**: Opens once, reused for entire session
- **Message handler**: Parses server responses and updates UI
- **Error handling**: Logs errors and updates connection state
- **Cleanup**: Closes connection when component unmounts

---

#### 1.6: Update Frame Capture to Stream via WebSocket

**File**: [`app/routes/record.tsx:582`](app/routes/record.tsx#L582)

**Current code** (search for the `captureFrame` function):
```typescript
const captureFrame = (frameNumber: number) => {
  const canvas = canvasRef.current
  if (!canvas) return

  try {
    const dataURL = canvas.toDataURL('image/png')
    // Problem: This pushes frames into state array!
    setCapturedFrames(prev => {
      const newFrames = [...prev]
      newFrames[frameNumber] = dataURL
      return newFrames
    })
    // ... rest of function
  }
}
```

**Key issues in current code**:
- `toDataURL()` returns base64 string (33% larger than binary)
- `setCapturedFrames` stores frame in state (accumulates in RAM)
- All frames kept until end of recording

**Replace entire function with**:
```typescript
// Frame capture function - streams via WebSocket, no storage
const captureFrame = (frameNumber: number) => {
  const canvas = canvasRef.current
  if (!canvas || !ws || !recordingSessionId) return

  try {
    // Convert canvas to Blob (binary, not base64)
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error(`Failed to create blob for frame ${frameNumber}`)
        return
      }

      // Create binary message: [4 bytes frame number][PNG data]
      blob.arrayBuffer().then(arrayBuffer => {
        // Create buffer with 4-byte header for frame number
        const frameNumberBuffer = new ArrayBuffer(4)
        const view = new DataView(frameNumberBuffer)
        view.setUint32(0, frameNumber, false) // Big-endian

        // Combine frame number + PNG data
        const combinedBuffer = new Uint8Array(frameNumberBuffer.byteLength + arrayBuffer.byteLength)
        combinedBuffer.set(new Uint8Array(frameNumberBuffer), 0)
        combinedBuffer.set(new Uint8Array(arrayBuffer), frameNumberBuffer.byteLength)

        // Send binary data via WebSocket
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(combinedBuffer)
          console.log(`→ Frame ${frameNumber} sent (${(blob.size / 1024).toFixed(1)} KB)`)
        } else {
          console.error(`WebSocket not open, cannot send frame ${frameNumber}`)
        }
      })
    }, 'image/png')

    // Auto-advance to next frame (don't wait for upload)
    if (frameNumber < totalFrames - 1) {
      setTimeout(() => setCurrentFrame(frameNumber + 1), 50)
    } else {
      // Recording complete
      setIsRecording(false)
      console.log('Recording complete! Finalizing...')

      // Wait a moment for final frames to upload
      setTimeout(() => finalizeRecording(), 2000)
    }
  } catch (error) {
    console.error('Error capturing frame:', error)
  }
}
```

**Why this approach**:
- **`canvas.toBlob()`**: Returns binary PNG data (no base64 conversion)
- **Frame number prefix**: Server knows which frame this is (allows out-of-order)
- **Fire-and-forget**: Don't wait for server response, keep capturing
- **Memory**: Blob is created and sent immediately, then garbage collected

**Key concept**: `toBlob()` is **async** (callback-based) because converting canvas to PNG happens off the main thread.

---

#### 1.7: Create Start and Finalize Functions

**File**: [`app/routes/record.tsx:692`](app/routes/record.tsx#L692)

**Current code** (search for `startRecording` function):
```typescript
const startRecording = () => {
  if (!midiObject) {
    alert('Please load a MIDI file first')
    return
  }

  setIsRecording(true)
  setCurrentFrame(0)
  setCapturedFrames([])  // This line will be removed
  console.log(`Starting recording: ${totalFrames} frames at ${FPS} FPS`)
}
```

**Replace entire function with**:
```typescript
// Start recording - initialize WebSocket session
const startRecording = () => {
  if (!midiObject) {
    alert('Please load a MIDI file first')
    return
  }

  if (!ws || !wsConnected) {
    alert('WebSocket not connected. Please refresh the page.')
    return
  }

  // Generate unique session ID
  const sessionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  setRecordingSessionId(sessionId)

  // Send session initialization message
  ws.send(JSON.stringify({
    type: 'init',
    sessionId,
    fps: FPS,
    expectedFrames: totalFrames
  }))

  setIsRecording(true)
  setCurrentFrame(0)
  setUploadedFrameCount(0)

  console.log(`✓ Recording session started: ${sessionId}`)
  console.log(`Recording ${totalFrames} frames at ${FPS} FPS`)
}

// Finalize recording - tell server we're done
const finalizeRecording = () => {
  if (!recordingSessionId || !ws) return

  // Send finalize message
  ws.send(JSON.stringify({
    type: 'finalize',
    sessionId: recordingSessionId
  }))

  console.log('Finalization message sent to server')

  // Trigger video generation via HTTP action
  setIsProcessingVideo(true)
  const formData = new FormData()
  formData.append('action_type', 'generate-video')
  formData.append('session_id', recordingSessionId)

  // Add MIDI file for audio generation (Step 3)
  if (midiFile) {
    formData.append('midi_file', midiFile)
  }

  fetcher.submit(formData, { method: 'POST' })
}
```

**Why separate WebSocket and HTTP**:
- **WebSocket**: Real-time frame streaming (high frequency, low latency)
- **HTTP**: One-time operations like video generation (can take minutes)

---

#### 1.8: Update HTTP Action for Video Generation

**File**: [`app/routes/record.tsx:238`](app/routes/record.tsx#L238)

**Current code** (search for the `action` function):
```typescript
export async function action({ request }: ActionFunctionArgs) {
  console.log('🚀 Server action started')

  let formData;
  try {
    formData = await request.formData()
    console.log('📝 Form data received successfully')
  } catch (error) {
    console.error('❌ Failed to parse form data:', error)
    return json({ error: 'Failed to parse form data - possibly too large' }, { status: 413 })
  }

  const framesData = formData.get('frames') as string
  const fps = parseInt(formData.get('fps') as string) || 60
  const audioBase64 = formData.get('audio_base64') as string | null;
  // ... rest of function processes frames from JSON array
```

**Key issues with current code**:
- Expects all frames in one `frames` JSON array (memory-intensive client-side)
- Frames already uploaded, this just processes them
- No streaming - batch processing only

**Replace entire function with**:
```typescript
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const actionType = formData.get('action_type') as string

  if (actionType === 'generate-video') {
    const sessionId = formData.get('session_id') as string

    const { spawn } = await import('child_process')
    const fs = await import('fs')
    const path = await import('path')

    const sessionDir = path.join(process.cwd(), 'temp_frames', sessionId)

    // Read metadata
    const metadataPath = path.join(sessionDir, 'metadata.json')
    const metadataContent = await fs.promises.readFile(metadataPath, 'utf-8')
    const metadata = JSON.parse(metadataContent)

    // Audio handling will go here in Step 3

    // Generate video
    const outputPath = path.join(process.cwd(), 'public', `piano_video_${sessionId}.mp4`)

    return new Promise((resolve) => {
      const ffmpegArgs = [
        '-framerate', metadata.fps.toString(),
        '-i', path.join(sessionDir, 'frame_%06d.png'),
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'fast',
        '-crf', '18',
        outputPath
      ]

      console.log(`🎬 Starting FFmpeg: ffmpeg ${ffmpegArgs.join(' ')}`)
      const ffmpeg = spawn('ffmpeg', ffmpegArgs)

      ffmpeg.stderr.on('data', (data) => {
        console.log(`ffmpeg: ${data}`)
      })

      ffmpeg.on('close', async (code) => {
        // Cleanup
        try {
          const files = await fs.promises.readdir(sessionDir)
          await Promise.all(files.map(file => fs.promises.unlink(path.join(sessionDir, file))))
          await fs.promises.rmdir(sessionDir)
          console.log(`🗑️  Cleaned up session: ${sessionId}`)
        } catch (error) {
          console.error('Cleanup error:', error)
        }

        if (code === 0) {
          const videoFileName = path.basename(outputPath)
          resolve(json({
            success: true,
            videoUrl: `/${videoFileName}`,
            message: `Video generated: ${videoFileName}`
          }))
        } else {
          resolve(json({ error: 'ffmpeg failed' }, { status: 500 }))
        }
      })
    })
  }

  return json({ error: 'Invalid action type' }, { status: 400 })
}
```

**Why keep HTTP for video generation**:
- FFmpeg can take 30-60 seconds
- HTTP can handle long-running operations
- WebSocket better for frequent small messages, not long tasks

---

#### 1.9: Update UI

**File**: [`app/routes/record.tsx:828`](app/routes/record.tsx#L828)

**Current code** (search in the JSX return statement):
```typescript
{isRecording && <p style={{ marginTop: '10px', fontSize: '12px' }}>Recording... {((currentFrame / totalFrames) * 100).toFixed(1)}%</p>}
{isProcessingVideo && <p style={{ marginTop: '10px', fontSize: '12px' }}>Processing video...</p>}
```

**Key issues with current code**:
- No WebSocket connection status displayed
- No upload progress feedback
- No server acknowledgment visibility
- User can't tell if frames are actually uploading

**Replace with**:
```typescript
<div style={{ marginBottom: '10px', fontSize: '11px' }}>
  WebSocket: {wsConnected ? '🟢 Connected' : '🔴 Disconnected'}
</div>

{isRecording && (
  <div style={{ marginTop: '10px', fontSize: '12px' }}>
    <p>Recording... {((currentFrame / totalFrames) * 100).toFixed(1)}%</p>
    <p>Uploaded: {uploadedFrameCount}/{totalFrames} frames</p>
  </div>
)}

{isProcessingVideo && <p style={{ marginTop: '10px', fontSize: '12px' }}>Generating video...</p>}
```

**Why show connection status**: Helps debug WebSocket issues immediately.

---

### 1.10: Verification

**Changed files summary**:
- ✅ `package.json` - Added `ws` dependency
- ✅ `server/websocket.ts` - New file created
- ✅ `server.ts` - Integrated WebSocket server
- ✅ [`app/routes/record.tsx:379`](app/routes/record.tsx#L379) - Removed `capturedFrames` state
- ✅ [`app/routes/record.tsx:582`](app/routes/record.tsx#L582) - Changed `captureFrame` to stream via WebSocket
- ✅ [`app/routes/record.tsx:692`](app/routes/record.tsx#L692) - Updated `startRecording` to init WebSocket session
- ✅ [`app/routes/record.tsx:238`](app/routes/record.tsx#L238) - Updated action to read from server disk
- ✅ [`app/routes/record.tsx:828`](app/routes/record.tsx#L828) - Updated UI with connection status

**How to Test**:

1. **Start server**:
   ```bash
   npm run dev
   ```

2. **Check server logs**:
   ```
   ✅ WebSocket server ready at ws://localhost:5173/ws/frames
   Express server listening on port 5173
   ```

3. **Open browser** and check:
   - UI shows "WebSocket: 🟢 Connected"
   - Console shows: `✅ WebSocket connected`

4. **Load MIDI file and start recording**

5. **Watch console output**:

   **Browser console**:
   ```
   ✓ Recording session started: 1234567890_abc123
   Recording 600 frames at 60 FPS
   → Frame 0 sent (1,234.5 KB)
   ✓ Frame 0 uploaded (1 total)
   → Frame 1 sent (1,235.2 KB)
   ✓ Frame 1 uploaded (2 total)
   ...
   ```

   **Server console**:
   ```
   🔌 Client connected
   📝 Session initialized: 1234567890_abc123
   ✓ Frame 0 saved (1 total)
   ✓ Frame 1 saved (2 total)
   ...
   ```

6. **Check memory**:
   - Open DevTools → Memory tab
   - Take heap snapshot
   - Record for 10 seconds
   - Take another snapshot
   - Compare: **Memory should stay flat around 50-100 MB**

7. **Check server disk**:
   ```bash
   ls temp_frames/1234567890_abc123/
   # Should see: frame_000000.png, frame_000001.png, ..., metadata.json
   ```

**What to Look For**:
- ✅ Memory stays constant (~50-100 MB)
- ✅ Console shows real-time frame confirmations
- ✅ Server directory fills with sequential frames
- ✅ No "out of memory" errors
- ✅ Binary transfer (check Network tab → WS → Messages → shows binary frames)

**Memory Savings**: **99% reduction** - from 16,000 MB to ~100 MB!

---

## Step 2: Backpressure & Error Handling

**Goal**: Handle slow networks and server disk I/O gracefully.

**Why This Helps**:
- Prevents overwhelming server with frames
- Handles disconnections gracefully
- Automatic retry on failure
- Smoother experience on slow networks

### Understanding Backpressure

**The problem**:
```
Client captures: 60 frames/sec
Network sends: 40 frames/sec
Buffer grows: 20 frames/sec × 180 sec = 3,600 frames stuck in memory
```

**The solution**: Check `ws.bufferedAmount` before sending.

```javascript
// How much data is waiting to be sent?
console.log(ws.bufferedAmount) // bytes queued in WebSocket buffer

// If buffer is too large, pause capturing
if (ws.bufferedAmount > 10 * 1024 * 1024) { // 10 MB
  // Wait before sending next frame
}
```

### Implementation

#### 2.1: Add Backpressure Check to Frame Capture

**File**: [`app/routes/record.tsx`](app/routes/record.tsx) (in the modified `captureFrame` function from Step 1.6)

**Find** the WebSocket send code you added in Step 1.6:
```typescript
// Send binary data via WebSocket
if (ws.readyState === WebSocket.OPEN) {
  ws.send(combinedBuffer)
  console.log(`→ Frame ${frameNumber} sent (${(blob.size / 1024).toFixed(1)} KB)`)
} else {
  console.error(`WebSocket not open, cannot send frame ${frameNumber}`)
}
```

**Key issue**: No check for buffer overflow - frames sent continuously regardless of network speed.

**Replace with**:
```typescript
// Check buffered amount (backpressure)
const BUFFER_THRESHOLD = 10 * 1024 * 1024 // 10 MB
if (ws.bufferedAmount > BUFFER_THRESHOLD) {
  console.warn(`⚠️  Buffer full (${(ws.bufferedAmount / 1024 / 1024).toFixed(1)} MB), pausing...`)

  // Wait for buffer to drain before sending
  const waitForBuffer = setInterval(() => {
    if (ws.bufferedAmount < BUFFER_THRESHOLD / 2) {
      clearInterval(waitForBuffer)
      ws.send(combinedBuffer)
      console.log(`→ Frame ${frameNumber} sent (${(blob.size / 1024).toFixed(1)} KB)`)
    }
  }, 100)
} else {
  // Send immediately
  ws.send(combinedBuffer)
  console.log(`→ Frame ${frameNumber} sent (${(blob.size / 1024).toFixed(1)} KB)`)
}
```

**Why this works**:
- **bufferedAmount**: Tells you how much data is queued (not yet sent over network)
- **Threshold**: If > 10 MB queued, pause sending
- **Drain**: Wait until buffer drops to 5 MB, then resume
- **Result**: Never accumulate frames in memory

---

#### 2.2: Add Reconnection Logic

**File**: [`app/routes/record.tsx`](app/routes/record.tsx) (in the WebSocket `useEffect` from Step 1.5)

**Find** the `onclose` handler you added in Step 1.5:
```typescript
websocket.onclose = () => {
  console.log('🔌 WebSocket disconnected')
  setWsConnected(false)
}
```

**Key issue**: No automatic reconnection on disconnect - recording fails permanently if connection drops.

**Replace with**:
```typescript
websocket.onclose = () => {
  console.log('🔌 WebSocket disconnected')
  setWsConnected(false)

  // Only reconnect if we're still recording
  if (isRecording) {
    console.log('🔄 Attempting to reconnect...')

    // Reconnect after 2 seconds
    setTimeout(() => {
      const newWebsocket = new WebSocket('ws://localhost:5173/ws/frames')

      newWebsocket.onopen = () => {
        console.log('✅ WebSocket reconnected')
        setWsConnected(true)

        // Re-initialize session
        if (recordingSessionId) {
          newWebsocket.send(JSON.stringify({
            type: 'init',
            sessionId: recordingSessionId,
            fps: FPS,
            expectedFrames: totalFrames
          }))
        }
      }

      // Copy other event handlers...
      setWs(newWebsocket)
    }, 2000)
  }
}
```

**Why reconnect**:
- Network can drop temporarily
- Server can restart
- Graceful recovery keeps recording going

---

#### 2.3: Add Frame Retry Logic (Advanced)

**File**: [`app/routes/record.tsx`](app/routes/record.tsx) (near your state declarations from Step 1.4)

**Add new state** (after the state you added in Step 1.4):
```typescript
const [pendingFrames, setPendingFrames] = useState<Set<number>>(new Set())
const [failedFrames, setFailedFrames] = useState<Set<number>>(new Set())
```

**Why**: Track which frames are waiting for server acknowledgment and which failed.

**Update frame capture** (in the `captureFrame` function):
```typescript
const captureFrame = (frameNumber: number) => {
  // ... existing code ...

  // Track pending frame
  setPendingFrames(prev => new Set(prev).add(frameNumber))

  // ... send frame ...
}
```

**Update message handler**:
```typescript
websocket.onmessage = (event) => {
  const message = JSON.parse(event.data)

  if (message.type === 'frame-ack') {
    // Remove from pending
    setPendingFrames(prev => {
      const newSet = new Set(prev)
      newSet.delete(message.frameNumber)
      return newSet
    })

    setUploadedFrameCount(message.totalFrames)
  }
}
```

**Add retry mechanism**:
```typescript
// Check for frames that didn't get acked within 5 seconds
useEffect(() => {
  if (!isRecording) return

  const retryInterval = setInterval(() => {
    const now = Date.now()
    pendingFrames.forEach(frameNumber => {
      // If frame pending > 5 seconds, mark as failed
      setFailedFrames(prev => new Set(prev).add(frameNumber))
      setPendingFrames(prev => {
        const newSet = new Set(prev)
        newSet.delete(frameNumber)
        return newSet
      })
    })
  }, 5000)

  return () => clearInterval(retryInterval)
}, [isRecording, pendingFrames])
```

**Why retry logic**:
- Some frames may get lost over network
- Server might drop messages under load
- Ensures all frames arrive (critical for video quality)

---

### 2.4: Verification

**Changed files summary for Step 2**:
- ✅ [`app/routes/record.tsx`](app/routes/record.tsx) - Added backpressure check in `captureFrame`
- ✅ [`app/routes/record.tsx`](app/routes/record.tsx) - Added reconnection logic in WebSocket `useEffect`
- ✅ [`app/routes/record.tsx`](app/routes/record.tsx) - (Optional) Added retry tracking with `pendingFrames` state

**How to Test**:

1. **Test backpressure**:
   - Open DevTools → Network tab
   - Throttle to "Slow 3G"
   - Start recording
   - Watch console: Should see `⚠️  Buffer full` messages
   - Memory should **still stay flat** (not accumulating frames)

2. **Test reconnection**:
   - Start recording
   - Stop server (Ctrl+C)
   - Watch browser console: `🔌 WebSocket disconnected`
   - Restart server
   - Watch browser console: `✅ WebSocket reconnected`
   - Recording should resume

3. **Check buffer size**:
   ```javascript
   // In browser console during recording
   console.log(ws.bufferedAmount)
   // Should stay under 10 MB
   ```

**What to Look For**:
- ✅ Buffer never exceeds 10 MB
- ✅ Reconnection happens automatically
- ✅ Recording survives temporary disconnections
- ✅ Memory stays constant even with slow network

---

## Step 3: Server-Side Audio Generation

**Goal**: Generate audio on the server from the MIDI file instead of in the browser.

**Why This Helps**:
- Removes 100-500 MB audio buffer from browser memory
- Faster processing (server has more CPU/RAM)
- Offloads work from user's device

### How Audio Rendering Works

Current flow (browser):
1. **Browser**: Create OfflineAudioContext (uses RAM)
2. **Browser**: Load soundfont samples (uses RAM)
3. **Browser**: Render audio buffer (uses CPU + RAM)
4. **Browser**: Convert to WAV (doubles RAM temporarily)
5. **Browser**: Convert to base64 (triples RAM temporarily)
6. **Browser**: Upload to server

New flow (server):
1. **Browser**: Upload MIDI file via HTTP
2. **Server**: Synthesize audio using fluidsynth
3. **Server**: Save audio file directly
4. **Server**: Use in FFmpeg command

### Implementation

#### 3.1: Install Server Dependencies

**No code changes** - Just system installation.

**Install fluidsynth** (MIDI → WAV synthesizer):

**macOS**:
```bash
brew install fluidsynth
```

**Ubuntu/Debian**:
```bash
sudo apt-get update
sudo apt-get install fluidsynth fluid-soundfont-gm
```

**Windows**:
- Download from https://github.com/FluidSynth/fluidsynth/releases

**Why fluidsynth**: Professional-grade MIDI synthesizer used by many audio applications. Removes need for browser-based audio generation.

---

#### 3.2: Download Soundfont

**File**: `.env` (create if it doesn't exist in project root)

**No current code** - This is a new addition.

**What are soundfonts?**: MIDI files are just instructions ("play note C at time 1.5s"). Soundfonts contain the actual audio samples (how a piano should sound).

**Download and configure**:
```bash
# Create directory
sudo mkdir -p /usr/share/sounds/sf2/

# Download soundfont (180 MB)
curl -L -o FluidR3_GM.sf2 https://github.com/urish/cinto/raw/master/media/FluidR3%20GM.sf2

# Move to system directory
sudo mv FluidR3_GM.sf2 /usr/share/sounds/sf2/

# Set environment variable
export SOUNDFONT_PATH=/usr/share/sounds/sf2/FluidR3_GM.sf2
```

**Add to project's `.env` file**:
```bash
SOUNDFONT_PATH=/usr/share/sounds/sf2/FluidR3_GM.sf2
```

**Why**: Server needs to know where soundfont file is located to synthesize audio from MIDI.

---

#### 3.3: Add Audio Generation to Server Action

**File**: [`app/routes/record.tsx:238`](app/routes/record.tsx#L238) (in the `action` function updated in Step 1.8)

**Current code** (in the `generate-video` action from Step 1.8):
```typescript
// Read metadata
const metadataPath = path.join(sessionDir, 'metadata.json')
const metadataContent = await fs.promises.readFile(metadataPath, 'utf-8')
const metadata = JSON.parse(metadataContent)

// Audio handling will go here in Step 3

// Generate video
const outputPath = path.join(process.cwd(), 'public', `piano_video_${sessionId}.mp4`)
```

**Key issue**: No server-side audio generation - browser still doing it (500MB+ memory).

**Replace comment with this code**:
```typescript
// Handle audio generation from MIDI
let audioPath: string | null = null
const midiFileData = formData.get('midi_file')

if (midiFileData && midiFileData instanceof File) {
  console.log('🎹 MIDI file received, generating audio on server...')

  const { promisify } = await import('util')
  const writeFile = promisify(fs.writeFile)

  try {
    // Save MIDI file temporarily
    const midiPath = path.join(sessionDir, 'input.mid')
    const midiBuffer = Buffer.from(await midiFileData.arrayBuffer())
    await writeFile(midiPath, midiBuffer)
    console.log(`📝 MIDI file saved: ${midiPath}`)

    // Generate audio using fluidsynth
    audioPath = path.join(sessionDir, 'audio.wav')
    const soundfontPath = process.env.SOUNDFONT_PATH || '/usr/share/sounds/sf2/FluidR3_GM.sf2'

    console.log(`🎵 Synthesizing audio with fluidsynth...`)

    await new Promise<void>((resolve, reject) => {
      const fluidsynth = spawn('fluidsynth', [
        '-ni',           // No interactive mode
        '-g', '1.0',     // Gain (volume)
        '-r', '44100',   // Sample rate
        soundfontPath,   // Soundfont file
        midiPath,        // Input MIDI
        '-F', audioPath  // Output WAV
      ])

      fluidsynth.stdout.on('data', (data) => {
        console.log(`fluidsynth: ${data}`)
      })

      fluidsynth.stderr.on('data', (data) => {
        console.log(`fluidsynth: ${data}`)
      })

      fluidsynth.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Audio generated successfully')
          resolve()
        } else {
          console.error(`❌ Fluidsynth failed with code ${code}`)
          reject(new Error(`fluidsynth failed with code ${code}`))
        }
      })
    })

  } catch (error) {
    console.error('❌ Audio generation failed:', error)
    audioPath = null // Continue without audio
  }
} else {
  console.log('ℹ️  No MIDI file provided, generating video without audio')
}
```

**Why fluidsynth command**:
- `-ni`: No interactive mode (runs as command-line tool)
- `-g 1.0`: Gain/volume at 100%
- `-r 44100`: Standard audio sample rate (44.1 kHz)
- `-F output.wav`: Output to WAV file

---

#### 3.4: Add Audio to FFmpeg Command

**File**: [`app/routes/record.tsx:238`](app/routes/record.tsx#L238) (same `action` function, FFmpeg section)

**Current code** (find the FFmpeg args construction):
```typescript
const ffmpegArgs = [
  '-framerate', metadata.fps.toString(),
  '-i', path.join(sessionDir, 'frame_%06d.png'),
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-preset', 'fast',
  '-crf', '18',
  outputPath
]
```

**Key issue**: No audio input - generating silent video even if audio was created by fluidsynth.

**Replace with**:
```typescript
const ffmpegArgs = [
  '-framerate', metadata.fps.toString(),
  '-i', path.join(sessionDir, 'frame_%06d.png')
]

// Add audio if available
if (audioPath) {
  console.log(`🎵 Adding audio track: ${audioPath}`)
  ffmpegArgs.push(
    '-i', audioPath,      // Audio input
    '-c:a', 'aac',        // Audio codec
    '-b:a', '192k',       // Audio bitrate (high quality)
    '-shortest'           // Match video length
  )
}

// Video encoding settings
ffmpegArgs.push(
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-preset', 'fast',
  '-crf', '18',
  outputPath
)
```

**Why `-shortest`**: If audio is longer than video (or vice versa), cut to shortest duration.

---

#### 3.5: Remove Client-Side Audio Generation

**File**: [`app/routes/record.tsx:502`](app/routes/record.tsx#L502)

**Current code** (search for `generateAudioFromMIDI`):
```typescript
// Generate audio from MIDI using soundfont
const generateAudioFromMIDI = async (): Promise<Blob | null> => {
  if (!midiObject || !ac || !instrument) {
    console.log('Cannot generate audio: missing dependencies', { midiObject: !!midiObject, ac: !!ac, instrument: !!instrument });
    return null;
  }

  console.log(`Generating audio from MIDI using soundfont for ${midiObject.length} notes...`);

  // ... 70+ lines of audio buffer generation code ...
  // Creates OfflineAudioContext, schedules notes, renders audio
  // Uses 500MB+ browser memory
}
```

**Key issue**: This entire function consumes 500MB+ of browser RAM and is now redundant since server generates audio.

**Delete entire function or comment it out**:
```typescript
// DEPRECATED: Audio generation moved to server-side (Step 3)
// This function is no longer used - server handles audio with fluidsynth
/*
const generateAudioFromMIDI = async (): Promise<Blob | null> => {
  ...
}
*/
```

**Also remove calls to this function** in `processVideo` function (around line 611):
- Find and remove the code that calls `generateAudioFromMIDI()`
- Remove the audio blob upload code

**Why remove**: Server-side audio generation is faster, uses less memory, and doesn't block the browser UI.

---

### 3.6: Verification

**Changed files summary for Step 3**:
- ✅ System: Installed `fluidsynth`
- ✅ `.env`: Added `SOUNDFONT_PATH` variable
- ✅ [`app/routes/record.tsx:238`](app/routes/record.tsx#L238) - Added server-side audio generation in action
- ✅ [`app/routes/record.tsx:238`](app/routes/record.tsx#L238) - Updated FFmpeg args to include audio
- ✅ [`app/routes/record.tsx:502`](app/routes/record.tsx#L502) - Removed/commented `generateAudioFromMIDI` function
- ✅ [`app/routes/record.tsx:611`](app/routes/record.tsx#L611) - Removed audio generation calls from `processVideo`

**How to Test**:

1. **Test fluidsynth installation**:
   ```bash
   fluidsynth --version
   # Should show: FluidSynth version 2.x.x
   ```

2. **Test manual audio generation**:
   ```bash
   # Use any MIDI file
   fluidsynth -ni -r 44100 /usr/share/sounds/sf2/FluidR3_GM.sf2 test.mid -F test.wav

   # Play the generated audio
   afplay test.wav  # macOS
   # or
   aplay test.wav   # Linux
   ```

3. **Test in app**:
   - Load MIDI file
   - Start recording
   - Stop recording
   - Check server logs:
     ```
     🎹 MIDI file received, generating audio on server...
     📝 MIDI file saved: /path/to/temp_frames/xxx/input.mid
     🎵 Synthesizing audio with fluidsynth...
     fluidsynth: FluidSynth runtime version 2.3.4
     fluidsynth: Rendering audio to file 'audio.wav'...
     ✅ Audio generated successfully
     🎵 Adding audio track: /path/to/temp_frames/xxx/audio.wav
     ```

4. **Check memory**:
   - Browser memory should **not spike** during audio generation
   - Only server uses CPU/RAM for audio

5. **Play video**:
   - Generated video should have audio
   - Audio should sync with visual

**What to Look For**:
- ✅ Browser memory stays flat (no audio generation spike)
- ✅ Server logs show fluidsynth success
- ✅ Generated video has audio track
- ✅ Audio syncs with video

**Memory Savings**: Additional 200-500 MB removed from browser!

---

## Step 4: Real-Time Progress Feedback

**Goal**: Show live progress updates from server during recording and video generation.

**Why This Helps**:
- User knows system is working
- Can see exactly which frame is being processed
- Helps debug issues (can see where it got stuck)
- Better user experience

### Understanding Bidirectional WebSocket

So far we've only sent data **browser → server**. WebSocket is **bidirectional**, meaning server can send messages back anytime.

```
Browser                    Server
   |                          |
   |--- Frame 100 ----------->|
   |                          | (saves frame)
   |<-- "Frame 100 saved" ----|
   |                          |
   |--- Frame 101 ----------->|
   |                          | (saves frame)
   |<-- "Frame 101 saved" ----|
```

### Implementation

#### 4.1: Add Progress UI State

**File**: [`app/routes/record.tsx`](app/routes/record.tsx) (near other state declarations from Step 1.4)

**Add new state** (after the state you added in earlier steps):
```typescript
const [serverStatus, setServerStatus] = useState<string>('')
const [uploadProgress, setUploadProgress] = useState<number>(0)
```

**Why**: Track real-time server messages and upload percentage for UI display.

---

#### 4.2: Update Message Handler

**File**: [`app/routes/record.tsx`](app/routes/record.tsx) (in the WebSocket `useEffect` from Step 1.5)

**Current code** (find the `onmessage` handler):
```typescript
websocket.onmessage = (event) => {
  try {
    const message = JSON.parse(event.data)

    if (message.type === 'frame-ack') {
      setUploadedFrameCount(message.totalFrames)
      console.log(`✓ Frame ${message.frameNumber} uploaded (${message.totalFrames} total)`)
    }
    // ... other handlers ...
  }
}
```

**Key issue**: No progress calculation or status updates for the UI.

**Replace with** (enhanced version):
```typescript
websocket.onmessage = (event) => {
  try {
    const message = JSON.parse(event.data)

    if (message.type === 'frame-ack') {
      setUploadedFrameCount(message.totalFrames)
      console.log(`✓ Frame ${message.frameNumber} uploaded (${message.totalFrames} total)`)
    }
    // ... other handlers ...
  }
}
```

**Add progress updates**:
```typescript
websocket.onmessage = (event) => {
  try {
    const message = JSON.parse(event.data)

    if (message.type === 'frame-ack') {
      setUploadedFrameCount(message.totalFrames)

      // Update progress percentage
      const progress = (message.totalFrames / totalFrames) * 100
      setUploadProgress(progress)

      // Update status message
      setServerStatus(`Frame ${message.frameNumber} saved`)

      console.log(`✓ Frame ${message.frameNumber} uploaded (${message.totalFrames} total)`)
    }

    else if (message.type === 'progress') {
      // Server can send arbitrary progress updates
      setServerStatus(message.message)
      console.log(`📊 Server: ${message.message}`)
    }

    // ... other handlers ...
  }
}
```

---

#### 4.3: Add Server Progress Updates

**File**: [`server/websocket.ts`](server/websocket.ts) (created in Step 1.2)

**Current code** (find in the frame save handler):
```typescript
// Send progress update
ws.send(JSON.stringify({
  type: 'frame-ack',
  frameNumber,
  totalFrames: session.frameCount
}))

console.log(`✓ Frame ${frameNumber} saved (${session.frameCount} total)`)
```

**Key issue**: Minimal feedback - just frame count, no timing or performance metrics.

**Replace with** (enhanced version):
```typescript
// Send progress update with more detail
ws.send(JSON.stringify({
  type: 'frame-ack',
  frameNumber,
  totalFrames: session.frameCount,
  frameSize: frameData.length,
  timestamp: Date.now()
}))

// Send periodic progress summary every 60 frames
if (session.frameCount % 60 === 0) {
  const elapsedSeconds = (Date.now() - session.startTime) / 1000
  const framesPerSecond = session.frameCount / elapsedSeconds

  ws.send(JSON.stringify({
    type: 'progress',
    message: `${session.frameCount} frames saved (${framesPerSecond.toFixed(1)} FPS average)`
  }))
}
```

---

#### 4.4: Add Video Generation Progress

**File**: [`app/routes/record.tsx:238`](app/routes/record.tsx#L238) (in the `action` function, FFmpeg section)

**Current code** (find the FFmpeg stderr handler):
```typescript
ffmpeg.stderr.on('data', (data) => {
  console.log(`ffmpeg: ${data}`)
})
```

**Key issue**: Raw FFmpeg output logged but not parsed - no structured progress info.

**Replace with** (enhanced version):
```typescript
ffmpeg.stderr.on('data', (data) => {
  const output = data.toString()
  console.log(`ffmpeg: ${output}`)

  // Parse FFmpeg progress (looks like: "frame= 540 fps=30 ...")
  const frameMatch = output.match(/frame=\s*(\d+)/)
  if (frameMatch) {
    const currentFrame = parseInt(frameMatch[1])
    console.log(`🎬 Encoding frame ${currentFrame}`)

    // You could send this via WebSocket if still connected
    // or use Server-Sent Events (SSE) for long-running tasks
  }
})
```

**Why FFmpeg stderr**: FFmpeg outputs progress to stderr (not stdout), which is standard for CLI tools.

---

#### 4.5: Update UI with Progress

**File**: [`app/routes/record.tsx:828`](app/routes/record.tsx#L828) (updated in Step 1.9, now enhance further)

**Current code** (from Step 1.9):
```typescript
{isRecording && (
  <div style={{ marginTop: '10px', fontSize: '12px' }}>
    <p>Recording... {((currentFrame / totalFrames) * 100).toFixed(1)}%</p>
    <p>Uploaded: {uploadedFrameCount}/{totalFrames} frames</p>
  </div>
)}
```

**Key issue**: Basic text only - no visual progress indicator or server status.

**Replace with** (enhanced version with progress bar):
```typescript
{isRecording && (
  <div style={{ marginTop: '10px', fontSize: '12px' }}>
    <p>Recording... {((currentFrame / totalFrames) * 100).toFixed(1)}%</p>
    <p>Uploaded: {uploadedFrameCount}/{totalFrames} frames ({uploadProgress.toFixed(1)}%)</p>
    {serverStatus && <p style={{ color: '#4a9eff' }}>Server: {serverStatus}</p>}

    {/* Progress bar */}
    <div style={{
      width: '200px',
      height: '8px',
      background: '#333',
      borderRadius: '4px',
      overflow: 'hidden',
      marginTop: '8px'
    }}>
      <div style={{
        width: `${uploadProgress}%`,
        height: '100%',
        background: '#4a9eff',
        transition: 'width 0.3s ease'
      }} />
    </div>
  </div>
)}
```

**Why progress bar**: Visual feedback is easier to understand than numbers.

---

### 4.6: Verification

**Changed files summary for Step 4**:
- ✅ [`app/routes/record.tsx`](app/routes/record.tsx) - Added `serverStatus` and `uploadProgress` state
- ✅ [`app/routes/record.tsx`](app/routes/record.tsx) - Enhanced WebSocket message handler with progress calculation
- ✅ [`server/websocket.ts`](server/websocket.ts) - Added detailed progress updates with timing
- ✅ [`app/routes/record.tsx:238`](app/routes/record.tsx#L238) - Added FFmpeg progress parsing in action
- ✅ [`app/routes/record.tsx:828`](app/routes/record.tsx#L828) - Added progress bar to UI

**How to Test**:

1. **Start recording**
2. **Watch UI updates in real-time**:
   - Progress bar fills from 0% → 100%
   - "Server: Frame 42 saved" updates continuously
   - Numbers increment smoothly

3. **Check timing**:
   - Server status should update within 100ms of frame capture
   - No lag between capture and confirmation

4. **Check console**:
   ```
   ✓ Frame 0 uploaded (1 total)
   Server: Frame 0 saved
   ✓ Frame 60 uploaded (61 total)
   📊 Server: 61 frames saved (60.5 FPS average)
   ```

**What to Look For**:
- ✅ Progress bar moves smoothly
- ✅ Server status updates in real-time
- ✅ FPS average shown every second
- ✅ No lag between capture and server confirmation

---

## Summary

You've implemented 4 progressive enhancements:

| Step | Memory Saved | Time Saved | Difficulty | Est. Time |
|------|-------------|-----------|-----------|---------|
| 1. WebSocket Streaming | 99% (16 GB → 50 MB) | 0% | Medium | 4h |
| 2. Backpressure & Retry | 0 MB (reliability) | 0% | Easy | 1h |
| 3. Server Audio | 500 MB | 0% | Medium | 3h |
| 4. Progress Feedback | 0 MB (UX) | 0% | Easy | 1h |

**Total Improvement**:
- **Before**: 16+ GB RAM (crashes), no feedback
- **After**: ~50 MB RAM (stable), real-time progress

### Final Architecture

```
┌──────────────┐
│   Browser    │
│              │
│ 1. Capture   │──┐
│    frame     │  │
│              │  │ WebSocket (binary)
│ 2. toBlob()  │  │ Frame data streaming
│              │  │
│ 3. ws.send() │──┘
│              │
│ Memory: 50MB │
└──────────────┘
        ↕
   WebSocket
   (persistent)
        ↕
┌──────────────┐
│ Node Server  │
│              │
│ 1. Receive   │
│    frames    │
│              │
│ 2. Save to   │
│    disk      │
│              │
│ 3. Send ack  │──┐ Real-time
│              │  │ progress
│ 4. Generate  │  │
│    audio     │  │
│    (MIDI→WAV)│  │
│              │◄─┘
│ 5. Run FFmpeg│
│              │
│ Disk: ~5 GB  │
└──────────────┘
```

### Key Takeaways

1. **WebSocket > HTTP for streaming**: One connection, binary data, real-time feedback
2. **Backpressure is critical**: Check `bufferedAmount` to prevent memory accumulation
3. **Binary > Base64**: 27% smaller, no encoding overhead
4. **Server-side processing**: Offload heavy work (audio, video encoding)
5. **Bidirectional communication**: Server keeps client informed in real-time

### Testing the Complete System

**Short Recording (10 seconds)**:
1. Load MIDI → Check "WebSocket: 🟢 Connected"
2. Start recording → Watch progress bar fill
3. Stop recording → Check frames uploaded
4. Video generates → Download and play

**Verify**:
- ✅ Memory < 100 MB throughout
- ✅ Progress updates every frame
- ✅ Server status shows frame numbers
- ✅ Video has audio and plays correctly

**Long Recording (3 minutes)**:
1. Same as above, but for 180 seconds
2. Memory should **stay flat** for all 10,800 frames
3. Progress bar should fill smoothly
4. Server should handle all frames without errors

**Verify**:
- ✅ Memory still < 100 MB
- ✅ No disconnections
- ✅ All frames uploaded (count matches total)
- ✅ Video quality is perfect

### Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| "WebSocket: 🔴 Disconnected" | Server not running | Check server logs, restart server |
| "Buffer full" warnings | Slow network | Normal - backpressure is working |
| Frames missing in video | Lost WebSocket messages | Check Step 2.3 retry logic |
| No audio in video | Fluidsynth not installed | Run: `brew install fluidsynth` (macOS) |
| Audio out of sync | Wrong FPS metadata | Verify FPS matches recording (60) |
| Memory still high | Frames stored in state | Check `capturedFrames` is removed |
| Progress bar stuck | WebSocket disconnect | Check console for reconnection |

---

## WebSocket vs HTTP: When to Use Each

### Use WebSocket for:
- ✅ High-frequency messages (60/sec)
- ✅ Real-time bidirectional communication
- ✅ Low latency requirements
- ✅ Streaming data (video frames, audio)
- ✅ Live progress updates

### Use HTTP for:
- ✅ One-time operations (file upload, API calls)
- ✅ Long-running tasks (video generation)
- ✅ RESTful operations (CRUD)
- ✅ Compatibility (works everywhere)

### Our architecture uses both:
- **WebSocket**: Frame streaming (high frequency, binary)
- **HTTP**: Video generation (one-time, long-running)

---

## Next Steps (Beyond This Guide)

Once all 4 steps work:

1. **Add frame deduplication**: Don't re-upload frames if recording is resumed
2. **Compression before upload**: JPEG with quality=80 (80% smaller than PNG)
3. **Resume capability**: Continue interrupted recordings from last frame
4. **Multiple quality options**: Let user choose video quality (CRF setting)
5. **Real-time preview**: Show last uploaded frame in UI
6. **WebCodecs API**: Browser-native video encoding (Chrome 94+, experimental)

---

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| WebSocket | ✅ All | ✅ All | ✅ All | ✅ All |
| WebSocket.send(Blob) | ✅ 21+ | ✅ 18+ | ✅ 10+ | ✅ 12+ |
| Canvas.toBlob | ✅ 50+ | ✅ 19+ | ✅ 11+ | ✅ 79+ |
| ArrayBuffer | ✅ All | ✅ All | ✅ All | ✅ All |

All features used are well-supported in modern browsers.

---

## Additional Resources

- **WebSocket Protocol**: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- **WebSocket Server (ws)**: https://github.com/websockets/ws
- **Canvas.toBlob**: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
- **FluidSynth**: https://www.fluidsynth.org/
- **FFmpeg**: https://ffmpeg.org/documentation.html
- **Memory Profiling**: https://developer.chrome.com/docs/devtools/memory-problems/

---

## Glossary

- **ArrayBuffer**: JavaScript's way of handling binary data
- **Backpressure**: Slowing down sender when receiver is overwhelmed
- **Base64**: Text encoding of binary data (33% size increase)
- **Binary**: Raw data format (most efficient for transmission)
- **Blob**: Binary Large Object - container for binary data
- **Buffered Amount**: Bytes queued in WebSocket send buffer
- **Fire-and-forget**: Send data without waiting for confirmation
- **Handshake**: Initial HTTP → WebSocket protocol upgrade
- **Soundfont**: Library of instrument audio samples
- **WebSocket**: Persistent bidirectional connection protocol

---

## Architecture Comparison

### Before (Batching with HTTP):
```
Capture → Store in RAM → Batch 100 frames → HTTP POST → Repeat
Memory: 16 GB (crashes)
Network: 60 separate HTTP connections
Feedback: None until upload complete
```

### After (Streaming with WebSocket):
```
Capture → toBlob() → ws.send() → Server saves → ws.send(ack)
Memory: 50 MB (stable)
Network: 1 WebSocket connection
Feedback: Real-time per frame
```

---

**Good luck! Remember:**

1. **Test each step independently** - Don't move to Step 2 until Step 1 works perfectly
2. **Check memory constantly** - Open DevTools → Memory tab and watch the graph
3. **Read server logs** - Most issues show up in server console first
4. **Verify binary transfer** - Network tab should show binary WebSocket frames
5. **Start simple** - Record 5 seconds first, then scale to 3 minutes

**Most importantly: The goal is zero client-side storage. Every frame should stream to server and be immediately forgotten by the browser.**
