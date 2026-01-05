import React, { useEffect, useState } from 'react'
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/cloudflare'
import { json } from '@remix-run/cloudflare'
import { useLoaderData } from '@remix-run/react'
import ThumbnailView from '../components/recording/ThumbnailView'
import { getEffectivePresetColors, parseColorPresetIndex } from '../utils/colorPresets'

type MidiNote = {
  NoteNumber: number
  Velocity: number
  Duration: number
  SoundDuration?: number
  Delta: number
}

type MidiData = {
  title: string
  artist: string
  durationMs: number
  midiSha256: string
  midiObject: MidiNote[]
}

type ImageManifest = {
  [artistSlug: string]: string[]
}

type LoaderData = {
  title: string
  artist: string
  durationMs: number
  midiObject: MidiNote[]
  timePositionMs: number
  artistImagePath: string | null
  fontFamily: string
  blackKeyColor: [number, number, number]
  whiteKeyColor: [number, number, number]
  inline: boolean
}

// Constants for random position calculation
const MIN_POSITION_PERCENT = 0.20
const MAX_POSITION_PERCENT = 0.80
const MIDI_WINDOW_MS = 30_000
const MIDI_MAX_NOTES = 20_000

export const meta: MetaFunction = () => {
  return [{ name: 'robots', content: 'noindex' }]
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const artistSlug = params.artist || ''
  const songSlug = params.song || ''
  if (!artistSlug || !songSlug) throw new Response('Not Found', { status: 404 })

  const url = new URL(request.url)
  const inline = url.searchParams.get('inline') === '1'

  // Get font from query parameter (default to EB Garamond)
  const fontFamily = url.searchParams.get('font') || 'EB Garamond'
  const presetIndex = parseColorPresetIndex(url.searchParams.get('preset'))
  const { blackKeyColor, whiteKeyColor } = getEffectivePresetColors(presetIndex)

  let title = ''
  let artist = ''
  let durationMs = 0
  let midiObject: MidiNote[] = []
  let timePositionMs = 0

  if (!inline) {
    // Load MIDI data
    const jsonUrl = `${url.origin}/public_midi_json/${encodeURIComponent(artistSlug)}/${encodeURIComponent(songSlug)}.json`
    const res = await fetch(jsonUrl)
    if (!res.ok) throw new Response('Not Found', { status: 404 })

    const data = (await res.json()) as MidiData
    if (!data || !Array.isArray(data.midiObject)) throw new Response('Bad Data', { status: 500 })

    // Calculate random time position (20-80% of the piece)
    const positionPercent =
      MIN_POSITION_PERCENT + Math.random() * (MAX_POSITION_PERCENT - MIN_POSITION_PERCENT)
    timePositionMs = data.durationMs * positionPercent

    // Reduce payload size: keep only notes around the snapshot time (layout still includes extremes).
    let minNote = 127
    let maxNote = 0
    for (const note of data.midiObject) {
      const n = Math.max(0, Math.min(127, note.NoteNumber))
      if (n < minNote) minNote = n
      if (n > maxNote) maxNote = n
    }

    const windowStartMs = Math.max(0, timePositionMs - MIDI_WINDOW_MS)
    const windowEndMs = timePositionMs + MIDI_WINDOW_MS
    midiObject = data.midiObject.filter((note) => {
      const deltaMs = note.Delta / 1000
      return deltaMs >= windowStartMs && deltaMs <= windowEndMs
    })
    if (midiObject.length > MIDI_MAX_NOTES) midiObject = midiObject.slice(0, MIDI_MAX_NOTES)

    const hasMin = midiObject.some((n) => n.NoteNumber === minNote)
    const hasMax = midiObject.some((n) => n.NoteNumber === maxNote)
    if (!hasMin && minNote >= 0 && minNote <= 127) midiObject.unshift({ NoteNumber: minNote, Velocity: 0, Duration: 0, Delta: 0 })
    if (!hasMax && maxNote >= 0 && maxNote <= 127) midiObject.unshift({ NoteNumber: maxNote, Velocity: 0, Duration: 0, Delta: 0 })

    title = data.title
    artist = data.artist
    durationMs = data.durationMs
  }

  // Load artist image from manifest
  let artistImagePath: string | null = null
  try {
    const manifestUrl = `${url.origin}/thumbnail_images/manifest.json`
    const manifestRes = await fetch(manifestUrl)
    if (manifestRes.ok) {
      const manifest = (await manifestRes.json()) as ImageManifest
      const images = manifest[artistSlug] || []
      if (images.length > 0) {
        const randomImage = images[Math.floor(Math.random() * images.length)]
        artistImagePath = `/thumbnail_images/${artistSlug}/${randomImage}`
      }
    }
  } catch {
    // Manifest not found or parse error - continue without artist image
  }

  return json<LoaderData>({
    title,
    artist,
    durationMs,
    midiObject,
    timePositionMs,
    artistImagePath,
    fontFamily,
    blackKeyColor,
    whiteKeyColor,
    inline,
  })
}

export default function ThumbnailRoute() {
  const data = useLoaderData<typeof loader>()
  const [inlineMidi, setInlineMidi] = useState<Pick<LoaderData, 'title' | 'artist' | 'durationMs' | 'midiObject' | 'timePositionMs'> | null>(null)

  useEffect(() => {
    if (!data.inline) return
    try {
      const raw = window.localStorage.getItem('thumbnailMidiData')
      if (!raw) return
      const parsed = JSON.parse(raw) as any
      if (!parsed || !Array.isArray(parsed.midiObject)) return
      setInlineMidi({
        title: typeof parsed.title === 'string' ? parsed.title : '',
        artist: typeof parsed.artist === 'string' ? parsed.artist : '',
        durationMs: typeof parsed.durationMs === 'number' ? parsed.durationMs : 0,
        midiObject: parsed.midiObject as MidiNote[],
        timePositionMs: typeof parsed.timePositionMs === 'number' ? parsed.timePositionMs : 0,
      })
    } catch {
      // ignore
    }
  }, [data.inline])

  if (data.inline && !inlineMidi) {
    return (
      <div
        id="thumbnail-page-container"
        style={{
          width: '1280px',
          height: '720px',
          overflow: 'hidden',
          position: 'relative',
          background: 'black',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}
      >
        Loading…
      </div>
    )
  }

  const effective = data.inline ? inlineMidi! : data

  return (
    <div
      id="thumbnail-page-container"
      style={{
        width: '1280px',
        height: '720px',
        overflow: 'hidden',
        position: 'relative',
        background: 'black',
      }}
    >
      <ThumbnailView
        midiObject={effective.midiObject}
        title={effective.title}
        artist={effective.artist}
        timePositionMs={effective.timePositionMs}
        artistImagePath={data.artistImagePath}
        fontFamily={data.fontFamily}
        blackKeyColor={data.blackKeyColor}
        whiteKeyColor={data.whiteKeyColor}
      />
    </div>
  )
}
