import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';

// UI iframe build · single HTML file with inline JS + CSS
// Figma plugin ui MUST be a single html file with no external resource refs
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  root: 'src/ui',
  build: {
    outDir: path.resolve(__dirname, 'build'),
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/ui/index.html'),
      output: { entryFileNames: 'ui.js' },
    },
    // singlefile plugin inlines everything · rename final html
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
  },
});
