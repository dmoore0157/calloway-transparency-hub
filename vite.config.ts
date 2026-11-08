import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';

// GitHub Pages project site lives under /calloway-transparency-hub/ unless a custom domain (public/CNAME) is set.
// An empty VITE_BASE (unset repository variable in CI) must mean "default", not "relative paths".
const base = process.env.VITE_BASE || (fs.existsSync('public/CNAME') ? '/' : '/calloway-transparency-hub/');

// Each build gets an id. It is compiled into the app and written to dist/version.json, so a tab left open across
// a deploy can notice the newer build and reload itself (src/lib/version.ts).
const buildId = Date.now().toString(36);

export default defineConfig({
  base,
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [react(), { name: 'hub-version-file', closeBundle() { fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/version.json', JSON.stringify({ id: buildId, built: new Date().toISOString() })); } }],
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
