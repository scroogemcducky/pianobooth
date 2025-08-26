import { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { createClient } from "~/utils/supabase.server";
import useMidiStore from '../store/midiStore';
// import process from 'process'

export async function loader({ request, context }: LoaderFunctionArgs) {
  // Access env variables from context.cloudflare.env
  const supabaseUrl = context.cloudflare.env.SUPABASE_URL;
  const supabaseKey = context.cloudflare.env.SUPABASE_KEY;
  
  
  const supabase = createClient(request, { 
    SUPABASE_URL: supabaseUrl, 
    SUPABASE_ANON_KEY: supabaseKey 
  });
  
  try {
    const { data: todos } = await supabase.from('Midi').select();
    console.log("todos: ", todos)

    return { todos };
  } catch (error) {
    console.error('Error fetching todos:', error);
    throw error;
  }
}

export const meta: MetaFunction = () => {
  return [
    { title: "Browse Classical Piano Music | Piano Learning App" },
    { name: "description", content: "Browse and discover classical piano pieces from Bach, Beethoven, Chopin, Debussy, and more. Interactive piano learning with MIDI playback." }
  ];
};

export default function Index() {
  const { todos } = useLoaderData<typeof loader>();
  const setMidiStore = useMidiStore((state) => state.setMidiFile);

  const handleSongClick = (midiData: string) => {
    try {
      // Clear any existing MIDI data
      localStorage.removeItem('processedMidiData');
      
      // The data is in data URL format: "data:audio/midi;base64,ABC123..."
      // Extract just the base64 part after the comma
      const base64Data = midiData.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid data URL format');
      }
      
      // Decode base64 data and create a File object
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: 'audio/midi' });
      const file = new File([blob], 'catalog-song.mid', { type: 'audio/midi' });
      
      // Update the midi store with the new file
      setMidiStore(file);
    } catch (error) {
      console.error('Error processing catalog MIDI data:', error);
      alert('Error loading the selected song. Please try again.');
    }
  };

  // Group pieces by composer
  const groupedByComposer = todos?.reduce((acc, todo) => {
    const composer = todo.Artist;
    if (!acc[composer]) {
      acc[composer] = [];
    }
    acc[composer].push(todo);
    return acc;
  }, {} as Record<string, typeof todos>);

  // Composer images mapping
  const composerImages = {
    'Bach': '/images/Bach2.png',
    'Beethoven': '/images/Beethoven4.png',
    'Chopin': '/images/Chopin3.png',
    'Debussy': '/images/Debussy3.png',
    'Pirate': '/images/Sparrow3.png'
  };

  // Include all composers in regular layout, with Pirate (Sparrow) last
  const regularComposers = Object.entries(groupedByComposer || {}).sort(([a], [b]) => {
    if (a === 'Pirate') return 1;
    if (b === 'Pirate') return -1;
    return a.localeCompare(b);
  });

  return (
    <div>
      <div className="container mx-auto px-4 py-8 min-h-screen">
        <div className="mb-16"></div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 h-full">
          {regularComposers.map(([composer, pieces]) => (
            <div key={composer} className="mb-24">
              {/* Composer Header */}
              <div className="flex flex-col md:flex-row mb-6">
                {composerImages[composer] && (
                  <img 
                    src={composerImages[composer]} 
                    alt={composer}
                    className="w-56 h-64 object-cover mb-4 md:mb-0 md:mr-6 flex-shrink-0 mx-auto md:mx-0"
                  />
                )}
                <div className="ml-4 md:ml-0">
                  <h2 className="text-2xl font-bold font-garamond text-gray-800 mb-4 underline">{composer === 'Pirate' ? 'Jack Sparrow' : composer}</h2>
                  
                  {/* Pieces List */}
                  <div>
                    {pieces.map((piece) => (
                      <Link 
                        key={piece.id}
                        to="/play" 
                        onClick={() => handleSongClick(piece.Data)}
                        className="block mb-2 text-xl font-garamond text-gray-800 hover:text-blue-600 transition-colors"
                      >
                        {composer === 'Pirate' ? 'Arrr' : (piece.Album ? `${piece.Album} - ${piece.Song}` : piece.Song)}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Copyright Section */}
      <div className="mt-16 pt-8 border-t border-black">
        <div className="text-center text-sm font-garamond text-gray-700 leading-relaxed">
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
      </div>
    </div>
  );
}