import React, { useEffect, useMemo, useState } from 'react'
import type { LoaderFunctionArgs, MetaFunction } from 'react-router'
import { useLoaderData } from 'react-router'
import EmbeddedPlayView_component from '../components/EmbeddedPlayer'

type LoaderData = {
  slug: string
  title: string
  artist: string
  midiPath: string
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const slug = params.slug || 'unknown'
  const midiPath = `/${slug}.mid`

  // Try to fetch the MIDI to extract basic metadata server-side (best-effort)
  // If fetch fails or metadata not found, fall back to slug-based guesses.
  let title = slug
  let artist = 'Piano'

  try {
    const res = await fetch(new URL(midiPath, request.url).toString())
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer()
      // Parse with @tonejs/midi if available in the worker runtime
      try {
        const { Midi } = await import('@tonejs/midi')
        const midi = new Midi(arrayBuffer)

        // Heuristic extraction
        const headerName = (midi as any)?.header?.name?.trim?.()
        const trackNames = midi.tracks.map((t: any) => (t.name || '').trim()).filter(Boolean)

        // Title preference: header.name > longest track name > slug
        if (headerName) title = headerName
        else if (trackNames.length) {
          title = trackNames.reduce((a: string, b: string) => (b.length > a.length ? b : a), trackNames[0])
        }

        // Artist heuristic: look for a track name that looks like an artist or contains composer
        const artistCandidate = trackNames.find((n: string) => /bach|beethoven|chopin|debussy|mozart|liszt|schubert|schumann|rachmaninoff|handel|haydn|tchaikovsky|gershwin/i.test(n))
        if (artistCandidate) {
          artist = artistCandidate
        } else {
          // Try to parse patterns like "Artist - Title" or "Title - Artist"
          const hyphen = trackNames.find((n: string) => n.includes('-'))
          if (hyphen) {
            const parts = hyphen.split('-').map((s) => s.trim())
            if (parts.length >= 2) {
              // Choose the shorter as artist and longer as title when ambiguous
              const [a, b] = parts
              if (a.length <= b.length) artist = a
              if (!headerName) title = b
            }
          }
        }
      } catch {
        // ignore parse errors; keep fallbacks
      }
    }
  } catch {
    // ignore fetch errors; keep fallbacks
  }

  return new Response(JSON.stringify({ slug, title, artist, midiPath } satisfies LoaderData), {
    headers: { 'Content-Type': 'application/json' },
  })
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const payload = (typeof data === 'string' ? JSON.parse(data) : data) as LoaderData | undefined
  const title = payload?.title || 'Interactive MIDI Piano Player'
  const artist = payload?.artist || 'Piano'
  const pageTitle = `${title} — ${artist} | Interactive MIDI Piano Player`
  const description = `Practice ${title} by ${artist} with interactive MIDI playback, real-time note highlighting, and a live piano view.`
  const image = '/piano_og.png'

  return [
    { title: pageTitle },
    { name: 'description', content: description },
    { property: 'og:title', content: pageTitle },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:image', content: image },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: pageTitle },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
  ]
}

export default function EmbedSlugRoute() {
  const payload = useLoaderData<typeof loader>()
  const data: LoaderData = useMemo(() => (typeof payload === 'string' ? JSON.parse(payload) : (payload as any)), [payload])

  const [midiBlob, setMidiBlob] = useState<Blob | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch(data.midiPath)
        if (!res.ok) return
        const buf = await res.arrayBuffer()
        if (!active) return
        setMidiBlob(new Blob([buf], { type: 'audio/midi' }))
      } catch {}
    })()
    return () => {
      active = false
    }
  }, [data.midiPath])

  return (
    <div className="font-eb min-h-screen text-black px-6 md:px-12 lg:px-20 py-4">
      <h1 className="m-0">{data.title}</h1>
      <p className="mt-2">{data.artist}</p>
      <div className="w-full h-[380px] mt-4 border border-gray-900 shadow-xl rounded-xl overflow-hidden">
        <EmbeddedPlayView_component className="w-full h-full" midiFile={midiBlob ?? undefined} />
      </div>
    </div>
  )
}
