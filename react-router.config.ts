import type { Config } from "@react-router/dev/config";

// v8_viteEnvironmentApi is required by Cloudflare plugin (production only)
const isProduction = process.env.NODE_ENV === 'production';

export default {
  ssr: true,
  future: {
    v8_viteEnvironmentApi: isProduction,
    unstable_optimizeDeps: true,
  },
} satisfies Config;
