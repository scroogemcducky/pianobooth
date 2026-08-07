import { useEffect, useState } from 'react'
import type { LoaderFunctionArgs, MetaFunction } from 'react-router'
import { data as json , useLoaderData, Link } from 'react-router'
import PlayView from '../components/PlayView'
import usePlayStore from '../store/playStore'

type MidiNote = {
  NoteNumber: number
  Velocity: number
  Duration: number
  SoundDuration?: number
  Delta: number
}

type LoaderData = {
  title: string
  artist: string
  artistSlug: string
  songSlug: string
  durationMs: number
  midiSha256: string
  midiObject: MidiNote[]
  license?: {
    name?: string
    url?: string
    text?: string
    attribution?: string
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [
    { title: 'Piano Piece' },
    { name: 'description', content: 'Interactive MIDI piano visualization.' },
  ]

  const pageTitle = `${data.title} — ${data.artist}`
  const description = `Interactive MIDI visualization of ${data.title} by ${data.artist}. Practice piano with animated falling notes.`
  const ogImageUrl = `/og-images/${data.artistSlug}/${data.songSlug}.png`

  return [
    { title: pageTitle },
    { name: 'description', content: description },
    // Open Graph
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: pageTitle },
    { property: 'og:description', content: description },
    { property: 'og:image', content: ogImageUrl },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    // Twitter Card
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: pageTitle },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: ogImageUrl },
  ]
}

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const artistSlug = params.artist || ''
  const songSlug = params.song || ''
  if (!artistSlug || !songSlug) throw new Response('Not Found', { status: 404 })

  const jsonPath = `/public_midi_json/${encodeURIComponent(artistSlug)}/${encodeURIComponent(songSlug)}.json`

  // Use ASSETS binding if available (production), otherwise fallback to fetch
  let res: Response
  const env = context?.cloudflare?.env
  if (env?.ASSETS) {
    res = await env.ASSETS.fetch(new Request(`http://assets${jsonPath}`))
  } else {
    const url = new URL(request.url)
    res = await fetch(`${url.origin}${jsonPath}`)
  }

  if (!res.ok) throw new Response('Not Found', { status: 404 })
  const data = await res.json() as LoaderData
  if (!data || !Array.isArray(data.midiObject)) throw new Response('Bad Data', { status: 500 })
  return json<LoaderData>({ ...data, artistSlug, songSlug })
}

export default function PublicPieceByArtistSongRoute() {
  const data = useLoaderData<typeof loader>()
  const playing = usePlayStore((s) => s.playing)
  const [overlayVisible, setOverlayVisible] = useState(true)
  const [overlayFading, setOverlayFading] = useState(false)

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
  return (
    <main className="relative h-screen min-h-screen overflow-hidden bg-black text-white">
      <div className="absolute inset-0">
        <PlayView midiObject={data.midiObject} license={data.license} />
      </div>

      {/* Title card over the canvas, fading out once playback starts. */}
      {(overlayVisible || overlayFading) && (
        <div
          className={`pointer-events-none absolute inset-0 z-[1100] flex flex-col items-center justify-center px-6 text-center transition-opacity duration-500 ease-out ${overlayFading ? 'opacity-0' : 'opacity-100'}`}
          style={{ textShadow: '0 2px 10px rgba(0,0,0,0.9)' }}
        >
          <h1 className="font-garamond m-0 text-3xl md:text-4xl">{data.title || 'Loading…'}</h1>
          <Link
            to={`/artist/${data.artistSlug}`}
            className="font-garamond pointer-events-auto mt-2 text-xl italic text-white/80 hover:text-white md:text-2xl"
          >
            {data.artist}
          </Link>
        </div>
      )}
    </main>
  )
}
