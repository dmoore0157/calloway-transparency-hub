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
