import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const frontendDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  const apiTarget = process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:3000';
  return {
    root: frontendDir,
    publicDir: path.resolve(frontendDir, 'public'),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(frontendDir, 'src'),
      },
    },
    build: {
      outDir: path.resolve(frontendDir, '../dist'),
      emptyOutDir: true,
    },
    server: {
      port: Number(process.env.FRONTEND_PORT) || 5173,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/src/assets/images': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
