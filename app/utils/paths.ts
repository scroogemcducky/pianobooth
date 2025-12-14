// Centralized path configuration for runtime output directories
// This ensures consistent paths regardless of how the server is started

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

// Project root is two levels up from app/utils/
export const PROJECT_ROOT = path.resolve(here, '..', '..')

// Runtime video output directory (outside project)
export const VIDEO_OUT_DIR = process.env.PIANO_VIDEO_OUT_DIR
  ? path.resolve(PROJECT_ROOT, process.env.PIANO_VIDEO_OUT_DIR)
  : path.resolve(PROJECT_ROOT, '..', 'piano_videos')

// Temporary frames directory
export const TEMP_FRAMES_DIR = path.join(PROJECT_ROOT, 'temp_frames')

// Sanitize filename to remove invalid characters
export function sanitizeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
}
