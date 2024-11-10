import { create } from 'zustand'

const useStore = create(set => ({
  midiFile: null,
  setMidiFile: (file) => set({ midiFile: file }),
}))

export default useStore;
// import { create } from 'zustand'

// const useStore = create((set) => ({
//   midiFile: null,
//   setMidiFile: (file) => {
//     console.log('Setting midi file:', file)
//     set((state) => {
//       console.log('Previous state:', state)
//       const newState = { midiFile: file }
//       console.log('New state:', newState)
//       return newState
//     })
//   },
// }))

// export default useStore