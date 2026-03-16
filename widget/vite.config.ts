import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'public',
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'ScoutWidget',
      formats: ['iife'],
      fileName: () => 'scout-widget.js',
    },
    outDir: 'dist',
    copyPublicDir: true,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
