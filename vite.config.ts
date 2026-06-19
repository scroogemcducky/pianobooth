import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Only use Cloudflare plugin for production builds
const isProduction = process.env.NODE_ENV === 'production';

// Custom plugins for dev server only (Node.js environment)
function devServerPlugins(): Plugin[] {
  return [
    // WebSocket server plugin - attach to Vite's HTTP server
    {
      name: 'websocket-server',
      apply: 'serve',
      async configureServer(server) {
        if (!server.httpServer) {
          console.warn('⚠️ No HTTP server available for WebSocket setup');
          return;
        }

        const { setupWebSocketServer } = await import('./server/websocket');
        setupWebSocketServer(server.httpServer);
        console.log('✅ WebSocket server attached to Vite dev server (ws://localhost:5173/ws/frames)');
      },
    },
    // Serve videos directory as static files
    {
      name: 'serve-videos',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use('/videos', async (req, res, next) => {
          const fs = await import('fs')
          const path = await import('path')
          const url = new URL(req.url || '', 'http://localhost')
          const filePath = path.join(process.cwd(), 'videos', url.pathname)

          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            res.setHeader('Content-Type', 'video/mp4')
            res.setHeader('Accept-Ranges', 'bytes')
            fs.createReadStream(filePath).pipe(res)
          } else {
            next()
          }
        })
      },
    },
    // Serve local-only recording thumbnail assets.
    {
      name: 'serve-recording-thumbnail-assets',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use('/recording-assets/thumbnail_images', async (req, res, next) => {
          const fs = await import('fs')
          const path = await import('path')
          const url = new URL(req.url || '', 'http://localhost')
          const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '')
          const baseDir = path.resolve(process.cwd(), 'recording', 'thumbnail_images')
          const filePath = path.resolve(baseDir, relativePath)

          if (filePath !== baseDir && !filePath.startsWith(baseDir + path.sep)) {
            next()
            return
          }

          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase()
            const contentTypes: Record<string, string> = {
              '.json': 'application/json',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.webp': 'image/webp',
            }
            res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream')
            fs.createReadStream(filePath).pipe(res)
          } else {
            next()
          }
        })
      },
    },
  ];
}

export default defineConfig({
  server: {
    watch: {
      ignored: [
        '**/agent/**',
        '**/logs/**',
        '**/tmp/**',
        '**/temp_audio/**',
        '**/temp_frames/**',
        '**/recording/thumbnail_images/**',
        '**/videos/**',
        '**/pop/**',
        '**/finnish/**',
        '**/theme/**',
        '**/non_finnish/**',
        '**/midi/**',
      ],
    },
  },
  plugins: [
    // Only use Cloudflare plugin in production to avoid miniflare conflicts with Node.js deps
    ...(isProduction ? [cloudflare({ viteEnvironment: { name: "ssr" } })] : []),
    reactRouter(),
    tsconfigPaths(),
    ...devServerPlugins(),
  ],
});
