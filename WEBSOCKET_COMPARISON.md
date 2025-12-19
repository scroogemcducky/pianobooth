# WebSocket Implementation: Node.js vs Bun

## Overview

This document explains the fundamental differences between WebSocket implementations in Node.js and Bun, and provides a refactor plan for migrating this project to use Bun's native WebSocket API.

---

## Node.js + `ws` Library Approach

### Architecture

Node.js doesn't have built-in WebSocket support, so we use the `ws` library which works with Node.js's HTTP server via the **event-based pattern**.

### Key Concepts

1. **HTTP Server with Upgrade Event**: WebSocket connections start as HTTP requests, then "upgrade" to WebSocket protocol
2. **Event Emitter Pattern**: The server emits events (`'upgrade'`, `'connection'`, `'message'`, `'close'`)
3. **Per-Connection State**: Each WebSocket connection is an individual object with its own event handlers

### Code Example (Current Implementation)

```typescript
// server/websocket.ts (Current)
import WebSocket, { WebSocketServer } from 'ws'

export function setupWebSocketServer(httpServer: any) {
  // Create WebSocket server (doesn't listen on its own port)
  const wss = new WebSocketServer({ noServer: true })

  // Intercept HTTP upgrade requests
  httpServer.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url, `http://${request.headers.host}`)

    if (pathname === '/ws/frames') {
      // Complete the WebSocket handshake
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
    }
  })

  // Handle new connections
  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected')

    // Per-connection event handlers
    ws.on('message', (data: Buffer) => {
      // Handle incoming messages
    })

    ws.on('close', () => {
      console.log('Client disconnected')
    })

    ws.on('error', (error) => {
      console.error('WebSocket error:', error)
    })
  })
}
```

### Flow Diagram

```
Client Request
    ↓
HTTP Server receives request
    ↓
Server emits 'upgrade' event
    ↓
Our handler checks pathname
    ↓
wss.handleUpgrade() completes handshake
    ↓
'connection' event emitted
    ↓
Per-connection handlers attached
    ↓
'message', 'close', 'error' events
```

---

## Bun's Native WebSocket Approach

### Architecture

Bun has **built-in WebSocket support** integrated directly into its HTTP server (`Bun.serve()`). Instead of events, it uses a **handler object pattern**.

### Key Concepts

1. **Server-Level Handlers**: WebSocket handlers are defined once at server creation
2. **No Upgrade Event**: The server automatically handles WebSocket upgrades based on `fetch` handler logic
3. **Context-Based**: Each connection gets a `ServerWebSocket` object, but handlers are shared

### Code Example (Bun Approach)

```typescript
// Hypothetical Bun implementation
import type { ServerWebSocket } from 'bun'

// Define WebSocket handler once
const websocketHandler = {
  // Called when a message is received
  message(ws: ServerWebSocket, message: string | Buffer) {
    console.log('Received:', message)
  },

  // Called when connection opens
  open(ws: ServerWebSocket) {
    console.log('Client connected')
  },

  // Called when connection closes
  close(ws: ServerWebSocket, code: number, reason: string) {
    console.log('Client disconnected')
  },

  // Called on errors
  error(ws: ServerWebSocket, error: Error) {
    console.error('WebSocket error:', error)
  },
}

// Create server with WebSocket support
const server = Bun.serve({
  port: 3000,

  // HTTP request handler
  fetch(req, server) {
    const url = new URL(req.url)

    // Upgrade to WebSocket for specific path
    if (url.pathname === '/ws/frames') {
      const upgraded = server.upgrade(req, {
        data: { sessionId: null } // Custom data per connection
      })

      if (upgraded) {
        return undefined // WebSocket handled
      }
    }

    // Regular HTTP response
    return new Response('Hello!')
  },

  // Attach WebSocket handlers
  websocket: websocketHandler,
})
```

### Flow Diagram

```
Client Request
    ↓
Bun.serve() fetch handler
    ↓
Check pathname
    ↓
server.upgrade(req) if WebSocket
    ↓
Bun automatically completes handshake
    ↓
websocket.open() called
    ↓
