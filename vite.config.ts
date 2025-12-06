import {
  vitePlugin as remix,
  cloudflareDevProxyVitePlugin as remixCloudflareDevProxy,
} from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { setupWebSocketServer } from "./server/websocket";

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
    // WebSocket server plugin
    {
      name: 'websocket-server',
      configureServer(server) {
        // Wait for server to be listening before setting up WebSocket
        server.httpServer?.on('listening', () => {
          setupWebSocketServer(server.httpServer!);
          console.log('✅ WebSocket server integrated with Vite dev server');
        });
      },
    },
  ],
});
