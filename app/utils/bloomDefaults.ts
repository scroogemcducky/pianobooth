export const BLOOM_STORAGE_KEY = 'piano.bloom' as const

export const BLOOM_DEFAULTS = {
  enabled: true,
  strength: 0.4,
  radius: 0,
  threshold: 1,
} as const

// Bloom presets (strength, radius, threshold)
export const BLOOM_PRESETS = {
  'retro punk': {
    strength: 0.30,
    radius: 0.02,
    threshold: 1.0,
    // Associated colors (RGB 0-1)
    whiteKeyColor: [0.941, 0.075, 0.278], // RGB 240, 19, 71
    blackKeyColor: [0.471, 0.039, 0.004], // RGB 120, 10, 1
    glow: 0, // intensity 1.0x
  },
  'red': {
    strength: 0.30,
    radius: 0.02,
    threshold: 0.0,
    // Associated colors (RGB 0-1)
    whiteKeyColor: [0.784, 0.098, 0.098], // RGB 200, 25, 25
    blackKeyColor: [1.0, 0.180, 0.384],   // RGB 255, 46, 98
    glow: 0, // intensity 1.0x
  },
} as const

export type BloomPresetName = keyof typeof BLOOM_PRESETS

