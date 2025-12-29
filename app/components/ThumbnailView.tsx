import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'

import EmbeddedKeys from './EmbeddedKeys'
import ThumbnailStaticBlocks from './ThumbnailStaticBlocks'
import ThumbnailStaticParticles from './ThumbnailStaticParticles'
import { computePianoLayout, DEFAULT_PIANO_LAYOUT, type PianoLayout } from '../utils/pianoLayout'
import useKeyStore from '../store/keyPressStore'

type MidiNote = {
  NoteNumber: number
  Delta: number
  Duration: number
  SoundDuration?: number
}

type Props = {
  midiObject: MidiNote[]
  title: string
  artist: string
  timePositionMs: number
  artistImagePath: string | null
  fontFamily?: string
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
        <EmbeddedKeys layout={pianoLayout} />
        {midiObject && midiObject.length > 0 && (
          <>
            <ThumbnailStaticBlocks
              midiObject={midiObject}
              layout={pianoLayout}
              timePositionMs={timePositionMs}
              onActiveNotesChange={handleActiveNotesChange}
            />
            <ThumbnailStaticParticles
              activeNotes={activeNotes}
              layout={pianoLayout}
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 10,
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
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
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
            fontSize: '56px',
            fontWeight: 600,
            textShadow: '0 3px 30px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,1)',
            maxWidth: '85%',
            lineHeight: 1.2,
          }}
        >
          {title || 'Piano Piece'}
        </h1>
        <p
          style={{
            marginTop: '16px',
            fontSize: '36px',
            color: '#cccccc',
            textShadow: '0 2px 15px rgba(0,0,0,0.8)',
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
