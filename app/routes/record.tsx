// Frame-by-frame video recording implementation
// Renders MIDI piano visualization offline for video creation

import React, { useState, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import midiParser from '../utils/MidiParser'
import useKeyStore from '../store/keyPressStore'  
import useMidiStore from '../store/midiStore'
import FrameBasedShaderBlocks from '../components/FrameBasedShaderBlocks'
import Keys from '../components/Keys'
import * as THREE from 'three'
import { ActionFunctionArgs, json } from '@remix-run/cloudflare'
import { useFetcher } from '@remix-run/react'

interface MidiNote {
  Delta: number;
  Duration: number;
  NoteNumber: number;
  Velocity: number;
  SoundDuration: number;
}

// Frame recording configuration
const FPS = 60
const FRAME_DURATION_MS = 1000 / FPS
const CANVAS_WIDTH = 1920
const CANVAS_HEIGHT = 1080

// Offline renderer component that controls frame-by-frame progression
function OfflineRenderer({ onFrameRendered, totalFrames, currentFrame }: {
  onFrameRendered: (frame: number) => void,
  totalFrames: number,
  currentFrame: number
}) {
  const { gl, scene, camera } = useThree()
  
  useFrame(() => {
    if (currentFrame < totalFrames) {
      // Render the current frame
      gl.render(scene, camera)
      
      // Capture frame
      onFrameRendered(currentFrame)
    }
  })
  
  return null
}

// Calculate total duration and frames needed
function calculateTotalFrames(midiObject: MidiNote[]): number {
  if (!midiObject || midiObject.length === 0) return 0
  
  // Find the last note end time
  const lastNoteEnd = Math.max(...midiObject.map((note: MidiNote) => 
    parseInt(note.Delta / 1000) + (note.Duration / 1000000 * 1000)
  ))
  
  // Add some padding at the end (2 seconds)
  const totalDurationMs = lastNoteEnd + 2000
  
  return Math.ceil(totalDurationMs / FRAME_DURATION_MS)
}

// Frame-based note triggering system
function useFrameBasedMidi(midiObject: MidiNote[] | null, currentFrame: number) {
  const currentTimeMs = currentFrame * FRAME_DURATION_MS
  const activeNotes = useRef<Set<number>>(new Set())
  const KEY_PRESS_DELAY_MS = -1000 // 1 second delay for key presses
  
  useEffect(() => {
    if (!midiObject) return
    
    // Find notes that should be active at current time
    const newActiveNotes = new Set<number>()
    
    midiObject.forEach((note: MidiNote) => {
      const noteStartMs = Math.floor(note.Delta / 1000)
      const noteDurationMs = note.Duration / 1000000 * 1000
      const noteEndMs = noteStartMs + noteDurationMs
      
      // Add delay so keys light up 1 second before the note plays
      const keyPressStartMs = noteStartMs - KEY_PRESS_DELAY_MS
      const keyPressEndMs = noteEndMs - KEY_PRESS_DELAY_MS
      
      if (currentTimeMs >= keyPressStartMs && currentTimeMs <= keyPressEndMs) {
        newActiveNotes.add(note.NoteNumber)
      }
    })
    
    // Update key states based on changes
    const keyStore = useKeyStore.getState()
    
    // Turn off keys that are no longer active
    activeNotes.current.forEach(noteNumber => {
      if (!newActiveNotes.has(noteNumber)) {
        // @ts-expect-error - keyStore accepts numbers despite type error
        keyStore.setKey(noteNumber, false)
      }
    })
    
    // Turn on keys that are newly active
    newActiveNotes.forEach(noteNumber => {
      if (!activeNotes.current.has(noteNumber)) {
        // @ts-expect-error - keyStore accepts numbers despite type error
        keyStore.setKey(noteNumber, true)
      }
    })
    
    activeNotes.current = newActiveNotes
  }, [currentFrame, midiObject])
}

// Server action to process frames and generate video
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData()
  const framesData = formData.get('frames') as string
  const fps = parseInt(formData.get('fps') as string) || 60
  
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
    const tempDir = path.join(process.cwd(), 'temp_frames')
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
    
    // Generate video with ffmpeg
    const outputPath = path.join(process.cwd(), 'public', `piano_video_${Date.now()}.mp4`)
    
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', [
        '-framerate', fps.toString(),
        '-i', path.join(tempDir, 'frame_%06d.png'),
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'fast',
        '-crf', '18', // High quality
        outputPath
      ])
      
      ffmpeg.stderr.on('data', (data) => {
        console.log(`ffmpeg: ${data}`)
      })
      
      ffmpeg.on('close', async (code) => {
        // Clean up temporary frames
        try {
          const files = await fs.promises.readdir(tempDir)
          await Promise.all(files.map(file => fs.promises.unlink(path.join(tempDir, file))))
          await fs.promises.rmdir(tempDir)
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
    
  } catch (error) {
    console.error('Server action error:', error)
    return json({ error: 'Failed to process frames' }, { status: 500 })
  }
}

export default function Record() {
  const [midiObject, setMidiObject] = useState<MidiNote[] | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [capturedFrames, setCapturedFrames] = useState<string[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const midiFile = useMidiStore((state) => state.midiFile)
  const [isProcessingVideo, setIsProcessingVideo] = useState(false)
  const fetcher = useFetcher()

  // Load MIDI file
  useEffect(() => {
    const getFileAndSetPlayer = async (file: unknown) => {
      const result = await midiParser(file)
      if(result) {
        setMidiObject(result)
      }
    }

    const localStorageJson = localStorage.getItem('midiFile')
    if (midiFile) {
      getFileAndSetPlayer(midiFile)
      return
    } 
    else if (localStorageJson) {
      const localStorageMidiFile = JSON.parse(localStorageJson)
      getFileAndSetPlayer(localStorageMidiFile)
    }
  }, [midiFile])

  // Frame-based MIDI processing
  useFrameBasedMidi(midiObject, currentFrame)

  const totalFrames = midiObject ? calculateTotalFrames(midiObject) : 0

  // Frame capture function
  const captureFrame = (frameNumber: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    try {
      const dataURL = canvas.toDataURL('image/png')
      setCapturedFrames(prev => {
        const newFrames = [...prev]
        newFrames[frameNumber] = dataURL
        return newFrames
      })
      
      console.log(`Captured frame ${frameNumber + 1}/${totalFrames}`)
      
      // Auto-advance to next frame
      if (frameNumber < totalFrames - 1) {
        setTimeout(() => setCurrentFrame(frameNumber + 1), 50)
      } else {
        // Recording complete
        setIsRecording(false)
        console.log('Recording complete! Processing video...')
        processVideo()
      }
    } catch (error) {
      console.error('Error capturing frame:', error)
    }
  }

  // Process frames into video using server action
  const processVideo = () => {
    setIsProcessingVideo(true)
    
    const formData = new FormData()
    formData.append('frames', JSON.stringify(capturedFrames))
    formData.append('fps', FPS.toString())
    
    fetcher.submit(formData, { method: 'POST' })
  }

  // Handle server response
  useEffect(() => {
    if (fetcher.data) {
      setIsProcessingVideo(false)
      if (fetcher.data.success) {
        alert(`Video created successfully! Download: ${fetcher.data.videoUrl}`)
        // Auto-download the video
        const link = document.createElement('a')
        link.href = fetcher.data.videoUrl
        link.download = fetcher.data.videoUrl.split('/').pop()
        link.click()
      } else {
        alert(`Error: ${fetcher.data.error}`)
      }
      setCapturedFrames([]) // Clear frames from memory
    }
  }, [fetcher.data])

  // Start recording
  const startRecording = () => {
    if (!midiObject) {
      alert('Please load a MIDI file first')
      return
    }
    
    setIsRecording(true)
    setCurrentFrame(0)
    setCapturedFrames([])
    console.log(`Starting recording: ${totalFrames} frames at ${FPS} FPS`)
  }

  // Stop recording and process video if frames were captured
  const stopRecording = () => {
    setIsRecording(false)
    setCurrentFrame(0)
    
    // If we have captured frames, process them into a video
    if (capturedFrames.length > 0) {
      console.log(`Recording stopped early with ${capturedFrames.length} frames. Processing video...`)
      processVideo()
    }
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
        <h3>Frame-by-Frame Recorder</h3>
        <p>Total frames: {totalFrames} ({(totalFrames / FPS).toFixed(1)}s)</p>
        <p>Current frame: {currentFrame + 1}</p>
        {isRecording && <p>Recording... {((currentFrame / totalFrames) * 100).toFixed(1)}%</p>}
        {isProcessingVideo && <p>Processing video with ffmpeg...</p>}
        
        <div style={{ marginTop: '10px' }}>
          <button 
            onClick={startRecording} 
            disabled={isRecording || !midiObject || isProcessingVideo}
            style={{
              padding: '10px 20px',
              marginRight: '10px',
              background: isRecording ? '#666' : '#ff4444',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: isRecording ? 'not-allowed' : 'pointer'
            }}
          >
            {isRecording ? 'Recording...' : 'Start Recording'}
          </button>
          
          <button 
            onClick={stopRecording} 
            disabled={!isRecording}
            style={{
              padding: '10px 20px',
              background: !isRecording ? '#666' : '#44ff44',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: !isRecording ? 'not-allowed' : 'pointer'
            }}
          >
            Stop & Create Video
          </button>
        </div>
        
        <div style={{ marginTop: '15px', fontSize: '12px' }}>
          <p>Instructions:</p>
          <ol style={{ margin: 0, paddingLeft: '20px' }}>
            <li>Load a MIDI file from the home page</li>
            <li>Click &quot;Start Recording&quot; to begin frame capture</li>
            <li>Frames will be automatically saved as PNG files</li>
            <li>Use FFmpeg to compile: <code style={{background:'#333', padding:'2px'}}>
              ffmpeg -framerate {FPS} -i frame_%06d.png -c:v libx264 -pix_fmt yuv420p output.mp4
            </code></li>
          </ol>
        </div>
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
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.LinearSRGBColorSpace,
          preserveDrawingBuffer: true, // Important for frame capture
          antialias: true
        }}
        dpr={1} // Force pixel ratio to 1 for consistent output
      >
        {/* @ts-ignore */}
        <ambientLight intensity={7.5} /> 
        {/* @ts-ignore */}
        <directionalLight 
          position={[11, -4, 90]} 
          intensity={0.15}
        />
        
        <Keys />  
        {midiObject && (
          <FrameBasedShaderBlocks 
            midiObject={midiObject} 
            currentFrame={currentFrame}
          />
        )}
        
        {isRecording && (
          <OfflineRenderer 
            onFrameRendered={captureFrame}
            totalFrames={totalFrames}
            currentFrame={currentFrame}
          />
        )}
      </Canvas>
    </div>
  )
}


