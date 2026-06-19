import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'

import RecordKeys from './FrameBasedKeys'
import ThumbnailStaticBlocks from './ThumbnailStaticBlocks'
import ThumbnailStaticParticles from './ThumbnailStaticParticles'
import { computePianoLayout, DEFAULT_PIANO_LAYOUT, type PianoLayout } from '../../utils/pianoLayout'
import useKeyStore from '../../store/keyPressStore'

type MidiNote = {
  NoteNumber: number
  Delta: number
  Duration: number
  SoundDuration?: number
}

type CutoutOverrides = {
  maxHeight?: string
  maxWidth?: string
  right?: string
  bottom?: string
}

type Props = {
  midiObject: MidiNote[]
  title: string
  artist: string
  timePositionMs: number
  artistImagePath: string | null
  fontFamily?: string
  blackKeyColor?: [number, number, number]
  whiteKeyColor?: [number, number, number]
  style?: 'full' | 'side' | 'cutout'
  cutoutOverrides?: CutoutOverrides | null
}

// Thumbnail visualization for YouTube thumbnails (1280x720)
// Layers: Canvas (piano + notes + particles) -> Artist image (semi-transparent) -> Text overlay
export default function ThumbnailView({
  midiObject,
  title,
  artist,
  timePositionMs,
  artistImagePath,
  fontFamily = 'EB Garamond',
  blackKeyColor,
  whiteKeyColor,
  style = 'cutout',
  cutoutOverrides,
}: Props) {
  const [isReady, setIsReady] = useState(false)
  const [pianoLayout, setPianoLayout] = useState<PianoLayout>(DEFAULT_PIANO_LAYOUT)
  const [imageLoaded, setImageLoaded] = useState(!artistImagePath)
  const [imageError, setImageError] = useState(false)
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set())
  const prevActiveNotesRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (midiObject && midiObject.length > 0) {
      const layout = computePianoLayout(midiObject)
      setPianoLayout(layout ?? DEFAULT_PIANO_LAYOUT)
    }
  }, [midiObject])

  // Callback to receive active notes from ThumbnailStaticBlocks
  const handleActiveNotesChange = useCallback((notes: Set<number>) => {
    setActiveNotes(notes)
  }, [])

  // Set active key states in the store when activeNotes changes
  useEffect(() => {
    const keyStore = useKeyStore.getState()

    // Clear previous active notes
    prevActiveNotesRef.current.forEach((noteNumber) => {
      if (!activeNotes.has(noteNumber)) {
        keyStore.setKey(noteNumber, false)
      }
    })

    // Set new active notes
    activeNotes.forEach((noteNumber) => {
      keyStore.setKey(noteNumber, true)
    })

    prevActiveNotesRef.current = new Set(activeNotes)

    // Cleanup: clear all active notes on unmount
    return () => {
      activeNotes.forEach((noteNumber) => {
        keyStore.setKey(noteNumber, false)
      })
    }
  }, [activeNotes])

  // Signal ready after canvas renders and image loads (if applicable)
  useEffect(() => {
    if (imageLoaded || imageError) {
      const timer = setTimeout(() => {
        setIsReady(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [imageLoaded, imageError])

  const wrapperStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'relative',
      width: '100%',
      height: '100%',
      fontFamily: `'${fontFamily}', serif`,
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    }),
    [fontFamily]
  )

  return (
    <div id="thumbnail-container" style={wrapperStyle}>
      {/* Layer 1: Canvas with piano keys, falling notes, and particles */}
      <Canvas
        style={{ background: 'black' }}
        orthographic
        camera={{ zoom: 9 }}
        gl={{
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.LinearSRGBColorSpace,
          preserveDrawingBuffer: true,
        }}
      >
        <ambientLight intensity={7.5} />
        <directionalLight position={[11, -4, 90]} intensity={0.15} />
        <RecordKeys
          layout={pianoLayout}
          scaleMultiplier={1}
          scaleFillRatio={0.9}
          scaleMax={1.1}
          blackKeyColor={blackKeyColor}
          whiteKeyColor={whiteKeyColor}
        />
        {midiObject && midiObject.length > 0 && (
          <>
            <ThumbnailStaticBlocks
              midiObject={midiObject}
              layout={pianoLayout}
              timePositionMs={timePositionMs}
              onActiveNotesChange={handleActiveNotesChange}
              blackKeyColor={blackKeyColor}
              whiteKeyColor={whiteKeyColor}
            />
            <ThumbnailStaticParticles
              activeNotes={activeNotes}
              layout={pianoLayout}
              blackKeyColor={blackKeyColor}
              whiteKeyColor={whiteKeyColor}
            />
          </>
        )}
      </Canvas>

      {/* Layer 2: Artist image (semi-transparent overlay) */}
      {artistImagePath && !imageError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 10,
            ...(style === 'side' ? {
              maskImage: 'linear-gradient(to right, transparent 0%, black 55%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 55%)',
            } : {}),
          }}
        >
          <img
            src={artistImagePath}
            alt={artist}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageError(true)
              setImageLoaded(true)
            }}
            style={style === 'cutout' ? {
              position: 'absolute',
              right: cutoutOverrides?.right ?? '3%',
              bottom: cutoutOverrides?.bottom ?? '0',
              maxHeight: cutoutOverrides?.maxHeight ?? '100%',
              maxWidth: cutoutOverrides?.maxWidth ?? '60%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              objectPosition: 'right bottom',
              filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.7)) drop-shadow(0 0 4px rgba(255,255,255,0.9))',
            } : style === 'side' ? {
              position: 'absolute',
              right: 0,
              top: 0,
              height: '100%',
              width: 'auto',
              objectFit: 'contain',
              objectPosition: 'right center',
              opacity: 0.4,
            } : {
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.4,
            }}
          />
        </div>
      )}

      {/* Layer 3: Title/Artist text overlay (always visible) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          color: 'white',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '97px',
            fontWeight: 600,
            textShadow: '0 4px 36px rgba(0,0,0,1), 0 2px 6px rgba(0,0,0,1), 0 0 60px rgba(0,0,0,0.8)',
            maxWidth: '85%',
            lineHeight: 1.2,
          }}
        >
          {title || 'Piano Piece'}
        </h1>
        <p
          style={{
            marginTop: '24px',
            fontSize: '62px',
            color: 'white',
            textShadow: '0 4px 36px rgba(0,0,0,1), 0 2px 6px rgba(0,0,0,1), 0 0 60px rgba(0,0,0,0.8)',
          }}
        >
          {artist || ''}
        </p>
      </div>

      {/* Ready indicator for Playwright */}
      {isReady && (
        <div
          id="thumbnail-ready"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1,
            height: 1,
            opacity: 0,
          }}
        />
      )}
    </div>
  )
}
