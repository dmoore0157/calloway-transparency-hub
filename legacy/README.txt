Calloway County Transparency Hub — static site
Files: index.html + app.js (self-contained; no build step, no server needed).

TO PUBLISH FREE (pick one):
1) Netlify Drop  — go to app.netlify.com/drop and drag this folder onto the page. Instant URL.
2) Cloudflare Pages — pages.cloudflare.com > Create > Direct Upload > upload this folder.
3) GitHub Pages — put these files in a repo, enable Pages on the main branch.

To update later, replace app.js with a newly exported bundle and re-upload.

PLANNING DOCS (Nov 2026):
  docs/UPGRADE_PLAN.md      Review of the current hub and the full upgrade plan
                            (IA simplification, theme fixes, budget and vote analytics,
                            feedback board, road-ticket system with map and photos).
  docs/backend/schema.sql   Postgres/Supabase schema for the new backend.
  docs/backend/API.md       Edge-function API, jobs, moderation and verification rules.
