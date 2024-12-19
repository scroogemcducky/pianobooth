import { create } from 'zustand'

const useStore = create(set => ({
  playing: false,
  setPlaying: (value) => set({ playing: value })

}))

export default useStore;