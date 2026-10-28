/// <reference types="vitest/config" />
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const clientDir = path.dirname(fileURLToPath(import.meta.url));
// One .env file at the project root configures both the server and the client.
const envDir = path.resolve(clientDir, '..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  const apiTarget = `${env.HTTPS_ENABLED === 'true' ? 'https' : 'http'}://127.0.0.1:${env.PORT || '4000'}`;

  return {
    envDir,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(clientDir, 'src') },
    },
    server: {
      host: env.CLIENT_DEV_HOST || '127.0.0.1',
      port: Number(env.CLIENT_DEV_PORT || 5173),
      strictPort: true,
      // The browser only ever talks to this dev server; API calls are forwarded
      // to the Express backend on this computer.
      proxy: {
        '/api': { target: apiTarget, changeOrigin: false, secure: false },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      // One main bundle (~250 kB gzipped) served from the local network; staff
      // pages are already split out with React.lazy.
      chunkSizeWarningLimit: 900,
    },
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  };
});
