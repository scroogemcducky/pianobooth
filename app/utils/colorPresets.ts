export type ColorPreset = {
  name: string
  whiteKeyColor: [number, number, number]
  blackKeyColor: [number, number, number]
  intensity: number
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    name: 'Original',
    whiteKeyColor: [0.94, 0.075, 0.28],
    blackKeyColor: [0.47, 0.04, 0.004],
    intensity: 0,
  },
  {
    name: 'Deep Red',
    whiteKeyColor: [0.392, 0.208, 0.251],
    blackKeyColor: [0.208, 0.067, 0.055],
    intensity: 1.5,
  },
  {
    name: 'Coral',
    whiteKeyColor: [1.0, 0.478, 0.6],
    blackKeyColor: [0.369, 0.188, 0.173],
    intensity: 0,
  },
]

export function parseColorPresetIndex(value: string | null): number | null {
  if (value == null) return null
  const idx = Number.parseInt(value, 10)
  if (!Number.isFinite(idx)) return null
  if (idx < 0 || idx >= COLOR_PRESETS.length) return null
  return idx
}

export function getColorPreset(index: number | null | undefined): { presetIndex: number; preset: ColorPreset } {
  const safeIndex = typeof index === 'number' && index >= 0 && index < COLOR_PRESETS.length ? index : 0
  return { presetIndex: safeIndex, preset: COLOR_PRESETS[safeIndex]! }
}

export function getEffectivePresetColors(index: number | null | undefined): {
  presetIndex: number
  presetName: string
  blackKeyColor: [number, number, number]
  whiteKeyColor: [number, number, number]
} {
  const { presetIndex, preset } = getColorPreset(index)
  const factor = 1 + (preset.intensity || 0)
  const scale = (c: [number, number, number]): [number, number, number] => [c[0] * factor, c[1] * factor, c[2] * factor]
  return {
    presetIndex,
    presetName: preset.name,
    blackKeyColor: scale(preset.blackKeyColor),
    whiteKeyColor: scale(preset.whiteKeyColor),
  }
}

