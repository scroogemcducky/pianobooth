// Shader implementation of PlayStandardSound
// used to be /shader

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { MetaFunction } from '@remix-run/node'

import { Canvas } from '@react-three/fiber'
import midiParser from '../utils/MidiParser'
import useKeyStore from '../store/keyPressStore'
import useMidiStore from '../store/midiStore'
import usePlayStore from '../store/playStore'
import PlayPauseButton from '../components/PlayPauseButton'
import SettingsButton from '../components/SettingsButton'
import EmbeddedKeys from '../components/EmbeddedKeys'
import KeyParticles, { type ActiveKeyParticle } from '../components/KeyParticles'
import ShaderBlocks_component from '../components/ShaderBlocks_component'
import soundFont from 'soundfont-player'
import * as THREE from 'three'
import { computePianoLayout, DEFAULT_PIANO_LAYOUT, type PianoLayout } from '../utils/pianoLayout'
import { isBlack } from '../utils/functions'
import { BLACK_KEY_COLOR, WHITE_KEY_COLOR } from '../utils/constants'

export const meta: MetaFunction = () => {
  return [
    { title: 'Piano Practice | Interactive MIDI Piano Player' },
    {
      name: 'description',
      content:
        'Practice piano with interactive MIDI playback, visual feedback, and real-time note highlighting. Perfect for learning classical piano pieces.',
    },
  ]
}

const DEBUG_FORCE_MIDDLE_C = true
const DEBUG_NOTES = [60, 61]

type MidiNote = {
  NoteNumber: number
  Delta: number
  Duration: number
  SoundDuration?: number
}

