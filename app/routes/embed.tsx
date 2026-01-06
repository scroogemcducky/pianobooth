import React, { useEffect, useMemo, useState } from 'react'
import type { MetaFunction } from 'react-router'
import EmbeddedPlayView_component from '../components/EmbeddedPlayer'
import useMidiStore from '../store/midiStore'
import usePlayStore from '../store/playStore'

export const meta: MetaFunction = () => {
  return [
    { title: 'Embedded Visualizer Test' },
    { name: 'description', content: 'Hello + embedded MIDI visualizer component test route.' },
  ]
}

export default function EmbedRoute() {
  const midiFile = useMidiStore((s) => s.midiFile)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const playing = usePlayStore((s) => s.playing)
  const [overlayVisible, setOverlayVisible] = useState(true)
  const [overlayFading, setOverlayFading] = useState(false)

  // Fade out overlay on first play, then unmount
  useEffect(() => {
    if (playing && overlayVisible && !overlayFading) {
      setOverlayFading(true)
      const tid = window.setTimeout(() => {
        setOverlayVisible(false)
        setOverlayFading(false)
      }, 500)
      return () => window.clearTimeout(tid)
    }
  }, [playing, overlayVisible, overlayFading])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!midiFile) return
      try {
        const buf = await midiFile.arrayBuffer()
        const { Midi } = await import('@tonejs/midi')
        const midi = new Midi(buf)
        const headerName = (midi as any)?.header?.name?.trim?.()
        const trackNames = midi.tracks.map((t: any) => (t.name || '').trim()).filter(Boolean)

        let nextTitle = headerName || ''
        if (!nextTitle && trackNames.length) {
          nextTitle = trackNames.reduce((a: string, b: string) => (b.length > a.length ? b : a), trackNames[0])
        }

        // Extract only the composer name (not the whole track title)
        let nextArtist = ''
        const composerRegex = /(bach|beethoven|chopin|debussy|mozart|liszt|schubert|schumann|rachmaninoff|handel|haydn|tchaikovsky|gershwin)/i
        const artistCandidate = trackNames.find((n: string) => composerRegex.test(n)) || (headerName && composerRegex.test(headerName) ? headerName : '')
        if (artistCandidate) {
          const m = artistCandidate.match(composerRegex)
          if (m && m[1]) {
            const name = m[1]
            nextArtist = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
          }
        } else if (trackNames.length) {
          const hyphen = trackNames.find((n: string) => n.includes('-'))
          if (hyphen) {
            const parts = hyphen.split('-').map((s) => s.trim())
            if (parts.length >= 2) {
              const [a, b] = parts
              if (a.length <= b.length) nextArtist = a
              if (!nextTitle) nextTitle = b
            }
          }
        }

        if (!cancelled) {
          setTitle(nextTitle || 'Untitled')
          setArtist(nextArtist || 'Piano')
        }
      } catch {
        if (!cancelled) {
          setTitle('Untitled')
          setArtist('Piano')
        }
      }
    })()
    return () => { cancelled = true }
  }, [midiFile])

  // Fallback: if store is empty (after refresh), try metadata from localStorage
  useEffect(() => {
    if (title || artist) return
    try {
      const raw = localStorage.getItem('midiMeta')
      if (!raw) return
      const meta = JSON.parse(raw)
      let nextTitle = meta?.title || ''
      let nextArtist = meta?.artist || ''
      // Sanitize artist to composer-only if possible
      const composerRegex = /(bach|beethoven|chopin|debussy|mozart|liszt|schubert|schumann|rachmaninoff|handel|haydn|tchaikovsky|gershwin)/i
      const am = (nextArtist || '').match(composerRegex)
      if (am && am[1]) {
        const name = am[1]
        nextArtist = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
      }
      // If the stored title still contains composer prefix, strip it
      const tm = (nextTitle || '').match(/^(.*?)[-:\u2013]\s*(.+)$/)
      if (tm) {
        const maybeComposer = tm[1].trim()
        const rest = tm[2].trim()
        if (composerRegex.test(maybeComposer)) {
          nextTitle = rest
        }
      }
      if (nextTitle) setTitle(nextTitle)
      if (nextArtist) setArtist(nextArtist)
    } catch {}
  }, [title, artist])

  const slug = useMemo(() => {
    const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    if (!title && !artist) return ''
    return `${slugify(title || 'untitled')}-${slugify(artist || 'piano')}`
  }, [title, artist])

  return (
    <div className="font-eb min-h-screen text-black py-6 px-[5%] sm:px-[6%] md:px-[8%] lg:px-[10%] flex justify-center">
      <div className="relative w-full max-w-6xl mx-auto">
        {/* Centered embedded player container with overlayed title + artist */}
        <div className="relative w-full max-w-6xl h-[468px] md:h-[558px] lg:h-[648px] mt-4 mx-auto border border-gray-900 shadow-lg rounded-lg overflow-hidden">
          <EmbeddedPlayView_component className="w-full h-full" midiFile={midiFile ?? undefined} />
          {(overlayVisible || overlayFading) && (
            <div
              className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center z-20 transition-opacity duration-500 ease-out ${overlayFading ? 'opacity-0' : 'opacity-100'} text-white`}
            >
              <h1 className="m-0 text-2xl md:text-3xl font-semibold">{title || 'Loading…'}</h1>
              <p className="mt-1 text-base md:text-lg opacity-90">{artist || ''}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
