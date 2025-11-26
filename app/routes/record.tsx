// Frame-by-frame video recording implementation
// Renders MIDI piano visualization offline for video creation

import React, { useState, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import midiParser from '../utils/MidiParser'
import useKeyStore from '../store/keyPressStore'  
import useMidiStore from '../store/midiStore'
import FrameBasedShaderBlocks from '../components/FrameBasedShaderBlocks'
import RecordKeys from '../components/RecordKeys'
import RecordTitle from '../components/RecordTitle'
import * as THREE from 'three'
import { ActionFunctionArgs, json } from '@remix-run/cloudflare'
import { useFetcher } from '@remix-run/react'
import soundFont, { Player } from 'soundfont-player'
import { computePianoLayout, DEFAULT_PIANO_LAYOUT, type PianoLayout } from '../utils/pianoLayout'

const KNOWN_COMPOSERS = /(bach|beethoven|chopin|debussy|mozart|liszt|schubert|schumann|rachmaninoff|handel|haydn|tchaikovsky|gershwin|albeniz)/i

type MidiMeta = { title: string; artist: string }

const stripDiacritics = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')

const normalizeMeta = (meta: MidiMeta): MidiMeta => {
  const clean = (input: string) => stripDiacritics(input || '').replace(/\s+/g, ' ').trim()
  const title = clean(meta.title) || 'Untitled'
  const artist = clean(meta.artist) || 'Piano'
  return { title, artist }
}

const inferMetaFromFilename = (name?: string | null): MidiMeta | null => {
  if (!name) return null
  const base = name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim()
  if (!base) return null
  const parts = base.split('-').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const [maybeArtist, ...rest] = parts
    return normalizeMeta({
      artist: maybeArtist || 'Piano',
      title: rest.join(' - ').trim() || 'Untitled',
    })
  }
  return normalizeMeta({ artist: 'Piano', title: base })
}

async function extractMidiMetadata(file: File): Promise<MidiMeta> {
  try {
    const buf = await file.arrayBuffer()
    const { Midi } = await import('@tonejs/midi')
    const midi = new Midi(buf)
    const headerName = midi?.header?.name?.trim?.() || ''
    const trackNames = midi.tracks.map((t: any) => (t.name || '').trim()).filter(Boolean)
    let title = headerName || ''
    if (!title && trackNames.length) {
      title = trackNames.reduce((a: string, b: string) => (b.length > a.length ? b : a), trackNames[0])
    }
    let artist = ''
    const artistCandidate = trackNames.find((n: string) => KNOWN_COMPOSERS.test(n)) || (headerName && KNOWN_COMPOSERS.test(headerName) ? headerName : '')
    if (artistCandidate) {
      const match = artistCandidate.match(KNOWN_COMPOSERS)
      if (match && match[1]) {
        const name = match[1]
        artist = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
      }
    } else if (trackNames.length) {
      const hyphen = trackNames.find((n: string) => n.includes('-'))
      if (hyphen) {
        const parts = hyphen.split('-').map((s) => s.trim())
        if (parts.length >= 2) {
          const [a, b] = parts
          if (a.length <= b.length) artist = a
          if (!title) title = b
        }
      }
    }
    if (title) {
      const composerPrefix = title.match(/^(.*?)[-:\u2013]\s*(.+)$/)
      if (composerPrefix && KNOWN_COMPOSERS.test(composerPrefix[1] || '')) {
        title = composerPrefix[2].trim()
      }
    }
    return normalizeMeta({ title: title || 'Untitled', artist: artist || 'Piano' })
  } catch (error) {
    console.error('extractMidiMetadata error', error)
    return normalizeMeta({ title: 'Untitled', artist: 'Piano' })
  }
}

interface MidiNote {
  Delta: number;
  Duration: number;
  NoteNumber: number;
  Velocity: number;
  SoundDuration: number;
}

interface FetcherData {
  success?: boolean;
  videoUrl?: string;
  message?: string;
  error?: string;
}

// Frame recording configuration
const FPS = 60
// Keep the recorded audio/visuals two seconds behind the original MIDI timing
const NOTE_START_DELAY_SECONDS = 2
const ADDITIONAL_AUDIO_DELAY_SECONDS = 0
const AUDIO_PLAYBACK_DELAY_SECONDS = NOTE_START_DELAY_SECONDS + ADDITIONAL_AUDIO_DELAY_SECONDS
const NOTE_START_DELAY_FRAMES = Math.round(NOTE_START_DELAY_SECONDS * FPS)
const FRAME_DURATION_MS = 1000 / FPS
const CANVAS_WIDTH = 1920
const CANVAS_HEIGHT = 1080
const VIDEO_POLL_INTERVAL_MS = 3000
const VIDEO_POLL_MAX_ATTEMPTS = 100

