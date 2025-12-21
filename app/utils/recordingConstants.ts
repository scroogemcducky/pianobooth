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

export const FALL_DURATION_SECONDS = 3  // How long blocks take to fall from top to keyboard
