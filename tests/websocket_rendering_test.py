"""
Playwright + Python test suite for WebSocket rendering functionality
Tests the full rendering pipeline: MIDI loading, WebSocket streaming, video generation
"""

import subprocess
import time
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

class DevServerManager:
    """Manages the Remix dev server lifecycle"""
    def __init__(self):
        self.process = None

    def start(self):
        """Start the dev server"""
        print("🚀 Starting dev server...")
        self.process = subprocess.Popen(
            ["bun", "run", "dev"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        # Wait for server to be ready
        time.sleep(8)
        print("✅ Dev server started")

    def stop(self):
        """Stop the dev server"""
        if self.process:
            print("🛑 Stopping dev server...")
            self.process.terminate()
            self.process.wait(timeout=5)
            print("✅ Dev server stopped")

def test_websocket_connection():
    """Test that WebSocket connects successfully"""
    server = DevServerManager()

    try:
        server.start()

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=False)
            context = browser.new_context(viewport={"width": 1920, "height": 1080})

            # Preload test MIDI data
            context.add_init_script("""
                localStorage.setItem('processedMidiData', JSON.stringify([
                    { Delta: 0, Duration: 500000, NoteNumber: 60, Velocity: 80, SoundDuration: 500 },
                    { Delta: 500000, Duration: 500000, NoteNumber: 64, Velocity: 80, SoundDuration: 500 }
                ]));
                localStorage.setItem('midiMeta', JSON.stringify({ title: 'Test Song', artist: 'Test Artist' }));
            """)

            page = context.new_page()

            # Track console messages
            ws_connected = {"value": False}
            def handle_console(msg):
                if "WebSocket connected" in msg.text:
                    ws_connected["value"] = True
                    print(f"✅ {msg.text}")

            page.on("console", handle_console)

            # Navigate to record page
            print("🎬 Opening /record page...")
            page.goto("http://localhost:5173/record", wait_until="domcontentloaded")

            # Wait for record button
            print("⏳ Waiting for record button...")
            page.wait_for_selector("#record-button", state="visible", timeout=30000)

            # Wait for WebSocket to connect (max 30 seconds)
            print("⏳ Waiting for WebSocket connection...")
            for i in range(30):
                if ws_connected["value"]:
                    break
                time.sleep(1)

            assert ws_connected["value"], "WebSocket failed to connect within 30 seconds"
            print("✅ WebSocket connection test PASSED")

            browser.close()

    finally:
        server.stop()

def test_full_rendering_pipeline():
    """Test the complete rendering pipeline from MIDI to video"""
    server = DevServerManager()

    try:
        server.start()

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=False)
            context = browser.new_context(viewport={"width": 1920, "height": 1080})

            # Load actual test MIDI
            test_midi_path = Path("midi/test_videos/test.mid")
            if not test_midi_path.exists():
                print(f"⚠️  Test MIDI not found at {test_midi_path}, using minimal test data")
                # Use minimal test data
                context.add_init_script("""
                    localStorage.setItem('processedMidiData', JSON.stringify([
                        { Delta: 0, Duration: 500000, NoteNumber: 60, Velocity: 80, SoundDuration: 500 }
                    ]));
                    localStorage.setItem('midiMeta', JSON.stringify({ title: 'Test', artist: 'Test' }));
                """)
            else:
                # Parse and inject real MIDI data
                print(f"📝 Loading MIDI from {test_midi_path}")
                # In a real implementation, you'd parse the MIDI file here
                # For now, use the test data
                context.add_init_script("""
                    localStorage.setItem('processedMidiData', JSON.stringify([
                        { Delta: 0, Duration: 500000, NoteNumber: 60, Velocity: 80, SoundDuration: 500 }
                    ]));
                    localStorage.setItem('midiMeta', JSON.stringify({ title: 'Test', artist: 'Test' }));
                """)

            page = context.new_page()

            # Track rendering progress
            session_initialized = {"value": False}
            video_ready = {"value": False}

            def handle_console(msg):
                text = msg.text
                if "Session initialized" in text:
                    session_initialized["value"] = True
                    print(f"✅ {text}")
                elif "Video ready" in text or "Video generated" in text:
                    video_ready["value"] = True
                    print(f"✅ {text}")
                elif "Frame" in text and "uploaded" in text:
                    # Frame progress
                    pass
                elif any(keyword in text for keyword in ["WebSocket", "Session", "Recording"]):
                    print(f"   [Browser] {text}")

            page.on("console", handle_console)

            # Navigate
            page.goto("http://localhost:5173/record", wait_until="domcontentloaded")

            # Wait for ready state
            page.wait_for_selector("#record-button:not([disabled])", timeout=30000)

            # Start recording
            print("🔴 Starting recording...")
            page.click("#record-button")

            # Wait for session to initialize
            for i in range(10):
                if session_initialized["value"]:
                    break
                time.sleep(1)

            assert session_initialized["value"], "Recording session failed to initialize"

            # Wait for video generation (can take several minutes)
            print("⏳ Waiting for video generation (timeout: 10 minutes)...")
            for i in range(600):  # 10 minutes max
                if video_ready["value"]:
                    break
                time.sleep(1)
                if i % 10 == 0:
                    print(f"   Still waiting... ({i}s elapsed)")

            assert video_ready["value"], "Video generation did not complete within timeout"
            print("✅ Full rendering pipeline test PASSED")

            browser.close()

    finally:
        server.stop()

if __name__ == "__main__":
    print("=" * 60)
    print("WebSocket Rendering Test Suite")
    print("=" * 60)

    print("\n🧪 Test 1: WebSocket Connection")
    print("-" * 60)
    try:
        test_websocket_connection()
    except AssertionError as e:
        print(f"❌ Test 1 FAILED: {e}")
    except Exception as e:
        print(f"❌ Test 1 ERROR: {e}")

    print("\n🧪 Test 2: Full Rendering Pipeline")
    print("-" * 60)
    try:
        test_full_rendering_pipeline()
    except AssertionError as e:
        print(f"❌ Test 2 FAILED: {e}")
    except Exception as e:
        print(f"❌ Test 2 ERROR: {e}")

    print("\n" + "=" * 60)
    print("Test suite complete")
    print("=" * 60)
