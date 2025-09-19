import { useRef, useState, useEffect} from 'react';
// import { checkExtension } from './utils/smallFunctions.ts';
import  useMidiStore  from '../store/midiStore'
import { useNavigate,  } from "@remix-run/react"; 
import { Link } from '@remix-run/react';
import type { MetaFunction } from "@remix-run/node";

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

  return (
    <main className="min-h-screen bg-stone-50 text-gray-900">
      <section className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-12 px-6 py-16 text-center">
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
