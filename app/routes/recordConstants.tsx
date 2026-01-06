// Static frozen view for testing note colors and visualization
// Picks a random MIDI song and random time, displays frozen (no animation)

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { data as json, type LoaderFunctionArgs } from 'react-router'
import { useLoaderData } from 'react-router'
import FrameBasedShaderBlocks, { type FrameBasedShaderBlocksHandle } from '../components/recording/FrameBasedShaderBlocks'
import FrameBasedKeyController, { type FrameBasedKeyControllerHandle } from '../components/recording/FrameBasedKeyController'
import FrameBasedParticles, { type FrameBasedParticlesHandle } from '../components/recording/FrameBasedParticles'
import RecordKeys from '../components/recording/FrameBasedKeys'
import SelectiveBloom from '../components/recording/SelectiveBloom'
import * as THREE from 'three'
import { BLOOM_DEFAULTS, BLOOM_STORAGE_KEY } from '../utils/bloomDefaults'
import { computePianoLayout, DEFAULT_PIANO_LAYOUT, type PianoLayout } from '../utils/pianoLayout'
import { FALL_DURATION_SECONDS } from '../utils/recordingConstants'
import { PARTICLE_DEFAULTS, PARTICLE_PRESETS, type ParticleSettings } from '../store/particleSettingsStore'

interface MidiNote {
  Delta: number
  Duration: number
  NoteNumber: number
  Velocity: number
  SoundDuration: number
}

interface MidiData {
  title: string
  artist: string
  durationMs: number
  midiObject: MidiNote[]
}

interface LoaderData {
  midiData: MidiData
  randomTimeMs: number
  songPath: string
}

// Server-side loader to pick random song and time
export async function loader({ context }: LoaderFunctionArgs) {
  // List of available songs (verified to exist in public_midi_json)
  const songs = [
    'bach/prelude-and-fugue-in-c-minor-bwv-847',
    'bach/praludium-und-fuge-in-d-dur-bwv-850',
    'beethoven/fur-elise',
    'beethoven/appassionata',
    'chopin/ballade-no-1-in-g-minor-op-23',
    'chopin/chopin-polonaise-in-ab-major-opus-53',
    'chopin/chopin-nocturne-opus-27-nr-2',
    'chopin/chopin-etude-no-12-opus-25',
    'debussy/menuet',
    'debussy/clair-de-lune',
    'mozart/piano-sonata-no-11-in-a-major-k-331-iii-alla-turca',
    'mozart/klaviersonate-kv-545-3-satz',
    'mozart/piano-sonata-11-in-a-major-k-331-ii-menuetto',
    'liszt/liebestraum-nr-3',
    'liszt/wilde-jagd',
    'brahms/intermezzo-in-e-flat-major-op-117-no-1',
    'schubert/piano-sonata-d-850-in-d-major-ii',
    'schumann/kreisleriana-op-16-no-4',
    'grieg/grieg-lyrische-stucke-es-war-einmal-opus-71-nr-1',
    'tchaikovsky/october-autumn-song-op-37a-no-10',
  ]

  // Pick a random song
  const randomIndex = Math.floor(Math.random() * songs.length)
  const songPath = songs[randomIndex]

  // Return the path - we'll fetch the data client-side
  return json({
    songPath,
    randomSeed: Math.random(),
  })
}

const CANVAS_WIDTH = 1920
const CANVAS_HEIGHT = 1080
const FPS = 60
const FRAME_DURATION_MS = 1000 / FPS

