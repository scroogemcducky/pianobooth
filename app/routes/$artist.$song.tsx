import React, { useEffect, useState } from 'react'
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/cloudflare'
import { json } from '@remix-run/cloudflare'
import { useLoaderData } from '@remix-run/react'
import EmbeddedPlayView_component from '../components/EmbeddedPlayView_component'
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
  const artist = params.artist || ''
  const song = params.song || ''
  if (!artist || !song) throw new Response('Not Found', { status: 404 })
  const url = new URL(request.url)
  const jsonUrl = `${url.origin}/public_midi_json/${encodeURIComponent(artist)}/${encodeURIComponent(song)}.json`
  const res = await fetch(jsonUrl)
  if (!res.ok) throw new Response('Not Found', { status: 404 })
  const data = await res.json() as LoaderData
  if (!data || !Array.isArray(data.midiObject)) throw new Response('Bad Data', { status: 500 })
  return json<LoaderData>(data)
}

export default function PublicPieceByArtistSongRoute() {
  const data = useLoaderData<typeof loader>()
  const playing = usePlayStore((s) => s.playing)
  const [overlayVisible, setOverlayVisible] = useState(true)
  const [overlayFading, setOverlayFading] = useState(false)
  const [licenseOpen, setLicenseOpen] = useState(false)

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
            <EmbeddedPlayView_component className="w-full h-full" midiObject={data.midiObject} />
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

      {/* Below-the-fold details: artist, song, license */}
      <section className="px-[5%] sm:px-[6%] md:px-[8%] lg:px-[10%] py-6 flex justify-center">
        <div className="w-full max-w-6xl">
          {data.license && (
            <div className="mt-6 border border-gray-200 rounded-lg bg-white/70 text-gray-900">
              <button
                type="button"
                className="w-full flex items-center px-4 py-3 text-left text-sm uppercase tracking-wide text-gray-600 gap-2"
                onClick={() => setLicenseOpen((open) => !open)}
              >
                <span>License</span>
                <span className="text-base font-semibold">{licenseOpen ? '-' : '+'}</span>
              </button>
              {licenseOpen && (
                <div className="px-4 pb-4">
                  {data.license.name && (
                    <div className="font-medium">{data.license.name}</div>
                  )}
                  {data.license.attribution && (
                    <div className="mt-1 text-sm">{data.license.attribution}</div>
                  )}
                  {data.license.url && (
                    <div className="mt-1 text-sm">
                      <a className="text-blue-700 underline" href={data.license.url} target="_blank" rel="noreferrer">{data.license.url}</a>
                    </div>
                  )}
                  {data.license.text && (
                    <pre className="mt-3 whitespace-pre-wrap break-words text-sm leading-snug max-h-80 overflow-auto">{data.license.text}</pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
