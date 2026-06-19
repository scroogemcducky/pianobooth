import { useRef } from 'react'
import type { DragEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import type { MetaFunction } from 'react-router'
import useMidiStore from '../store/midiStore'
import { composerImages } from '~/data/artists'
import { slugify } from '~/utils/slugify'
import { validateMidiFile } from '~/utils/validateMidiFile'

type FeaturedPiece = {
  title: string
  url: string
}

const featuredStaticPieces: Record<string, FeaturedPiece[]> = {
  Bach: [
    { title: 'Prelude & Fugue No. 1 in C major, BWV 846', url: '/bach/prelude-and-fugue-in-c-major-bwv-846' },
    { title: 'Prelude & Fugue No. 2 in C minor, BWV 847', url: '/bach/prelude-and-fugue-in-c-minor-bwv-847' },
    { title: 'Prelude & Fugue in D major, BWV 850', url: '/bach/pr-ludium-und-fuge-in-d-dur-bwv-850' },
  ],
  Beethoven: [
    { title: 'Piano Sonata No. 23 "Appassionata" I', url: '/beethoven/piano-sonata-no-23-op-57-in-f-minor-i' },
    { title: 'Appassionata', url: '/beethoven/appassionata' },
    { title: 'Hammerklavier Sonata - 1st movement', url: '/beethoven/hammerklaviersonate-1-satz' },
    { title: 'Les Adieux Sonata - 1st movement', url: '/beethoven/sonate-les-adieux-1-satz' },
  ],
  Chopin: [
    { title: 'Grand Valse Brillante, Op. 18', url: '/chopin/grand-valse-brillante-in-es-dur-opus-18' },
    { title: 'Scherzo in B minor, Op. 31', url: '/chopin/scherzo-in-b-moll-opus-31' },
    { title: 'Prelude No. 15 "Raindrop"', url: '/chopin/chopin-prelude-no-15-opus-28' },
    { title: 'Prelude No. 16, Op. 28', url: '/chopin/chopin-prelude-no-16-opus-28' },
  ],
  Debussy: [
    { title: 'Clair de Lune', url: '/debussy/clair-de-lune' },
    { title: 'Doctor Gradus ad Parnassum', url: '/debussy/doctor-gradus-ad-parnassum' },
    { title: "Jimbo's Lullaby", url: '/debussy/jimbo-s-lullaby' },
    { title: 'Passepied', url: '/debussy/passepied' },
  ],
  'Jack Sparrow': [
    { title: "He's a Pirate", url: '/jack-sparrow/hes-a-pirate' },
  ],
}

const regularComposers = Object.entries(featuredStaticPieces).sort(([a], [b]) => {
  if (a === 'Jack Sparrow') return 1
  if (b === 'Jack Sparrow') return -1
  return a.localeCompare(b)
})

export const meta: MetaFunction = () => {
  return [
    { title: 'Classical Piano Music | PianoBooth' },
    {
      name: 'description',
      content:
        'Browse classical piano pieces from Bach, Beethoven, Chopin, Debussy, and more with interactive MIDI playback.',
    },
    { property: 'og:title', content: 'PianoBooth | Classical Piano Music' },
    {
      property: 'og:description',
      content: 'Browse classical piano pieces from Bach, Beethoven, Chopin, Debussy, and more.',
    },
    { property: 'og:image', content: 'https://pianobooth.com/og-images/og_image.png' },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://pianobooth.com/classical' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:image', content: 'https://pianobooth.com/og-images/og_image.png' },
  ]
}

export default function Classical() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const setMidiStore = useMidiStore((state) => state.setMidiFile)
  const navigate = useNavigate()

  const handleMidiFile = (file: File | null | undefined) => {
    const { isValid, error } = validateMidiFile(file)

    if (!isValid) {
      alert(error)
      return
    }

    setMidiStore(file)
    navigate('/play')
  }

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    handleMidiFile(event.dataTransfer.files.item(0))
  }

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
  }

  return (
    <main
      className="min-h-screen bg-white text-gray-900"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <section className="container mx-auto flex flex-col justify-start gap-8 px-6 py-8 text-left md:px-8 lg:px-10">
        <div className="flex w-full max-w-2xl flex-col items-center gap-4 self-center py-10 text-center">
          <input
            type="file"
            ref={fileInputRef}
            accept=".mid,.midi,.kar,audio/midi,audio/x-midi,application/x-midi"
            onChange={(event) => handleMidiFile(event.currentTarget.files?.item(0))}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="font-garamond text-2xl text-stone-800 transition-colors hover:text-stone-600"
          >
            Drop a MIDI file here.
          </button>
          <p className="text-base text-stone-500">
            <Link to="/browse" className="italic text-gray-600 underline hover:text-gray-700">
              Or browse.
            </Link>
          </p>
        </div>
      </section>

      <section className="container mx-auto px-6 py-12 md:px-8 lg:px-10">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
          {regularComposers.map(([composer, pieces]) => {
            const composerSlug = slugify(composer)
            const displayPieces = pieces.slice(0, 4)

            return (
              <div key={composer} className="mb-8">
                <div className="mb-6 flex flex-col md:flex-row">
                  {composerImages[composer] && (
                    <img
                      src={composerImages[composer]}
                      alt={composer}
                      className="mx-auto mb-4 h-64 w-56 flex-shrink-0 object-cover md:mx-0 md:mb-0 md:mr-6"
                    />
                  )}
                  <div className="ml-4 md:ml-0">
                    <Link to={`/artist/${composerSlug}`}>
                      <h2 className="mb-4 font-garamond text-2xl font-bold text-gray-800 underline hover:text-blue-600">
                        {composer}
                      </h2>
                    </Link>
                    <div>
                      {displayPieces.map((piece, index) => (
                        <Link
                          key={`${composer}-${index}`}
                          to={piece.url}
                          className="mb-2 block w-full text-left font-garamond text-xl text-gray-800 transition-colors hover:text-blue-600"
                        >
                          {piece.title}
                        </Link>
                      ))}
                      {composer !== 'Jack Sparrow' && (
                        <Link
                          to={`/browse#${composerSlug}`}
                          className="mt-4 inline-flex font-garamond text-base text-gray-600 underline hover:text-gray-700"
                        >
                          more...
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
