import { useEffect, useState } from 'react'
import type { LoaderFunctionArgs, MetaFunction } from 'react-router'
import { data as json , useLoaderData } from 'react-router'
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
  return [
    { title: `${data.title} — ${data.artist}` },
    { name: 'description', content: `Interactive MIDI visualization of ${data.title} by ${data.artist}.` },
    { property: 'og:title', content: `${data.title} — ${data.artist}` },
    { property: 'og:description', content: `Interactive MIDI visualization of ${data.title} by ${data.artist}.` },
  ]
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const slug = params.slug || ''
  if (!slug) throw new Response('Not Found', { status: 404 })

  // Fetch sidecar JSON from /public_midi_json/<slug>.json hosted under /public
  const url = new URL(request.url)
  const jsonUrl = `${url.origin}/public_midi_json/${encodeURIComponent(slug)}.json`
  const res = await fetch(jsonUrl)
  if (!res.ok) throw new Response('Not Found', { status: 404 })
  const data = await res.json() as LoaderData
  // Basic shape check
  if (!data || !Array.isArray(data.midiObject)) throw new Response('Bad Data', { status: 500 })
  return json<LoaderData>({ ...data })
}

export default function PublicPieceRoute() {
  const data = useLoaderData<typeof loader>()
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
          <p className="font-garamond mt-2 text-xl italic text-white/80 md:text-2xl">{data.artist || ''}</p>
        </div>
      )}
    </main>
  )
}
