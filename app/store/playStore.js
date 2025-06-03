import { create } from 'zustand'

const useStore = create(set => ({
  playing: false,
  setPlaying: (value) => set({ playing: value }),
  speed: 1.0,
  setSpeed: (speed) => set({ speed }),

}))

export default useStore;