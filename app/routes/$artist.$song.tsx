import React, { useEffect, useState } from 'react'
import type { LoaderFunctionArgs, MetaFunction } from 'react-router'
import { data as json } from 'react-router'
import { useLoaderData, Link } from 'react-router'
import EmbeddedPlayView_component from '../components/EmbeddedPlayer'
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
  // Include slugs for OG image URL generation
  return json<LoaderData>({ ...data, artistSlug, songSlug })
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
            <Link to={`/artist/${data.artistSlug}`} className="text-lg hover:text-blue-600 hover:underline">{data.artist}</Link>
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
