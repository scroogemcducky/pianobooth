// Frame-by-frame video recording implementation
// Renders MIDI piano visualization offline for video creation

import React, { useState, useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import midiParser from '../utils/MidiParser'
import useMidiStore from '../store/midiStore'
import FrameBasedShaderBlocks, { type FrameBasedShaderBlocksHandle } from '../components/FrameBasedShaderBlocks'
import FrameBasedTitle, { type FrameBasedTitleHandle } from '../components/FrameBasedTitle'
import FrameBasedKeyController, { type FrameBasedKeyControllerHandle } from '../components/FrameBasedKeyController'
import RecordKeys from '../components/FrameBasedKeys'
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
// Keys light up 1 second after the note's Delta time (KEY_PRESS_DELAY_MS = -1000 in FrameBasedKeyController)
const KEY_PRESS_DELAY_SECONDS = 1
const AUDIO_PLAYBACK_DELAY_SECONDS = NOTE_START_DELAY_SECONDS + KEY_PRESS_DELAY_SECONDS  // 3 seconds total
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

// Component that captures frames in sync with R3F render loop
// Deterministic recorder: manually advances R3F and captures each frame in order
function DeterministicRecorder({
  isRecording,
  totalFrames,
  noteStartDelayFrames,
  onComplete,
  wsRef,
  sessionId,
  setIsRecording,
  blocksRef,
  titleRef,
  keysRef,
}: {
  isRecording: boolean
  totalFrames: number
  noteStartDelayFrames: number
  onComplete: () => void
  wsRef: React.MutableRefObject<WebSocket | null>
  sessionId: string | null
  setIsRecording: (recording: boolean) => void
  blocksRef: React.RefObject<FrameBasedShaderBlocksHandle | null>
  titleRef: React.RefObject<FrameBasedTitleHandle | null>
  keysRef: React.RefObject<FrameBasedKeyControllerHandle | null>
}) {
  const { gl, advance } = useThree()
  const isRecordingRef = useRef(false)
  const loopPromiseRef = useRef<Promise<void> | null>(null)

  const captureFramePayload = async (frameNumber: number) => {
    const canvas = gl?.domElement as HTMLCanvasElement | undefined
    if (!canvas) return

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95))
    if (!blob) return

    const buffer = await blob.arrayBuffer()
    const header = new ArrayBuffer(4)
    new DataView(header).setUint32(0, frameNumber, false)
    const payload = new Uint8Array(header.byteLength + buffer.byteLength)
    payload.set(new Uint8Array(header), 0)
    payload.set(new Uint8Array(buffer), header.byteLength)

    const socket = wsRef.current
    if (socket && socket.readyState === WebSocket.OPEN && sessionId) {
      socket.send(payload)
      if (frameNumber % 50 === 0) {
        console.log(`→ Frame ${frameNumber} sent (${(blob.size / 1024).toFixed(1)} KB)`)
      }
    }
  }

  const processRecording = async () => {
    for (let i = 0; i < totalFrames; i++) {
      if (!isRecordingRef.current) break

      // Single source of truth: calculate adjusted frame here
      const adjustedFrame = Math.max(0, i - noteStartDelayFrames)

      // Update all visual state imperatively
      blocksRef.current?.setFrame(adjustedFrame)
      titleRef.current?.setFrame(i)  // title uses raw frame for fade timing
      keysRef.current?.setFrame(adjustedFrame)

      // Render the scene
      advance(i * FRAME_DURATION_MS)
      gl.getContext().finish()

      // Capture and send
      await captureFramePayload(i)
    }

    if (isRecordingRef.current) {
      setIsRecording(false)
      console.log('Recording complete! Finalizing...')
      setTimeout(() => onComplete(), 2000)
    }
  }

  useEffect(() => {
    isRecordingRef.current = isRecording
    if (isRecording && !loopPromiseRef.current) {
      loopPromiseRef.current = processRecording().finally(() => {
        loopPromiseRef.current = null
      })
    }
  }, [isRecording, totalFrames])

  useEffect(() => {
    return () => {
      isRecordingRef.current = false
    }
  }, [])

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
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Imperative refs for frame-based components
  const blocksRef = useRef<FrameBasedShaderBlocksHandle>(null)
  const titleRef = useRef<FrameBasedTitleHandle>(null)
  const keysRef = useRef<FrameBasedKeyControllerHandle>(null)
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
            // setUploadedFrameCount(message.totalFrames)
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

  const midiFrameCount = midiObject ? calculateTotalFrames(midiObject) : 0
  const totalFrames = midiFrameCount + NOTE_START_DELAY_FRAMES
  const keyboardScaleOptions = {
    multiplier: 1.2,
    fillRatio: 0.95,
    max: 1.5,
  }

  // Generate audio from MIDI using soundfont
  const generateAudioFromMIDI = async (): Promise<Blob | null> => {
    if (!midiObject) {
      console.error('❌ Cannot generate audio: no MIDI data')
      return null
    }

    console.log(`🎵 Generating audio from MIDI for ${midiObject.length} notes...`)

    // Calculate total duration:
    // - 3 second intro delay (2s visual delay + 1s key press delay to sync with key activation)
    // - MIDI duration
    // - 2 second tail padding
    const introDelayMs = AUDIO_PLAYBACK_DELAY_SECONDS * 1000  // 3000ms (matches when keys light up)
    const lastNoteEndMs = Math.max(...midiObject.map(note =>
      Math.floor(note.Delta / 1000) + (note.Duration / 1000000 * 1000)
    ))
    const tailPaddingMs = 2000
    const totalDurationMs = introDelayMs + lastNoteEndMs + tailPaddingMs
    const totalDurationSec = totalDurationMs / 1000

    console.log(`   Intro delay: ${introDelayMs}ms`)
    console.log(`   MIDI duration: ${lastNoteEndMs}ms (last note ends at ${(lastNoteEndMs/1000).toFixed(2)}s)`)
    console.log(`   Tail padding: ${tailPaddingMs}ms`)
    console.log(`   Total audio duration: ${totalDurationSec.toFixed(2)}s`)

    // Create offline audio context for rendering
    const sampleRate = 44100  // Standard CD quality
    const totalSamples = Math.floor(totalDurationSec * sampleRate)
    console.log(`   Creating OfflineAudioContext: ${totalSamples} samples at ${sampleRate}Hz`)

    try {
      const offlineContext = new OfflineAudioContext(1, totalSamples, sampleRate)

      // Load instrument for offline context
      console.log('   Loading soundfont instrument for offline context...')
      // @ts-expect-error - soundfont-player accepts OfflineAudioContext despite type definition
      const offlineInstrument = await soundFont.instrument(offlineContext, 'acoustic_grand_piano')
      console.log('   ✅ Offline instrument loaded')

      // Schedule all notes with 3-second delay to match when keys light up
      // (2s visual intro + 1s KEY_PRESS_DELAY_MS offset in FrameBasedKeyController)
      let scheduledNotes = 0
      const delaySeconds = AUDIO_PLAYBACK_DELAY_SECONDS  // 3 seconds to sync with key activation

      for (const note of midiObject) {
        const noteTimeSeconds = Math.floor(note.Delta / 1000) / 1000
        const startTime = delaySeconds + noteTimeSeconds
        const duration = note.Duration / 1000000
        const velocity = note.Velocity / 127

        if (startTime < totalDurationSec && startTime >= 0) {
          // Log first few notes to verify timing
          if (scheduledNotes < 3) {
            console.log(`   Note ${scheduledNotes}: MIDI ${note.NoteNumber} at ${startTime.toFixed(3)}s (delay ${delaySeconds}s + noteTime ${noteTimeSeconds.toFixed(3)}s)`)
          }

          offlineInstrument.play(note.NoteNumber, startTime, {
            gain: velocity,
            duration: duration,
            release: 2.5,
            sustain: 2,
            delay: 0
          })
          scheduledNotes++
        }
      }

      console.log(`   Scheduled ${scheduledNotes}/${midiObject.length} notes (first note at ${delaySeconds}s)`)

      // Render audio
      console.log('   Rendering audio...')
      const audioBuffer = await offlineContext.startRendering()
      console.log(`   ✅ Rendering complete: ${audioBuffer.duration.toFixed(2)}s`)

      // Check if audio was actually generated
      const channelData = audioBuffer.getChannelData(0)
      let maxAmplitude = 0
      let minAmplitude = 0

      const sampleStep = Math.max(1, Math.floor(channelData.length / 1000))
      for (let i = 0; i < channelData.length; i += sampleStep) {
        const sample = channelData[i]
        if (sample > maxAmplitude) maxAmplitude = sample
        if (sample < minAmplitude) minAmplitude = sample
      }

      console.log(`   Amplitude range: ${minAmplitude.toFixed(4)} to ${maxAmplitude.toFixed(4)}`)

      if (maxAmplitude === 0 && minAmplitude === 0) {
        console.error('❌ Generated audio buffer is silent!')
        return null
      }

      // Convert to WAV blob
      const wavBlob = audioBufferToWav(audioBuffer)
      console.log(`   ✅ WAV blob created: ${(wavBlob.size / 1024).toFixed(1)} KB`)
      return wavBlob
    } catch (error) {
      console.error('❌ Audio generation failed:', error)
      return null
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

    // Wait for audio acknowledgment before finalizing
    const waitForAudioAck = (): Promise<void> => {
      return new Promise((resolve) => {
        const handleMessage = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data)
            if (message.type === 'audio-ack' && message.sessionId === recordingSessionId) {
              console.log('✅ Audio acknowledged by server')
              ws.removeEventListener('message', handleMessage)
              resolve()
            }
          } catch {
            // Ignore non-JSON messages
          }
        }
        ws.addEventListener('message', handleMessage)

        // Timeout after 30 seconds
        setTimeout(() => {
          ws.removeEventListener('message', handleMessage)
          console.warn('⚠️ Audio ack timeout, proceeding anyway')
          resolve()
        }, 30000)
      })
    }

    // Send audio if available and wait for acknowledgment
    let audioSent = false
    try {
      if (audioFile) {
        console.log(`📎 Sending uploaded audio file: ${audioFile.size} bytes`)
        const audioBase64 = await blobToBase64(audioFile)
        ws.send(JSON.stringify({
          type: 'audio',
          sessionId: recordingSessionId,
          audioData: audioBase64
        }))
        audioSent = true
      } else if (midiObject) {
        console.log('🎵 Generating MIDI audio...')
        const audioBlob = await generateAudioFromMIDI()
        if (audioBlob) {
          console.log(`📤 Sending audio: ${(audioBlob.size / 1024).toFixed(1)} KB`)
          const audioBase64 = await blobToBase64(audioBlob)
          ws.send(JSON.stringify({
            type: 'audio',
            sessionId: recordingSessionId,
            audioData: audioBase64
          }))
          console.log('✅ Audio sent, waiting for server acknowledgment...')
          audioSent = true
        } else {
          console.warn('⚠️ Audio generation returned null')
        }
      } else {
        console.warn('⚠️ No MIDI data available for audio generation')
      }
    } catch (error) {
      console.error('❌ Failed to generate/send audio:', error)
    }

    // Wait for audio to be processed before finalizing
    if (audioSent) {
      await waitForAudioAck()
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
    console.log(`Starting recording: ${totalFrames} frames at ${FPS} FPS`)
    console.log(`Session ID: ${sessionId}`)
  }

  // Stop recording and finalize
  const stopRecording = () => {
    setIsRecording(false)
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
            <p>Recording...</p>
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
        frameloop="demand"
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
        <FrameBasedTitle
          ref={titleRef}
          title={title}
          artist={artist}
          fps={FPS}
        />

        <RecordKeys
          layout={pianoLayout}
          scaleMultiplier={keyboardScaleOptions.multiplier}
          scaleFillRatio={keyboardScaleOptions.fillRatio}
          scaleMax={keyboardScaleOptions.max}
        />

        <FrameBasedKeyController
          ref={keysRef}
          midiObject={midiObject}
        />

        {midiObject && (
          <FrameBasedShaderBlocks
            ref={blocksRef}
            midiObject={midiObject}
            layout={pianoLayout}
            scaleMultiplier={keyboardScaleOptions.multiplier}
            scaleFillRatio={keyboardScaleOptions.fillRatio}
            scaleMax={keyboardScaleOptions.max}
          />
        )}
        <DeterministicRecorder
          isRecording={isRecording}
          totalFrames={totalFrames}
          noteStartDelayFrames={NOTE_START_DELAY_FRAMES}
          onComplete={() => finalizeRecording()}
          wsRef={wsRef}
          sessionId={recordingSessionId}
          setIsRecording={setIsRecording}
          blocksRef={blocksRef}
          titleRef={titleRef}
          keysRef={keysRef}
        />
      </Canvas>
    </div>
  )
}