websocket.message(), close(), error() as needed
```

---

## Key Differences Summary

| Feature | Node.js + `ws` | Bun Native |
|---------|----------------|------------|
| **Setup** | Separate library, attach to HTTP server | Built into `Bun.serve()` |
| **Pattern** | Event-based (`on('message')`) | Handler object (`message(ws, data)`) |
| **Upgrade** | Manual via `'upgrade'` event | Automatic via `server.upgrade()` |
| **Handlers** | Per-connection | Shared across all connections |
| **State** | Store in closure or WeakMap | Store in `ws.data` object |
| **Type Safety** | Requires `@types/ws` | Built into Bun types |
| **Performance** | Good | **Faster** (native implementation) |
| **Compatibility** | Standard Node.js ecosystem | Bun-specific, not portable |

---

## Conceptual Differences

### 1. Event-Driven vs. Handler Object

**Node.js/ws:**
```typescript
ws.on('message', (data) => { /* handle */ })
ws.on('close', () => { /* handle */ })
```

**Bun:**
```typescript
const websocket = {
  message(ws, data) { /* handle */ },
  close(ws, code, reason) { /* handle */ }
}
```

### 2. Connection State Storage

**Node.js/ws:**
```typescript
// Store state in closure or external Map
const sessions = new Map()

wss.on('connection', (ws) => {
  let sessionId = null
  ws.on('message', (data) => {
    // Access sessionId here
  })
})
```

**Bun:**
```typescript
// Store state in ws.data
server.upgrade(req, {
  data: { sessionId: null }
})

websocket: {
  message(ws, data) {
    const sessionId = ws.data.sessionId // Access custom data
  }
}
```

### 3. Sending Messages

**Node.js/ws:**
```typescript
ws.send('Hello')
ws.send(Buffer.from([1, 2, 3]))
```

**Bun:**
```typescript
ws.send('Hello')
ws.send(new Uint8Array([1, 2, 3]))
```

---

## Refactor Plan: Migrating This Project to Bun

### Current Architecture

```
Vite Dev Server (Node.js HTTP server)
    ↓
vite.config.ts plugin hooks into server.httpServer
    ↓
server/websocket.ts sets up ws library
    ↓
Listens on 'upgrade' event
    ↓
Handles WebSocket connections
```

### Proposed Bun Architecture

```
Separate Bun WebSocket Server
    ↓
Runs on different port (e.g., 5174)
    ↓
Uses Bun.serve() with native WebSocket
    ↓
Vite serves frontend on 5173
    ↓
Frontend connects to ws://localhost:5174/frames
```

---

## Step-by-Step Refactor

### Step 1: Create New Bun WebSocket Server

Create `server/websocket-bun.ts`:

```typescript
import type { ServerWebSocket } from 'bun'
import fs from 'fs/promises'
import path from 'path'
import { spawn } from 'child_process'

const TEMP_ROOT = path.join(process.cwd(), 'temp_frames')

interface SessionData {
  sessionId: string | null
  sessionDir: string
  fps: number
  frameCount: number
  expectedFrames: number
  title: string
  artist: string
  audioPath?: string
}

// Active sessions stored separately (since handlers are shared)
const activeSessions = new Map<string, SessionData>()

