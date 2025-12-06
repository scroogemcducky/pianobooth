import React, { useRef, forwardRef, useImperativeHandle, useCallback } from 'react'
import { Text } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Color, Mesh } from 'three'

export interface FrameBasedTitleHandle {
  setFrame: (rawFrame: number) => void
  waitForReady: () => Promise<void>
}

type Props = {
  title?: string | null
  artist?: string | null
  fps?: number
}

const PRIMARY_FONT = '/fonts/EBGaramond-VariableFont_wght.ttf'
export const RECORD_TITLE_FADE_SECONDS = 1
const DEFAULT_FPS = 60
const DISPLAY_DURATION_SECONDS = 0
const FADE_DURATION_SECONDS = RECORD_TITLE_FADE_SECONDS
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const fadedHex = (baseHex: string, intensity: number) => {
  const amount = clamp01(intensity)
  if (amount >= 0.999) return baseHex
  if (amount <= 0) return '#000000'
  const color = new Color(baseHex)
  color.multiplyScalar(amount)
  return `#${color.getHexString()}`
}

const FrameBasedTitle = forwardRef<FrameBasedTitleHandle, Props>(
  function FrameBasedTitle({ title, artist, fps = DEFAULT_FPS }, ref) {
  const { viewport } = useThree()
  const titleRef = useRef<Mesh>(null)
  const artistRef = useRef<Mesh>(null)
  const hasTitle = Boolean(title)
  const hasArtist = Boolean(artist)

  // Track font/text readiness for both title and artist
  const titleReadyRef = useRef(false)
  const artistReadyRef = useRef(false)
  const readyResolversRef = useRef<Array<() => void>>([])

  const checkAndResolveReady = useCallback(() => {
    const titleReady = !hasTitle || titleReadyRef.current
    const artistReady = !hasArtist || artistReadyRef.current
    if (titleReady && artistReady) {
      readyResolversRef.current.forEach(resolve => resolve())
      readyResolversRef.current = []
    }
  }, [hasTitle, hasArtist])

  const onTitleSync = useCallback(() => {
    titleReadyRef.current = true
    checkAndResolveReady()
  }, [checkAndResolveReady])

  const onArtistSync = useCallback(() => {
    artistReadyRef.current = true
    checkAndResolveReady()
  }, [checkAndResolveReady])

  const displayFrames = Math.round(DISPLAY_DURATION_SECONDS * fps)
  const fadeFrames = Math.max(1, Math.round(FADE_DURATION_SECONDS * fps))
  const fadeStartFrame = displayFrames
  const fadeEndFrame = fadeStartFrame + fadeFrames

  useImperativeHandle(ref, () => ({
    setFrame: (rawFrame: number) => {
      let opacity: number

      if (!hasTitle && !hasArtist) {
        opacity = 0
      } else if (rawFrame <= fadeStartFrame) {
        opacity = 1
      } else if (rawFrame >= fadeEndFrame) {
        opacity = 0
      } else {
        const framesIntoFade = rawFrame - fadeStartFrame
        opacity = 1 - framesIntoFade / fadeFrames
      }

      opacity = clamp01(opacity)

      // Update title mesh material
      if (titleRef.current && titleRef.current.material) {
        const mat = titleRef.current.material as any
        if (mat.color) {
          mat.color.setHex(0xffffff).multiplyScalar(opacity)
        }
        if ('opacity' in mat) {
          mat.opacity = opacity
        }
      }

      // Update artist mesh material
      if (artistRef.current && artistRef.current.material) {
        const mat = artistRef.current.material as any
        if (mat.color) {
          mat.color.setHex(0xcccccc).multiplyScalar(opacity)
        }
        if ('opacity' in mat) {
          mat.opacity = opacity
        }
      }
    },
    waitForReady: () => {
      // If no title/artist, resolve immediately
      if (!hasTitle && !hasArtist) {
        return Promise.resolve()
      }
      // If already ready, resolve immediately
      const titleReady = !hasTitle || titleReadyRef.current
      const artistReady = !hasArtist || artistReadyRef.current
      if (titleReady && artistReady) {
        return Promise.resolve()
      }
      // Otherwise wait for onSync callbacks
      return new Promise<void>((resolve) => {
        readyResolversRef.current.push(resolve)
      })
    }
  }), [hasTitle, hasArtist, fadeStartFrame, fadeEndFrame, fadeFrames])

  if (!hasTitle && !hasArtist) return null

  const topY = viewport.height / 2 - viewport.height * 0.25
  const titleSize = viewport.width * 0.035
  const artistSize = viewport.width * 0.02

  return (
    <group position={[0, topY, 0.5]}>
      {hasTitle && (
        <Text
          ref={titleRef}
          font={PRIMARY_FONT}
          fontSize={titleSize}
          color="#ffffff"
          fillOpacity={1}
          anchorX="center"
          anchorY="middle"
          maxWidth={viewport.width * 0.8}
          outlineWidth={0}
          onSync={onTitleSync}
        >
          {title}
        </Text>
      )}
      {hasArtist && (
        <Text
          ref={artistRef}
          font={PRIMARY_FONT}
          fontSize={artistSize}
          color="#cccccc"
          fillOpacity={1}
          anchorX="center"
          anchorY="middle"
          position={[0, -titleSize * 0.9, 0]}
          maxWidth={viewport.width * 0.8}
          onSync={onArtistSync}
        >
          {artist}
        </Text>
      )}
    </group>
  )
})

export default FrameBasedTitle
