import React, { useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
// import React from 'react'
import midiParser from '../utils/MidiParser'
// import soundFont from 'soundfont-player'
import useKeyStore from '../store/keyPressStore'  
import useMidiStore from '../store/midiStore'
import LightsButton from '../components/LightsButton'
import PlayPauseButton from '../components/PlayPauseButton'
// import MovingBlocks from '../components/ClaudeMovingBlocks'
import ShaderBlocks from '../components/shaderBlocks'
import Lights from '../components/Lights'
import Camera from '../components/Camera'
import Keys from '../components/Keyboard' 
import { OrbitControls } from '@react-three/drei'
// const ac = new AudioContext()

// let instrument;

// soundFont.instrument(ac, 'acoustic_grand_piano').then(function (piano) {
//       instrument = piano
// });

export default function Video()  {  
  const [midiObject, setMidiObject] = useState();
  const [playing, setPlaying] = useState(false)
  const [lights, setLights] = useState(true)
  const midiFile = useMidiStore((state) => state.midiFile);

  useEffect(() => {
    const getFileAndSetPlayer = async (file) => {
      const result = await midiParser(file)
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

  // TODO pass note parameters to playNote
//   const playNote = (noteName, duration=4) => {
//     if (instrument) {
//       instrument.play(noteName, ac.currentTime, {gain:1, duration: duration, release: 2.5, sustain: 2, delay: 2});
//     }
//   }

  const triggerVisibleNote = (noteName, duration) => {
    useKeyStore.getState().setKey(noteName, true);
    // playNote(noteName)
    setTimeout(() => useKeyStore.getState().setKey(noteName, false), duration); 
  }

  return ( 
    <React.StrictMode >
    <div style={{height: "100%"}}>
      <Canvas 
          style={{ background: "black" }}  
          orthographic 
        //   camera={{zoom: 7}}  
          camera={{zoom: 5, rotation: [Math.PI/2, 0, -Math.PI/2]}}  
          >
          {/* {lights ? <Lights /> : <>

              <ambientLight intensity={5} />
              eslint-disable-next-line react/no-unknown-property
              <pointLight position={[10, 10, 10]} />
               </>} */}
               <ambientLight intensity={5} />
          {/* {midiObject && <MovingBlocks 
                playing={playing} 
                triggerVisibleNote={triggerVisibleNote} 
                midiObject={midiObject}/>} */}
          <Camera /> 
          <Keys /> 
          {/* <OrbitControls 
            enableZoom={true}
            enablePan={true}
            enableRotate={true}
            minDistance={5}
            maxDistance={100}
            // Optional: set limits on rotation/pan if needed
            // minPolarAngle={Math.PI / 4} // Limit how high you can orbit up
            // maxPolarAngle={Math.PI / 2} // Limit how low you can orbit down
            // minAzimuthAngle={-Math.PI / 4} // Limit rotation left
            // maxAzimuthAngle={Math.PI / 4} // Limit rotation right
            /> */}
        <ShaderBlocks/>
      </Canvas>
      <PlayPauseButton 
        playing={playing} 
        onClick={ () => {setPlaying(prevPlaying => !prevPlaying)}} />
      <LightsButton 
        lights={lights} 
        onClick={() => {setLights(prevLights => !prevLights)}} />
    </div>
    </React.StrictMode>
  )
}