// WebSocket handler (shared across all connections)
const websocketHandler = {
  async message(ws: ServerWebSocket<{ sessionId: string | null }>, message: string | Buffer) {
    try {
      // Check if it's JSON (control message) or binary (frame data)
      if (typeof message === 'string') {
        const data = JSON.parse(message)

        // Handle session initialization
        if (data.type === 'init') {
          const sessionId = data.sessionId
          const sessionDir = path.join(TEMP_ROOT, sessionId)

          await fs.mkdir(sessionDir, { recursive: true })

          activeSessions.set(sessionId, {
            sessionId,
            sessionDir,
            fps: data.fps || 60,
            frameCount: 0,
            expectedFrames: data.expectedFrames || 0,
            title: data.title || 'Untitled',
            artist: data.artist || 'Piano',
          })

          // Store session ID in connection data
          ws.data.sessionId = sessionId

          ws.send(JSON.stringify({
            type: 'init-ack',
            sessionId,
          }))

          console.log(`📝 Session initialized: ${sessionId}`)
        }

        // Handle finalize
        else if (data.type === 'finalize') {
          const session = activeSessions.get(data.sessionId)
          if (session) {
            console.log(`✅ Session finalized: ${data.sessionId}`)
            const videoFileName = await generateVideo(session)

            ws.send(JSON.stringify({
              type: 'video-ready',
              sessionId: data.sessionId,
              videoUrl: `/${videoFileName}`,
              frameCount: session.frameCount,
            }))

            activeSessions.delete(data.sessionId)
          }
        }

        // Handle audio upload
        else if (data.type === 'audio') {
          const session = activeSessions.get(data.sessionId)
          if (session) {
            const audioPath = path.join(session.sessionDir, 'audio.wav')
            const audioBuffer = Buffer.from(data.audioData, 'base64')
            await fs.writeFile(audioPath, audioBuffer)
            session.audioPath = audioPath

            ws.send(JSON.stringify({
              type: 'audio-ack',
              sessionId: data.sessionId,
            }))
          }
        }
      }

      // Binary frame data
      else {
        const sessionId = ws.data.sessionId
        if (!sessionId) {
          console.error('❌ Frame data received before session init')
          return
        }

        const session = activeSessions.get(sessionId)
        if (!session) {
          console.error(`❌ Session not found: ${sessionId}`)
          return
        }

        // Parse frame data
        const frameNumber = new DataView(message.buffer).getUint32(0, false)
        const frameData = message.slice(4)

        const filename = `frame_${String(frameNumber).padStart(6, '0')}.jpg`
        const filepath = path.join(session.sessionDir, filename)
        await fs.writeFile(filepath, frameData)

        session.frameCount++

        ws.send(JSON.stringify({
          type: 'frame-ack',
          frameNumber,
          totalFrames: session.frameCount,
        }))

        if (frameNumber % 50 === 0) {
          console.log(`✓ Frame ${frameNumber} saved (${session.frameCount} total)`)
        }
      }
    } catch (error) {
      console.error('❌ Error processing message:', error)
      ws.send(JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }))
    }
  },

  open(ws: ServerWebSocket<{ sessionId: string | null }>) {
    console.log('🔌 Client connected')
    ws.data.sessionId = null
  },

  async close(ws: ServerWebSocket<{ sessionId: string | null }>) {
    console.log('🔌 Client disconnected')

    const sessionId = ws.data.sessionId
    if (sessionId) {
      const session = activeSessions.get(sessionId)
      if (session && session.frameCount > 0) {
        console.log(`📦 Auto-generating video for session ${sessionId}`)
        try {
          await generateVideo(session)
          activeSessions.delete(sessionId)
        } catch (error) {
          console.error('❌ Video generation failed on disconnect:', error)
        }
      }
    }
  },

  error(ws: ServerWebSocket<{ sessionId: string | null }>, error: Error) {
    console.error('❌ WebSocket error:', error)
  },
}

