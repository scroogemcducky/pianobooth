// The complete set of differences between the desktop and mobile recorders.
//
// Both render at 1920x1080 through the same pipeline; the mobile script crops to
// portrait afterwards (see --keep-landscape in render_next_mobile_video.ts). So
// "mobile" is a preset, not a separate renderer.

import { FALL_DURATION_SECONDS } from './recordingConstants'

export type RecordingPreset = {
  /** Keyboard sizing passed to the keys, blocks and particles. */
  keyboardScale: {
    multiplier: number
    fillRatio: number
    max: number
  }
  fallDuration: {
    /** Used when the render script has not injected a value. */
    default: number
    /**
     * The render scripts hand their --fall-duration flag to the page through
     * localStorage before load; these are the keys they write.
     */
    storageKey: string
    /** Read if `storageKey` is absent, so mobile can fall back to the shared key. */
    fallbackStorageKey?: string
  }
  /** Desktop overlays a title card; mobile does not. */
  showTitle: boolean
  /** Passed to computePianoLayout; mobile drops the padding octave. */
  layoutOptions?: { paddingNotes?: number; minOctaves?: number }
  particles: {
    zoomAdaptive: boolean
    motionScaleMultiplier?: number
  }
}

export const DESKTOP_RECORDING_PRESET: RecordingPreset = {
  keyboardScale: { multiplier: 1.2, fillRatio: 0.95, max: 1.5 },
  fallDuration: { default: FALL_DURATION_SECONDS, storageKey: 'fallDuration' },
  showTitle: true,
  particles: { zoomAdaptive: false },
}

export const MOBILE_RECORDING_PRESET: RecordingPreset = {
  keyboardScale: { multiplier: 1.0, fillRatio: 0.95, max: 2.5 },
  fallDuration: {
    default: 2,
    storageKey: 'fallDurationMobile',
    fallbackStorageKey: 'fallDuration',
  },
  showTitle: false,
  layoutOptions: { paddingNotes: 0 },
  particles: { zoomAdaptive: true, motionScaleMultiplier: 2 },
}
