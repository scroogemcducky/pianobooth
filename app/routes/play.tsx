// Shader implementation of PlayStandardSound
// used to be /shader

import React, { useState, useEffect } from 'react'

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

  const midiFile = useMidiStore((state) => state.midiFile);

  useEffect(() => {
    const getFileAndSetPlayer = async (file) => {
      console.log('Processing file:', file);
      try {
        const result = await midiParser(file)
        console.log('Parser result:', result);
        if(result) {
            setMidiObject(result)
        }
      } catch (error) {
        console.error('MIDI parsing error:', error);
      }
    }

    if (midiFile) {
        console.log('MIDI file received:', midiFile);
        getFileAndSetPlayer(midiFile)
        return
    }
  }, [midiFile]);

  // TODO pass note parameters to playNote
  const playNote = (noteName, duration=4) => {
    if (instrument) {
      instrument.play(noteName, ac.currentTime, {gain: 1, duration: duration, release: 2.5, sustain: 2, delay: 2});
    }
  }

  const triggerVisibleNote = (noteName, duration) => {
    useKeyStore.getState().setKey(noteName, true);
    playNote(noteName)
    setTimeout(() => useKeyStore.getState().setKey(noteName, false), duration); 
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
      <PlayPauseButton 
        onClick={() => usePlayStore.getState().setPlaying(!playing)}
         />
      <SettingsButton 
        // lights={false} 
        // lightsClick={() => {setLights(prevLights => !prevLights)}}
        />
    </div>
    </React.StrictMode>
  )
}


