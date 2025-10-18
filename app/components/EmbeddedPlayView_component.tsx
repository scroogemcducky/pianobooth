import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'

// Reuse existing app pieces to keep visuals identical to play.tsx
import midiParser from '../utils/MidiParser'
import useKeyStore from '../store/keyPressStore'
import usePlayStore from '../store/playStore'
import Keys from './Keys'
import ShaderBlocks_component from './ShaderBlocks_component'
import PlayPauseButton from './PlayPauseButton'
import SettingsButton from './SettingsButton'
import soundFont from 'soundfont-player'

type MidiNote = {
  NoteNumber: number
  Delta: number // microseconds from start
  Duration: number // microseconds
  SoundDuration?: number
}

type Props = {
  midiFile?: File | Blob
  midiObject?: MidiNote[]
  fallbackToLocalStorage?: boolean
  style?: React.CSSProperties
  className?: string
  background?: string
  enableSpacebarToggle?: boolean
  orthographicZoom?: number
}

// Embeddable version of routes/play.tsx keeping behavior and visuals intact
export default function EmbeddedPlayView_component({
  midiFile,
  midiObject: midiObjectProp,
  fallbackToLocalStorage = true,
  style,
  className,
  background = 'black',
  enableSpacebarToggle = true,
  orthographicZoom = 9,
}: Props) {
  const [midiObject, setMidiObject] = useState<MidiNote[] | null>(null)
  const [ac, setAc] = useState<AudioContext | null>(null)
  const [instrument, setInstrument] = useState<any>(null)
  const [timelineDurationMs, setTimelineDurationMs] = useState<number>(0)
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0)
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false)

  // Initialize audio context lazily on mount (client side only)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const AudioContextCtor: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AudioContextCtor) return
    const audioContext = new AudioContextCtor()
    setAc(audioContext as AudioContext)
    return () => {
      try { audioContext.close() } catch {}
    }
  }, [])

  // Load soundfont instrument once we have an AudioContext
  useEffect(() => {
    let cancelled = false
    async function loadInstrument() {
      if (!ac) return
      try {
        const piano = await soundFont.instrument(ac as any, 'acoustic_grand_piano')
        if (!cancelled) setInstrument(piano)
      } catch (e) {
        console.error('Error loading instrument', e)
      }
    }
    loadInstrument()
    return () => { cancelled = true }
  }, [ac])

  // Reset playing state when unmounting
  useEffect(() => {
    return () => {
      try { usePlayStore.getState().setPlaying(false) } catch {}
    }
  }, [])

  // Spacebar toggles play/pause, mirroring routes/play.tsx
  useEffect(() => {
    if (!enableSpacebarToggle) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        const currentPlaying = usePlayStore.getState().playing
        usePlayStore.getState().setPlaying(!currentPlaying)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enableSpacebarToggle])

  // Load MIDI from props (midiObject or midiFile), or fallback to localStorage for parity with play.tsx
  useEffect(() => {
    let disposed = false

    const setFromParsed = (data: MidiNote[]) => {
      if (disposed) return
      setMidiObject(data)
      try { localStorage.setItem('processedMidiData', JSON.stringify(data)) } catch {}
      setCurrentTimeMs(0)
    }

    const parseFile = async (file: File | Blob) => {
      try {
        const result: any = await midiParser(file)
        if (result && !disposed) setFromParsed(result)
      } catch (error) {
        console.error('MIDI parsing error:', error)
      }
    }

    if (midiObjectProp && midiObjectProp.length) {
      setFromParsed(midiObjectProp)
    } else if (midiFile) {
      parseFile(midiFile)
    } else if (fallbackToLocalStorage) {
      try {
        const stored = localStorage.getItem('processedMidiData')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed && Array.isArray(parsed)) setMidiObject(parsed)
        }
      } catch (e) {
        console.error('Error loading from localStorage:', e)
        try { localStorage.removeItem('processedMidiData') } catch {}
      }
    }

    return () => { disposed = true }
  }, [midiFile, midiObjectProp, fallbackToLocalStorage])

  // Audio + key highlighting
  const activeTimeouts = useRef<Map<number, number>>(new Map())

  const playNote = (midiNumber: number, duration = 4) => {
    if (instrument && ac) {
      try {
        instrument.play(midiNumber, (ac as any).currentTime, { gain: 1, duration, release: 2.5, sustain: 2, delay: 2 })
      } catch (e) {
        console.error('instrument.play error', e)
      }
    }
  }

  const triggerVisibleNote = (noteNumber: number, durationMs: number) => {
    const existing = activeTimeouts.current.get(noteNumber)
    if (existing) window.clearTimeout(existing)

    try { useKeyStore.getState().setKey(noteNumber, true) } catch {}
    playNote(noteNumber)

    const tid = window.setTimeout(() => {
      try { useKeyStore.getState().setKey(noteNumber, false) } catch {}
      activeTimeouts.current.delete(noteNumber)
    }, Math.max(0, Math.floor(durationMs)))

    activeTimeouts.current.set(noteNumber, tid)
  }

  // Cleanup any pending key-release timers
  useEffect(() => {
    return () => {
      activeTimeouts.current.forEach((tid) => window.clearTimeout(tid))
      activeTimeouts.current.clear()
    }
  }, [])

  // Helper to clear all lit keys on seek
  const clearAllKeys = () => {
    try {
      for (let n = 20; n <= 127; n++) {
        useKeyStore.getState().setKey(n, false)
      }
    } catch {}
  }

  const handleSeekStart = () => {
    setIsScrubbing(true)
    // Stop any pending releases to avoid flicker while scrubbing
    activeTimeouts.current.forEach((tid) => window.clearTimeout(tid))
    activeTimeouts.current.clear()
    clearAllKeys()
  }

  const handleSeek = (value: number) => {
    setCurrentTimeMs(value)
  }

  const handleSeekEnd = () => {
    setIsScrubbing(false)
  }

  // Wrapper styles: let parent size control layout; Canvas fills 100%
  const wrapperStyle = useMemo<React.CSSProperties>(() => ({
    position: 'relative',
    width: '100%',
    height: '100%',
    ...style,
  }), [style])

  return (
    <div className={className} style={wrapperStyle}>
      <Canvas
        style={{ background }}
        orthographic
        camera={{ zoom: orthographicZoom }}
        gl={{ toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.LinearSRGBColorSpace }}
      >
        <>
          <ambientLight intensity={7.5} />
          <directionalLight position={[11, -4, 90]} intensity={0.15} />
        </>
        <Keys />
        {midiObject && (
          <ShaderBlocks_component
            midiObject={midiObject}
            triggerVisibleNote={triggerVisibleNote}
            seekMs={currentTimeMs}
            onPrepared={({ durationMs }) => {
              setTimelineDurationMs(durationMs)
            }}
            onTimeUpdate={(ms) => {
              if (!isScrubbing) setCurrentTimeMs(ms)
            }}
          />
        )}
      </Canvas>
      <PlayPauseButton />
      <SettingsButton onClick={() => { /* no-op to match existing usage */ }} />
      {/* Time bar overlay */}
      {midiObject && timelineDurationMs > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 8,
            padding: '0 48px',
            zIndex: 1001,
            pointerEvents: 'auto',
          }}
        >
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.floor(timelineDurationMs))}
            step={10}
            value={Math.min(currentTimeMs, timelineDurationMs)}
            onMouseDown={handleSeekStart}
            onTouchStart={handleSeekStart}
            onChange={(e) => handleSeek(parseFloat((e.target as HTMLInputElement).value))}
            onMouseUp={handleSeekEnd}
            onTouchEnd={handleSeekEnd}
            style={{ width: '100%' }}
            aria-label="Timeline"
          />
        </div>
      )}
    </div>
  )
}
