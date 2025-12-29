import { create } from 'zustand'

export type ParticleSettings = {
  count: number
  decayFrequency: number
  velocityDamping: number
  emitterVisible: boolean
  emitterRadius: number
  emitterVelocityStrength: number
  initialVelocityX: number
  initialVelocityY: number
  initialVelocityZ: number
  initialRandomVelocity: number
  turbulenceStrength: number
  turbulenceTimeFrequeny: number
  turbulencePositionFrequeny: number
  gravityX: number
  gravityY: number
  gravityZ: number
  floorY: number
  floorDamping: number
  colorIn: string
  colorOut: string
  fadeIn: number
  fadeOut: number
  size: number
  glowSpread: number
  solidRatio: number
  solidAlpha: number
  opacity: number
  sparklingAlpha: number
  sparklingFrequency: number
  sparklingDuration: number
  allowDownward: boolean
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const defaultSettings: ParticleSettings = {
  count: 3000,
  decayFrequency: 0.303,
  velocityDamping: 0.019,
  emitterVisible: true,
  emitterRadius: 0,
  emitterVelocityStrength: 0.4,
  initialVelocityX: 0,
  initialVelocityY: 2,
  initialVelocityZ: 1.836,
  initialRandomVelocity: 0.018,
  turbulenceStrength: 0.022,
  turbulenceTimeFrequeny: 0.1,
  turbulencePositionFrequeny: 0.378,
  gravityX: 0,
  gravityY: -3.236,
  gravityZ: 0,
  floorY: -0.134,
  floorDamping: 1,
  colorIn: '#f5c1cd',
  colorOut: '#780a01',
  fadeIn: 0.058,
  fadeOut: 0.2,
  size: 0.051,
  glowSpread: 0.01,
  solidRatio: 0.238,
  solidAlpha: 1,
  opacity: 1,
  sparklingAlpha: 4.46,
  sparklingFrequency: 10,
  sparklingDuration: 0.01,
  allowDownward: true,
}

type ParticlePresetName =
  | 'version1'
  | 'version2'
  | 'magicWand'
  | 'fountain'
  | 'sparkles'
  | 'fire'
  | 'ashes'
  | 'mannekenPis'
  | 'beamMeUp'
  | 'balrogWhip'

export const PARTICLE_PRESETS: Record<ParticlePresetName, Partial<ParticleSettings>> = {
  version1: {
    ...defaultSettings,
    allowDownward: false,
  },
  version2: {
    ...defaultSettings,
    allowDownward: true,
  },
  magicWand: { ...defaultSettings },
  fountain: {
    count: 10000,
    decayFrequency: 0.2,
    velocityDamping: 0.01,
    emitterVisible: false,
    emitterRadius: 0,
    emitterVelocityStrength: 0.4,
    initialVelocityX: 0,
    initialVelocityY: 1.733,
    initialVelocityZ: 0,
    initialRandomVelocity: 0.162,
    turbulenceStrength: 0.023,
    turbulenceTimeFrequeny: 0.1,
    turbulencePositionFrequeny: 0.873,
    gravityY: -1.622,
    floorDamping: 0.757,
    colorIn: '#7ae4ff',
    colorOut: '#0033ff',
    fadeIn: 0.053,
    fadeOut: 0.182,
    size: 0.1,
    glowSpread: 0.019,
    solidRatio: 0.101,
    opacity: 0.669,
    sparklingFrequency: 0,
  },
  sparkles: {
    count: 1000,
    decayFrequency: 0.303,
    velocityDamping: 0.009,
    emitterVisible: true,
    initialVelocityY: 1.489,
    initialVelocityZ: 1.327,
    initialRandomVelocity: 0.263,
    turbulenceStrength: 0.005,
    turbulencePositionFrequeny: 3,
    gravityY: -2.84,
    floorY: -0.134,
    floorDamping: 0.372,
    colorIn: '#ffa55c',
    colorOut: '#ff0000',
    fadeIn: 0.047,
    size: 0.1,
    sparklingAlpha: 4.46,
    sparklingFrequency: 10,
  },
  fire: {
    count: 2000,
    decayFrequency: 0.25,
    velocityDamping: 0.077,
    emitterVisible: false,
    initialRandomVelocity: 0.392,
    turbulenceStrength: 0.009,
    turbulenceTimeFrequeny: 0.047,
    turbulencePositionFrequeny: 1.076,
    gravityY: 1.085,
    floorY: -0.188,
    colorIn: '#ffa052',
    colorOut: '#ff0000',
    fadeIn: 0.067,
    fadeOut: 0.372,
    size: 0.27,
    glowSpread: 0.009,
    solidAlpha: 2.633,
    opacity: 0.419,
    sparklingFrequency: 0,
  },
  ashes: {
    count: 1000,
    decayFrequency: 0.25,
    velocityDamping: 0.077,
    emitterVisible: false,
    emitterRadius: 0.959,
    initialRandomVelocity: 0.108,
    turbulenceStrength: 0.003,
    turbulenceTimeFrequeny: 0.105,
    turbulencePositionFrequeny: 0.535,
    gravityY: 0.137,
    floorY: -1,
    floorDamping: 0,
  },
  mannekenPis: {
    count: 1000,
    decayFrequency: 0.303,
    velocityDamping: 0.019,
    emitterVisible: true,
    initialVelocityY: 2,
    initialVelocityZ: 1.836,
    initialRandomVelocity: 0.018,
    turbulenceStrength: 0.022,
    turbulencePositionFrequeny: 0.378,
    gravityY: -3.236,
    floorY: -0.134,
    floorDamping: 1,
    colorIn: '#f5c1cd',
    colorOut: '#780a01',
    fadeIn: 0.058,
    size: 0.051,
    sparklingAlpha: 4.46,
    sparklingFrequency: 10,
  },
  beamMeUp: {
    count: 559,
    decayFrequency: 0.128,
    velocityDamping: 0,
    emitterVisible: false,
    emitterRadius: 0.338,
    emitterVelocityStrength: 0.4,
    initialVelocityY: 0.101,
    turbulenceStrength: 0,
    turbulenceTimeFrequeny: 0,
    turbulencePositionFrequeny: 0,
    gravityY: 0,
    colorIn: '#f133ff',
    colorOut: '#00b3ff',
    size: 0.258,
    glowSpread: 0.007,
    sparklingAlpha: 1.246,
  },
  balrogWhip: {
    count: 2000,
    decayFrequency: 0.303,
    velocityDamping: 0.017,
    emitterVisible: false,
    emitterRadius: 0,
    initialRandomVelocity: 0.01,
    turbulenceStrength: 0.016,
    turbulenceTimeFrequeny: 0.178,
    turbulencePositionFrequeny: 0.378,
    gravityY: 0,
    floorY: -1,
    floorDamping: 1,
    colorIn: '#ffa66b',
    colorOut: '#ff0f27',
    fadeIn: 0.318,
    fadeOut: 0.084,
    size: 0.071,
    sparklingAlpha: 4.46,
    sparklingFrequency: 10,
  },
}

type StoreState = {
  settings: ParticleSettings
  updateSetting: <K extends keyof ParticleSettings>(key: K, value: ParticleSettings[K]) => void
  reset: () => void
  applyPreset: (preset: ParticlePresetName) => void
}

const clampSettings = (incoming: ParticleSettings): ParticleSettings => {
  const next = { ...incoming }
  next.count = Math.min(10000, Math.max(200, Math.round(next.count)))
  next.decayFrequency = clamp01(next.decayFrequency)
  next.velocityDamping = clamp01(next.velocityDamping)
  next.emitterRadius = Math.max(0, next.emitterRadius)
  next.emitterVelocityStrength = Math.max(0, next.emitterVelocityStrength)
  next.initialRandomVelocity = Math.max(0, next.initialRandomVelocity)
  next.turbulenceStrength = Math.max(0, next.turbulenceStrength)
  next.turbulenceTimeFrequeny = Math.max(0, next.turbulenceTimeFrequeny)
  next.turbulencePositionFrequeny = Math.max(0, next.turbulencePositionFrequeny)
  next.floorDamping = clamp01(next.floorDamping)
  next.fadeIn = clamp01(next.fadeIn)
  next.fadeOut = clamp01(next.fadeOut)
  next.size = Math.max(0.01, next.size)
  next.glowSpread = Math.max(0, next.glowSpread)
  next.solidRatio = clamp01(next.solidRatio)
  next.solidAlpha = Math.max(0, next.solidAlpha)
  next.opacity = clamp01(next.opacity)
  next.sparklingAlpha = Math.max(0, next.sparklingAlpha)
  next.sparklingFrequency = Math.max(0, next.sparklingFrequency)
  next.sparklingDuration = clamp01(next.sparklingDuration)
  return next
}

const useParticleSettingsStore = create<StoreState>((set) => ({
  settings: { ...defaultSettings },
  updateSetting: (key, value) =>
    set((state) => ({
      settings: clampSettings({
        ...state.settings,
        [key]: value,
      }),
    })),
  reset: () => set({ settings: { ...defaultSettings } }),
  applyPreset: (preset) =>
    set(() => ({
      settings: clampSettings({
        ...defaultSettings,
        ...(PARTICLE_PRESETS[preset] ?? {}),
      }),
    })),
}))

export default useParticleSettingsStore
export const PARTICLE_DEFAULTS = { ...defaultSettings }
