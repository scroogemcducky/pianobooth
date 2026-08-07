import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { Link } from 'react-router'
import type { MetaFunction } from 'react-router'
import useMidiStore from '../store/midiStore'
import PlayView from '../components/PlayView'
import { validateMidiFile } from '~/utils/validateMidiFile'

export const meta: MetaFunction = () => {
  return [
    { title: 'PianoBooth | Interactive MIDI Piano Player' },
    {
      name: 'description',
      content: 'Drop a MIDI file into PianoBooth for interactive piano playback, or browse classical piano pieces.',
    },
    { property: 'og:title', content: 'PianoBooth | Interactive MIDI Piano Player' },
    {
      property: 'og:description',
      content: 'Drop a MIDI file for interactive piano playback, or browse classical piano pieces.',
    },
    { property: 'og:image', content: 'https://pianobooth.com/og-images/og_image.png' },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://pianobooth.com' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:image', content: 'https://pianobooth.com/og-images/og_image.png' },
  ]
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [overlayReady, setOverlayReady] = useState(false)
  const [hasAcceptedMidi, setHasAcceptedMidi] = useState(false)
  const setMidiStore = useMidiStore((state) => state.setMidiFile)

  useEffect(() => {
    let cancelled = false
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined

    const showOverlay = () => {
      if (fallbackTimer) clearTimeout(fallbackTimer)
      requestAnimationFrame(() => {
        if (!cancelled) setOverlayReady(true)
      })
    }

    if (typeof document !== 'undefined' && 'fonts' in document) {
      fallbackTimer = setTimeout(showOverlay, 1200)
      document.fonts.load('1em "EB Garamond"').then(showOverlay, showOverlay)
    } else {
      showOverlay()
    }

    return () => {
      cancelled = true
      if (fallbackTimer) clearTimeout(fallbackTimer)
    }
  }, [])

  const handleMidiFile = useCallback(
    (file: File | null | undefined) => {
      const { isValid, error } = validateMidiFile(file)

      if (!isValid) {
        alert(error)
        return
      }

      setMidiStore(file)
      setHasAcceptedMidi(true)
    },
    [setMidiStore],
  )

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      handleMidiFile(event.dataTransfer.files.item(0))
    },
    [handleMidiFile],
  )

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
  }

  return (
    <main
      className="relative h-screen min-h-screen overflow-hidden bg-black text-white"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="absolute inset-0">
        <PlayView />
      </div>

      {!hasAcceptedMidi && (
        <section className="pointer-events-none absolute inset-0 z-[1100] flex items-center justify-center px-6">
          <div
            className="pointer-events-auto isolate flex max-w-xl flex-col items-center gap-4 text-center text-white"
            style={{
              opacity: overlayReady ? 1 : 0,
              transform: 'translate3d(0,0,0)',
              backfaceVisibility: 'hidden',
              contain: 'layout paint',
              textShadow: '0 2px 10px rgba(0,0,0,0.9)',
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".mid,.midi,.kar,audio/midi,audio/x-midi,application/x-midi"
              onChange={(event) => handleMidiFile(event.currentTarget.files?.item(0))}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="font-garamond text-3xl text-white hover:text-white/80 md:text-4xl"
            >
              Drop a MIDI file here.
            </button>
            <p className="font-garamond text-xl text-white/80 md:text-2xl">
              Or{' '}
              <Link
                to="/classical"
                className="group relative inline-block pb-0.5 italic text-white hover:text-white/80"
              >
                <span>browse classical pieces</span>
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 block h-px bg-white group-hover:bg-white/80"
                  style={{ transform: 'translate3d(0,0,0)', backfaceVisibility: 'hidden' }}
                />
              </Link>
              .
            </p>
          </div>
        </section>
      )}
    </main>
  )
}
