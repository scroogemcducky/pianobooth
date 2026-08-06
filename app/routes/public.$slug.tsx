import { useEffect, useState } from 'react'
import type { LoaderFunctionArgs, MetaFunction } from 'react-router'
import { data as json , useLoaderData } from 'react-router'
import PlayView from './play'
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
    <div className="font-eb text-black">
      {/* Top section: artist + song above a slightly smaller player */}
      <section className="px-[5%] sm:px-[6%] md:px-[8%] lg:px-[10%] py-6 flex justify-center">
        <div className="relative w-full max-w-6xl mx-auto">
          <div className="mb-3">
            <div className="text-lg">{data.artist}</div>
            <div className="text-xl font-semibold">{data.title}</div>
          </div>
          <div className="relative w-full max-w-6xl h-[420px] md:h-[500px] lg:h-[580px] mx-auto border border-gray-900 shadow-2xl rounded-lg overflow-hidden">
            <PlayView midiObject={data.midiObject} license={data.license} />
            {(overlayVisible || overlayFading) && (
              <div
                className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center z-20 transition-opacity duration-500 ease-out ${overlayFading ? 'opacity-0' : 'opacity-100'} text-white`}
              >
                <h1 className="m-0 text-2xl md:text-3xl font-semibold">{data.title || 'Loading…'}</h1>
                <p className="mt-1 text-base md:text-lg opacity-90">{data.artist || ''}</p>
              </div>
            )}
          </div>
        </div>
      </section>

    </div>
  )
}
