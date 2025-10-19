// Shader implementation of PlayStandardSound
// used to be /shader

import React, { useState, useEffect, useRef } from 'react'
import type { MetaFunction } from "@remix-run/node";

import { Canvas, } from '@react-three/fiber'
import midiParser from '../utils/MidiParser'
import useKeyStore from '../store/keyPressStore'  
import useMidiStore from '../store/midiStore'
import usePlayStore from '../store/playStore'
import PlayPauseButton from '../components/PlayPauseButton'
import SettingsButton from '../components/SettingsButton'
import ShaderBlocks from '../components/ShaderBlocks'
// import Lights from '../components/Lights'
// import Camera from '../components/Camera'
import soundFont from 'soundfont-player'
import Keys from '../components/Keys'
import * as THREE from 'three'

export const meta: MetaFunction = () => {
  return [
    { title: "Piano Practice | Interactive MIDI Piano Player" },
    { name: "description", content: "Practice piano with interactive MIDI playback, visual feedback, and real-time note highlighting. Perfect for learning classical piano pieces." }
  ];
};

export default function Video()  {  
  const [midiObject, setMidiObject] = useState();
  // const [lights, setLights] = useState(true)
  const [ac, setAc] = useState(null)
  const [instrument, setInstrument] = useState(null)

  useEffect(() => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    setAc(audioContext);
  }, []);

  useEffect(() => {
    if (ac) {
        soundFont.instrument(ac, 'acoustic_grand_piano').then(function (piano) {
            setInstrument(piano);
        });
    }
  }, [ac]);

  useEffect(() => {
    return () => {
      // Reset playing state when leaving the page
      usePlayStore.getState().setPlaying(false);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        const currentPlaying = usePlayStore.getState().playing;
        usePlayStore.getState().setPlaying(!currentPlaying);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const midiFile = useMidiStore((state) => state.midiFile);

  useEffect(() => {
    const getFileAndSetPlayer = async (file) => {
      console.log('Processing file:', file);
      try {
        const result = await midiParser(file)
        console.log('Parser result:', result);
        if(result) {
            setMidiObject(result)
            // Store processed MIDI data for persistence
            localStorage.setItem('processedMidiData', JSON.stringify(result));
            // Best-effort: extract and persist basic metadata for embed route fallback
            try {
              const buf = await file.arrayBuffer();
              const { Midi } = await import('@tonejs/midi');
              const midi = new Midi(buf);
              const headerName = midi?.header?.name?.trim?.();
              const trackNames = midi.tracks.map((t) => (t.name || '').trim()).filter(Boolean);
              let title = headerName || '';
              if (!title && trackNames.length) {
                title = trackNames.reduce((a, b) => (b.length > a.length ? b : a), trackNames[0]);
              }
              let artist = '';
              const artistCandidate = trackNames.find((n) => /bach|beethoven|chopin|debussy|mozart|liszt|schubert|schumann|rachmaninoff|handel|haydn|tchaikovsky|gershwin/i.test(n));
              if (artistCandidate) artist = artistCandidate;
              else if (trackNames.length) {
                const hyphen = trackNames.find((n) => n.includes('-'));
                if (hyphen) {
                  const parts = hyphen.split('-').map((s) => s.trim());
                  if (parts.length >= 2) {
                    const [a, b] = parts;
                    if (a.length <= b.length) artist = a;
                    if (!title) title = b;
                  }
                }
              }
              localStorage.setItem('midiMeta', JSON.stringify({ title: title || 'Untitled', artist: artist || 'Piano' }));
            } catch {}
        }
      } catch (error) {
        console.error('MIDI parsing error:', error);
      }
    }

    const loadFromLocalStorage = () => {
      const storedData = localStorage.getItem('processedMidiData');
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          console.log('Loaded from localStorage:', parsedData);
          setMidiObject(parsedData);
        } catch (error) {
          console.error('Error loading from localStorage:', error);
          localStorage.removeItem('processedMidiData');
        }
      }
    }

    if (midiFile) {
        console.log('MIDI file received:', midiFile);
        getFileAndSetPlayer(midiFile)
        return
    } else {
        // Try to load from localStorage if no file in store
        loadFromLocalStorage()
    }
  }, [midiFile]);

  // TODO pass note parameters to playNote
  const playNote = (noteName, duration=4) => {
    if (instrument) {
      instrument.play(noteName, ac.currentTime, {gain: 1, duration: duration, release: 2.5, sustain: 2, delay: 2});
    }
  }

  const activeTimeouts = useRef(new Map());

  const triggerVisibleNote = (noteName, duration) => {
    // Clear any existing timeout for this note
    if (activeTimeouts.current.has(noteName)) {
      clearTimeout(activeTimeouts.current.get(noteName));
    }
    
    // Always turn key on immediately
    useKeyStore.getState().setKey(noteName, true);
    playNote(noteName);
    
    // Set new timeout and store it
    const timeoutId = setTimeout(() => {
      useKeyStore.getState().setKey(noteName, false);
      activeTimeouts.current.delete(noteName);
    }, duration);
    
    activeTimeouts.current.set(noteName, timeoutId);
  }
  
  return ( 
    <React.StrictMode >
    <div style={{height: "100%"}}>
      <Canvas 
          style={{ background: "black" }}  
          orthographic 
          camera={{ zoom: 9 }}
          gl={{ 
            toneMapping: THREE.NoToneMapping,
            outputColorSpace: THREE.LinearSRGBColorSpace 
          }}
          >
          {/* {lights ? <Lights /> :  */}
          <>
          <ambientLight intensity={7.5} /> 
          {/* <hemisphereLight 
            skyColor={0xffffbb} 
            groundColor={0x080820} 
            intensity={10} 
          /> */}
          <directionalLight 
            position={[11, -4, 90]} 
            intensity={0.15}
            // castShadow
          />
          {/* <pointLight position={[10, 10, 10]} />  */}
        </>
        {/* } */}
      
          {/* <Camera />  */}
          <Keys />  
          {midiObject && <ShaderBlocks 
            midiObject={midiObject} 
            triggerVisibleNote={triggerVisibleNote} />} 
      </Canvas>
      <PlayPauseButton />
      <SettingsButton 
        // lights={false} 
        // lightsClick={() => {setLights(prevLights => !prevLights)}}
        />
    </div>
    </React.StrictMode>
  )
}
