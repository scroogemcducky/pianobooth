import { mdiCog, mdiClose } from '@mdi/js'; 
import Icon from '@mdi/react';
import { useState, useEffect, useRef, useCallback } from "react";
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useHydrated } from "~/hooks/useHydrated";
import usePlayStore from '../store/playStore';
import useParticleSettingsStore, { type ParticleSettings, PARTICLE_PRESETS } from '../store/particleSettingsStore';

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

type SettingsButtonProps = {
  onClick?: () => void
}

const SettingsButton = ({ onClick }: SettingsButtonProps) => {
  const isHydrated = useHydrated();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const speed = usePlayStore(state => state.speed);
  const setSpeed = usePlayStore(state => state.setSpeed);
  const lookahead = usePlayStore(state => state.lookahead);
  const setLookahead = usePlayStore(state => state.setLookahead);
  const particlesEnabled = usePlayStore((state) => state.particlesEnabled);
  const setParticlesEnabled = usePlayStore((state) => state.setParticlesEnabled);
  const {
    settings: particleSettings,
    updateSetting: updateParticleSetting,
    reset: resetParticleSettings,
    applyPreset,
  } =
    useParticleSettingsStore((state) => ({
      settings: state.settings,
      updateSetting: state.updateSetting,
      reset: state.reset,
      applyPreset: state.applyPreset,
    }));

  const renderParticleSlider = useCallback(
    (config: SliderConfig) => {
      const value = particleSettings[config.key]
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
            onChange={(event) => updateParticleSetting(config.key, parseFloat(event.target.value))}
            className="w-full accent-white"
          />
        </li>
      )
    },
    [particleSettings, updateParticleSetting],
  )

  const renderColorControl = useCallback(
    (key: 'colorIn' | 'colorOut', label: string) => (
      <li key={key} className="py-2">
        <div className="flex items-center justify-between text-white text-xs uppercase tracking-wide mb-2">
          <span>{label}</span>
          <span className="text-[10px] opacity-80">{particleSettings[key].toUpperCase()}</span>
        </div>
        <input
          type="color"
          value={particleSettings[key]}
          onChange={(event) => updateParticleSetting(key, event.target.value)}
          className="w-full h-10 bg-transparent border border-white/30 rounded cursor-pointer"
        />
      </li>
    ),
    [particleSettings, updateParticleSetting],
  )

  const handleToggle = (evt?: ReactMouseEvent) => {
    if (evt?.target instanceof HTMLElement && evt.target.closest('.settings-menu')) {
      return
    }
    setIsOpen((prev) => !prev)
    onClick?.()
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <button
      ref={buttonRef}
      tabIndex={-1}
      aria-label="Settings menu"
      aria-expanded={isOpen}
      onClick={handleToggle}
      className="absolute top-8 right-8 z-50 bg-transparent border-none outline-none cursor-pointer text-white text-2xl"
    >
      {isHydrated && (
        <Icon 
          path={isOpen ? mdiClose : mdiCog}
          size={1}
          color="white"
        />
      )}
      {isOpen && (
        <div className="settings-menu bg-black/80 text-white rounded-lg shadow-2xl p-4 w-80 max-h-[80vh] overflow-y-auto backdrop-blur-md border border-white/20">
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] mb-2">
              <span className="text-white/70">Presets</span>
              {typeof navigator !== 'undefined' && navigator?.clipboard && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(JSON.stringify(particleSettings))
                    } catch {}
                  }}
                  className="text-[10px] uppercase tracking-wide text-white/60 hover:text-white transition"
                >
                  Copy to clipboard
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_NAMES.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="text-xs uppercase tracking-wide bg-white/10 hover:bg-white/20 transition rounded px-2 py-1"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
          <ul className="space-y-3">
            <li className="border-b border-white/20 pb-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide mb-2">
                <span>Playback Speed</span>
                <span className="text-[10px] opacity-80">{speed.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={speed}
                aria-label="Playback speed"
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full accent-white"
              />
            </li>
            <li className="border-b border-white/20 pb-3">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide mb-2">
                <span>Note Lookahead</span>
                <span className="text-[10px] opacity-80">{lookahead.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="4"
                step="0.5"
                value={lookahead}
                aria-label="Note lookahead time"
                onChange={(e) => setLookahead(parseFloat(e.target.value))}
                className="w-full accent-white"
              />
            </li>
            <li className="border-b border-white/20 pb-3 flex items-center justify-between text-white text-xs uppercase tracking-wide gap-4">
              <span>Particles</span>
              <label className="flex items-center gap-2 text-white text-sm">
                <input
                  type="checkbox"
                  checked={particlesEnabled}
                  onChange={(event) => setParticlesEnabled(event.target.checked)}
                  className="accent-white h-4 w-4"
                />
                <span>{particlesEnabled ? 'On' : 'Off'}</span>
              </label>
            </li>
          </ul>

          {particlesEnabled && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em]">
                <span className="text-white/70">Particle Controls</span>
                <button
                  type="button"
                  onClick={resetParticleSettings}
                  className="text-[10px] uppercase tracking-wide text-white/60 hover:text-white transition"
                >
                  Reset
                </button>
              </div>
              {particleSections.map((section) => (
                <div key={section.title} className="border border-white/10 rounded-lg p-3 bg-white/5">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide mb-2">
                    <span>{section.title}</span>
                    {section.title === '🔫 Emitter' && (
                      <label className="flex items-center gap-2 text-[11px]">
                        <input
                          type="checkbox"
                          checked={particleSettings.emitterVisible}
                          onChange={(event) => updateParticleSetting('emitterVisible', event.target.checked)}
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
                    {section.items.map((config) => renderParticleSlider(config))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </button>
  );
};
 
export default SettingsButton;
