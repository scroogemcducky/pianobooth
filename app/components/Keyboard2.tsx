// // TODO make keyboard component
// import { C, C_Sharp, D, D_Sharp, E, F, F_Sharp, G, G_Sharp, A, A_Sharp, B } from './Key'
// import { white_size_vector,  positions } from '../utils/constants'
// import { useThree } from '@react-three/fiber';

// const Keys = () => {
//     const {viewport} = useThree()
//     const offset = viewport.height/2
//     return (
//       <group position={[offset, 0, 0]}>
//         <C pitch={"C"} octave={1} noteNumber={24} pos={positions[24]} />
//         <C_Sharp pitch={"C#"} octave={1}  noteNumber={25} pos={positions[25]} />
//         <D pitch={"D"} octave={1} noteNumber={26} pos={positions[26]} />
//         <D_Sharp pitch={"D#"} octave={1} noteNumber={27} pos={positions[27]} />
//         <E pitch={"E"} octave={1} noteNumber={28} pos={positions[28]} />
//         <F pitch={"F"} octave={1} noteNumber={29} pos={positions[29]} />
//         <F_Sharp pitch={"F#"} octave={1} noteNumber={30} pos={positions[30]} />
//         <G pitch={"G"} octave={1} noteNumber={31} pos={positions[31]}  />
//         <G_Sharp pitch={"G#"} octave={1} noteNumber={32} pos={positions[32]} />
//         <A pitch={"A"} octave={1} noteNumber={33} pos={positions[33]} />
//         <A_Sharp pitch={"A#"} octave={1} noteNumber={34} pos={positions[34]} />
//         <B pitch={"B"} octave={1} noteNumber={35} pos={positions[35]} />
  
//         <C pitch={"C"} octave={1} noteNumber={36} pos={positions[36]} />
//         <C_Sharp pitch={"C#"} octave={1}  noteNumber={37} pos={positions[37]} />
//         <D pitch={"D"} octave={1} noteNumber={38} pos={positions[38]} />
//         <D_Sharp pitch={"D#"} octave={1} noteNumber={39} pos={positions[39]}  />
//         <E pitch={"E"} octave={1} noteNumber={40}  pos={positions[40]}/>
//         <F pitch={"F"} octave={1} noteNumber={41} pos={positions[41]}/>
//         <F_Sharp pitch={"F#"} octave={1} noteNumber={42} pos={positions[42]}/>
//         <G pitch={"G"} octave={1} noteNumber={43} pos={positions[43]}/>
//         <G_Sharp pitch={"G#"} octave={1} noteNumber={44} pos={positions[44]}/>
//         <A pitch={"A"} octave={1} noteNumber={45} pos={positions[45]}/>
//         <A_Sharp pitch={"A#"} octave={1} noteNumber={46} pos={positions[46]}/>
//         <B pitch={"B"} octave={1} noteNumber={47} pos={positions[47]} />
  
//         <C pitch={"C"} octave={2} noteNumber={48} pos={positions[48]}/>
//         <C_Sharp pitch={"C#"} octave={2} noteNumber={49} pos={positions[49]}/>
//         <D pitch={"D"} octave={2} noteNumber={50} pos={positions[50]}/>
//         <D_Sharp pitch={"D#"} octave={2} noteNumber={51} pos={positions[51]}/>
//         <E pitch={"E"} octave={2} noteNumber={52} pos={positions[52]}/>
//         <F pitch={"F"} octave={2} noteNumber={53} pos={positions[53]}/>
//         <F_Sharp pitch={"F#"} octave={2} noteNumber={54} pos={positions[54]} />
//         <G pitch={"G"} octave={2} noteNumber={55} pos={positions[55]}/>
//         <G_Sharp pitch={"G#"} octave={2} noteNumber={56} pos={positions[56]} />
//         <A pitch={"A"} octave={2} noteNumber={57} pos={positions[57]} />
//         <A_Sharp pitch={"A#"} octave={2} noteNumber={58} pos={positions[58]} />
//         <B pitch={"B"} octave={2} noteNumber={59} pos={positions[59]} />
  
