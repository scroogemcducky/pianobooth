import { useRef, useState, useEffect} from 'react';
import { Link, useLoaderData, useNavigate } from "@remix-run/react"; 
import  useMidiStore  from '../store/midiStore'
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { createClient } from "~/utils/supabase.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Piano Learning App | Interactive MIDI Piano Practice" },
    { name: "description", content: "Learn piano with interactive MIDI playback. Upload your MIDI files or browse classical pieces from Bach, Beethoven, Chopin, and more." }
  ];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  try {
    const supabaseUrl = (context as any)?.cloudflare?.env?.SUPABASE_URL;
    const supabaseKey = (context as any)?.cloudflare?.env?.SUPABASE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return { todos: [] };
    }
    const supabase = createClient(request, { SUPABASE_URL: supabaseUrl, SUPABASE_ANON_KEY: supabaseKey });
    const { data: todos } = await (supabase as any).from('Midi').select();
    return { todos: todos ?? [] };
  } catch (error) {
    console.error('Error loading MIDI catalog:', error);
    return { todos: [] };
  }
}

const App = () => {
  const { todos } = useLoaderData<typeof loader>() as { todos: any[] };
  const [isClient, setIsClient] = useState(false);
  const [file, setFile] = useState(null);
  const MidiFileRef = useRef<HTMLInputElement>(null)
  // const navigate = useNavigate(); // Create navigate function using the useNavigate hook
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

  // Group pieces by composer
  const groupedByComposer = (todos || []).reduce((acc: Record<string, any[]>, todo: any) => {
    const composer = todo.Artist;
    if (!acc[composer]) acc[composer] = [];
    acc[composer].push(todo);
    return acc;
  }, {} as Record<string, any[]>);

  // Composer images mapping
  const composerImages: Record<string, string> = {
    'Bach': '/images/Bach2.jpg',
    'Beethoven': '/images/Beethoven4.jpg',
    'Chopin': '/images/Chopin3.jpg',
    'Debussy': '/images/Debussy3.jpg',
    'Pirate': '/images/Sparrow3.jpg'
  };

  // Include all composers in regular layout, with Pirate (Sparrow) last
  const regularComposers = Object.entries(groupedByComposer).sort(([a], [b]) => {
    if (a === 'Pirate') return 1;
    if (b === 'Pirate') return -1;
    return a.localeCompare(b);
  });

  const handleSongClick = (midiData: string) => {
    try {
      localStorage.removeItem('processedMidiData');
      const base64Data = midiData.split(',')[1];
      if (!base64Data) throw new Error('Invalid data URL format');
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/midi' });
      const file = new File([blob], 'catalog-song.mid', { type: 'audio/midi' });
      setMidiStore(file);
      navigate('/play');
    } catch (error) {
      console.error('Error processing catalog MIDI data:', error);
      alert('Error loading the selected song. Please try again.');
    }
  };

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <section className="mx-auto flex max-w-4xl flex-col items-center justify-start gap-8 px-6 py-8 text-center">
        <div className="flex flex-col gap-6">
          <h1 className="font-garamond text-4xl font-semibold leading-tight text-stone-900">
            Midi piano learning software designed to guide every practice session.
          </h1>
          <p className="text-lg text-stone-600">
            Upload any MIDI arrangement, slow the tempo when technique needs attention, and loop the spots that demand repetition.
            Browse a curated mix of classical repertoire and modern grooves, then follow an interactive keyboard that highlights each note you play.
          </p>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-stone-300 bg-white/80 p-10 shadow-sm transition hover:border-stone-500 focus-within:border-stone-500"
        >
          <input type="file" ref={MidiFileRef} onChange={handleFileInput} className="hidden" />
          <p className="font-garamond text-2xl text-stone-800">Drop a MIDI file to launch the session.</p>
          <p className="text-base text-stone-500">
            Testing the waters? <Link to="/browse" className="italic text-stone-700 underline">Start with the library.</Link>
          </p>
        </div>
      </section>

      {/* Artists/Composers from Browse */}
      <section className="container mx-auto px-6 md:px-8 lg:px-10 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {regularComposers.map(([composer, pieces]) => (
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
                    {composer === 'Pirate' ? 'Jack Sparrow' : composer}
                  </h2>
                  <div>
                    {pieces.map((piece: any) => (
                      <button
                        key={piece.id}
                        onClick={() => handleSongClick(piece.Data)}
                        className="block text-left w-full mb-2 text-xl font-garamond text-gray-800 hover:text-blue-600 transition-colors"
                      >
                        {composer === 'Pirate' ? 'Arrr' : (piece.Album ? `${piece.Album} - ${piece.Song}` : piece.Song)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Copyright Section from Browse */}
      <footer className="mt-16 pt-8 border-t border-black">
        <div className="text-center text-sm font-garamond text-gray-700 leading-relaxed px-4">
          <p className="mb-2">
            The MIDI files of Bernd Krueger are licensed under the cc-by-sa Germany License.
          </p>
          <p className="mb-2">
            This means, that you can use and adapt the files, as long as you attribute to the copyright holder
          </p>
          <p className="mb-2">
            <strong>Name:</strong> Bernd Krueger<br />
            <strong>Source:</strong> <a href="http://www.piano-midi.de" className="text-blue-600 hover:underline">http://www.piano-midi.de</a>
          </p>
          <p className="mb-2">
            The distribution or public playback of the files is only allowed under identical license conditions.
          </p>
          <p>
            The scores are open source.
          </p>
        </div>
      </footer>
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
