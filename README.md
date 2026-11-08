# Calloway County Transparency Hub

An independent, nonpartisan public-records site for Calloway County, Kentucky: where county money comes from and
where it goes, how the Fiscal Court votes, what officials promised, and a public road-request tracker.
Every figure links to a public record. Not affiliated with Calloway County government or any candidate.

**Live site:** https://dmoore0157.github.io/calloway-transparency-hub/ (GitHub Pages, deployed by `.github/workflows/deploy.yml`)

## How it is built

| Layer | What | Where |
|---|---|---|
| Site | Vite + React + TypeScript, prerendered to one HTML file per route, served by GitHub Pages | `src/`, `scripts/prerender.mjs` |
| Data | Budgets, meetings, motions, votes, grants, debt, ordinances, glossary as JSON (public, CC BY 4.0) | `data/` |
| Backend | Supabase project `calloway-transparency-hub`: Postgres + PostGIS, Row Level Security, Storage, Edge Functions, cron | `supabase/` |
| Live features | Road tickets with map and photos, idea board, data-error flags, commitments tracker, admin review queues | edge functions + `public.*_public` views |

### Local development

```bash
npm install
npm run dev          # http://localhost:5173/calloway-transparency-hub/app.html
npm run build        # typecheck, build, prerender 750+ routes into dist/
node scripts/check-data.mjs   # data contract checks (also run in CI)
```

`.env.production` holds the Supabase URL and anon key. Both are public by design; the database is protected by
Row Level Security, and the anon role can read only the `public.*_public` views.

### Deploying

Pushes to `main` build and deploy to GitHub Pages. The workflow asks GitHub to switch the Pages source to **GitHub Actions**; if that is refused, set it once under Settings → Pages → Source. Until then the repo-root `index.html` + `app.js` (the legacy site) keep serving, so nothing breaks during the switch.
A scheduled rebuild every 3 hours refreshes link previews for new tickets and keeps the Supabase project awake.
For a custom domain, add `public/CNAME`; `vite.config.ts` then uses `/` as the base path.

### Backend

- `supabase/migrations/` is the schema history applied to the project. `supabase/seed/` holds the minutes seed.
- `supabase/functions/` are the Edge Functions (see the README there for secrets).
- Editors sign in at `/admin` with an email magic link; only addresses in `hub.admins` can act, and every action is logged.

### Updating data

Edit the files in `data/` (or regenerate them), run `node scripts/check-data.mjs`, commit, push to `main`.
The repository history is the public change log for every number on the site.

## Documents

- `docs/UPGRADE_PLAN.md` — the review and plan this build follows, including the commitments-tracker rulebook
- `docs/backend/schema.sql`, `docs/backend/API.md` — reference design for the backend
- `index.html`, `app.js`, `404.html` at the repo root — the legacy single-bundle site, kept only until Pages serves from Actions; `legacy/legacy-data-dump.json` is the data extracted from it

## License

Code: MIT. Hub-compiled data: CC BY 4.0 (credit "Calloway County Transparency Hub"). Source documents are public
records of Calloway County and the Commonwealth of Kentucky.
