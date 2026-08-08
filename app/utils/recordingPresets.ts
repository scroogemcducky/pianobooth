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
  /**
   * Seconds a note takes to fall to the keys. The render scripts pass their
   * --fall-duration flag as a ?fallDuration= query param; this applies when the
   * page is opened by hand.
   */
  defaultFallDuration: number
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
  defaultFallDuration: FALL_DURATION_SECONDS,
  showTitle: true,
  particles: { zoomAdaptive: false },
}

export const MOBILE_RECORDING_PRESET: RecordingPreset = {
  keyboardScale: { multiplier: 1.0, fillRatio: 0.95, max: 2.5 },
  defaultFallDuration: 2,
  showTitle: false,
  layoutOptions: { paddingNotes: 0 },
  particles: { zoomAdaptive: true, motionScaleMultiplier: 2 },
}
