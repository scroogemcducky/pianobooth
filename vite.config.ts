import {
  vitePlugin as remix,
  cloudflareDevProxyVitePlugin as remixCloudflareDevProxy,
} from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { setupWebSocketServer } from "./server/websocket";
import { createServer as createHttpServer } from 'http';

// Global WebSocket server instance to prevent multiple servers
let globalWsServer: ReturnType<typeof createHttpServer> | null = null;

declare module "@remix-run/cloudflare" {
  interface Future {
    v3_singleFetch: true;
  }
}

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom', 'scheduler', '@remix-run/react'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  plugins: [
    remixCloudflareDevProxy(),
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    tsconfigPaths(),
    // WebSocket server plugin - attach to Vite's HTTP server
    {
      name: 'websocket-server',
      configureServer(server) {
        if (!server.httpServer) {
          console.warn('⚠️ No HTTP server available for WebSocket setup');
          return;
        }

        // Set up WebSocket on Vite's HTTP server (port 5173)
        setupWebSocketServer(server.httpServer);
        console.log('✅ WebSocket server attached to Vite dev server (ws://localhost:5173/ws/frames)');
      },
    },
    // Serve videos directory as static files
    {
      name: 'serve-videos',
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
  ],
});
