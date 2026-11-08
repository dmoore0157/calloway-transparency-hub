import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';

// GitHub Pages project site lives under /calloway-transparency-hub/ unless a custom domain (public/CNAME) is set.
const base = process.env.VITE_BASE ?? (fs.existsSync('public/CNAME') ? '/' : '/calloway-transparency-hub/');

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      // app.html is the Vite entry; the repo-root index.html is the legacy site, kept so branch-mode Pages keeps working until
      // the Pages source is switched to GitHub Actions. scripts/prerender.mjs renames the built app.html to index.html.
      input: 'app.html',
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          map: ['maplibre-gl'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
