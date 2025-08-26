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
    <div onDrop={handleDrop} onDragOver={handleDragOver} style={{ width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px dashed #ccc' }}>
      <input type="file" ref={MidiFileRef} onChange={handleFileInput} style={{ display: 'none' }} />
      <div className="text-center text-2xl text-gray-800">
        <h1 className='font-garamond'>Drop a MIDI file here</h1>
        <br />
        <h2 className='font-garamond'>Or <Link to="/browse" className='italic underline'>browse..</Link></h2>
      </div>
    </div>
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