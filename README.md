# Pianobooth

Running at [pianobooth.com](https://pianobooth.com)

An interactive piano visualizer and MIDI player that renders falling note animations with a 3D piano keyboard. Songs are browsable by artist, playable in the browser. 

There's a seoarate functionality to make videos as well. 

## What it does

- Browse and play MIDI songs from a catalog of artists
- 3D animated piano keys and falling note blocks 
- Automated video rendering pipeline (visual + audio muxed with FluidSynth + ffmpeg)
- Dynamic Open Graph image generation for social sharing

## Technologies

- **Framework**: Remix (React Router v7) on Cloudflare Pages
- **Frontend**: React 19, TypeScript, Tailwind CSS
- **3D Rendering**: React Three Fiber / Three.js (instanced shader-based note blocks)
- **Audio**: soundfont-player (browser), FluidSynth (server-side video rendering)
- **MIDI Processing**: @tonejs/midi
- **State**: Zustand
- **Video**: Playwright (video recording), ffmpeg 

## How to run

Install dependencies:

```bash
bun install
```

Start the development server:

```bash
bun run dev
```

Other commands:

```bash
bun run typecheck     # Type checking
bun run lint          # ESLint
bun run generate:og   # Generate Open Graph images
```

### Video recording commands

> **Note**: The following commands (`record`, `pop`, `finnish`, `theme`, etc.) require local folders and tools — MIDI source files, FluidSynth, ffmpeg, and a Playwright-compatible browser — that are not committed to the repository. They are intended for local/offline use only.
For the recording you need to have a separate server up when running these commands.

```bash
bun run record          # Record the next video in the queue
bun run record:mobile   # Record mobile-format video
bun run record:full     # Record a full set
bun run pop             # Record pop category videos
bun run finnish         # Record Finnish category videos
bun run theme           # Record theme category videos
```