//         <C pitch={"C"} octave={3} noteNumber={60} pos={positions[60]} />
//         <C_Sharp pitch={"C#"} octave={3} noteNumber={61} pos={positions[61]} />
//         <D pitch={"D"} octave={3} noteNumber={62} pos={positions[62]} />
//         <D_Sharp pitch={"D#"} octave={3} noteNumber={63} pos={positions[63]} />
//         <E pitch={"E"} octave={3} noteNumber={64} pos={positions[64]} />
//         <F pitch={"F"} octave={3} noteNumber={65} pos={positions[65]} />
//         <F_Sharp pitch={"F#"} octave={3} noteNumber={66} pos={positions[66]} />
//         <G pitch={"G"} octave={3} noteNumber={67} pos={positions[67]} />
//         <G_Sharp pitch={"G#"} octave={3} noteNumber={68} pos={positions[68]} />
//         <A pitch={"A"} octave={3} noteNumber={69} pos={positions[69]} />
//         <A_Sharp pitch={"A#"} octave={3} noteNumber={70} pos={positions[70]} />
//         <B pitch={"B"} octave={3} noteNumber={71} pos={positions[71]} />
  
//         <C pitch={"C"} octave={4} noteNumber={72} pos={positions[72]} />
//         <C_Sharp pitch={"C#"} octave={4} noteNumber={73} pos={positions[73]} />
//         <D pitch={"D"} octave={4} noteNumber={74} pos={positions[74]} />
//         <D_Sharp pitch={"D#"} octave={4} noteNumber={75} pos={positions[75]} />
//         <E pitch={"E"} octave={4} noteNumber={76} pos={positions[76]} />
//         <F pitch={"F"} octave={4} noteNumber={77} pos={positions[77]} />
//         <F_Sharp pitch={"F#"} octave={4} noteNumber={78} pos={positions[78]} />
//         <G pitch={"G"} octave={4} noteNumber={79} pos={positions[79]} />
//         <G_Sharp pitch={"G#"} octave={4} noteNumber={80} pos={positions[80]} />
//         <A pitch={"A"} octave={4} noteNumber={81} pos={positions[81]} />
//         <A_Sharp pitch={"A#"} octave={4} noteNumber={82} pos={positions[82]} />
//         <B pitch={"B"} octave={4} noteNumber={83} pos={positions[83]} /> 
  
//         <C pitch={"C"} octave={5} noteNumber={84} pos={positions[84]} />
//         <C_Sharp pitch={"C#"} octave={5} noteNumber={85} pos={positions[85]} />
//         <D pitch={"D"} octave={5} noteNumber={86} pos={positions[86]} />
//         <D_Sharp pitch={"D#"} octave={5} noteNumber={87} pos={positions[87]} />
//         <E pitch={"E"} octave={5} noteNumber={88} pos={positions[88]} />
//         <F pitch={"F"} octave={5} noteNumber={89} pos={positions[89]} />
//         <F_Sharp pitch={"F#"} octave={5} noteNumber={90} pos={positions[90]} />
//         <G pitch={"G"} octave={5} noteNumber={91} pos={positions[91]} />
//         <G_Sharp pitch={"G#"} octave={5} noteNumber={92} pos={positions[92]} />
//         <A pitch={"A"} octave={5} noteNumber={93} pos={positions[93]} />
//         <A_Sharp pitch={"A#"} octave={5} noteNumber={94} pos={positions[94]} />
//         <B pitch={"B"} octave={5} noteNumber={95} pos={positions[95]} />
  
//         <C pitch={"C"} octave={6} noteNumber={96} pos={positions[96]} />
//         <C_Sharp pitch={"C#"} octave={6} noteNumber={97} pos={positions[97]} />
//         <D pitch={"D"} octave={6} noteNumber={98} pos={positions[98]} />
//         <D_Sharp pitch={"D#"} octave={6} noteNumber={99} pos={positions[99]} />
//         <E pitch={"E"} octave={6} noteNumber={100} pos={positions[100]} />
//         <F pitch={"F"} octave={6} noteNumber={101} pos={positions[101]} />
//         <F_Sharp pitch={"F#"} octave={6} noteNumber={102} pos={positions[102]} />
//         <G pitch={"G"} octave={6} noteNumber={103} pos={positions[103]} />
//         <G_Sharp pitch={"G#"} octave={6} noteNumber={104} pos={positions[104]} />
//         <A pitch={"A"} octave={6} noteNumber={105} pos={positions[105]} />
//         <A_Sharp pitch={"A#"} octave={6} noteNumber={106} pos={positions[106]} />
//         <B pitch={"B"} octave={6} noteNumber={107} pos={positions[107]} />
  
//         <Cover />
//       </group>
//     )
//   }
  
//   const Cover = () => (
//     <mesh position={ [-45, 0, 0]} rotation={[-Math.PI/2, 0, -Math.PI/2]}>
//       <planeGeometry args={[200, 90]} />
//       <meshBasicMaterial color={"black"} />
//     </mesh>
//   )

//   export default Keys;