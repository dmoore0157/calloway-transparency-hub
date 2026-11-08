# Edge functions

Each folder is one Supabase Edge Function. `common.ts` is identical in every folder (shared helpers: service client,
CORS, rate limits, captcha, admin check, audit, email). Edit `submit-ticket/common.ts` and copy it to the others.

| Function | Purpose |
|---|---|
| submit-ticket | Create a public road ticket plus private contact record; return the county hand-off packet |
| upload-photo | Accept a photo (JPEG/PNG/WebP, ≤5 MB, no EXIF), store privately pending review |
| ticket-action | Resident confirmations, reporter "submitted to county", reporter edits |
| feedback | Ideas, votes, data-error flags, contact messages, official responses |
| admin-action | Editor actions: photo moderation, ticket status, ideas, flags, commitments, ratings, publish |
| geocode | Cached reverse geocoding (Nominatim) with a county/state/city maintainer guess |

Secrets (set in the Supabase dashboard, Edge Functions → Secrets): `TURNSTILE_SECRET` (optional captcha),
`RESEND_API_KEY` + `EMAIL_FROM` (optional email), `ADMIN_EMAIL` (flag notifications), `SITE_URL`,
`GITHUB_DISPATCH_TOKEN` + `GITHUB_REPO` (Publish button), `TOKEN_HASH_SALT`, `ALLOWED_ORIGIN`.
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.
