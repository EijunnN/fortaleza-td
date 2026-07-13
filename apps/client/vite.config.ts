import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    // En dev el proxy apunta al servidor Node local (:3000), necesario para
    // el sandbox y el server normal. El worker de Cloudflare es solo para
    // producción/preview (`pnpm cf:dev`).
    proxy: {
      '/ws': { target: 'ws://localhost:3000', ws: true },
      '/api': { target: 'http://localhost:3000' },
    },
  },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
});
