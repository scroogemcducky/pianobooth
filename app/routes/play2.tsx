import React, { useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import midiParser from '../utils/MidiParser'
import useKeyStore from '../store/keyPressStore'  
import useMidiStore from '../store/midiStore'
import LightsButton from '../components/LightsButton'
import PlayPauseButton from '../components/PlayPauseButton'
import Lights from '../components/Lights'
import Camera from '../components/Camera'
import Keys from '../components/Keyboard2' 
import CanvasMovingBlocks from '../components/CanvasMovingBlocks';

interface MidiData {
  NoteNumber: number;
  Duration: number;
  Delta: number;
  SoundDuration: number;
}

export default function Video() {
  const [midiObject, setMidiObject] = useState<MidiData[]>();
  const [playing, setPlaying] = useState(false)
  const [lights, setLights] = useState(true)
  const midiFile = useMidiStore((state) => state.midiFile);

  useEffect(() => {
    const getFileAndSetPlayer = async (file: File | Blob) => {
      const result = await midiParser(file)
      console.log("result is: ", result)
      if(result) {
          setMidiObject(result)
      }
    }
    const localStorageJson = localStorage.getItem('midiFile')
    if (midiFile) {
        getFileAndSetPlayer(midiFile)
        return
    } 
    else if (localStorageJson) {
        const localStorageMidiFile = JSON.parse(localStorageJson)
        getFileAndSetPlayer(localStorageMidiFile)
    }
  }, [midiFile]);

  const triggerVisibleNote = (noteNumber: number, duration: number) => {
    // const noteName = noteNumberToName(noteNumber);
    useKeyStore.getState().setKey(noteNumber, true);
    setTimeout(() => {
      useKeyStore.getState().setKey(noteNumber, false)
    }, duration); 
  }

  

  function noteNumberToName(noteNumber: number): string {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor((noteNumber - 12) / 12);
    const noteIndex = noteNumber % 12;
    const noteName = notes[noteIndex];
    return `${noteName}${octave}`;
  }

  return ( 
    <React.StrictMode >
    <div style={{height: "100%"}}>
      <canvas
        id="2d-canvas"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%", 
          height: "80%",
          pointerEvents: "none",
          zIndex: 1,
          backgroundColor: "#333333"
        }}
      />
      {midiObject && <CanvasMovingBlocks 
        playing={playing}
        triggerVisibleNote={triggerVisibleNote}
        midiObject={midiObject}
      />}
      <Canvas 
          style={{ background: "black", height: "20%", position: "absolute", bottom: 0, width: "100%" }}  
          orthographic 
          camera={{zoom: 7}}  
      >
          {lights ? <Lights /> : <>
              {/* eslint-disable-next-line react/no-unknown-property */}
              <ambientLight intensity={5} />
              {/* eslint-disable-next-line react/no-unknown-property */}
              <pointLight position={[10, 10, 10]} />
          </>}
          <Camera /> 
          <Keys /> 
      </Canvas>
      <PlayPauseButton 
        playing={playing} 
        onClick={() => setPlaying(prevPlaying => !prevPlaying)} />
      <LightsButton 
        lights={lights} 
        onClick={() => setLights(prevLights => !prevLights)} />
    </div>
    </React.StrictMode>
  )
}

