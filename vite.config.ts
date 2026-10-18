import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig(({ mode }) => ({
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  build: {
    ...(mode === 'android' ? { target: 'chrome107' } : {}),
    // The installed Android client has its own output. It must never replace
    // the web bundle served by Docker or load its HTML from the game server.
    outDir: mode === 'android' ? 'dist/android' : 'dist/client',
    emptyOutDir: true,
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
    chunkSizeWarningLimit: 1600,
  },
}));
