import React from 'react'
import type { MetaFunction } from '@remix-run/node'
import EmbeddedPlayView_component from '../components/EmbeddedPlayView_component'

export const meta: MetaFunction = () => {
  return [
    { title: 'Embedded Visualizer Test' },
    { name: 'description', content: 'Hello + embedded MIDI visualizer component test route.' },
  ]
}

export default function EmbedRoute() {
  return (
    <div style={{ padding: '1rem', color: '#111', background: '#fff', minHeight: '100vh' }}>
      <h1 style={{ margin: 0 }}>Hello</h1>
      <p style={{ marginTop: '0.5rem', color: '#333' }}>
        If you previously loaded a MIDI in the app, this view will load it from localStorage.
      </p>
      <div style={{ width: '100%', height: '380px', marginTop: '1rem', border: '1px solid #ccc' }}>
        <EmbeddedPlayView_component className="w-full h-full" />
      </div>
    </div>
  )
}
