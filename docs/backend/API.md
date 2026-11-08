# Backend API and Operations Contract

Companion to `schema.sql`. All resident-facing writes go through Supabase Edge Functions (Deno) so that validation, anti-spam, rate limiting, and PII handling happen in one place. Reads of published data come from static JSON built at deploy time, with live Postgres views only for things that change minute to minute (tickets, ideas).

Base URL: `https://<project>.supabase.co/functions/v1/` (the hub's own Supabase project and organization). The site is served from GitHub Pages; the browser calls Supabase directly.

Conventions

- JSON in, JSON out. Errors: `{ "error": { "code": "rate_limited", "message": "..." } }` with 4xx/5xx.
- Every write requires a Cloudflare Turnstile token in `turnstile_token` and a stable `device_token` (random UUID the client stores in localStorage, hashed server-side).
- Rate limits are per IP hash and per device token, sliding windows stored in `hub.rate_limits`.
- Admin endpoints require a Supabase Auth JWT whose user is in `hub.admins`.
- CORS on every function allows only the hub's custom domain (and `localhost` in development).
- The anti-spam token field is named `turnstile_token`; if hCaptcha is chosen instead, the same field carries the hCaptcha token and only the verify call changes.

---

## 1. Public read endpoints

Static files, built from the public views on every publish, committed to `data/` in the repository, and served by GitHub Pages at `/data/...`. Because they are committed, the repository history is a public log of every data change. The build writes a `manifest.json` with dataset versions, `generated_at`, and the commit SHA.

| Path | Contents |
|---|---|
| `/data/manifest.json` | dataset list, versions, generated_at, record counts |
| `/data/budget/lines.json` | all budget lines with per-year adopted/amended/actual, source refs |
| `/data/budget/funds.json`, `/data/budget/revenue.json`, `/data/budget/categories.json` | aggregates used by charts |
| `/data/decisions/meetings.json` | meetings, attendance, summaries |
| `/data/decisions/motions.json` | verified motions with votes inline |
| `/data/decisions/members.json` | members, districts, `member_stats`, `mover_seconder_matrix` |
| `/data/decisions/enactments.json` | ordinances and resolutions |
| `/data/grants.json`, `/data/debt.json`, `/data/documents.json`, `/data/glossary.json` | reference sets |
| `/data/search-index.json` | prebuilt MiniSearch index over all of the above |
| `/data/corrections.json` | public corrections log |
| `/data/accountability/commitments.json` | published commitments with sources, current and proposed rating, accepted evidence, official responses |
| `/data/accountability/scores.json` | `commitment_scores`: counts, score, and whether the official meets the five-resolved minimum |
| `/data/accountability/rating-log.json` | every rating change with date and reason |

Live endpoints (PostgREST over the `public.*_public` views, anon key, read only):

| Endpoint | Notes |
|---|---|
| `GET /rest/v1/tickets_public?select=*&status=in.(reported,submitted_to_county,acknowledged,in_progress)` | list; supports PostgREST filters |
| `GET /functions/v1/tickets-geojson?bbox=w,s,e,n&status=...&category=...` | GeoJSON FeatureCollection for the map, clustered client-side |
| `GET /rest/v1/ticket_events_public?ticket_id=eq.CT-2026-0142&order=created_at` | timeline |
| `GET /rest/v1/ticket_photos_public?ticket_id=eq.CT-2026-0142` | approved photos; `public_path` resolves under the public bucket |
| `GET /rest/v1/ideas_public?order=vote_count.desc` | idea board |
| `GET /rest/v1/corrections_log` | corrections |
| `GET /functions/v1/district-stats` | cached `district_ticket_stats` |
| `GET /rest/v1/commitment_ratings_public?state=eq.proposed` | ratings currently in their seven-day pending period |

Downloads: weekly job writes `exports/<dataset>-<date>.csv|json` to the public `exports` bucket; `/records/data` lists them from `manifest.json`.

---

## 2. Resident write endpoints

### `POST /roads/tickets`

Creates a ticket plus its private contact record. Returns the public id and a reporter secret for later edits.

Request

```json
{
  "turnstile_token": "...",
  "device_token": "uuid",
  "category": "pothole",
  "severity": "routine",
  "description": "Pothole about 2 ft wide in the eastbound lane just past the bridge.",
  "location": { "lat": 36.6103, "lng": -88.3148 },
  "location_text": "Doores Trail, 200 ft east of the culvert",
  "road_name": "Doores Trail",
  "contact": {
    "first_name": "…", "last_name": "…", "phone": "…", "email": "…", "home_address": "…",
    "email_opt_in": true
  },
  "photo_ids": ["uuid", "uuid"]
}
```

Server steps

1. Verify Turnstile. Rate limit: 3 tickets / device / day, 10 / IP / day.
2. Validate with zod (lengths, enum values, lat/lng inside Calloway County bounding box with 2 km margin).
3. Reverse geocode through `geocode_cache` → road name suggestion; the `tickets_geo` trigger sets `district_id`, `road_id`, `maintainer`.
4. Duplicate check: same category within 75 m in the last 90 days → return `possible_duplicates[]` with 409 unless `confirm_not_duplicate: true`.
5. Insert `tickets`, `ticket_contacts`, `ticket_events(kind='created')`; attach pending photos by id.
6. Build the **county hand-off packet** (section 4) and return it.
7. Email the reporter a tracking link with the reporter secret (if opted in).

Response

```json
{
  "id": "CT-2026-0142",
  "reporter_secret": "…",
  "status": "reported",
  "maintainer": "county",
  "district": { "id": 2, "magistrate": "Larry Crutcher" },
  "handoff": { "...": "see section 4" },
  "possible_duplicates": []
}
```

### `POST /roads/photos`

Multipart upload. Max 4 per ticket or confirmation, 5 MB each, JPEG/PNG/HEIC/WebP.

Steps: sniff content type; decode; read EXIF `DateTimeOriginal` and GPS into `taken_at` / `exif_gps`; strip all metadata; re-encode to JPEG at max 1600 px and a 400 px thumbnail; store under `ticket-photos-private/<uuid>.jpg`; insert `ticket_photos(status='pending')`. Returns `{ "photo_id": "uuid", "suggested_location": {lat,lng} | null }`. Photos may be uploaded before the ticket exists; unattached photos older than 24 h are deleted by the stale job.

### `POST /roads/tickets/{id}/confirm`

Anyone may add a confirmation. Body: `{ kind: "still_issue" | "fixed", note?, photo_ids?[] }`. Rate limit 1 per device per ticket per day. Creates `ticket_events`. Two independent `fixed` confirmations, or one from the reporter, move status to `fixed` automatically; an admin can revert.

### `POST /roads/tickets/{id}/submitted`

Reporter marks the ticket as submitted to the county. Body: `{ reporter_secret, county_reference? }`. Sets `submitted_to_county_at`, status → `submitted_to_county`.

### `POST /roads/tickets/{id}/edit`

Reporter-only (secret) edit of description, location text, category within 24 h of creation. Logged as an event.

### `POST /feedback/ideas`

`{ turnstile_token, device_token, title, body, category, email? }`. Rate limit 5 / device / day. Auto-publish unless body contains a URL or a flagged term, in which case `published=false` and it enters moderation. Returns `{ id, published }`.

### `POST /feedback/ideas/{id}/vote` and `DELETE`

Toggle vote for the device token. One per device per idea. Returns new `vote_count`.

### `POST /feedback/ideas/{id}/comments`

Resident comments are held for moderation (`published=false`).

### `POST /feedback/flags`

Data error report. `{ turnstile_token, record_table, record_id, message, email? }`. Validates that the record exists. Creates `data_flags(status='open')` and an `ingest_jobs` row of kind `review_flag` so it shows in the verification queue.

### `POST /accountability/responses`

For officials only. Body: `{ invite_token, commitment_id, body }`. The invite token comes from a private link mailed and emailed to the official's public office address (`hub.response_invites`, valid 90 days, reusable until expiry). The function checks the token hash, that the commitment belongs to that official, and the 2,500-character limit. Responses are published unedited within 48 hours; they may be withheld only for reasons listed on the methodology page, and the withheld reason is itself public.

### `POST /contact`

Private message to the publisher. Rate limited, emailed, not stored beyond the email log.

---

## 3. Admin endpoints (JWT, `hub.is_admin()`)

| Endpoint | Purpose |
|---|---|
| `GET /admin/queue?kind=verify|moderate|flags` | unified work queue |
| `POST /admin/motions/{id}/verify` | body: edited motion + votes; sets `verification='verified'`, `verified_by/at`, writes audit |
| `POST /admin/motions/{id}/reject` | removes from publish set |
| `POST /admin/meetings/{id}/verify` | marks the whole meeting verified once all motions are |
| `POST /admin/photos/{id}/approve` | copies to public bucket, sets `public_path`, `status='approved'` |
| `POST /admin/photos/{id}/reject` | deletes private object, stores reason |
| `POST /admin/tickets/{id}/status` | body: `{ to_status, note }`; sets `hub.actor` to `admin` or `county` for the trigger |
| `POST /admin/tickets/{id}/merge` | sets `duplicate_of`, status `closed_duplicate`, notifies both reporters |
| `POST /admin/ideas/{id}` | publish/unpublish, set status and status_note |
| `POST /admin/flags/{id}/resolve` | `{ status: confirmed_corrected|rejected, resolution }`; corrected flags appear in `/data/corrections.json` |
| `POST /admin/commitments` | create or edit a commitment with quote, sources, measure, deadline, wording type; requires `measure` when `scoreable` |
| `POST /admin/commitments/{id}/rate` | propose a rating with reason and evidence ids; creates a `proposed` row with `effective_at = now() + 7 days` |
| `POST /admin/ratings/{id}/second-review` | a different editor confirms a proposed rating; required for Broken when the hub has two or more editors |
| `POST /admin/ratings/{id}/withdraw` | withdraw a proposed rating, with reason |
| `POST /admin/evidence/{id}` | accept or reject an auto-suggested evidence link |
| `POST /admin/invites` | issue response invites to an official; sends letter text and email |
| `POST /admin/responses/{id}` | publish, or withhold with a listed reason |
| `POST /admin/publish` | triggers the `publish.yml` GitHub Actions workflow through `workflow_dispatch`; the workflow reads the public views with the anon key, writes `data/*.json`, commits, builds, and deploys to GitHub Pages; logs the run URL and commit SHA in `publishes` |
| `GET /admin/health` | last ingest, last publish, queue depths, error counts |

The admin UI is a route in the same React app (`/admin`), gated client-side by auth and server-side by RLS. It shows the PDF page next to each extracted motion with the quote highlighted.

---

## 4. County hand-off packet

Returned by `POST /roads/tickets` and by `GET /roads/tickets/{id}/handoff?reporter_secret=…`. The hub does not submit the county's WPForms form (reCAPTCHA v3 and a per-page token make that unreliable and inappropriate). It gives the resident everything the form asks for, in the form's order.

```json
{
  "form_url": "https://callowaycountyky.gov/calloway-county-road-concern/",
  "phone_road_department": "(270) 753-4846",
  "phone_after_hours_sheriff": "(270) 753-3151",
  "hours": "Mon–Fri 7:00 AM–3:30 PM",
  "emergency_note": "For emergencies call 911.",
  "fields": [
    { "label": "Resident Information – First", "value": "…" },
    { "label": "Resident Information – Last",  "value": "…" },
    { "label": "Your Street Address, City, State, Zip", "value": "…" },
    { "label": "Phone Number", "value": "…" },
    { "label": "Email", "value": "…" },
    { "label": "Magistrate (if known)", "value": "District 2 - Larry Crutcher" },
    { "label": "Exact location of the issue", "value": "Doores Trail, 200 ft east of the culvert (36.6103, -88.3148). Hub ticket CT-2026-0142." },
    { "label": "Description of the concern", "value": "…" },
    { "label": "Severity Level", "value": "Routine (e.g., potholes, grading requests)" }
  ],
  "clipboard_text": "First: …\nLast: …\n…",
  "mailto": "mailto:?subject=Road%20concern%20CT-2026-0142&body=…"
}
```

The client renders **Copy all**, per-field copy buttons, **Open county form**, and the **I submitted it** checkbox. Including the hub ticket id in the location field gives the county a reference back to the public record.

A nightly job (`jobs/check-county-form`) fetches the county page, extracts the WPForms field list, compares it with `county_form_template`, and emails the admin if labels or options changed.

---

## 5. Scheduled jobs (edge functions triggered by Supabase cron)

| Job | Schedule | What it does |
|---|---|---|
| `jobs/ingest-minutes` | nightly 02:00 | Crawl the county minutes page; for each new PDF: download to `documents`, compute sha256, create `documents` row, enqueue `ingest_jobs(kind='minutes_extract')`. |
| `jobs/extract` | every 10 min | Pops queued extraction jobs; runs the LLM extraction with a strict JSON schema (meeting metadata, attendance, agenda items, motions with mover/seconder/outcome/method/amount/quote/page, votes, appointments, grants mentioned); inserts rows with `verification='extracted'`; sets job `needs_review`. |
| `jobs/check-county-form` | nightly 03:00 | Section 4. |
| `jobs/stale-tickets` | daily 09:00 | Tickets open 30+ days with no event in 30 days: email reporter "Is this still a problem?" with one-tap links to `/confirm`. Delete unattached photos older than 24 h. |
| `jobs/digest` | daily 07:00 | Admin digest: new tickets, ideas, flags, items awaiting verification, errors. |
| `jobs/export-datasets` | weekly Sun 04:00 | CSV/JSON of every public dataset to the `exports` bucket; update `manifest.json`. |
| `jobs/archive-sources` | hourly | For new commitment sources: request a Wayback Machine snapshot, store a screenshot or PDF in `commitment-archive`, fill `archive_url` and `snapshot_path`. |
| `jobs/suggest-evidence` | after each motion is verified | Match the motion's category, text, and budget lines against open commitments; insert `commitment_evidence(suggested=true)` for review. |
| `finalize-ratings` (SQL) | daily 06:30 | Proposed ratings past their pending period become final unless flagged or awaiting a required second review. |
| `refresh-stats` (SQL) | hourly | Materialized views. |
| GitHub `scheduled.yml` | every 3 h | Rebuild so new tickets get link previews; ping a health function so a free-tier project does not pause. |

---

## 6. Moderation and verification rules

- **Motions/votes**: nothing public until a human verifies against the PDF. The review screen must show the source page. Reviewer initials and date are public on the meeting page.
- **Photos**: manual approval for the first three months; then auto-approve after 24 h without a report unless the ticket is flagged. Reject reasons: not a road issue, identifiable person or plate, offensive, duplicate, unreadable.
- **Tickets**: text is public immediately (it contains no PII by design). Admin may hide a ticket (`closed_invalid`) with a reason; hidden tickets are excluded from public views.
- **Ideas**: auto-publish plain text; hold anything with links or flagged terms.
- **Flags**: resolved flags that change data produce a corrections-log entry with the before/after.
- **Appeals**: every moderation email includes a reply address.

---

## 7. Environment and secrets

| Name | Used by |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | edge functions |
| `TURNSTILE_SECRET` | all write endpoints |
| `RESEND_API_KEY` (or Postmark) | email |
| `LLM_API_KEY` | `jobs/extract` |
| `GITHUB_DISPATCH_TOKEN` | `/admin/publish`; fine-grained token limited to the hub repository with Actions write only |
| `GITHUB_REPO` | `owner/name` of the hub repository |
| `IP_HASH_SALT`, `TOKEN_HASH_SALT` | hashing before storage |
| `NOMINATIM_USER_AGENT` | geocoder (identify the hub, include a contact URL) |

Secrets live in Supabase function secrets, never in the repo. The frontend ships only the anon key and the anti-spam site key. GitHub Actions needs only the Supabase URL and anon key, which are public by design, so no privileged Supabase credential is stored in GitHub. Every account above is owned by the hub's own email, separate from any other business.

---

## 8. Testing and quality gates

- Schema migrations applied in CI to a throwaway Supabase branch; `pgTAP` tests for RLS (anon cannot read `ticket_contacts`, cannot read unverified motions).
- Edge function unit tests (Deno test) for validation, rate limiting, duplicate detection, EXIF stripping.
- Playwright end-to-end: report a ticket on a phone viewport, upload a photo, see it pending, approve as admin, see it public; submit an idea and vote; flag a motion.
- Lighthouse CI budgets: performance 90+, accessibility 95+ on `/`, `/money`, `/decisions/votes`, `/roads`.
- Contract check: the dataset build fails if any published motion lacks `source_doc_id` or `source_quote`, or any published commitment lacks a quote, a source with an archive copy, and (when scoreable) a measure.
- Scoring tests: proposed ratings never count; an official with fewer than five resolved commitments has a null score; a Broken rating does not finalize without a second reviewer when two editors exist; an open flag holds a rating.
