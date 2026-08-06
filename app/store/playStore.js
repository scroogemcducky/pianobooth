import { create } from 'zustand'

const useStore = create(set => ({
  playing: false,
  setPlaying: (value) => set({ playing: value }),
  speed: 1.0,
  setSpeed: (speed) => set({ speed }),
  particlesEnabled: true,
  setParticlesEnabled: (value) => set({ particlesEnabled: value }),
  lookahead: 2,
  setLookahead: (lookahead) => set({ lookahead }),
  // Opt-in timeline: off by default so the player stays visually clean.
  timelineVisible: false,
  setTimelineVisible: (value) => set({ timelineVisible: value }),

}))

export default useStore;
