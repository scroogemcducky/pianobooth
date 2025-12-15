# WebSocket Rendering Debugging Notes

## Issue
`bun run render:test` was failing with "WebSocket disconnected" error and not rendering.

## Root Causes Identified

### 1. Dev Server Not Running
**Problem**: The test script expects `http://localhost:5173` to be available but doesn't start the server.
**Solution**: Test scripts should manage the dev server lifecycle or document the requirement.

### 2. React Strict Mode WebSocket Interference
**Problem**: React 18's Strict Mode runs useEffects twice in development, causing:
- First invocation: Creates WebSocket
- Cleanup runs: Closes the WebSocket before it can connect
- Second invocation: Creates new WebSocket, but same issue

**Solution**: Modified `app/routes/record.tsx` (lines 660-670) to:
```typescript
if (websocket.readyState === WebSocket.OPEN) {
  websocket.close()
  wsRef.current = null
} else if (websocket.readyState === WebSocket.CONNECTING) {
  console.log('⏸️ WebSocket still connecting, keeping it open')
  // Don't close - let it finish connecting
}
```

### 3. WebSocket Handshake Not Completing
**Problem**: Even with fixes, the WebSocket handshake doesn't complete:
- Server receives upgrade request ✅
- Server calls `handleUpgrade` ✅
- Server emits 'connection' event ✅
- Server sees client connected ✅
- BUT: Client stays in CONNECTING state ❌
- Client never fires `onopen` event ❌

**Attempted Solutions**:
1. Added error handling to upgrade handler
2. Moved WebSocket to separate HTTP server on port 5174
3. Implemented singleton pattern to prevent multiple servers
4. Added detailed logging throughout the handshake process

**Status**: The WebSocket server is properly set up and receiving connections at the TCP level, but there's an incompatibility preventing the WebSocket protocol handshake from completing on the client side.

## Files Modified

1. `app/routes/record.tsx`
   - Fixed Strict Mode WebSocket cleanup (line 660-670)
   - Changed WebSocket URL to port 5174

2. `server/websocket.ts`
   - Added detailed logging to upgrade handler
   - Added error handling

3. `vite.config.ts`
   - Created separate HTTP server on port 5174 for WebSocket
   - Implemented singleton pattern to prevent multiple instances

4. `tests/websocket_rendering_test.py` (NEW)
   - Complete test suite with Playwright + Python
   - Manages dev server lifecycle
   - Tests WebSocket connection and full rendering pipeline

## Recommended Next Steps

### Option 1: Manual Dev Server (Simplest)
Document that `bun run dev` must be running before `bun run render:test`:
```bash
# Terminal 1
bun run dev

# Terminal 2
bun run render:test
```

### Option 2: Fix WebSocket Handshake
Investigate why `ws` library's `handleUpgrade` isn't completing the handshake:
- May be Bun-specific compatibility issue
- Could try alternative WebSocket libraries (uWebSockets, etc.)
- Might need to manually construct the handshake response

### Option 3: Use Python Test Suite
The new `tests/websocket_rendering_test.py` manages the dev server automatically:
```bash
python tests/websocket_rendering_test.py
```

## How to Run Tests

### Python Test Suite (Recommended)
```bash
# Install dependencies
pip install playwright
python -m playwright install chromium

# Run tests
python tests/websocket_rendering_test.py
```

### Original Test Script (Requires Manual Server)
```bash
# Terminal 1: Start dev server
bun run dev

# Terminal 2: Run test (once server is ready)
bun run render:test
```

## WebSocket Architecture

Current setup:
- **Port 5173**: Vite dev server (HTTP + Vite HMR WebSocket)
- **Port 5174**: Dedicated WebSocket server for frame streaming

```
Client (Browser/Playwright)
    ↓
ws://localhost:5174/ws/frames
    ↓
Separate HTTP Server (vite.config.ts)
    ↓
WebSocketServer (server/websocket.ts)
    ↓
Handles: init, frames, audio, finalize
    ↓
Generates video with FFmpeg
```

## Debug Logging

All WebSocket activity is logged to `recording-debug.log`:
```bash
tail -f recording-debug.log
```

Key log messages:
- `📡 Upgrade request received` - Client attempting to connect
- `🔗 handleUpgrade callback fired` - Server processing upgrade
- `🔌 Client connected` - Connection established (server-side)
- `✅ WebSocket connected` - Should appear in browser console (currently not firing)

## Known Issues

1. **WebSocket client never sees `onopen` event** despite server accepting connection
2. **Strict Mode can still cause issues** if state updates happen during cleanup
3. **Port 5174 must be available** for WebSocket server

## Testing Checklist

- [ ] Dev server starts successfully
- [ ] Port 5174 is listening (`lsof -ti:5174`)
- [ ] Browser can load `/record` page
- [ ] Record button appears and is enabled
- [ ] WebSocket shows "connected" in browser console
- [ ] Recording session initializes
- [ ] Frames are uploaded
- [ ] Video generation completes
- [ ] Video file appears in `/videos` directory
