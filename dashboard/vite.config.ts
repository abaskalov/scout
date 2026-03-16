import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:10009',
      '/storage': 'http://localhost:10009',
    },
  },
  build: {
    outDir: 'dist',
  },
});
