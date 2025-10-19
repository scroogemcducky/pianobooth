import React, { useEffect, useMemo, useState } from 'react'
import type { MetaFunction } from '@remix-run/node'
import EmbeddedPlayView_component from '../components/EmbeddedPlayView_component'
import useMidiStore from '../store/midiStore'

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

        let nextArtist = ''
        const artistCandidate = trackNames.find((n: string) => /bach|beethoven|chopin|debussy|mozart|liszt|schubert|schumann|rachmaninoff|handel|haydn|tchaikovsky|gershwin/i.test(n))
        if (artistCandidate) nextArtist = artistCandidate
        else if (trackNames.length) {
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
      if (meta?.title) setTitle(meta.title)
      if (meta?.artist) setArtist(meta.artist)
    } catch {}
  }, [title, artist])

  const slug = useMemo(() => {
    const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    if (!title && !artist) return ''
    return `${slugify(title || 'untitled')}-${slugify(artist || 'piano')}`
  }, [title, artist])

  return (
    <div className="font-eb min-h-screen text-black py-4 px-[5%] sm:px-[6%] md:px-[8%] lg:px-[10%]">
      <h1 className="m-0">{title || 'Loading…'}</h1>
      <p className="mt-2">{artist || ''}</p>
      {slug && (
        <p className="mt-1 text-sm text-gray-500">
          Shareable page: <a className="underline" href={`/embed/${slug}`}>/embed/{slug}</a>
        </p>
      )}
      <div className="w-full h-[468px] md:h-[558px] lg:h-[648px] mt-4 border border-gray-900 shadow-xl rounded-xl overflow-hidden">
        <EmbeddedPlayView_component className="w-full h-full" midiFile={midiFile ?? undefined} />
      </div>
    </div>
  )
}
