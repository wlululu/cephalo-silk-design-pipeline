import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

// Relative output URLs let the same dist/ run at / or any repository subpath.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {alias: {'@': fileURLToPath(new URL('.', import.meta.url))}},
  server: {host: '127.0.0.1', port: 5173, strictPort: true},
  preview: {host: '127.0.0.1', port: 4173, strictPort: true},
  build: {outDir: 'dist', emptyOutDir: true},
});