// Mirror server-side file name sanitization
const sanitizeFileName = (s: string): string => s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()

// Calculate total duration and frames needed
function calculateTotalFrames(midiObject: MidiNote[]): number {
  if (!midiObject || midiObject.length === 0) return 0
  
  // Find the last note end time
  const lastNoteEnd = Math.max(...midiObject.map((note: MidiNote) => 
    Math.floor(note.Delta / 1000) + (note.Duration / 1000000 * 1000)
  ))
  
  // Add some padding at the end (2 seconds)
  const totalDurationMs = lastNoteEnd + 2000
  
  return Math.ceil(totalDurationMs / FRAME_DURATION_MS)
}

// Convert AudioBuffer to WAV blob
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const length = buffer.length;
  const sampleRate = buffer.sampleRate;
  const arrayBuffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * 2, true);
  
  // Convert to 16-bit PCM
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(44 + i * 2, sample * 0x7FFF, true);
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// Component that updates key states based on frame number (runs in R3F render loop)
function KeyStateController({
  frameNumberRef,
  midiObject,
  isRecording
}: {
  frameNumberRef: React.MutableRefObject<number>
  midiObject: MidiNote[] | null
  isRecording: boolean
}) {
  const activeNotesRef = useRef<Set<number>>(new Set())
  const KEY_PRESS_DELAY_MS = -1000

  useFrame(() => {
    if (!isRecording || !midiObject) return

    // Read current frame from ref (no React state!)
    const currentFrame = frameNumberRef.current
    // Apply a global note-start offset so keys (and thus frames) begin 2s after the MIDI timeline
    const currentTimeMs = currentFrame * FRAME_DURATION_MS - NOTE_START_DELAY_SECONDS * 1000

    // Calculate which notes should be active
    const newActiveNotes = new Set<number>()

    midiObject.forEach((note: MidiNote) => {
      const noteStartMs = Math.floor(note.Delta / 1000)
      const noteDurationMs = note.Duration / 1000000 * 1000
      const noteEndMs = noteStartMs + noteDurationMs

      const keyPressStartMs = noteStartMs - KEY_PRESS_DELAY_MS
      const keyPressEndMs = noteEndMs - KEY_PRESS_DELAY_MS

      if (currentTimeMs >= keyPressStartMs && currentTimeMs <= keyPressEndMs) {
        newActiveNotes.add(note.NoteNumber)
      }
    })

    // Update key states (only what changed)
    const keyStore = useKeyStore.getState()

    activeNotesRef.current.forEach(noteNumber => {
      if (!newActiveNotes.has(noteNumber)) {
        // @ts-expect-error - keyStore accepts numbers despite type error
        keyStore.setKey(noteNumber, false)
      }
    })

    newActiveNotes.forEach(noteNumber => {
      if (!activeNotesRef.current.has(noteNumber)) {
        // @ts-expect-error - keyStore accepts numbers despite type error
        keyStore.setKey(noteNumber, true)
      }
    })

    activeNotesRef.current = newActiveNotes
  })

  return null // This component doesn't render anything
}

// Component that captures frames in sync with R3F render loop
function CaptureController({
  frameNumberRef,
  totalFrames,
  isRecording,
  canvasRef,
  ws,
  sessionId,
  setUiFrameCount,
  setIsRecording,
  onComplete
}: {
  frameNumberRef: React.MutableRefObject<number>
  totalFrames: number
  isRecording: boolean
  canvasRef: React.RefObject<HTMLCanvasElement>
  ws: WebSocket | null
  sessionId: string | null
  setUiFrameCount: (count: number) => void
  setIsRecording: (recording: boolean) => void
  onComplete: () => void
}) {
  const capturedFrameRef = useRef(-1) // Track last captured frame to avoid duplicates

  useFrame(() => {
    if (!isRecording || !ws || !sessionId || !canvasRef.current) return

    const currentFrame = frameNumberRef.current

    // Check if we've already captured this frame
    if (currentFrame === capturedFrameRef.current) return
    if (currentFrame >= totalFrames) return

    const canvas = canvasRef.current

    // Capture frame (async, but we don't wait)
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error(`Failed to create blob for frame ${currentFrame}`)
        return
      }

      blob.arrayBuffer().then(arrayBuffer => {
        // Create binary message: [4 bytes frame number][PNG data]
        const frameNumberBuffer = new ArrayBuffer(4)
        const view = new DataView(frameNumberBuffer)
        view.setUint32(0, currentFrame, false)

        const combinedBuffer = new Uint8Array(frameNumberBuffer.byteLength + arrayBuffer.byteLength)
        combinedBuffer.set(new Uint8Array(frameNumberBuffer), 0)
        combinedBuffer.set(new Uint8Array(arrayBuffer), frameNumberBuffer.byteLength)

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(combinedBuffer)
          console.log(`→ Frame ${currentFrame} sent (${(blob.size / 1024).toFixed(1)} KB)`)
        }
      })
    }, 'image/png')

    // Mark this frame as captured
    capturedFrameRef.current = currentFrame

    // Update UI every 10 frames
    if (currentFrame % 10 === 0) {
      setUiFrameCount(currentFrame)
    }

    // Increment for next frame
    frameNumberRef.current = currentFrame + 1

    // Check if we're done
    if (currentFrame >= totalFrames - 1) {
      setUiFrameCount(totalFrames - 1)
      setIsRecording(false)
      console.log('Recording complete! Finalizing...')
      setTimeout(() => onComplete(), 2000)
    }
  })

  return null
}

