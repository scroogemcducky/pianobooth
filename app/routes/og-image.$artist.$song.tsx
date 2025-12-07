import React from 'react'
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/cloudflare'
import { json } from '@remix-run/cloudflare'
import { useLoaderData } from '@remix-run/react'
import OGImageView from '../components/OGImageView'

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
}

export const meta: MetaFunction = () => {
  return [
    { name: 'robots', content: 'noindex' },
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

export default function OGImageRoute() {
  const data = useLoaderData<typeof loader>()

  return (
    <div
      id="og-image-container"
      style={{
        width: '1200px',
        height: '630px',
        overflow: 'hidden',
        position: 'relative',
        background: 'black',
      }}
    >
      <OGImageView
        midiObject={data.midiObject}
        title={data.title}
        artist={data.artist}
      />
    </div>
  )
}