export default function Video() {
  const [midiObject, setMidiObject] = useState<MidiNote[] | null>(null)
  const [ac, setAc] = useState<AudioContext | null>(null)
  const [instrument, setInstrument] = useState<any>(null)
  const [pianoLayout, setPianoLayout] = useState<PianoLayout>(DEFAULT_PIANO_LAYOUT)
  const [activeParticleNotes, setActiveParticleNotes] = useState<Record<number, ActiveKeyParticle>>({})
  const particlesEnabled = usePlayStore((state) => state.particlesEnabled)
  const particlesEnabledRef = useRef(particlesEnabled)

  useEffect(() => {
    particlesEnabledRef.current = particlesEnabled
    if (!particlesEnabled) {
      setActiveParticleNotes({})
    }
  }, [particlesEnabled])

  const registerParticleNote = useCallback((noteNumber: number, durationMs: number) => {
    if (!particlesEnabledRef.current) return
    const keyIsBlack = isBlack(noteNumber)
    const keyColor = (keyIsBlack ? BLACK_KEY_COLOR : WHITE_KEY_COLOR) as [number, number, number]
    const timestamp = typeof performance !== 'undefined' ? performance.now() : Date.now()
    setActiveParticleNotes((prev) => ({
      ...prev,
      [noteNumber]: {
        noteNumber,
        startedAt: timestamp,
        durationMs,
        color: keyColor,
        isBlack: keyIsBlack,
      },
    }))
  }, [])

  const unregisterParticleNote = useCallback((noteNumber: number) => {
    setActiveParticleNotes((prev) => {
      if (!prev[noteNumber]) return prev
      const next = { ...prev }
      delete next[noteNumber]
      return next
    })
  }, [])

  const activeParticleList = useMemo(() => Object.values(activeParticleNotes), [activeParticleNotes])
  const debugParticles = useMemo<ActiveKeyParticle[]>(() => {
    if (!DEBUG_FORCE_MIDDLE_C) return []
    return DEBUG_NOTES.map((noteNumber) => {
      const keyIsBlack = isBlack(noteNumber)
      const keyColor = (keyIsBlack ? BLACK_KEY_COLOR : WHITE_KEY_COLOR) as [number, number, number]
      return {
        noteNumber,
        startedAt: 0,
        durationMs: Number.POSITIVE_INFINITY,
        color: keyColor,
        isBlack: keyIsBlack,
      }
    })
  }, [])
  const particlesToRender = useMemo(() => {
    const base = particlesEnabled ? activeParticleList : []
    return DEBUG_FORCE_MIDDLE_C ? [...debugParticles, ...base] : base
  }, [activeParticleList, debugParticles, particlesEnabled])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const AudioContextCtor: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AudioContextCtor) return
    const audioContext = new AudioContextCtor()
    setAc(audioContext as AudioContext)
    return () => {
      try {
        audioContext.close()
      } catch {}
    }
  }, [])

  useEffect(() => {
    if (!ac) return
    let cancelled = false
    soundFont.instrument(ac as any, 'acoustic_grand_piano').then((piano) => {
      if (!cancelled) setInstrument(piano)
    }).catch((error) => {
      console.error('Error loading instrument', error)
    })
    return () => {
      cancelled = true
    }
  }, [ac])

  useEffect(() => {
    return () => {
      // Reset playing state when leaving the page
      usePlayStore.getState().setPlaying(false)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        const currentPlaying = usePlayStore.getState().playing
        usePlayStore.getState().setPlaying(!currentPlaying)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const midiFile = useMidiStore((state) => state.midiFile)

  const updateMidiState = (data: MidiNote[]) => {
    if (!data || !Array.isArray(data) || data.length === 0) return
    setMidiObject(data)
    const layout = computePianoLayout(data)
    setPianoLayout(layout ?? DEFAULT_PIANO_LAYOUT)
  }

  useEffect(() => {
    const getFileAndSetPlayer = async (file: File) => {
      console.log('Processing file:', file)
      try {
        const result = await midiParser(file)
        console.log('Parser result:', result)
        if (result) {
          updateMidiState(result)
          // Store processed MIDI data for persistence
          localStorage.setItem('processedMidiData', JSON.stringify(result))
          // Best-effort: extract and persist basic metadata for embed route fallback
          try {
            const buf = await file.arrayBuffer()
            const { Midi } = await import('@tonejs/midi')
            const midi = new Midi(buf)
            const headerName = midi?.header?.name?.trim?.()
            const trackNames = midi.tracks.map((t) => (t.name || '').trim()).filter(Boolean)
            let title = headerName || ''
            if (!title && trackNames.length) {
              title = trackNames.reduce((a, b) => (b.length > a.length ? b : a), trackNames[0])
            }
            // Prefer composer-only artist label
            let artist = ''
            const composerRegex = /(bach|beethoven|chopin|debussy|mozart|liszt|schubert|schumann|rachmaninoff|handel|haydn|tchaikovsky|gershwin)/i
            const artistCandidate = trackNames.find((n) => composerRegex.test(n))
            if (artistCandidate) {
              const m = artistCandidate.match(composerRegex)
              if (m && m[1]) {
                const name = m[1]
                artist = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
              }
            } else if (trackNames.length) {
              const hyphen = trackNames.find((n) => n.includes('-'))
              if (hyphen) {
                const parts = hyphen.split('-').map((s) => s.trim())
                if (parts.length >= 2) {
                  const [a, b] = parts
                  if (a.length <= b.length) artist = a
                  if (!title) title = b
                }
              }
            }
            // If the title contains the composer prefix like "Beethoven - Für Elise", strip it
            if (title) {
              const m = title.match(/^(.*?)[-:\u2013]\s*(.+)$/) // hyphen, colon, en-dash
              if (m) {
                const maybeComposer = m[1].trim()
                const rest = m[2].trim()
                if (composerRegex.test(maybeComposer)) {
                  title = rest
                }
              }
            }
            localStorage.setItem('midiMeta', JSON.stringify({ title: title || 'Untitled', artist: artist || 'Piano' }))
          } catch {}
        }
      } catch (error) {
        console.error('MIDI parsing error:', error)
      }
    }

    const loadFromLocalStorage = () => {
      const storedData = localStorage.getItem('processedMidiData')
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData)
          console.log('Loaded from localStorage:', parsedData)
          updateMidiState(parsedData)
        } catch (error) {
          console.error('Error loading from localStorage:', error)
          localStorage.removeItem('processedMidiData')
        }
      }
    }

    if (midiFile) {
      console.log('MIDI file received:', midiFile)
      getFileAndSetPlayer(midiFile)
      return
    } else {
      // Try to load from localStorage if no file in store
      loadFromLocalStorage()
    }
  }, [midiFile])

  // TODO pass note parameters to playNote
  const playNote = (noteName: number, duration = 4) => {
    if (instrument && ac) {
      instrument.play(noteName, ac.currentTime, { gain: 1, duration: duration, release: 2.5, sustain: 2, delay: 2 })
    }
  }

  const activeTimeouts = useRef<Map<number, number>>(new Map())

  const triggerVisibleNote = (noteName: number, duration: number) => {
    // Clear any existing timeout for this note
    const existing = activeTimeouts.current.get(noteName)
    if (existing) {
      window.clearTimeout(existing)
    }

    // Always turn key on immediately
    useKeyStore.getState().setKey(noteName, true)
    playNote(noteName)
    registerParticleNote(noteName, duration)

    // Set new timeout and store it
    const timeoutId = window.setTimeout(() => {
      useKeyStore.getState().setKey(noteName, false)
      activeTimeouts.current.delete(noteName)
      unregisterParticleNote(noteName)
    }, duration)

    activeTimeouts.current.set(noteName, timeoutId)
  }

  const clearAllKeys = () => {
    try {
      for (let n = 20; n <= 127; n++) {
        useKeyStore.getState().setKey(n, false)
      }
    } catch {}
    setActiveParticleNotes({})
  }

  useEffect(() => {
    return () => {
      activeTimeouts.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
      activeTimeouts.current.clear()
      clearAllKeys()
    }
  }, [])
  
  return ( 
    <React.StrictMode >
    <div style={{height: "100%"}}>
      <Canvas 
          style={{ background: "black" }}  
          orthographic 
          camera={{ zoom: 9 }}
          gl={{ 
            toneMapping: THREE.NoToneMapping,
            outputColorSpace: THREE.LinearSRGBColorSpace 
          }}
          >
          {/* {lights ? <Lights /> :  */}
          <>
          <ambientLight intensity={7.5} /> 
          {/* <hemisphereLight 
            skyColor={0xffffbb} 
            groundColor={0x080820} 
            intensity={10} 
          /> */}
          <directionalLight 
            position={[11, -4, 90]} 
            intensity={0.15}
            // castShadow
          />
          {/* <pointLight position={[10, 10, 10]} />  */}
        </>
        {/* } */}
      
          {/* <Camera />  */}
          <EmbeddedKeys layout={pianoLayout} />  
          <KeyParticles layout={pianoLayout} notes={particlesToRender} />
          {midiObject && <ShaderBlocks_component
            midiObject={midiObject} 
            layout={pianoLayout}
            triggerVisibleNote={triggerVisibleNote} />} 
      </Canvas>
      <PlayPauseButton />
      <SettingsButton 
        // lights={false} 
        // lightsClick={() => {setLights(prevLights => !prevLights)}}
        />
    </div>
    </React.StrictMode>
  )
}
