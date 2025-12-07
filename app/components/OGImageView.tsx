import React, { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'

import EmbeddedKeys from './EmbeddedKeys'
import OGStaticBlocks from './OGStaticBlocks'
import { computePianoLayout, DEFAULT_PIANO_LAYOUT, type PianoLayout } from '../utils/pianoLayout'

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
}

// Static visualization for OG image screenshots
export default function OGImageView({ midiObject, title, artist }: Props) {
  const [isReady, setIsReady] = useState(false)
  const [pianoLayout, setPianoLayout] = useState<PianoLayout>(DEFAULT_PIANO_LAYOUT)

  useEffect(() => {
    if (midiObject && midiObject.length > 0) {
      const layout = computePianoLayout(midiObject)
      setPianoLayout(layout ?? DEFAULT_PIANO_LAYOUT)
    }
  }, [midiObject])

  // Signal ready after a short delay to allow Three.js to render
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true)
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  const wrapperStyle = useMemo<React.CSSProperties>(() => ({
    position: 'relative',
    width: '100%',
    height: '100%',
    fontFamily: `'EB Garamond', serif`,
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
  }), [])

  return (
    <div style={wrapperStyle}>
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
          <OGStaticBlocks midiObject={midiObject} layout={pianoLayout} />
        )}
      </Canvas>

      {/* Title/Artist overlay - always visible */}
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
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.1) 30%, rgba(0,0,0,0.1) 70%, rgba(0,0,0,0.4) 100%)',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '48px',
            fontWeight: 600,
            textShadow: '0 2px 20px rgba(0,0,0,0.8)',
            maxWidth: '80%',
            lineHeight: 1.2,
          }}
        >
          {title || 'Piano Piece'}
        </h1>
        <p
          style={{
            marginTop: '12px',
            fontSize: '28px',
            opacity: 0.9,
            textShadow: '0 2px 10px rgba(0,0,0,0.8)',
          }}
        >
          {artist || ''}
        </p>
      </div>

      {/* Ready indicator for Playwright */}
      {isReady && (
        <div
          id="og-ready"
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
