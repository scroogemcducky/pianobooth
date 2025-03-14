// // standard/original version no sound
// // non-instanced
// import React, { useState, useEffect } from 'react'
// import { Canvas } from '@react-three/fiber'
// import midiParser from '../utils/MidiParser'
// import useKeyStore from '../store/keyPressStore'  
// import useMidiStore from '../store/midiStore'
// import LightsButton from '../components/LightsButton'
// import PlayPauseButton from '../components/PlayPauseButton'
// import MovingBlocks from '../components/MovingBlocks'
// import Lights from '../components/Lights'
// import Camera from '../components/SetupCameraOriginal'
// import Keys from '../components/Keyboard' 

// // const ac = new AudioContext()
// // let instrument;
// // soundFont.instrument(ac, 'acoustic_grand_piano').then(function (piano) {
// //       instrument = piano
// // });

// export default function Video()  {  
//   const [midiObject, setMidiObject] = useState();
//   const [playing, setPlaying] = useState(false)
//   const [lights, setLights] = useState(true)
//   const midiFile = useMidiStore((state) => state.midiFile);

//   useEffect(() => {
//     const getFileAndSetPlayer = async (file) => {
//       const result = await midiParser(file)
//       if(result) {
//           setMidiObject(result)
//       }
//     }
//     const localStorageJson = localStorage.getItem('midiFile')
//     if (midiFile) {
//         getFileAndSetPlayer(midiFile)
//         return
//     } 
//     else if (localStorageJson) {
//         const localStorageMidiFile = JSON.parse(localStorageJson)
//         getFileAndSetPlayer(localStorageMidiFile)
//     }
//   }, [midiFile]);

//   // TODO pass note parameters to playNote
// //   const playNote = (noteName, duration=4) => {
// //     if (instrument) {
// //       instrument.play(noteName, ac.currentTime, {gain:1, duration: duration, release: 2.5, sustain: 2, delay: 2});
// //     }
// //   }

//   const triggerVisibleNote = (noteName, duration) => {
//     useKeyStore.getState().setKey(noteName, true);
//     // playNote(noteName)
//     setTimeout(() => useKeyStore.getState().setKey(noteName, false), duration); 
//   }

//   return ( 
//     <React.StrictMode >
//     <div style={{height: "100%"}}>
//       <Canvas 
//           style={{ background: "black" }}  
//           orthographic 
//           camera={{zoom: 7}}  
//           >
//           {lights ? <Lights /> : <>
//               {/* eslint-disable-next-line react/no-unknown-property */}
//               <ambientLight intensity={5} />
//               eslint-disable-next-line react/no-unknown-property
//               <pointLight position={[10, 10, 10]} />
//                </>}
//           {midiObject && <MovingBlocks 
//                 playing={playing} 
//                 triggerVisibleNote={triggerVisibleNote} 
//                 midiObject={midiObject}/>}
//           <Camera /> 
//           <Keys /> 
//       </Canvas>
//       <PlayPauseButton 
//         playing={playing} 
//         onClick={ () => {setPlaying(prevPlaying => !prevPlaying)}} />
//       <LightsButton 
//         lights={lights} 
//         onClick={() => {setLights(prevLights => !prevLights)}} />
//     </div>
//     </React.StrictMode>
//   )
// }