// Video generation function (same as before)
async function generateVideo(session: SessionData): Promise<string> {
  const displayName = sanitizeFileName(`${session.artist} - ${session.title}`)
  const videoFileName = `${displayName}.mp4`
  const outputPath = path.join(process.cwd(), 'videos', videoFileName)

  console.log(`🎬 Starting video generation for session ${session.sessionId}...`)

  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      '-y',
      '-framerate', session.fps.toString(),
      '-i', path.join(session.sessionDir, 'frame_%06d.jpg')
    ]

    if (session.audioPath) {
      ffmpegArgs.push('-i', session.audioPath)
      ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k')
    }

    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'fast',
      '-crf', '18'
    )

    if (session.audioPath) {
      ffmpegArgs.push('-shortest')
    }

    ffmpegArgs.push(outputPath)

    const ffmpeg = spawn('ffmpeg', ffmpegArgs)

    ffmpeg.stderr.on('data', (data) => {
      console.log(`ffmpeg: ${data.toString().trim()}`)
    })

    ffmpeg.on('close', async (code) => {
      // Cleanup
      try {
        const files = await fs.readdir(session.sessionDir)
        await Promise.all(files.map(file => fs.unlink(path.join(session.sessionDir, file))))
        await fs.rmdir(session.sessionDir)
      } catch (error) {
        console.error('⚠️ Cleanup error:', error)
      }

      if (code === 0) {
        console.log(`✅ Video generated: ${videoFileName}`)
        resolve(videoFileName)
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`))
      }
    })
  })
}

function sanitizeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').replace(/\\s+/g, ' ').trim()
}

// Start Bun WebSocket server
const server = Bun.serve({
  port: 5174,

  fetch(req, server) {
    const url = new URL(req.url)

    // Upgrade WebSocket connections on /frames path
    if (url.pathname === '/frames') {
      const upgraded = server.upgrade(req, {
        data: { sessionId: null }
      })

      if (upgraded) {
        return undefined // Connection upgraded to WebSocket
      }

      return new Response('WebSocket upgrade failed', { status: 400 })
    }

    return new Response('WebSocket server running', { status: 200 })
  },

  websocket: websocketHandler,
})

console.log(`🚀 Bun WebSocket server running on ws://localhost:${server.port}/frames`)
```

### Step 2: Update Frontend to Connect to New Port

In `app/routes/record.tsx:558`, change:

```typescript
// OLD (Node.js/ws approach)
websocket = new WebSocket('ws://localhost:5173/ws/frames')

// NEW (Bun approach)
websocket = new WebSocket('ws://localhost:5174/frames')
```

### Step 3: Update Package.json Scripts

```json
{
  "scripts": {
    "dev": "npm run dev:vite & npm run dev:ws",
    "dev:vite": "remix vite:dev",
    "dev:ws": "bun server/websocket-bun.ts",
    "render:test": "bun scripts/test_websocket_stream.ts"
  }
}
```

### Step 4: Remove Old WebSocket Setup

- Remove or comment out the WebSocket plugin in `vite.config.ts:35-44`
- Keep `server/websocket.ts` for reference but don't import it

### Step 5: Update Test Script

In `scripts/test_websocket_stream.ts:10`, change:

```typescript
// OLD
const BASE_URL = process.env.RENDER_BASE_URL || 'http://localhost:5173'

// NEW - WebSocket on different port
const BASE_URL = process.env.RENDER_BASE_URL || 'http://localhost:5173'
const WS_URL = process.env.WS_URL || 'ws://localhost:5174/frames'

// Then update the WebSocket connection code to use WS_URL
```

---

## Pros and Cons of Migrating to Bun

### Pros

✅ **Performance**: Bun's native WebSocket is faster than `ws` library
✅ **Simplicity**: No need for upgrade event handling
✅ **Type Safety**: Built-in TypeScript types
✅ **Modern API**: Cleaner handler object pattern
✅ **All Bun**: Use Bun for both scripts and server

### Cons

❌ **Not Portable**: Code only works with Bun, not Node.js
❌ **Separate Server**: Need to run two servers (Vite + WebSocket)
❌ **Different Patterns**: Team needs to learn Bun-specific API
❌ **Ecosystem**: Some tools/libraries expect Node.js
❌ **Production**: Deployment complexity (two processes)

---

## Alternative: Hybrid Approach

Keep Node.js for Vite dev server, but use Bun for the WebSocket server:

```bash
# Terminal 1: Vite with Node.js
npm run dev:vite

# Terminal 2: WebSocket with Bun
bun run dev:ws
```

This gives you:
- ✅ Vite compatibility (Node.js)
- ✅ Fast WebSocket (Bun)
- ✅ Best of both worlds

---

## Recommendation

**For this project**: **Stick with Node.js** because:
1. The current setup works perfectly with Node.js installed
2. Vite + Remix ecosystem is Node.js-first
3. Deploying to Cloudflare Pages (per wrangler config) works better with standard Node.js
4. No significant performance bottleneck in WebSocket handling

**When to use Bun WebSocket**:
- Building a new project from scratch
- WebSocket performance is critical
- You're already committed to Bun ecosystem
- You control the entire deployment stack

---

## Learning Resources

- [Bun WebSocket Documentation](https://bun.com/docs/api/websockets)
- [ws Library Documentation](https://github.com/websockets/ws)
- [Bun vs Node.js Compatibility](https://github.com/oven-sh/bun/issues)
- [WebSocket Protocol RFC 6455](https://datatracker.ietf.org/doc/html/rfc6455)

---

## Conclusion

The key difference is **philosophy**:
- **Node.js/ws**: Event-driven, flexible, ecosystem-compatible
- **Bun**: Handler-object, performant, Bun-specific

Both work well, but for different use cases. Your project is best served by Node.js for now, but understanding Bun's approach helps you make informed decisions for future projects.
