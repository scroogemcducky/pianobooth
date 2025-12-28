/**
 * Recording timing constants
 * 
 * Single source of truth for all timing-related constants used in video recording.
 * Changing FALL_DURATION_SECONDS here will automatically update:
 * - Block fall speed
 * - Key press timing and duration
 * - Particle emission timing and duration
 * - Audio generation duration
 * - Video frame calculation
 */

// Default fall duration (can be overridden via URL parameter)
export const DEFAULT_FALL_DURATION_SECONDS = 3

// Runtime fall duration (initialized from URL parameter or default)
export let FALL_DURATION_SECONDS = DEFAULT_FALL_DURATION_SECONDS

/**
 * Set the fall duration at runtime (called from /record page with URL parameter)
 */
export function setFallDuration(seconds: number) {
  if (seconds > 0 && seconds <= 10) {  // Sanity check: 0-10 seconds
    FALL_DURATION_SECONDS = seconds
  }
}
