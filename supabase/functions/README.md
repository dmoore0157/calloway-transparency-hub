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

## ask (Ask the records)

Answers residents' questions using only the hub's records. Claude (default `claude-opus-5-5`, server-side refusal
fallbacks on) runs a tool loop over the published corpus (`/data/ai-corpus.json`, built by `scripts/build-ai-corpus.mjs`
on every site build) and live views (commitments, road requests). Tools: `search_records`, `get_records`,
`query_motions` (exact counts), `calculate`, `live_commitments`, `road_requests`, and `respond` (final answer).

Guardrails enforced in code, not only in the prompt:
- An answer is shown only if every citation points to a record retrieved in that request and every figure in it
  appears in the retrieved records or a `calculate` result. One repair attempt; otherwise the answer is withheld.
- Out-of-scope and opinion requests return fixed hub text, never model text. Plain-text replies are never shown.
- Links to other sites and HTML are stripped. Prior turns are passed as unverified context and cannot be cited.
- Rate limits per device, per IP hash and a global daily cap (`AI_DAILY_LIMIT`, default 400). Turnstile if configured.

Secrets: `ANTHROPIC_API_KEY` (required). Optional: `AI_MODEL`, `AI_DAILY_LIMIT`, `CORPUS_URL`, `SITE_URL`.
Tables: `hub.ai_answers` (30-day retention unless shared), `hub.ai_feedback`; public view `ai_answers_shared`.
Tests: `npm run test:ask` (offline, scripted model); `node scripts/ask-eval.mjs` (live, costs a few dollars).
