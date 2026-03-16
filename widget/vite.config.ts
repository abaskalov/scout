import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'ScoutWidget',
      formats: ['iife'],
      fileName: () => 'scout-widget.js',
    },
    outDir: 'dist',
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
