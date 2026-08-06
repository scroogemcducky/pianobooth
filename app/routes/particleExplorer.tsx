// Dev-only particle tuning page. Excluded from the production build via
// DEV_ONLY_ROUTES in app/routes.ts, which keeps the player's settings menu
// identical in development and production.
//
// Copy a tuned configuration to the clipboard and paste it into
// app/store/particleSettingsStore.ts to make it the default.

import { useCallback, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import EmbeddedKeys from '../components/EmbeddedKeys'
import KeyParticles, { type ActiveKeyParticle } from '../components/KeyParticles'
import { DEFAULT_PIANO_LAYOUT } from '../utils/pianoLayout'
import { isBlack } from '../utils/functions'
import { BLACK_KEY_COLOR, WHITE_KEY_COLOR } from '../utils/constants'
import useParticleSettingsStore, {
  type ParticleSettings,
  PARTICLE_PRESETS,
} from '../store/particleSettingsStore'

type NumericSettingKey = {
  [K in keyof ParticleSettings]: ParticleSettings[K] extends number ? K : never
}[keyof ParticleSettings]

type SliderConfig = {
  key: NumericSettingKey
  label: string
  min: number
  max: number
  step: number
  format?: (value: number) => string
}

const PRESET_NAMES = Object.keys(PARTICLE_PRESETS) as Array<keyof typeof PARTICLE_PRESETS>

const particleSections: Array<{ title: string; items: SliderConfig[] }> = [
  {
    title: '✨ Particles',
    items: [
      { key: 'count', label: 'Count', min: 200, max: 10000, step: 50, format: (value) => `${Math.round(value)}` },
      { key: 'decayFrequency', label: 'Decay Frequency', min: 0, max: 1, step: 0.01 },
      { key: 'velocityDamping', label: 'Velocity Damping', min: 0, max: 0.25, step: 0.005 },
    ],
  },
  {
    title: '🔫 Emitter',
    items: [
      { key: 'emitterRadius', label: 'Radius', min: 0, max: 1.5, step: 0.01 },
      { key: 'emitterVelocityStrength', label: 'Velocity Strength', min: 0, max: 3, step: 0.05 },
      { key: 'initialVelocityX', label: 'Initial Velocity X', min: -3, max: 3, step: 0.05 },
      { key: 'initialVelocityY', label: 'Initial Velocity Y', min: -3, max: 3, step: 0.05 },
      { key: 'initialVelocityZ', label: 'Initial Velocity Z', min: -3, max: 3, step: 0.05 },
      { key: 'initialRandomVelocity', label: 'Random Velocity', min: 0, max: 2, step: 0.01 },
    ],
  },
  {
    title: '💨 Turbulence',
    items: [
      { key: 'turbulenceStrength', label: 'Strength', min: 0, max: 0.08, step: 0.001 },
      { key: 'turbulenceTimeFrequeny', label: 'Time Frequency', min: 0, max: 1, step: 0.01 },
      { key: 'turbulencePositionFrequeny', label: 'Position Frequency', min: 0, max: 5, step: 0.05 },
    ],
  },
  {
    title: '🧲 Gravity',
    items: [
      { key: 'gravityX', label: 'Gravity X', min: -3, max: 3, step: 0.05 },
      { key: 'gravityY', label: 'Gravity Y', min: -3, max: 3, step: 0.05 },
      { key: 'gravityZ', label: 'Gravity Z', min: -3, max: 3, step: 0.05 },
    ],
  },
  {
    title: '🫓 Floor',
    items: [
      { key: 'floorY', label: 'Floor Y', min: -2, max: 0.5, step: 0.01 },
      { key: 'floorDamping', label: 'Floor Damping', min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    title: '🎨 Appearance',
    items: [
      { key: 'fadeIn', label: 'Fade In', min: 0, max: 0.8, step: 0.01 },
      { key: 'fadeOut', label: 'Fade Out', min: 0, max: 0.8, step: 0.01 },
      { key: 'size', label: 'Size', min: 0.05, max: 0.6, step: 0.01 },
      { key: 'glowSpread', label: 'Glow Spread', min: 0, max: 0.1, step: 0.001 },
      { key: 'solidRatio', label: 'Solid Ratio', min: 0, max: 1, step: 0.01 },
      { key: 'solidAlpha', label: 'Solid Alpha', min: 0, max: 6, step: 0.05 },
      { key: 'opacity', label: 'Opacity', min: 0.1, max: 1, step: 0.01 },
    ],
  },
  {
    title: '💥 Sparkling',
    items: [
      { key: 'sparklingAlpha', label: 'Alpha', min: 0, max: 6, step: 0.05 },
      { key: 'sparklingFrequency', label: 'Frequency', min: 0, max: 10, step: 0.1 },
      { key: 'sparklingDuration', label: 'Duration', min: 0, max: 0.5, step: 0.01 },
    ],
  },
]

// A chord across the keyboard, re-fired on demand so tuning has something to look at.
const PREVIEW_NOTES = [48, 55, 60, 64, 67, 72, 76]
const PREVIEW_DURATION_MS = 1600

export default function ParticleExplorer() {
  const [burst, setBurst] = useState(0)
  const { settings, updateSetting, reset, applyPreset } = useParticleSettingsStore((state) => ({
    settings: state.settings,
    updateSetting: state.updateSetting,
    reset: state.reset,
    applyPreset: state.applyPreset,
  }))

  const activeNotes: ActiveKeyParticle[] = PREVIEW_NOTES.map((noteNumber) => {
    const keyIsBlack = isBlack(noteNumber)
    return {
      noteNumber,
      startedAt: burst,
      durationMs: PREVIEW_DURATION_MS,
      color: (keyIsBlack ? BLACK_KEY_COLOR : WHITE_KEY_COLOR) as [number, number, number],
      isBlack: keyIsBlack,
    }
  })

  const renderSlider = useCallback(
    (config: SliderConfig) => {
      const value = settings[config.key]
      const display = config.format ? config.format(value) : value.toFixed(2)
      return (
        <li key={config.key} className="py-2">
          <div className="flex items-center justify-between text-white text-xs uppercase tracking-wide mb-2">
            <span>{config.label}</span>
            <span className="text-[10px] opacity-80">{display}</span>
          </div>
          <input
            type="range"
            min={config.min}
            max={config.max}
            step={config.step}
            value={value}
            onChange={(event) => updateSetting(config.key, parseFloat(event.target.value))}
            className="w-full accent-white"
          />
        </li>
      )
    },
    [settings, updateSetting],
  )

  const renderColorControl = useCallback(
    (key: 'colorIn' | 'colorOut', label: string) => (
      <li key={key} className="py-2">
        <div className="flex items-center justify-between text-white text-xs uppercase tracking-wide mb-2">
          <span>{label}</span>
          <span className="text-[10px] opacity-80">{settings[key].toUpperCase()}</span>
        </div>
        <input
          type="color"
          value={settings[key]}
          onChange={(event) => updateSetting(key, event.target.value)}
          className="w-full h-10 bg-transparent border border-white/30 rounded cursor-pointer"
        />
      </li>
    ),
    [settings, updateSetting],
  )

  return (
    <div className="flex h-screen w-full bg-black text-white">
      <div className="relative flex-1">
        <Canvas
          style={{ background: 'black' }}
          orthographic
          camera={{ zoom: 9 }}
          gl={{ toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.LinearSRGBColorSpace }}
        >
          <ambientLight intensity={7.5} />
          <directionalLight position={[11, -4, 90]} intensity={0.15} />
          <EmbeddedKeys layout={DEFAULT_PIANO_LAYOUT} />
          <KeyParticles layout={DEFAULT_PIANO_LAYOUT} notes={activeNotes} />
        </Canvas>
        <button
          type="button"
          onClick={() => setBurst(performance.now())}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded bg-white/10 px-4 py-2 text-xs uppercase tracking-wide hover:bg-white/20 transition"
        >
          Fire particles
        </button>
      </div>

      <aside className="w-96 shrink-0 overflow-y-auto border-l border-white/20 bg-black/80 p-4 backdrop-blur-md">
        <h1 className="mb-4 text-sm uppercase tracking-[0.2em] text-white/70">Particle Explorer</h1>

        <div className="mb-4">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] mb-2">
            <span className="text-white/70">Presets</span>
            <div className="flex gap-3">
              {typeof navigator !== 'undefined' && navigator?.clipboard && (
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(settings, null, 2)).catch(() => {})}
                  className="text-[10px] uppercase tracking-wide text-white/60 hover:text-white transition"
                >
                  Copy
                </button>
              )}
              <button
                type="button"
                onClick={reset}
                className="text-[10px] uppercase tracking-wide text-white/60 hover:text-white transition"
              >
                Reset
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_NAMES.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded bg-white/10 px-2 py-1 text-xs uppercase tracking-wide hover:bg-white/20 transition"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {particleSections.map((section) => (
            <div key={section.title} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide mb-2">
                <span>{section.title}</span>
                {section.title === '🔫 Emitter' && (
                  <label className="flex items-center gap-2 text-[11px]">
                    <input
                      type="checkbox"
                      checked={settings.emitterVisible}
                      onChange={(event) => updateSetting('emitterVisible', event.target.checked)}
                      className="accent-white h-3 w-3"
                    />
                    <span>Emitter Visible</span>
                  </label>
                )}
              </div>
              <ul className="divide-y divide-white/10">
                {section.title === '🎨 Appearance' && (
                  <>
                    {renderColorControl('colorIn', 'Color In')}
                    {renderColorControl('colorOut', 'Color Out')}
                  </>
                )}
                {section.items.map(renderSlider)}
              </ul>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
