import { defineConfig } from 'vite';
import path from 'node:path';

// Figma sandbox (main) build · single JS file · runs in Figma's plugin sandbox
// No DOM, no fetch, only figma.* API + postMessage
export default defineConfig({
  build: {
    outDir: 'build',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(__dirname, 'src/figma/main.ts'),
      formats: ['iife'],
      name: 'FigmaPlugin',
      fileName: () => 'figma.js',
    },
    rollupOptions: {
      output: { extend: true },
    },
    minify: false, // easier to debug
  },
});