// Color conversion helpers
function rgbToHex(rgb: number[]): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`
}

function hexToRgb(hex: string): number[] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [1, 1, 1]
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ]
}

// Component to continuously set the frozen frame on every render
function FrozenFrame({
  frame,
  blocksRef,
  keysRef,
  particlesRef,
}: {
  frame: number
  blocksRef: React.RefObject<FrameBasedShaderBlocksHandle | null>
  keysRef: React.RefObject<FrameBasedKeyControllerHandle | null>
  particlesRef: React.RefObject<FrameBasedParticlesHandle | null>
}) {
  // Use a ref to track the current frame so useFrame always has the latest
  const frameRef = useRef(frame)
  frameRef.current = frame

  // Set frame on every render loop iteration (this ensures refs are ready)
  useFrame(() => {
    blocksRef.current?.setFrame(frameRef.current)
    keysRef.current?.setFrame(frameRef.current)
    particlesRef.current?.setFrame(frameRef.current)
  })

  return null
}

export default function RecordConstants() {
  const loaderData = useLoaderData<typeof loader>()
  const [midiData, setMidiData] = useState<MidiData | null>(null)
  const [pianoLayout, setPianoLayout] = useState<PianoLayout>(DEFAULT_PIANO_LAYOUT)
  const [frozenFrame, setFrozenFrame] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fallDuration = FALL_DURATION_SECONDS

  // Lighting settings (same as /record)
  const [ambientIntensity, setAmbientIntensity] = useState(11.70)
  const [directionalIntensity, setDirectionalIntensity] = useState(0.96)
  const [directionalX, setDirectionalX] = useState(10.5)
  const [directionalY, setDirectionalY] = useState(-5.5)
  const [directionalZ, setDirectionalZ] = useState(107.5)

  // Color presets
  const COLOR_PRESETS = [
    {
      name: 'Original',
      whiteKeyColor: [0.94, 0.075, 0.28],   // pink/red
      blackKeyColor: [0.47, 0.04, 0.004],   // dark red
      glow: 0,
    },
    {
      name: 'Deep Red',
      whiteKeyColor: [0.392, 0.208, 0.251], // RGB 100, 53, 64
      blackKeyColor: [0.208, 0.067, 0.055], // RGB 53, 17, 14
      glow: 1.5, // intensity 2.5x
    },
    {
      name: 'Coral',
      whiteKeyColor: [1.0, 0.478, 0.6],     // RGB 255, 122, 153
      blackKeyColor: [0.369, 0.188, 0.173], // RGB 94, 48, 44
      glow: 0,
    },
  ]

  // Pick a random preset on load
  const [currentPreset] = useState(() => Math.floor(Math.random() * COLOR_PRESETS.length))
  const initialPreset = COLOR_PRESETS[currentPreset]

  // Note colors (RGB 0-1 range)
  const [blackKeyColor, setBlackKeyColor] = useState(initialPreset.blackKeyColor)
  const [whiteKeyColor, setWhiteKeyColor] = useState(initialPreset.whiteKeyColor)
  const [glow, setGlow] = useState(initialPreset.glow) // color intensity boost (0 = normal, 4 = 5x brighter)
  const [bloomEnabled, setBloomEnabled] = useState(BLOOM_DEFAULTS.enabled)
  const [bloomStrength, setBloomStrength] = useState(BLOOM_DEFAULTS.strength)
  const [bloomRadius, setBloomRadius] = useState(BLOOM_DEFAULTS.radius)
  const [bloomThreshold, setBloomThreshold] = useState(BLOOM_DEFAULTS.threshold)

  // Particle settings
  const [particleSettings, setParticleSettings] = useState<ParticleSettings>({ ...PARTICLE_DEFAULTS })
  const updateParticleSetting = <K extends keyof ParticleSettings>(key: K, value: ParticleSettings[K]) => {
    setParticleSettings(prev => ({ ...prev, [key]: value }))
  }

  // Refs for frame-based components
  const blocksRef = useRef<FrameBasedShaderBlocksHandle>(null)
  const keysRef = useRef<FrameBasedKeyControllerHandle>(null)
  const particlesRef = useRef<FrameBasedParticlesHandle>(null)

  const keyboardScaleOptions = {
    multiplier: 1.2,
    fillRatio: 0.95,
    max: 1.5,
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BLOOM_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (typeof parsed?.enabled === 'boolean') setBloomEnabled(parsed.enabled)
      if (typeof parsed?.strength === 'number') setBloomStrength(parsed.strength)
      if (typeof parsed?.radius === 'number') setBloomRadius(parsed.radius)
      if (typeof parsed?.threshold === 'number') setBloomThreshold(parsed.threshold)
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(
        BLOOM_STORAGE_KEY,
        JSON.stringify({ enabled: bloomEnabled, strength: bloomStrength, radius: bloomRadius, threshold: bloomThreshold }),
      )
    } catch {}
  }, [bloomEnabled, bloomStrength, bloomRadius, bloomThreshold])

  // Fetch MIDI data client-side
  useEffect(() => {
    async function fetchMidiData() {
      try {
        const response = await fetch(`/public_midi_json/${loaderData.songPath}.json`)
        if (!response.ok) {
          throw new Error(`Failed to load: ${loaderData.songPath}`)
        }
        const data: MidiData = await response.json()
        setMidiData(data)

        // Compute piano layout
        const layout = computePianoLayout(data.midiObject)
        setPianoLayout(layout ?? DEFAULT_PIANO_LAYOUT)

        // Pick a random time (between 10% and 90% of the song to get interesting visuals)
        const minTime = data.durationMs * 0.1
        const maxTime = data.durationMs * 0.9
        const randomTimeMs = minTime + Math.random() * (maxTime - minTime)

        // Convert time to frame (accounting for fall duration lookahead)
        const adjustedTimeMs = randomTimeMs
        const frame = Math.floor(adjustedTimeMs / FRAME_DURATION_MS)
        setFrozenFrame(frame)

        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load MIDI data')
        setLoading(false)
      }
    }

    fetchMidiData()
  }, [loaderData.songPath])

  // Reroll function to pick new random song and time
  const reroll = () => {
    window.location.reload()
  }

  // Adjust time manually
  const adjustTime = (deltaFrames: number) => {
    setFrozenFrame(prev => Math.max(0, prev + deltaFrames))
  }

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'black',
        color: 'white'
      }}>
        Loading {loaderData.songPath}...
      </div>
    )
  }

  if (error || !midiData) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'black',
        color: 'white',
        gap: '20px'
      }}>
        <p>Error: {error}</p>
        <button onClick={reroll} style={{ padding: '10px 20px', cursor: 'pointer' }}>
          Try Another Song
        </button>
      </div>
    )
  }

  const currentTimeMs = frozenFrame * FRAME_DURATION_MS
  const currentTimeSec = currentTimeMs / 1000

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      {/* Left panel - Song info, Time, Lighting */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.8)',
        padding: '20px',
        borderRadius: '10px',
        color: 'white',
        maxWidth: '300px'
      }}>
        {/* Song info */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{midiData.title}</div>
          <div style={{ fontSize: '12px', opacity: 0.7 }}>{midiData.artist}</div>
          <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '4px' }}>
            Time: {currentTimeSec.toFixed(2)}s / {(midiData.durationMs / 1000).toFixed(2)}s
          </div>
          <div style={{ fontSize: '11px', opacity: 0.5 }}>
            Frame: {frozenFrame}
          </div>
        </div>

        {/* Time controls */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Time</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => adjustTime(-600)} style={buttonStyle}>-10s</button>
            <button onClick={() => adjustTime(-60)} style={buttonStyle}>-1s</button>
            <button onClick={() => adjustTime(-10)} style={buttonStyle}>-10f</button>
            <button onClick={() => adjustTime(10)} style={buttonStyle}>+10f</button>
            <button onClick={() => adjustTime(60)} style={buttonStyle}>+1s</button>
            <button onClick={() => adjustTime(600)} style={buttonStyle}>+10s</button>
          </div>
        </div>

        {/* Lighting controls */}
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
            style={{ width: '100%' }}
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
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            <label style={{ fontSize: '11px' }}>
              X
              <input
                type="number"
                value={directionalX}
                step={0.5}
                onChange={(e) => setDirectionalX(parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={{ fontSize: '11px' }}>
              Y
              <input
                type="number"
                value={directionalY}
                step={0.5}
                onChange={(e) => setDirectionalY(parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
            <label style={{ fontSize: '11px' }}>
              Z
              <input
                type="number"
                value={directionalZ}
                step={0.5}
                onChange={(e) => setDirectionalZ(parseFloat(e.target.value))}
                style={inputStyle}
              />
            </label>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Bloom (Active Keys)</div>
          <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <input type="checkbox" checked={bloomEnabled} onChange={(e) => setBloomEnabled(e.target.checked)} />
            Enabled
          </label>
          <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>
            Strength: {bloomStrength.toFixed(2)}
          </label>
          <input
            type="range"
            min={0}
            max={5}
            step={0.05}
            value={bloomStrength}
            onChange={(e) => setBloomStrength(parseFloat(e.target.value))}
            style={{ width: '100%' }}
            disabled={!bloomEnabled}
          />
          <label style={{ display: 'block', fontSize: '11px', margin: '10px 0 4px' }}>
            Radius: {bloomRadius.toFixed(2)}
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={bloomRadius}
            onChange={(e) => setBloomRadius(parseFloat(e.target.value))}
            style={{ width: '100%' }}
            disabled={!bloomEnabled}
          />
          <label style={{ display: 'block', fontSize: '11px', margin: '10px 0 4px' }}>
            Threshold: {bloomThreshold.toFixed(2)}
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={bloomThreshold}
            onChange={(e) => setBloomThreshold(parseFloat(e.target.value))}
            style={{ width: '100%' }}
            disabled={!bloomEnabled}
          />
        </div>

        {/* Reroll button */}
        <button
          onClick={reroll}
          style={{
            ...buttonStyle,
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          New Random Song
        </button>
      </div>

      {/* Right panel - Colors */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.8)',
        padding: '20px',
        borderRadius: '10px',
        color: 'white',
        maxWidth: '200px'
      }}>
        <div style={{ fontSize: '12px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Colors</div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          <label style={{ fontSize: '11px' }}>
            White Key
            <input
              type="color"
              value={rgbToHex(whiteKeyColor)}
              onChange={(e) => setWhiteKeyColor(hexToRgb(e.target.value))}
              style={{ display: 'block', width: '60px', height: '30px', marginTop: '4px', cursor: 'pointer' }}
            />
          </label>
          <label style={{ fontSize: '11px' }}>
            Black Key
            <input
              type="color"
              value={rgbToHex(blackKeyColor)}
              onChange={(e) => setBlackKeyColor(hexToRgb(e.target.value))}
              style={{ display: 'block', width: '60px', height: '30px', marginTop: '4px', cursor: 'pointer' }}
            />
          </label>
        </div>
        <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px' }}>
          Intensity: {(1 + glow).toFixed(2)}x
        </label>
        <input
          type="range"
          min={0}
          max={4}
          step={0.1}
          value={glow}
          onChange={(e) => setGlow(parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      {/* Particle Settings Panel */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: 240,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.8)',
        padding: '20px',
        borderRadius: '10px',
        color: 'white',
        width: '280px',
        maxHeight: 'calc(100vh - 40px)',
        overflowY: 'auto'
      }}>
        <div style={{ fontSize: '12px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Particles</div>

        {/* Presets */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '6px' }}>Presets</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {Object.keys(PARTICLE_PRESETS).map((preset) => (
              <button
                key={preset}
                onClick={() => setParticleSettings({ ...PARTICLE_DEFAULTS, ...PARTICLE_PRESETS[preset as keyof typeof PARTICLE_PRESETS] })}
                style={{ ...buttonStyle, fontSize: '9px', padding: '4px 6px' }}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Count & Lifetime */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '6px' }}>Count & Lifetime</div>
          <label style={sliderLabelStyle}>
            Count: {particleSettings.count}
            <input type="range" min={200} max={10000} step={100} value={particleSettings.count}
              onChange={(e) => updateParticleSetting('count', parseInt(e.target.value))} style={sliderStyle} />
          </label>
          <label style={sliderLabelStyle}>
            Decay: {particleSettings.decayFrequency.toFixed(3)}
            <input type="range" min={0} max={1} step={0.01} value={particleSettings.decayFrequency}
              onChange={(e) => updateParticleSetting('decayFrequency', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
          <label style={sliderLabelStyle}>
            Velocity Damping: {particleSettings.velocityDamping.toFixed(3)}
            <input type="range" min={0} max={1} step={0.01} value={particleSettings.velocityDamping}
              onChange={(e) => updateParticleSetting('velocityDamping', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
        </div>

        {/* Emitter */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '6px' }}>Emitter</div>
          <label style={sliderLabelStyle}>
            Radius: {particleSettings.emitterRadius.toFixed(3)}
            <input type="range" min={0} max={2} step={0.01} value={particleSettings.emitterRadius}
              onChange={(e) => updateParticleSetting('emitterRadius', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
          <label style={sliderLabelStyle}>
            Velocity Strength: {particleSettings.emitterVelocityStrength.toFixed(3)}
            <input type="range" min={0} max={2} step={0.01} value={particleSettings.emitterVelocityStrength}
              onChange={(e) => updateParticleSetting('emitterVelocityStrength', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
        </div>

        {/* Initial Velocity */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '6px' }}>Initial Velocity</div>
          <label style={sliderLabelStyle}>
            X: {particleSettings.initialVelocityX.toFixed(2)}
            <input type="range" min={-5} max={5} step={0.1} value={particleSettings.initialVelocityX}
              onChange={(e) => updateParticleSetting('initialVelocityX', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
          <label style={sliderLabelStyle}>
            Y: {particleSettings.initialVelocityY.toFixed(2)}
            <input type="range" min={-5} max={5} step={0.1} value={particleSettings.initialVelocityY}
              onChange={(e) => updateParticleSetting('initialVelocityY', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
          <label style={sliderLabelStyle}>
            Z: {particleSettings.initialVelocityZ.toFixed(2)}
            <input type="range" min={-5} max={5} step={0.1} value={particleSettings.initialVelocityZ}
              onChange={(e) => updateParticleSetting('initialVelocityZ', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
          <label style={sliderLabelStyle}>
            Random: {particleSettings.initialRandomVelocity.toFixed(3)}
            <input type="range" min={0} max={1} step={0.01} value={particleSettings.initialRandomVelocity}
              onChange={(e) => updateParticleSetting('initialRandomVelocity', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
        </div>

        {/* Gravity */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '6px' }}>Gravity</div>
          <label style={sliderLabelStyle}>
            X: {particleSettings.gravityX.toFixed(2)}
            <input type="range" min={-5} max={5} step={0.1} value={particleSettings.gravityX}
              onChange={(e) => updateParticleSetting('gravityX', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
          <label style={sliderLabelStyle}>
            Y: {particleSettings.gravityY.toFixed(2)}
            <input type="range" min={-5} max={5} step={0.1} value={particleSettings.gravityY}
              onChange={(e) => updateParticleSetting('gravityY', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
          <label style={sliderLabelStyle}>
            Z: {particleSettings.gravityZ.toFixed(2)}
            <input type="range" min={-5} max={5} step={0.1} value={particleSettings.gravityZ}
              onChange={(e) => updateParticleSetting('gravityZ', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
        </div>

        {/* Turbulence */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '6px' }}>Turbulence</div>
          <label style={sliderLabelStyle}>
            Strength: {particleSettings.turbulenceStrength.toFixed(3)}
            <input type="range" min={0} max={0.1} step={0.001} value={particleSettings.turbulenceStrength}
              onChange={(e) => updateParticleSetting('turbulenceStrength', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
          <label style={sliderLabelStyle}>
            Time Freq: {particleSettings.turbulenceTimeFrequeny.toFixed(3)}
            <input type="range" min={0} max={1} step={0.01} value={particleSettings.turbulenceTimeFrequeny}
              onChange={(e) => updateParticleSetting('turbulenceTimeFrequeny', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
          <label style={sliderLabelStyle}>
            Pos Freq: {particleSettings.turbulencePositionFrequeny.toFixed(3)}
            <input type="range" min={0} max={3} step={0.01} value={particleSettings.turbulencePositionFrequeny}
              onChange={(e) => updateParticleSetting('turbulencePositionFrequeny', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
        </div>

        {/* Colors */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '6px' }}>Particle Colors</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <label style={{ fontSize: '10px' }}>
              Color In
              <input type="color" value={particleSettings.colorIn}
                onChange={(e) => updateParticleSetting('colorIn', e.target.value)}
                style={{ display: 'block', width: '50px', height: '24px', marginTop: '4px', cursor: 'pointer' }} />
            </label>
            <label style={{ fontSize: '10px' }}>
              Color Out
              <input type="color" value={particleSettings.colorOut}
                onChange={(e) => updateParticleSetting('colorOut', e.target.value)}
                style={{ display: 'block', width: '50px', height: '24px', marginTop: '4px', cursor: 'pointer' }} />
            </label>
          </div>
        </div>

        {/* Appearance */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '6px' }}>Appearance</div>
          <label style={sliderLabelStyle}>
            Size: {particleSettings.size.toFixed(3)}
            <input type="range" min={0.01} max={0.5} step={0.01} value={particleSettings.size}
              onChange={(e) => updateParticleSetting('size', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
          <label style={sliderLabelStyle}>
            Glow Spread: {particleSettings.glowSpread.toFixed(3)}
            <input type="range" min={0} max={0.1} step={0.001} value={particleSettings.glowSpread}
              onChange={(e) => updateParticleSetting('glowSpread', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
          <label style={sliderLabelStyle}>
            Opacity: {particleSettings.opacity.toFixed(2)}
            <input type="range" min={0} max={1} step={0.01} value={particleSettings.opacity}
              onChange={(e) => updateParticleSetting('opacity', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
          <label style={sliderLabelStyle}>
            Fade In: {particleSettings.fadeIn.toFixed(3)}
            <input type="range" min={0} max={1} step={0.01} value={particleSettings.fadeIn}
              onChange={(e) => updateParticleSetting('fadeIn', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
          <label style={sliderLabelStyle}>
            Fade Out: {particleSettings.fadeOut.toFixed(3)}
            <input type="range" min={0} max={1} step={0.01} value={particleSettings.fadeOut}
              onChange={(e) => updateParticleSetting('fadeOut', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
        </div>

        {/* Solid Effect */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '6px' }}>Solid Effect</div>
          <label style={sliderLabelStyle}>
            Ratio: {particleSettings.solidRatio.toFixed(3)}
            <input type="range" min={0} max={1} step={0.01} value={particleSettings.solidRatio}
              onChange={(e) => updateParticleSetting('solidRatio', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
          <label style={sliderLabelStyle}>
            Alpha: {particleSettings.solidAlpha.toFixed(2)}
            <input type="range" min={0} max={5} step={0.1} value={particleSettings.solidAlpha}
              onChange={(e) => updateParticleSetting('solidAlpha', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
        </div>

        {/* Sparkling */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '6px' }}>Sparkling</div>
          <label style={sliderLabelStyle}>
            Alpha: {particleSettings.sparklingAlpha.toFixed(2)}
            <input type="range" min={0} max={10} step={0.1} value={particleSettings.sparklingAlpha}
              onChange={(e) => updateParticleSetting('sparklingAlpha', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
          <label style={sliderLabelStyle}>
            Frequency: {particleSettings.sparklingFrequency.toFixed(1)}
            <input type="range" min={0} max={20} step={0.5} value={particleSettings.sparklingFrequency}
              onChange={(e) => updateParticleSetting('sparklingFrequency', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
          <label style={sliderLabelStyle}>
            Duration: {particleSettings.sparklingDuration.toFixed(3)}
            <input type="range" min={0} max={1} step={0.01} value={particleSettings.sparklingDuration}
              onChange={(e) => updateParticleSetting('sparklingDuration', parseFloat(e.target.value))} style={sliderStyle} />
          </label>
        </div>

        {/* Options */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="checkbox" checked={particleSettings.allowDownward}
              onChange={(e) => updateParticleSetting('allowDownward', e.target.checked)} />
            Allow Downward
          </label>
        </div>

        {/* Reset button */}
        <button
          onClick={() => setParticleSettings({ ...PARTICLE_DEFAULTS })}
          style={{ ...buttonStyle, width: '100%', marginTop: '8px' }}
        >
          Reset to Defaults
        </button>
      </div>

      <Canvas
        style={{
          background: 'black',
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT
        }}
        frameloop="always"
        orthographic
        camera={{ zoom: 9 }}
        gl={{
          alpha: false,
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.LinearSRGBColorSpace,
          preserveDrawingBuffer: true,
          antialias: true
        }}
        dpr={1}
      >
        {/* @ts-ignore */}
        <color attach="background" args={['#000000']} />
        {/* @ts-ignore */}
        <ambientLight intensity={ambientIntensity} />
        {/* @ts-ignore */}
        <directionalLight
          position={[directionalX, directionalY, directionalZ]}
          intensity={directionalIntensity}
        />

        <RecordKeys
          layout={pianoLayout}
          scaleMultiplier={keyboardScaleOptions.multiplier}
          scaleFillRatio={keyboardScaleOptions.fillRatio}
          scaleMax={keyboardScaleOptions.max}
          blackKeyColor={blackKeyColor.map(c => c * (1 + glow))}
          whiteKeyColor={whiteKeyColor.map(c => c * (1 + glow))}
        />

        <FrameBasedKeyController
          ref={keysRef}
          midiObject={midiData.midiObject}
          lookahead={fallDuration}
        />

        <FrameBasedParticles
          ref={particlesRef}
          midiObject={midiData.midiObject}
          layout={pianoLayout}
          scaleMultiplier={keyboardScaleOptions.multiplier}
          scaleFillRatio={keyboardScaleOptions.fillRatio}
          scaleMax={keyboardScaleOptions.max}
          lookahead={fallDuration}
          blackKeyColor={blackKeyColor.map(c => c * (1 + glow))}
          whiteKeyColor={whiteKeyColor.map(c => c * (1 + glow))}
          settings={particleSettings}
        />

        <FrameBasedShaderBlocks
          ref={blocksRef}
          midiObject={midiData.midiObject}
          layout={pianoLayout}
          scaleMultiplier={keyboardScaleOptions.multiplier}
          scaleFillRatio={keyboardScaleOptions.fillRatio}
          scaleMax={keyboardScaleOptions.max}
          lookahead={fallDuration}
          blackKeyColor={blackKeyColor.map(c => c * (1 + glow))}
          whiteKeyColor={whiteKeyColor.map(c => c * (1 + glow))}
        />

        {bloomEnabled && (
          <SelectiveBloom strength={bloomStrength} radius={bloomRadius} threshold={bloomThreshold} />
        )}

        <FrozenFrame
          frame={frozenFrame}
          blocksRef={blocksRef}
          keysRef={keysRef}
          particlesRef={particlesRef}
        />

      </Canvas>
    </div>
  )
}

const buttonStyle: React.CSSProperties = {
  background: '#333',
  color: 'white',
  border: '1px solid #666',
  borderRadius: '3px',
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: '11px'
}

const inputStyle: React.CSSProperties = {
  width: '60px',
  marginLeft: '4px',
  background: '#333',
  color: 'white',
  border: '1px solid #666',
  borderRadius: '3px'
}

const sliderLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  marginBottom: '6px'
}

const sliderStyle: React.CSSProperties = {
  width: '100%',
  marginTop: '2px'
}
