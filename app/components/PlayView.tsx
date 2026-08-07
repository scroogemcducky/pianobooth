// The interactive player: falling blocks, 3D keyboard, audio and controls.
//
// Deliberately a plain component rather than a route module: React Router wraps
// route default exports in withComponentProps, which replaces any props the
// caller passes with route context, so props would silently vanish.

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'

import { Canvas } from '@react-three/fiber'
import midiParser from '../utils/MidiParser'
import useKeyStore from '../store/keyPressStore'
import useMidiStore from '../store/midiStore'
import usePlayStore from '../store/playStore'
import PlayPauseButton from './PlayPauseButton'
import SettingsButton from './SettingsButton'
import EmbeddedKeys from './EmbeddedKeys'
import KeyParticles, { type ActiveKeyParticle } from './KeyParticles'
import ShaderBlocks from './ShaderBlocks'
import type { VisualizerHandle } from './Instances_component'
import type { PieceLicense } from './SettingsButton'
import soundFont from 'soundfont-player'
import * as THREE from 'three'
import { computePianoLayout, DEFAULT_PIANO_LAYOUT, type PianoLayout } from '../utils/pianoLayout'
import { isBlack } from '../utils/functions'
import { BLACK_KEY_COLOR, WHITE_KEY_COLOR } from '../utils/constants'

type MidiNote = {
  NoteNumber: number
  Delta: number
  Duration: number
  SoundDuration?: number
}

type PlayViewProps = {
  /**
   * Pre-parsed notes, used by the song pages. When omitted the view falls back to
   * the MIDI store (a file the user dropped) and then to localStorage.
   */
  midiObject?: MidiNote[]
  /** Shown in the settings menu when the piece carries licence terms. */
  license?: PieceLicense
}

export default function PlayView({ midiObject: midiObjectProp, license }: PlayViewProps) {
  const [midiObject, setMidiObject] = useState<MidiNote[] | null>(midiObjectProp ?? null)
  const [ac, setAc] = useState<AudioContext | null>(null)
  const [instrument, setInstrument] = useState<any>(null)
  const [pianoLayout, setPianoLayout] = useState<PianoLayout>(DEFAULT_PIANO_LAYOUT)
  const [activeParticleNotes, setActiveParticleNotes] = useState<Record<number, ActiveKeyParticle>>({})

  // Timeline / seeking, shown only when the Controls toggle is on.
  const [timelineDurationMs, setTimelineDurationMs] = useState(0)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const visualizerRef = useRef<VisualizerHandle>(null)
  const sliderRef = useRef<HTMLInputElement>(null)
  const timelineVisible = usePlayStore((state) => state.timelineVisible)
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
  const particlesToRender = useMemo(() => {
    return particlesEnabled ? activeParticleList : []
  }, [activeParticleList, particlesEnabled])

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

  useEffect(() => {
    // Each run of this effect closes over its own `ignore`. React runs the
    // previous run's cleanup before starting the next one, so when a second file
    // arrives mid-parse the first run's flag flips to true and its result is
    // dropped instead of overwriting the newer file's.
    let ignore = false

    const updateMidiState = (data: MidiNote[]) => {
      if (!data || !Array.isArray(data) || data.length === 0) return
      setMidiObject(data)
      const layout = computePianoLayout(data)
      setPianoLayout(layout ?? DEFAULT_PIANO_LAYOUT)
    }

    const getFileAndSetPlayer = async (file: File) => {
      try {
        const result = await midiParser(file)
        if (ignore) return
        if (result) {
          updateMidiState(result)
          // Store processed MIDI data for persistence
          localStorage.setItem('processedMidiData', JSON.stringify(result))
          // Best-effort: extract and persist basic metadata for embed route fallback
          try {
            const buf = await file.arrayBuffer()
            const { Midi } = await import('@tonejs/midi')
            // Second checkpoint: without it a stale run could pair its own
            // title/artist with the newer file's notes in localStorage.
            if (ignore) return
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
          updateMidiState(JSON.parse(storedData))
        } catch (error) {
          console.error('Error loading from localStorage:', error)
          localStorage.removeItem('processedMidiData')
        }
      }
    }

    if (midiObjectProp?.length) {
      // Song pages supply notes directly; deliberately not persisted to
      // localStorage so visiting a piece cannot clobber a file the user dropped.
      updateMidiState(midiObjectProp)
    } else if (midiFile) {
      getFileAndSetPlayer(midiFile)
    } else {
      // Try to load from localStorage if no file in store
      loadFromLocalStorage()
    }

    return () => {
      ignore = true
    }
  }, [midiFile, midiObjectProp])

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

  const handleSeekStart = () => {
    setIsScrubbing(true)
    // Drop pending key-releases so scrubbing does not leave keys lit.
    activeTimeouts.current.forEach((timeoutId) => window.clearTimeout(timeoutId))
    activeTimeouts.current.clear()
    clearAllKeys()
  }

  const handleSeek = (value: number) => {
    if (sliderRef.current) sliderRef.current.value = String(Math.floor(value))
    visualizerRef.current?.seek(value)
  }
  return (
    <div className="relative h-full w-full">
      <Canvas
        style={{ background: 'black' }}
        orthographic
        camera={{ zoom: 9 }}
        gl={{
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.LinearSRGBColorSpace,
        }}
      >
        <ambientLight intensity={7.5} />
        <directionalLight position={[11, -4, 90]} intensity={0.15} />
        <EmbeddedKeys layout={pianoLayout} />
        <KeyParticles layout={pianoLayout} notes={particlesToRender} />
        {midiObject && (
          <ShaderBlocks
            midiObject={midiObject}
            layout={pianoLayout}
            triggerVisibleNote={triggerVisibleNote}
            visualizerRef={visualizerRef}
            onPrepared={({ durationMs }) => setTimelineDurationMs(durationMs)}
            onTimeUpdate={(ms) => {
              // Written straight to the input so playback progress never re-renders.
              if (!isScrubbing && sliderRef.current) sliderRef.current.value = String(Math.floor(ms))
            }}
          />
        )}
      </Canvas>

      <PlayPauseButton />
      <SettingsButton license={license} />

      {/* Opt-in via the Controls toggle in settings. */}
      {timelineVisible && midiObject && timelineDurationMs > 0 && (
        <div className="absolute inset-x-0 bottom-0 z-[1001] px-6 pb-3">
          <input
            type="range"
            min={0}
            // Declarative: the slider can mount after the duration is known (when
            // Controls is toggled on mid-piece), and an imperative max would be
            // missed. Only `value` is written via the ref, to avoid re-rendering
            // on every frame of playback.
            max={Math.max(1, Math.floor(timelineDurationMs))}
            step={10}
            defaultValue={0}
            ref={sliderRef}
            onMouseDown={handleSeekStart}
            onTouchStart={handleSeekStart}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            onMouseUp={() => setIsScrubbing(false)}
            onTouchEnd={() => setIsScrubbing(false)}
            className="timeline-slider w-full"
            aria-label="Timeline"
          />
        </div>
      )}
    </div>
  )
}
