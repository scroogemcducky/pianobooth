import type { MetaFunction } from 'react-router'
import PlayView from '../components/PlayView'

export const meta: MetaFunction = () => {
  return [
    { title: 'Piano Practice | Interactive MIDI Piano Player' },
    {
      name: 'description',
      content:
        'Practice piano with interactive MIDI playback, visual feedback, and real-time note highlighting. Perfect for learning classical piano pieces.',
    },
  ]
}

// Thin route wrapper. The player itself lives in components/PlayView so other
// routes can render it with props - route default exports cannot receive them.
export default function PlayRoute() {
  return <PlayView />
}
