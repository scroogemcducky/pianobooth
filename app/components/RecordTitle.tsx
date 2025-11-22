import React, { useMemo } from 'react'
import { Text } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Color } from 'three'

type Props = {
  title?: string | null
  artist?: string | null
  currentFrame?: number
  fps?: number
  isRecording?: boolean
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

export default function RecordTitle({
  title,
  artist,
  currentFrame = 0,
  fps = DEFAULT_FPS,
  isRecording = false,
}: Props) {
  const { viewport } = useThree()
  const hasTitle = Boolean(title)
  const hasArtist = Boolean(artist)

  const displayFrames = Math.round(DISPLAY_DURATION_SECONDS * fps)
  const fadeFrames = Math.max(1, Math.round(FADE_DURATION_SECONDS * fps))
  const fadeStartFrame = displayFrames
  const fadeEndFrame = fadeStartFrame + fadeFrames

  const opacity = useMemo(() => {
    if (!hasTitle && !hasArtist) return 0
    if (!isRecording) return 1
    if (currentFrame <= fadeStartFrame) return 1
    if (currentFrame >= fadeEndFrame) return 0
    const framesIntoFade = currentFrame - fadeStartFrame
    const progress = framesIntoFade / fadeFrames
    return 1 - progress
  }, [currentFrame, fadeFrames, fadeEndFrame, fadeStartFrame, hasArtist, hasTitle, isRecording])
  const normalizedOpacity = clamp01(opacity)
  const titleColor = useMemo(() => fadedHex('#ffffff', normalizedOpacity), [normalizedOpacity])
  const artistColor = useMemo(() => fadedHex('#cccccc', normalizedOpacity), [normalizedOpacity])

  if (!hasTitle && !hasArtist) return null

  const topY = viewport.height / 2 - viewport.height * 0.25
  const titleSize = viewport.width * 0.035
  const artistSize = viewport.width * 0.02

  return (
    <group position={[0, topY, 0.5]}>
      {hasTitle && (
        <Text
          font={PRIMARY_FONT}
          fontSize={titleSize}
          color={titleColor}
          fillOpacity={opacity}
          anchorX="center"
          anchorY="middle"
          maxWidth={viewport.width * 0.8}
          outlineWidth={0}
          transparent
        >
          {title}
        </Text>
      )}
      {hasArtist && (
        <Text
          font={PRIMARY_FONT}
          fontSize={artistSize}
          color={artistColor}
          fillOpacity={opacity}
          anchorX="center"
          anchorY="middle"
          position={[0, -titleSize * 0.9, 0]}
          maxWidth={viewport.width * 0.8}
          transparent
        >
          {artist}
        </Text>
      )}
    </group>
  )
}