// Server action to process frames and generate video with optional audio
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
  
  console.log('📋 Form entries:', Array.from(formData.keys()))
  
  if (!framesData) {
    return json({ error: 'No frames data provided' }, { status: 400 })
  }

  try {
    const frames = JSON.parse(framesData) as string[]
    
    // Dynamic imports for Node.js modules (only available on server)
    const { spawn } = await import('child_process')
    const fs = await import('fs')
    const path = await import('path')
    const { promisify } = await import('util')
    const writeFile = promisify(fs.writeFile)
    const mkdir = promisify(fs.mkdir)
    
    // Create temporary directory
    const tempDir = path.join(process.cwd(), 'temp_frames', `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
    await mkdir(tempDir, { recursive: true })
    
    console.log(`Processing ${frames.length} frames...`)
    
    // Save all frames to temporary directory
    const framePromises = frames.map(async (dataURL, index) => {
      if (dataURL) {
        const base64Data = dataURL.replace(/^data:image\/png;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')
        const filename = `frame_${String(index).padStart(6, '0')}.png`
        const filepath = path.join(tempDir, filename)
        await writeFile(filepath, buffer)
      }
    })
    
    await Promise.all(framePromises)
    console.log('All frames saved to disk')
    
    // Handle audio file if provided
    let audioPath: string | null = null;
    if (audioBase64) {
      console.log(`📄 Base64 audio data received, decoding...`);
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      audioPath = path.join(tempDir, 'audio.wav');
      await writeFile(audioPath, audioBuffer);
      console.log(`✅ Audio file saved from base64 to: ${audioPath}`);
    } else {
      console.log('❌ No audio data provided to server.');
    }
    
    // Generate video with ffmpeg (with or without audio)
    const outputPath = path.join(process.cwd(), 'public', `piano_video_${Date.now()}.mp4`)
    
    return new Promise((resolve) => {
      const ffmpegArgs = [
        '-framerate', fps.toString(),
        '-i', path.join(tempDir, 'frame_%06d.png')
      ]
      
      // Add audio input if provided
      if (audioPath) {
        console.log(`🎵 Adding audio input: ${audioPath}`)
        ffmpegArgs.push('-i', audioPath)
        ffmpegArgs.push('-c:a', 'aac')
        ffmpegArgs.push('-b:a', '192k') // High quality audio
      } else {
        console.log('🔇 No audio - creating video without sound')
      }
      
      // Video encoding settings
      ffmpegArgs.push(
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'fast',
        '-crf', '18' // High quality
      )
      
      // If audio is provided, ensure video and audio are same length
      if (audioPath) {
        ffmpegArgs.push('-shortest')
      }
      
      ffmpegArgs.push(outputPath)
      
      console.log(`🎬 FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`)
      const ffmpeg = spawn('ffmpeg', ffmpegArgs)
      
      ffmpeg.stderr.on('data', (data) => {
        console.log(`ffmpeg: ${data}`)
      })
      
      ffmpeg.on('close', async (code) => {
        // Clean up temporary files
        try {
          const files = await fs.promises.readdir(tempDir)
          await Promise.all(files.map(file => fs.promises.unlink(path.join(tempDir, file))))
          await fs.promises.rmdir(tempDir)
        } catch (error) {
          console.error('Cleanup error:', error)
        }
        
        if (code === 0) {
          const videoFileName = path.basename(outputPath)
          const audioType = audioPath ? ' with audio' : ''
          resolve(json({ 
            success: true, 
            videoUrl: `/${videoFileName}`,
            message: `Video generated${audioType}: ${videoFileName}`
          }))
        } else {
          resolve(json({ error: 'ffmpeg failed' }, { status: 500 }))
        }
      })
    })
    
  } catch (error) {
    console.error('Server action error:', error)
    return json({ error: 'Failed to process frames' }, { status: 500 })
  }
}

export default function Record() {
  const [midiObject, setMidiObject] = useState<MidiNote[] | null>(null)
  const [pianoLayout, setPianoLayout] = useState<PianoLayout>(DEFAULT_PIANO_LAYOUT)
  const [isRecording, setIsRecording] = useState(false)
  const frameNumberRef = useRef(0)
  const [uiFrameCount, setUiFrameCount] = useState(0) // For UI display only
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const midiFile = useMidiStore((state) => state.midiFile)
  const [isProcessingVideo, setIsProcessingVideo] = useState(false)
  const [audioFile, setAudioFile] = useState<File | null>(null)

  // WebSocket streaming state
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null)
  const [uploadedFrameCount, setUploadedFrameCount] = useState(0)
  const [ac, setAc] = useState<AudioContext | null>(null)
  const [instrument, setInstrument] = useState<Player | null>(null)
  const [title, setTitle] = useState('Untitled')
  const [artist, setArtist] = useState('Piano')
  const [ambientIntensity, setAmbientIntensity] = useState(7.5)
  const [directionalIntensity, setDirectionalIntensity] = useState(0.75)
  const [directionalX, setDirectionalX] = useState(9)
  const [directionalY, setDirectionalY] = useState(-6)
  const [directionalZ, setDirectionalZ] = useState(123)
  const fetcher = useFetcher<FetcherData>()
  const wsRef = useRef<WebSocket | null>(null)
  const connectWebSocketRef = useRef<() => void>(() => {})
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recordingSessionIdRef = useRef<string | null>(null)
  const uploadedFrameCountRef = useRef(0)
  const videoPollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    recordingSessionIdRef.current = recordingSessionId
  }, [recordingSessionId])

  useEffect(() => {
    uploadedFrameCountRef.current = uploadedFrameCount
  }, [uploadedFrameCount])

  const handleVideoReady = (videoUrl: string) => {
    if (videoPollingRef.current) {
      clearInterval(videoPollingRef.current)
      videoPollingRef.current = null
    }
    setIsProcessingVideo(false)

    // Auto-download the video
    const link = document.createElement('a')
    link.href = videoUrl
    const videoName = videoUrl.split('/').pop()
    if (videoName) {
      link.download = videoName
    }
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    console.log(`Video created successfully! ${videoName || videoUrl}`)
  }

  const startVideoPolling = () => {
    // Avoid duplicate pollers
    if (videoPollingRef.current) return

    setIsProcessingVideo(true)
    const videoFileName = `${sanitizeFileName(`${artist} - ${title}`)}.mp4`
    console.log(`📡 Polling for video file: ${videoFileName}`)
    let attempts = 0

    const poll = async () => {
      attempts++
      try {
        const res = await fetch(`/${videoFileName}`, { method: 'HEAD', cache: 'no-cache' })
        if (res.ok) {
          if (videoPollingRef.current) {
            clearInterval(videoPollingRef.current)
            videoPollingRef.current = null
          }
          const videoUrl = `/${videoFileName}`
          console.log(`✅ Video ready (polled): ${videoUrl}`)
          handleVideoReady(videoUrl)
          return
        }
      } catch (error) {
        console.warn('Video polling error:', error)
      }

      if (attempts >= VIDEO_POLL_MAX_ATTEMPTS) {
        if (videoPollingRef.current) {
          clearInterval(videoPollingRef.current)
          videoPollingRef.current = null
        }
        console.error('Video polling timed out')
        setIsProcessingVideo(false)
      }
    }

    videoPollingRef.current = window.setInterval(poll, VIDEO_POLL_INTERVAL_MS)
    // Kick off immediately instead of waiting for first interval tick
    poll()
  }

  useEffect(() => {
    return () => {
      if (videoPollingRef.current) {
        clearInterval(videoPollingRef.current)
        videoPollingRef.current = null
      }
    }
  }, [])

  // Initialize audio context and instrument
  useEffect(() => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    setAc(audioContext);
  }, []);

  useEffect(() => {
    if (ac) {
      soundFont.instrument(ac, 'acoustic_grand_piano').then(function (piano: Player) {
        setInstrument(piano);
      });
    }
  }, [ac]);

  // Trigger initial frame capture when recording starts
  useEffect(() => {
    if (!isRecording) return
    if (!recordingSessionId) {
      console.warn('Recording flagged as active but no sessionId yet; waiting for sessionId before capturing frames.')
      return
    }
    // Start the capture sequence once both flags are ready
    frameNumberRef.current = 0
    captureFrame(0)
  }, [isRecording, recordingSessionId])

  // Initialize WebSocket connection with simple auto-reconnect
  useEffect(() => {
    let websocket: WebSocket | null = null

    const connect = () => {
      if (websocket && (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING)) {
        return
      }

      websocket = new WebSocket('ws://localhost:5173/ws/frames')
      wsRef.current = websocket
      setWs(websocket)

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

          else if (message.type === 'video-ready') {
            console.log(`✅ Video ready: ${message.videoUrl}`)
            handleVideoReady(message.videoUrl)
          }

          else if (message.type === 'error') {
            console.error(`❌ Server error: ${message.error}`)
            setIsProcessingVideo(false)
          }

          else if (message.type === 'audio-ack') {
            console.log(`✅ Audio uploaded`)
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
        setWs(null)
        wsRef.current = null
        if (recordingSessionIdRef.current && uploadedFrameCountRef.current > 0) {
          startVideoPolling()
        }
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectTimeoutRef.current = null
            connect()
          }, 750)
        }
      }
    }

    connectWebSocketRef.current = connect
    connect()

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.close()
      }
      wsRef.current = null
    }
  }, [])

  const updateMidiState = (data: MidiNote[], meta?: Partial<MidiMeta>) => {
    if (!data || !Array.isArray(data) || data.length === 0) return
    setMidiObject(data)
    const layout = computePianoLayout(data)
    setPianoLayout(layout ?? DEFAULT_PIANO_LAYOUT)
    if (meta?.title || meta?.artist) {
      setTitle(meta.title ?? 'Untitled')
      setArtist(meta.artist ?? 'Piano')
    } else {
      setTitle('Untitled')
      setArtist('Piano')
    }
  }

  // Load MIDI file
  useEffect(() => {
    const getFileAndSetPlayer = async (file: unknown) => {
      console.log('Processing file:', file);
      try {
        const result = await midiParser(file)
        console.log('Parser result:', result);
        if (result) {
          let meta: MidiMeta | undefined
          if (file instanceof File) {
            const inferred = inferMetaFromFilename(file.name)
            const extracted = await extractMidiMetadata(file)
            meta = normalizeMeta({
              title: extracted.title || inferred?.title || 'Untitled',
              artist: extracted.artist || inferred?.artist || 'Piano',
            })
            setTitle(meta.title)
            setArtist(meta.artist)
            localStorage.setItem('midiMeta', JSON.stringify(meta))
          }
          updateMidiState(result as MidiNote[], meta)
          // Store processed MIDI data for persistence
          localStorage.setItem('processedMidiData', JSON.stringify(result));
        }
      } catch (error) {
        console.error('MIDI parsing error:', error);
      }
    }

    const loadFromLocalStorage = () => {
      const storedData = localStorage.getItem('processedMidiData');
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          console.log('Loaded from localStorage:', parsedData);
          const storedMeta = localStorage.getItem('midiMeta')
          if (storedMeta) {
            try {
              const parsedMeta = normalizeMeta(JSON.parse(storedMeta) as MidiMeta)
              setTitle(parsedMeta.title || '')
              setArtist(parsedMeta.artist || '')
              updateMidiState(parsedData as MidiNote[], parsedMeta)
            } catch {
              updateMidiState(parsedData as MidiNote[])
            }
          } else {
            updateMidiState(parsedData as MidiNote[])
          }
        } catch (error) {
          console.error('Error loading from localStorage:', error);
          localStorage.removeItem('processedMidiData');
        }
      }
    }

    if (midiFile) {
        console.log('MIDI file received:', midiFile);
        getFileAndSetPlayer(midiFile)
        return
    } else {
        // Try to load from localStorage if no file in store
        loadFromLocalStorage()
    }
  }, [midiFile])

  // Calculate playback frame from ref
  const playbackFrame = Math.max(0, frameNumberRef.current - NOTE_START_DELAY_FRAMES)

  const midiFrameCount = midiObject ? calculateTotalFrames(midiObject) : 0
  const totalFrames = midiFrameCount + NOTE_START_DELAY_FRAMES
  const keyboardScaleOptions = {
    multiplier: 1.2,
    fillRatio: 0.95,
    max: 1.5,
  }

  // Generate audio from MIDI using soundfont
  const generateAudioFromMIDI = async (): Promise<Blob | null> => {
    if (!midiObject || !ac || !instrument) {
      console.log('Cannot generate audio: missing dependencies', { midiObject: !!midiObject, ac: !!ac, instrument: !!instrument });
      return null;
    }

    console.log(`Generating audio from MIDI using soundfont for ${midiObject.length} notes...`);
    
    // Calculate total duration, accounting for the intro delay and tail padding
    const totalDurationMs = Math.max(...midiObject.map(note => 
      Math.floor(note.Delta / 1000) + (note.Duration / 1000000 * 1000)
    )) + AUDIO_PLAYBACK_DELAY_SECONDS * 1000 + 2000;
    
    const totalDurationSec = totalDurationMs / 1000;
    console.log(`Total audio duration: ${totalDurationSec.toFixed(2)} seconds`);

    // Create offline audio context for rendering (use lower sample rate to reduce file size)
    const sampleRate = 22050; // Half the normal rate to reduce file size by ~50%
    const totalSamples = Math.floor(totalDurationSec * sampleRate);
    console.log(`Creating OfflineAudioContext: ${totalSamples} samples at ${sampleRate}Hz`);
    
    const offlineContext = new OfflineAudioContext(1, totalSamples, sampleRate);
    
    // Load instrument for offline context
    console.log('Loading soundfont instrument for offline context...');
    const offlineInstrument = await soundFont.instrument(offlineContext, 'acoustic_grand_piano');
    console.log('Offline instrument loaded');
    
    // Schedule all notes
    let scheduledNotes = 0;
    midiObject.forEach((note, index) => {
      const startTime = AUDIO_PLAYBACK_DELAY_SECONDS + Math.floor(note.Delta / 1000) / 1000;
      const duration = note.Duration / 1000000;
      const velocity = note.Velocity / 127;
      
      if (startTime < totalDurationSec) {
        console.log(`Scheduling note ${index}: MIDI ${note.NoteNumber} at ${startTime.toFixed(3)}s, duration ${duration.toFixed(3)}s, velocity ${velocity.toFixed(3)}`);
        offlineInstrument.play(note.NoteNumber, startTime, {
          gain: velocity,
          duration: duration,
          release: 2.5,
          sustain: 2,
          delay: 0
        });
        scheduledNotes++;
      }
    });
    
    console.log(`Scheduled ${scheduledNotes} notes. Starting rendering...`);

    // Render audio
    const audioBuffer = await offlineContext.startRendering();
    console.log(`Audio rendering complete. Buffer length: ${audioBuffer.length} samples, duration: ${audioBuffer.duration.toFixed(2)}s`);

    // Check if audio was actually generated (avoid stack overflow with large buffers)
    const channelData = audioBuffer.getChannelData(0);
    let maxAmplitude = 0;
    let minAmplitude = 0;
    
    // Sample check instead of checking all values
    const sampleStep = Math.max(1, Math.floor(channelData.length / 1000));
    for (let i = 0; i < channelData.length; i += sampleStep) {
      const sample = channelData[i];
      if (sample > maxAmplitude) maxAmplitude = sample;
      if (sample < minAmplitude) minAmplitude = sample;
    }
    
    console.log(`Audio amplitude range: ${minAmplitude.toFixed(6)} to ${maxAmplitude.toFixed(6)}`);
    
    if (maxAmplitude === 0 && minAmplitude === 0) {
      console.warn('⚠️ Generated audio buffer is silent!');
    }

    // Convert to WAV blob
    const wavBlob = audioBufferToWav(audioBuffer);
    console.log(`WAV blob created: ${wavBlob.size} bytes`);
    return wavBlob;
  }

  // Frame capture function
  const captureFrame = (frameNumber: number) => {
    const canvas = canvasRef.current
    // If prerequisites aren't ready yet (e.g. canvas not mounted immediately after page load),
    // reschedule this frame instead of silently giving up.
    if (!canvas || !ws || !recordingSessionId) {
      requestAnimationFrame(() => captureFrame(frameNumber))
      return
    }

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

      // Update frame ref (KeyStateController reads this in R3F render loop)
      frameNumberRef.current = frameNumber

      // Update UI counter every 10 frames (reduce re-renders)
      if (frameNumber % 10 === 0) {
        setUiFrameCount(frameNumber)
      }

      // Auto-advance to next frame after canvas renders
      if (frameNumber < totalFrames - 1) {
        // Wait for R3F to render the updated frame
        requestAnimationFrame(() => {
          requestAnimationFrame(() => captureFrame(frameNumber + 1))
        })
      } else {
        // Recording complete
        setUiFrameCount(frameNumber) // Final update
        setIsRecording(false)
        console.log('Recording complete! Finalizing...')

        // Wait a moment for final frames to upload, then finalize
        setTimeout(() => finalizeRecording(), 2000)
      }
    } catch (error) {
      console.error('Error capturing frame:', error)
    }
  }

  // Finalize recording and send audio
  const finalizeRecording = async () => {
    if (!ws || !recordingSessionId) {
      console.warn('Finalize requested but missing WebSocket or session id; starting video polling fallback.')
      startVideoPolling()
      return
    }

    if (ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not open during finalize; starting video polling fallback.')
      startVideoPolling()
      return
    }

    setIsProcessingVideo(true)
    console.log('📤 Finalizing recording...')

    const blobToBase64 = (blob: Blob): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1]
          resolve(base64String)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    }

    // Send audio if available
    try {
      if (audioFile) {
        console.log(`📎 Sending uploaded audio file: ${audioFile.size} bytes`)
        const audioBase64 = await blobToBase64(audioFile)
        ws.send(JSON.stringify({
          type: 'audio',
          sessionId: recordingSessionId,
          audioData: audioBase64
        }))
      } else if (midiObject && ac && instrument) {
        console.log('🎵 Generating and sending MIDI audio...')
        const audioBlob = await generateAudioFromMIDI()
        if (audioBlob) {
          const audioBase64 = await blobToBase64(audioBlob)
          ws.send(JSON.stringify({
            type: 'audio',
            sessionId: recordingSessionId,
            audioData: audioBase64
          }))
          console.log('✅ Audio sent')
        }
      }
    } catch (error) {
      console.error('❌ Failed to send audio:', error)
    }

    // Send finalize message
    ws.send(JSON.stringify({
      type: 'finalize',
      sessionId: recordingSessionId
    }))

    console.log('✅ Finalize message sent, waiting for video generation...')
  }

  // OLD: Process frames into video using server action (DEPRECATED)
  const processVideo = async () => {
    setIsProcessingVideo(true)
    
    const formData = new FormData()
    formData.append('frames', JSON.stringify(capturedFrames))
    formData.append('fps', FPS.toString())
    
    const blobToBase64 = (blob: Blob): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64String = (reader.result as string).split(',')[1];
              resolve(base64String);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
      });
    };

    // Add audio file if selected, or generate from MIDI
    if (audioFile) {
      console.log(`📎 Adding uploaded audio file: ${audioFile.size} bytes`)
      const audioBase64 = await blobToBase64(audioFile);
      formData.append('audio_base64', audioBase64);
    } else if (midiObject && ac && instrument) {
      try {
        console.log('Generating soundfont audio...')
        const audioBlob = await generateAudioFromMIDI()
        if (audioBlob) {
          console.log(`📎 Converting generated audio to base64...`);
          const audioBase64 = await blobToBase64(audioBlob);
          formData.append('audio_base64', audioBase64);
          console.log('✅ Generated audio converted and added to form data');
        } else {
          console.error('❌ Failed to generate audio blob')
        }
      } catch (error) {
        console.error('❌ Failed to generate audio:', error)
      }
    } else {
      console.log('⚠️ No audio will be included - missing dependencies')
    }
    
    // Log total form data size
    let totalSize = 0;
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        totalSize += value.size;
        console.log(`FormData entry "${key}": ${value.size} bytes (${value.type})`);
      } else {
        totalSize += value.length;
        console.log(`FormData entry "${key}": ${value.length} characters`);
      }
    }
    console.log(`📦 Total form data size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    fetcher.submit(formData, { method: 'POST' })
  }

  // Handle server response (DEPRECATED - using WebSocket streaming now)
  useEffect(() => {
    if (fetcher.data) {
      setIsProcessingVideo(false)
      if (fetcher.data.success && fetcher.data.videoUrl) {
        console.log(`Video created successfully! Download: ${fetcher.data.videoUrl}`)
        // Auto-download the video
        const link = document.createElement('a')
        link.href = fetcher.data.videoUrl
        const videoName = fetcher.data.videoUrl.split('/').pop()
        if (videoName) {
          link.download = videoName
        }
        link.click()
      } else if (fetcher.data.error) {
        console.error(`Error: ${fetcher.data.error}`)
      }
    }
  }, [fetcher.data])

  // Start recording
  const startRecording = () => {
    if (!midiObject) {
      console.warn('Please load a MIDI file first')
      return
    }

    const socket = wsRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected. Attempting to reconnect...')
      connectWebSocketRef.current?.()
      return
    }

    // Generate unique session ID
    const sessionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setRecordingSessionId(sessionId)
    setUploadedFrameCount(0)

    // Send init message to server
    socket.send(JSON.stringify({
      type: 'init',
      sessionId,
      fps: FPS,
      title,
      artist,
      expectedFrames: totalFrames
    }))

    setIsRecording(true)
    frameNumberRef.current = 0
    setUiFrameCount(0)
    console.log(`Starting recording: ${totalFrames} frames at ${FPS} FPS`)
    console.log(`Session ID: ${sessionId}`)
  }

  // Stop recording and finalize
  const stopRecording = () => {
    setIsRecording(false)
    frameNumberRef.current = 0
    setUiFrameCount(0)

    console.log(`Recording stopped manually. Finalizing...`)
    // Wait for any pending frames to upload
    setTimeout(() => finalizeRecording(), 2000)
  }

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
      {/* Recording controls */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.8)',
        padding: '20px',
        borderRadius: '10px',
        color: 'white'
      }}>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Lighting</div>
          <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>
            Ambient Intensity: {ambientIntensity.toFixed(2)}
          </label>
          <input
            type="range"
            min={0}
            max={12}
            step={0.1}
            value={ambientIntensity}
            onChange={(e) => setAmbientIntensity(parseFloat(e.target.value))}
            style={{ width: '200px' }}
          />
          <label style={{ display: 'block', fontSize: '11px', margin: '10px 0 4px' }}>
            Directional Intensity: {directionalIntensity.toFixed(2)}
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={directionalIntensity}
            onChange={(e) => setDirectionalIntensity(parseFloat(e.target.value))}
            style={{ width: '200px' }}
          />
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            <label style={{ fontSize: '11px' }}>
              X
              <input
                type="number"
                value={directionalX}
                step={0.5}
                onChange={(e) => setDirectionalX(parseFloat(e.target.value))}
                style={{ width: '60px', marginLeft: '4px', background: '#333', color: 'white', border: '1px solid #666', borderRadius: '3px' }}
              />
            </label>
            <label style={{ fontSize: '11px' }}>
              Y
              <input
                type="number"
                value={directionalY}
                step={0.5}
                onChange={(e) => setDirectionalY(parseFloat(e.target.value))}
                style={{ width: '60px', marginLeft: '4px', background: '#333', color: 'white', border: '1px solid #666', borderRadius: '3px' }}
              />
            </label>
            <label style={{ fontSize: '11px' }}>
              Z
              <input
                type="number"
                value={directionalZ}
                step={0.5}
                onChange={(e) => setDirectionalZ(parseFloat(e.target.value))}
                style={{ width: '60px', marginLeft: '4px', background: '#333', color: 'white', border: '1px solid #666', borderRadius: '3px' }}
              />
            </label>
          </div>
        </div>

        <div>
          <button 
            id="record-button"
            onClick={isRecording ? stopRecording : startRecording} 
            disabled={!midiObject || isProcessingVideo}
            style={{
              background: !midiObject || isProcessingVideo ? '#666' : (isRecording ? '#ff4757' : '#ff4757'),
              color: 'white',
              border: isRecording ? '3px solid #fff' : 'none',
              borderRadius: '50%',
              cursor: (!midiObject || isProcessingVideo) ? 'not-allowed' : 'pointer',
              width: '60px',
              height: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              position: 'relative',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          >
            {isRecording ? (
              <div style={{
                width: '18px',
                height: '18px',
                backgroundColor: 'white',
                borderRadius: '2px'
              }} />
            ) : (
              <div style={{
                width: '18px',
                height: '18px',
                backgroundColor: 'white',
                borderRadius: '50%'
              }} />
            )}
          </button>
        </div>
        
        {isRecording && (
          <div style={{ marginTop: '10px', fontSize: '12px' }}>
            <p>Recording... {((uiFrameCount / totalFrames) * 100).toFixed(1)}%</p>
            <p>Uploaded: {uploadedFrameCount}/{totalFrames} frames</p>
          </div>
        )}
        {isProcessingVideo && <p style={{ marginTop: '10px', fontSize: '12px' }}>Generating video...</p>}
        {!wsConnected && <p style={{ marginTop: '10px', fontSize: '12px', color: '#ff4757' }}>⚠️ WebSocket disconnected</p>}
      </div>

      <Canvas 
        ref={canvasRef}
        style={{ 
          background: "black",
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT
        }}
        orthographic 
        camera={{ zoom: 9 }}
        gl={{ 
          alpha: false,
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.LinearSRGBColorSpace,
          preserveDrawingBuffer: true, // Important for frame capture
          antialias: true
        }}
        dpr={1} // Force pixel ratio to 1 for consistent output
      >
        {/* Force an opaque canvas background so fades persist in captured frames */}
        {/* @ts-ignore */}
        <color attach="background" args={['#000000']} />
        {/* @ts-ignore */}
        <ambientLight intensity={ambientIntensity} /> 
        {/* @ts-ignore */}
        <directionalLight 
          position={[directionalX, directionalY, directionalZ]} 
          intensity={directionalIntensity}
        />
        <RecordTitle
          title={title}
          artist={artist}
          currentFrame={uiFrameCount}
          isRecording={isRecording}
          fps={FPS}
        />
        
        <RecordKeys
          layout={pianoLayout}
          scaleMultiplier={keyboardScaleOptions.multiplier}
          scaleFillRatio={keyboardScaleOptions.fillRatio}
          scaleMax={keyboardScaleOptions.max}
        />

        {/* Key state controller - updates key lighting based on frame ref */}
        <KeyStateController
          frameNumberRef={frameNumberRef}
          midiObject={midiObject}
          isRecording={isRecording}
        />

        {midiObject && (
          <FrameBasedShaderBlocks 
            midiObject={midiObject} 
            currentFrame={playbackFrame}
            layout={pianoLayout}
            scaleMultiplier={keyboardScaleOptions.multiplier}
            scaleFillRatio={keyboardScaleOptions.fillRatio}
            scaleMax={keyboardScaleOptions.max}
          />
        )}
      </Canvas>
    </div>
  )
}
