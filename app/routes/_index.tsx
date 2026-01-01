import { useRef, useState, useEffect} from 'react';
import { Link, useNavigate } from "@remix-run/react"; 
import  useMidiStore  from '../store/midiStore'
import type { MetaFunction } from "@remix-run/node";
import { slugify } from "~/utils/slugify";

export const meta: MetaFunction = () => {
  return [
    { title: "Piano Learning App | Interactive MIDI Piano Practice" },
    { name: "description", content: "Learn piano with interactive MIDI playback. Upload your MIDI files or browse classical pieces from Bach, Beethoven, Chopin, and more." }
  ];
};

const App = () => {
  const [isClient, setIsClient] = useState(false);
  const [file, setFile] = useState(null);
  const MidiFileRef = useRef<HTMLInputElement>(null)
  const setMidiStore = useMidiStore((state) => state.setMidiFile)
  const navigate = useNavigate();

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null; // or a loading state
  }
  const handleFileInput = async () => {
    if (typeof window === 'undefined') return;
    const selectedFile = MidiFileRef.current.files[0];
    const {isValid, error} = validateMidiFile(selectedFile)
    if(isValid){
      try {
        setMidiStore(selectedFile); // Store File object directly
        navigate("/play")
      } 
      catch (error) {
        alert('Error processing the MIDI file. Please try again.');
      }
    }
  };


  const handleDrop = (event) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      setFile(files[0]);
      MidiFileRef.current.files = files;
      handleFileInput();
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  // Composer images mapping
  const composerImages: Record<string, string> = {
    'Albeniz': '/images/Albeniz3.jpg',
    "Albéniz": '/images/Albeniz3.jpg',
    'Bach': '/images/Bach2.jpg',
    'Balakirev': '/images/Balakirev3.jpg',
    'Haydn': '/images/Haydn5.jpg',
    'Beethoven': '/images/Beethoven5.jpg',
    'Borodin': '/images/Borodin1.jpg',
    'Brahms': '/images/Brahms1.jpg',
    'Burgmüller': '/images/Burgmuller4.jpg',
    'Clementi': '/images/Clementi1.jpg',
    'Chopin': '/images/Chopin3.jpg',
    'Liszt': '/images/Liszt3.jpg',
    'Mendelssohn': '/images/Mendelssohn4.jpg',
    'Mozart': '/images/Mozart1.jpg',
    'Mussorgsky': '/images/Mussorgsky1.jpg',
    'Rachmaninoff': '/images/Rachmaninoff2.jpg',
    'Ravel': '/images/Ravel4.jpg',
    'Schubert': '/images/Schubert4.jpg',
    'Schumann': '/images/Schumann6.jpg',
    'Tchaikovsky': '/images/Tchaikovsky5.jpg',
    'Christmas': '/images/Santa4.jpg',
    'Debussy': '/images/Debussy3.jpg',
    'Godowsky': '/images/Godowsky4.jpg',
    'Granados': '/images/Granados4.jpg',
    'Grieg': '/images/Grieg3.jpg',
    'Jack Sparrow': '/images/Sparrow3.jpg'
  };

  const featuredStaticPieces: Record<string, { title: string; url: string }[]> = {
    Bach: [
      { title: 'Prelude & Fugue No. 1 in C major, BWV 846', url: '/bach/prelude-and-fugue-in-c-major-bwv-846' },
      { title: 'Prelude & Fugue No. 2 in C minor, BWV 847', url: '/bach/prelude-and-fugue-in-c-minor-bwv-847' },
      { title: 'Prelude & Fugue in D major, BWV 850', url: '/bach/pr-ludium-und-fuge-in-d-dur-bwv-850' },
    ],
    Beethoven: [
      { title: 'Piano Sonata No. 23 "Appassionata" I', url: '/beethoven/piano-sonata-no-23-op-57-in-f-minor-i' },
      { title: 'Appassionata', url: '/beethoven/appassionata' },
      { title: 'Hammerklavier Sonata – 1st movement', url: '/beethoven/hammerklaviersonate-1-satz' },
      { title: 'Les Adieux Sonata – 1st movement', url: '/beethoven/sonate-les-adieux-1-satz' },
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

  // Get composers from featuredStaticPieces, with Jack Sparrow last
  const regularComposers = Object.entries(featuredStaticPieces).sort(([a], [b]) => {
    if (a === 'Jack Sparrow') return 1;
    if (b === 'Jack Sparrow') return -1;
    return a.localeCompare(b);
  });

  return (
    <main
      className="min-h-screen bg-white text-gray-900"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <section className="container mx-auto flex flex-col justify-start gap-8 px-6 md:px-8 lg:px-10 py-8 text-left">
        {/* <div className="flex flex-col gap-6 md:pl-[15.5rem]">
          <h1 className="font-garamond text-4xl font-semibold leading-tight text-stone-900">
            Midi piano learning software designed to guide every practice session.
          </h1>
          <p className="text-lg text-stone-600">
            Upload any MIDI arrangement, slow the tempo when technique needs attention, and loop the spots that demand repetition.
            Browse a curated mix of classical repertoire and modern grooves, then follow an interactive keyboard that highlights each note you play.
          </p>
        </div> */}

        <div className="self-center flex w-full max-w-2xl flex-col items-center gap-4 text-center py-10">
          <input type="file" ref={MidiFileRef} onChange={handleFileInput} className="hidden" />
          <p className="font-garamond text-2xl text-stone-800">Drop a MIDI file here.</p>
          <p className="text-base text-stone-500">
            <Link to="/browse" className="italic text-stone-700 underline">
              Or browse.
            </Link>
          </p>
        </div>
      </section>

      {/* Artists/Composers from Browse */}
      <section className="container mx-auto px-6 md:px-8 lg:px-10 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {regularComposers.map(([composer, pieces]) => {
            const composerSlug = slugify(composer);
            const displayPieces = pieces.slice(0, 4);
            
            return (
              <div key={composer} className="mb-8">
                <div className="flex flex-col md:flex-row mb-6">
                  {composerImages[composer] && (
                    <img
                      src={composerImages[composer]}
                      alt={composer}
                      className="w-56 h-64 object-cover mb-4 md:mb-0 md:mr-6 flex-shrink-0 mx-auto md:mx-0"
                    />
                  )}
                  <div className="ml-4 md:ml-0">
                    <h2 className="text-2xl font-bold font-garamond text-gray-800 mb-4 underline">
                      {composer}
                    </h2>
                    <div>
                      {displayPieces.map((piece, index) => (
                        <Link
                          key={`${composer}-${index}`}
                          to={piece.url}
                          className="block text-left w-full mb-2 text-xl font-garamond text-gray-800 hover:text-blue-600 transition-colors"
                        >
                          {piece.title}
                        </Link>
                      ))}
                      <Link
                        to={`/browse#${composerSlug}`}
                        className="mt-4 inline-flex text-base font-garamond text-gray-400 underline hover:text-gray-600"
                      >
                        more…
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

    </main>
  );
}

export const validateMidiFile = (file) => {
  // console.log("Getting called")
  // Early return if no file provided
  if (!file) {
    // console.log("File from validation: ", file)
    return { isValid: false, error: 'No file provided' };
  }

  // Check if it's a File object
  if (!(file instanceof File)) {
    return { isValid: false, error: 'Invalid file object' };
  }

  // Array of accepted MIDI extensions
  const validMidiExtensions = ['.mid', '.midi', '.kar'];
  
  // Get the file extension
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  
  // Check file extension
  const isValidExtension = validMidiExtensions.includes(extension);
  
  // Check MIME type (note: some browsers might return 'application/octet-stream')
  const isValidMimeType = [
    'audio/midi',
    'audio/x-midi',
    'application/x-midi',
    'application/octet-stream'
  ].includes(file.type);

  if (!isValidExtension) {
    return { 
      isValid: false, 
      error: `Invalid file extension. Expected: ${validMidiExtensions.join(', ')}` 
    };
  }

  if (!isValidMimeType) {
    console.warn('Warning: MIME type check failed, but file extension is valid');
  }

  return { isValid: true, error: null };
};
export default App;
