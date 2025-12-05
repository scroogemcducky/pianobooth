import React, { useMemo } from 'react'
import { Text } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Color } from 'three'

type Props = {
  title?: string | null
  artist?: string | null
  frameNumberRef?: React.MutableRefObject<number>
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
  frameNumberRef,
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
  const currentFrame = frameNumberRef?.current ?? 0

  let opacity: number

  if (!hasTitle && !hasArtist) { opacity = 0}
  else if (!isRecording) { opacity = 1 }
  else if (currentFrame <= fadeStartFrame) {opacity = 1}
  else if (currentFrame >= fadeEndFrame) {opacity = 0} 
  else {

    const framesIntoFade = currentFrame - fadeStartFrame
    opacity =1 - framesIntoFade / fadeFrames

  }


  opacity = clamp01(opacity)
  const titleColor = fadedHex('#ffffff', opacity)
  const artistColor = fadedHex('#cccccc', opacity)

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
