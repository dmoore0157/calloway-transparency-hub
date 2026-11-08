# Calloway County Transparency Hub: Upgrade Plan

Prepared November 2026 from a review of the deployed hub (`index.html` + `app.js`), the data embedded in it, screenshots at desktop and phone widths, and the county's own Road Concern form.

Companion documents:

- `docs/backend/schema.sql` : the full Postgres schema (Supabase) for every feature below
- `docs/backend/API.md` : public and admin API contract, edge functions, jobs, and moderation flow

### Build status (November 2026)

Phases 0 to 3 of this plan are implemented on the `claude/calloway-hub-improvements-aou06k` branch and the Supabase
project `calloway-transparency-hub` is live: schema, RLS, storage buckets, six edge functions, seeded meetings and
votes. What differs from the plan as written:

- Hosting stays on GitHub Pages (section 7.5). The Supabase project was created in the only organization the
  account had at build time; transfer it to a hub-owned organization from the project's Settings → General page.
- Fonts are system fonts rather than self-hosted files, so no font downloads are needed.
- Anti-spam runs on rate limits, a honeypot, and moderation; Turnstile switches on when `TURNSTILE_SECRET` is set.
- Magistrate district boundaries and county road centerlines are not yet loaded, so "Who represents me" links to the
  county map and tickets use the reporter's district choice until boundaries are available.
- Public views are `SECURITY DEFINER` (owned by postgres) so the anon role sees only whitelisted columns and rows;
  Supabase's advisor flags this pattern, and it is intentional here.

### Decisions so far

| Topic | Decision (Nov 2026) |
|---|---|
| Navigation | Five-door structure approved (section 3) |
| Theme | Token and contrast changes approved (section 4) |
| Hosting | Stay on GitHub Pages (section 7.5) |
| Backend | A dedicated Supabase project in its own Supabase organization, fully separate from Cited Digital (section 7.6) |
| Neutrality | No candidate promotion anywhere. Officials are held to their own decisions, commitments, and campaign promises, and ranked on promise-keeping by published rules (section 10) |

---

## 1. Where the hub stands today

**What is in the repo.** One prebuilt bundle (`app.js`, 836 KB, esbuild) and two identical HTML shells. There is no source code, no build step, no data files, no tests. React 19, Redux Toolkit, Recharts, lucide icons, decimal.js are all inlined. Deployed as a static site (GitHub Pages, `.nojekyll`).

**What it contains (all hard-coded in the bundle):**

| Area | Content | Shape |
|---|---|---|
| Budget | FY2018 to FY2025 revenue by source, spending by fund (General, Road, Jail), category budget vs. actual, FY2026-27 adopted budget line items (every fund, revenue and appropriation), FY2024-25 year-end General Fund report | Arrays keyed by fiscal year |
| Meetings | 31 regular and special meetings (Jan 2024 to Apr 2026), each with a PDF link, absent list, bullet summary, and free-text "split vote" notes | `{d, u, absent, splits[], b[]}` |
| Motions | 349 motions: mover, seconder, action text, result, routine flag | `{m, s, a, r, g}` keyed by meeting |
| Grants | ~40 funding items from minutes (program, purpose, amount, match, stage) | flat array |
| Ordinances | ~60 ordinances in categories with county PDF links | nested arrays |
| Debt, reports, glossary, sources, law citations | prose and link tables | mixed |

**What works well and must be preserved**

- Source discipline. Every figure is labeled audited vs. county-reported vs. year-end, and the two are never blended. This is the hub's core credibility asset.
- Plain-English explainers on tap (the drawer with "what it is / why it matters / the law").
- Honest status badges on things that are not built yet.
- A real question-first entry point ("How much did the county spend last year?").

**Structural problems that block the next stage**

1. **No source, no data layer.** Everything lives inside a minified bundle. Adding a meeting means rebuilding and re-exporting the whole app. Nothing can be shared, exported, or linked.
2. **No URLs.** Navigation is React state. You cannot link someone to a specific motion, budget line, or meeting, search engines index one page, and the browser back button does nothing.
3. **Fourteen top-level tabs.** On a phone the header is 487 px tall and the nav wraps to four rows before any content appears.
4. **Votes are not structured.** Roll calls, nays, and abstentions are prose strings in `splits[]`. The Vote Tracker filters on "result starts with Unanimous". No per-member analytics are possible with the current shape.
5. **Campaign framing inside a neutrality claim.** Status badges read "AS JUDGE-EXECUTIVE" and a category note says "This is the office on this November's ballot." The footer says "not affiliated with Calloway County government". For a hub you will share as *the* public transparency resource, those two messages collide. **Decided:** remove all campaign framing. Accountability moves to the commitments tracker in section 10, which applies the same rules to every official.
6. **"Compiled by AI from the official minutes."** Honest, but there is no visible verification trail. Section 6 makes verification a first-class, visible step.

---

## 2. Design principles for the upgrade

1. **One question, one screen.** Every page answers a question a resident would actually ask, in the first viewport, then lets them go deeper.
2. **Every number has a receipt.** Source document, page, and quote one tap away. Unchanged from today, extended to votes and tickets.
3. **Five doors, not fourteen.** Money, Decisions, Roads, Records, Feedback.
4. **Mobile is the default device.** Residents will open this from a Facebook link on a phone.
5. **Neutral, and accountable.** The hub endorses no one and editorializes nowhere. Every official is measured against the public record and against their own commitments, by the same published rules.
6. **Nothing goes public unverified.** Extracted data is reviewed by a human before publish. Resident submissions are moderated before photos appear.

---

## 3. Information architecture and UX simplification

### 3.1 New top-level navigation

| Door | What lives there | Replaces today's tabs |
|---|---|---|
| **Home** | Search bar, four questions, "this month at the Fiscal Court", open road tickets near you | Home |
| **Money** | Budget overview, Where it comes from, Where it goes, Budget vs. Actual, Line-item explorer, Grants, Debt. One page with a year selector and sub-tabs, not six tabs. | County Budget, Where it comes from, Budget vs Actual, FY26-27 Budget, Spending Detail, Grants & Funding, Debt |
| **Decisions** | Meetings, Vote Tracker with member scorecards, Ordinances & Resolutions, Who represents me | Meetings & Records, Vote Tracker |
| **Roads** | Report a road problem, live ticket map, ticket list and tracking, district response stats | new |
| **Records** | Reports & Audits, Sources, Glossary, Data downloads, How this is built, Corrections log | Reports & Audits, Sources, Glossary, Full Roadmap |
| **Feedback** | Suggest an improvement, public idea board, what's coming, report a data error | new |

### 3.2 Routing and linkability

- Real URLs with the History API, deployable on a static host with a SPA fallback (the existing `404.html` trick already supports this).
- Examples: `/money/2025/general-fund`, `/money/lines/01-5101`, `/decisions/meetings/2026-04-22`, `/decisions/motions/2026-04-22-07`, `/decisions/members/cherry`, `/roads/tickets/CT-2026-0142`, `/feedback/ideas/23`.
- Every record gets a **Share** button that copies a permalink, and an **Open Graph** image so links unfurl on Facebook with the key number.
- Browser back/forward work. Filters live in the query string so a filtered view is shareable.

### 3.3 Mobile and header

- Compact sticky header: wordmark, search icon, menu. Target header height under 120 px on a 390 px phone (today 487 px).
- Bottom tab bar on phones for the five doors.
- Drop the always-on "Tip: anything with an ⓘ opens an explanation" banner; show it once and remember dismissal.
- Tables become cards on narrow screens; long tables get sticky first column and horizontal scroll with a visible affordance.

### 3.4 Global search

One search box across budget lines, motions, meetings, ordinances, grants, glossary, tickets, and ideas. Client-side index (FlexSearch or MiniSearch) built at deploy time from the data files, so it works with no backend call. Results grouped by type with the number of hits per group.

### 3.5 Explainers

Keep the drawer pattern. Add:

- "What changed since last year" sentence on every budget card, generated from data, not hand-written.
- A per-page **Sources** footer listing only the documents used on that page, replacing the global Sources tab as the primary entry point.
- Reading level target of grade 8 for all hub-written copy.

### 3.6 Accessibility

- Fix color contrast (section 4).
- Keyboard-reachable charts: every chart has a "View as table" toggle and a CSV download.
- Visible focus rings are already present; keep them.
- `prefers-reduced-motion` is already honored; keep it.
- Lighthouse accessibility score target 95+ on every route.

---

## 4. Theme evaluation and recommendations

### 4.1 What the theme does right

- The navy / gold / cream / red palette reads as civic and serious, closer to a courthouse than a startup. That fits.
- Serif headings (Georgia) with a sans body is a sound pairing for long-form explanatory content.
- Consistent card language, left-border accents, and status badges give the site a recognizable system.
- Source-type colors (audited vs. county-reported) are applied consistently across charts and legends.

### 4.2 Problems found

| Issue | Evidence | Fix |
|---|---|---|
| **Gold text fails contrast** | `#C9A84C` on cream `#F5F1EA` is 2.03:1; on white 2.29:1. WCAG AA needs 4.5:1 for small text. Gold is used for section labels, "Recorded / split votes" labels, badge text, and footer credit. | Introduce `gold-ink` `#8A6B1F` (4.44:1 on cream, use at 14 px+ bold) for text; keep `#C9A84C` for borders, rules, and large display only. |
| **Orange fails contrast** | `#D4752A` on white is 3.29:1 and it labels the unaudited data series. | Use `#B45F1D` for text and dots on light backgrounds. |
| **Red means three things** | Red is the primary link/CTA color, the Jail Fund series color, and the "latest spending" accent. Red on a jail bar reads as alarm. | Red becomes the single **action** color (links, buttons). Funds get a neutral categorical palette: navy, slate blue `#5B7A9E`, moss `#6E8B5A`, plum `#8C6BA0`, teal `#3E7C8C`. |
| **Phone header is 487 px** | 14 nav buttons wrap to four rows under a two-line title, italic tagline, and tip pill. | Section 3.3. |
| **Trebuchet MS body font** | Renders differently on Android (falls back to Roboto) and iOS, so spacing and line breaks differ per device. | Self-host one variable sans (Source Sans 3 or Inter) and one serif (Source Serif 4 or keep Georgia as system fallback). Two font files, under 200 KB total. |
| **Status badges carry campaign language** | "AS JUDGE-EXECUTIVE" badge, "This is the office on this November's ballot" explainer. | Rename to "NEEDS COUNTY PARTICIPATION". Remove ballot references. Move any personal platform content to a clearly separate site or a single, clearly labeled "About the publisher" page. |
| **No favicon, no Open Graph image, no manifest** | Links unfurl as plain text on social media. | Add favicon set, a default OG image, per-record generated OG images for key pages, and a web manifest so the hub can be added to a home screen. |
| **Charts lack direct labels** | Users must read the legend and hover. Hover does not exist on phones. | Direct-label bar ends, show value on tap, always provide the table view. |
| **No dark mode** | Not a blocker, but the cream background is harsh in dark rooms and many Android phones force dark. | Define tokens once, provide a dark palette (`#141B2D` background, cream text), honor `prefers-color-scheme`. |

### 4.3 Proposed token set

```
--bg            #F5F1EA   (cream)        dark: #141B2D
--surface       #FFFFFF                  dark: #1C2538
--ink           #2C2C2C   (charcoal)     dark: #EDE7DC
--ink-muted     #5E5B54   (stone, darkened for 5.5:1)
--brand         #1A2744   (navy)         dark: #C9A84C used as brand accent
--accent        #C9A84C   (gold, borders/rules only)
--accent-ink    #8A6B1F   (gold for text)
--action        #C0272D   (red, links and buttons only)
--ok            #3A7D44
--warn          #B45F1D
--series-1..5   #1A2744 #5B7A9E #6E8B5A #8C6BA0 #3E7C8C
--source-audited   #1A2744
--source-county    #B45F1D
--source-yearend   #8C6BA0   (stop using red for a data series)
```

---

## 5. Budget analytics: letting people explore how money is spent

The data already in the bundle supports most of this. The work is restructuring it into files and building views.

### 5.1 Data restructure

Move everything out of the bundle into versioned JSON (and the Postgres tables in `schema.sql`), generated from a single `data/` folder:

- `funds.json`, `budget_lines.json` (account code, fund, department, name, FY, adopted, amended, actual, source type, source document id)
- `revenue_sources.json`, `categories.json`, `grants.json`, `debt.json`, `documents.json`

Every row carries `source_doc_id` and, where available, `source_page`.

### 5.2 Views

| View | Question answered | Interaction |
|---|---|---|
| **Budget at a glance** | How big is the budget, where does it come from, where does it go? | Two stacked flows (revenue → funds → departments) as a Sankey, with a toggle to simple bars. Year selector FY2018 to FY2027. |
| **Where it goes (treemap)** | What are the biggest things we pay for? | Fund → department → line. Tap to zoom. Per-resident toggle. Inflation-adjusted toggle (CPI). |
| **Budget vs. actual** | Does the county spend what it plans? | Ranked variance list: biggest under- and over-spends by line and department, with a plain-English note ("spent 61% of plan"). |
| **Line-item explorer** | What exactly is account 01-5101? | Search by name or code. Each line gets a page with an 8-year sparkline, adopted vs. amended vs. actual, explainer, and the ordinances or motions that touched it. |
| **Trends** | Is X growing faster than everything else? | Pick up to five lines or departments; indexed-to-100 chart; CAGR shown as text. |
| **Follow the dollar** | What did my $1,000 in property tax pay for? | Input a tax bill amount; output a proportional split by department. Clearly labeled as proportional, not literal. |
| **Grants and outside funding** | What outside money did the county win, and what did it cost us in match? | Table plus timeline, linked to the motions that accepted each grant. |
| **Decisions with dollars** | Which votes moved money? | Motions with extracted dollar amounts, linked to the budget lines they affect. Bridges the Money and Decisions doors. |

### 5.3 Peer comparison (phase 4)

Kentucky DLG publishes uniform financial reports for all counties. Compare Calloway with similar-population counties (Marshall, Graves, Hopkins, Franklin) on per-resident spending by fund. Label as county-reported. Requires scraping and normalizing DLG data; schedule after the core is stable.

### 5.4 Data downloads

Every chart and table: CSV and JSON download, plus a public read-only API (section 7 and `API.md`). A `/records/data` page lists every dataset with license (CC BY 4.0 for hub-compiled data; source documents remain public records).

---

## 6. Voting records analytics: how the Judge-Executive and magistrates act

### 6.1 The data model change that unlocks everything

Today a motion is `{m, s, a, r, g}`. It becomes:

```
motion
  id, meeting_id, sequence, agenda_item_id
  text (the action), summary (plain English), category (tags)
  mover_id, seconder_id
  outcome: passed | failed | no_second | tabled | withdrawn
  vote_method: voice_unanimous | roll_call | voice_with_nays | consensus | no_vote
  dollar_amount (nullable, extracted), related_doc_ids (ordinance/resolution), budget_line_ids
  is_routine (minutes approval, bills, adjournment)
  source_doc_id, source_page, source_quote
  verification_status: extracted | verified | disputed

vote
  motion_id, member_id, value: aye | nay | abstain | absent | not_recorded
```

Rule for voice votes, stated on the page: when minutes record "all voted aye," every present member is stored as `aye` with `vote_method = voice_unanimous`, and the UI labels these as "voice vote, recorded as unanimous" rather than implying an individual roll call. Abstentions, nays, and no-second events are stored explicitly from the minutes text. The current `splits[]` prose is re-keyed into these rows during migration.

### 6.2 Views

| View | Question answered |
|---|---|
| **Member scorecard** (one per magistrate and the Judge-Executive) | Attendance, motions made, motions seconded, nays, abstentions, no-second events. Share of motions by category. Dollar value of motions moved. Every count links to the list of motions behind it. |
| **Who moves, who seconds** | A 5×5 matrix of mover × seconder. Shows working pairs and who never seconds whom. |
| **Split and recorded votes** | Every non-unanimous or individually recorded vote, with the full tally and the source quote. Today this is a filter; it becomes the headline view because it is the only place the public record distinguishes members. |
| **Topics over time** | Motions by category per quarter: roads and bridges, budget and finance, personnel, appointments, ordinances, property, public safety, grants. |
| **Appointments tracker** | Every board appointment: who was appointed, to what, by whose motion, term end date. Boards are where a lot of quiet influence lives. |
| **Meeting page** | Agenda-ordered motions, attendance, documents adopted, dollars moved, link to PDF, and a "what this meeting cost" summary when amounts are present. |
| **Who represents me** | Enter an address → magistrate district, magistrate name, scorecard link, Road tickets open in that district. Needs district boundary GeoJSON (see 8.4). |

### 6.3 Honesty rules for vote analytics

- Routine motions (approve minutes, pay bills, adjourn) are excluded from scorecards by default with a visible toggle, so counts reflect substantive activity.
- Activity counts such as motions made or seconded are shown side by side but never ranked, because more motions is neither better nor worse. Ranking is reserved for promise-keeping (section 10), where the standard is the official's own words.
- Every scorecard page states: "Kentucky fiscal courts vote by voice. Unless the minutes record a roll call, nay, or abstention, a member's vote is recorded here as 'aye' because the minutes say 'all voted aye.'"

### 6.4 Extraction and verification pipeline

1. **Ingest**: a scheduled job checks the county minutes page for new PDFs and stores them (`documents` table + Storage bucket).
2. **Extract**: PDF text → structured motions and votes via an LLM with a fixed JSON schema, citing page and quote for every field.
3. **Verify**: an admin review screen shows the PDF page beside the extracted rows. A human approves, edits, or rejects each motion. Nothing is public until `verification_status = verified`.
4. **Publish**: verified rows are exported to the static JSON the site reads, and the search index rebuilds. The verification date and reviewer initials appear on the meeting page.
5. **Corrections**: any reader can flag a motion ("this isn't what the minutes say"). Flags enter the same review queue; resolved flags appear in a public corrections log.

---

## 7. Backend: platform, architecture, and operations

The hub stays a static site for reading. A small backend is added for everything residents *submit* and for the verification pipeline. Detailed schema in `docs/backend/schema.sql`, API in `docs/backend/API.md`.

### 7.1 Platform choice

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vite + React + TypeScript, source committed, built by GitHub Actions | Reproducible builds; today's bundle cannot be edited. |
| Hosting | **GitHub Pages** (kept), with a hub-owned custom domain | Free, already in place, HTTPS included. Everything Cloudflare Pages would add is covered another way (section 7.5). |
| Database, auth, storage, functions | A **dedicated Supabase project in its own Supabase organization** (Postgres + Row Level Security + Storage + Edge Functions + cron) | One managed stack, Postgres fits the relational data, PostGIS covers maps. Kept fully separate from Cited Digital (section 7.6). |
| Maps | MapLibre GL JS with a Protomaps PMTiles extract of Calloway County, hosted in the site or in Supabase Storage | No API key, no per-tile billing, no reliance on the volunteer-run OSM tile servers. |
| Geocoding | Nominatim (OSM) with caching, rate-limited through an edge function; fallback to Census Geocoder for addresses | Free; cached results stored in `geocode_cache`. |
| Anti-spam | Cloudflare Turnstile under a hub-only Cloudflare account, or hCaptcha | Turnstile works on any host and needs no Cloudflare hosting. Swapping to hCaptcha is a configuration change. |
| Email | Resend or Postmark on a hub-owned sending domain | Ticket confirmations, status changes, admin alerts. |
| Errors and analytics | Sentry (errors), Plausible or Umami (privacy-friendly, no cookies) | A transparency site should not run ad-tech trackers. |

### 7.2 Architecture

```
Residents ──► Static site (GitHub Pages, custom domain)
                 │  published data
                 ├──► /data/*.json (committed to the repo by the publish workflow)
                 │  live data (tickets, ideas)
                 ├──► Supabase REST over public views (anon key)
                 │  writes (tickets, photos, ideas, flags, official responses)
                 └──► Supabase Edge Functions ──► Postgres (RLS) + Storage
                                              └──► Email, geocoder, image processing

Admin ──► /admin route (Supabase Auth, email magic link, allow-listed)
            ├── verification queue (motions, votes, commitments, ratings)
            ├── moderation queue (photos, tickets, ideas, responses)
            └── Publish → edge function calls GitHub workflow_dispatch

GitHub Actions (hub's GitHub organization)
            ├── publish.yml: read public views → write data/*.json → commit → build → deploy to Pages
            ├── scheduled.yml (every 3 h): rebuild so new tickets get link previews; Supabase keep-alive ping
            └── ci.yml: tests, Lighthouse, schema and RLS checks on every pull request

Supabase cron
            ├── nightly: fetch new minutes PDFs → extraction queue; check county form
            ├── hourly: recompute ticket, vote, and commitment stats
            ├── daily: finalize ratings past their pending window; stale-ticket prompts; digests
            └── weekly: export public datasets to Storage (CSV/JSON)
```

### 7.3 Security and abuse controls

- Anonymous writes only through edge functions, never directly to tables. Functions validate payloads with a schema (zod), enforce Cloudflare Turnstile, and apply per-IP and per-device rate limits stored in `rate_limits`.
- Row Level Security on every table. Public role can `select` only published rows and public columns (views hide PII). Admin role requires an allow-listed email.
- PII (name, phone, email, home address) is stored in `ticket_contacts`, a separate table never exposed through any public view or API.
- Photos: client-side resize to 1600 px max, server-side EXIF strip (GPS is read once to suggest the pin, then removed), content-type sniffing, size cap 5 MB, held in a private bucket until approved, then copied to the public bucket.
- Audit log on every admin action.
- Signed URLs for admin-only files; public bucket for approved photos with immutable cache headers.
- Backups: Supabase daily backups (Pro plan) plus a weekly `pg_dump`, encrypted with a key only the hub owner holds, stored with a second provider. Never store an unencrypted dump as a GitHub Actions artifact: the repo is public and the database holds resident contact details. The `data/` folder in git is itself a full backup of all published data.

### 7.4 Observability and operations

- Health page at `/records/status`: last minutes ingest, last publish, ticket queue depth, moderation backlog. Transparency about the hub itself.
- Error tracking on both client and edge functions.
- Admin daily digest email: new tickets, new ideas, items awaiting verification.

### 7.5 Hosting on GitHub Pages

GitHub Pages only serves static files. That is fine, because everything dynamic runs in Supabase and the browser talks to Supabase directly. This table covers each thing Cloudflare Pages would have added.

| Need | How it works on GitHub Pages |
|---|---|
| Clean URLs and deep links | The build prerenders every known route into its own folder with an `index.html`, so `/decisions/meetings/2026-04-22` returns a normal page. Anything not prerendered falls back to `404.html`, which boots the app (the trick the site already uses). |
| Facebook and text-message link previews | Link-preview crawlers do not run JavaScript, so each prerendered page carries its own title, description, and Open Graph image generated at build time. Tickets created between builds show immediately on the site; their link preview appears after the next scheduled rebuild, every 3 hours. |
| Deploy when data is published | The admin Publish button calls an edge function, which triggers the `publish.yml` workflow through the GitHub API. The token used is fine-grained, limited to this one repository, with only Actions write access. |
| Server-side code | Lives in Supabase Edge Functions. CORS allows only the hub's domain. |
| Anti-spam | Turnstile or hCaptcha run in the browser and are verified by the edge function, so the host does not matter. |
| Limits | Pages allows a 1 GB site and about 100 GB of traffic a month. Photos and PDFs live in Supabase Storage, so the site itself stays a few megabytes. |

Two benefits come from staying on GitHub:

- **A public audit trail of every data change.** The publish workflow commits `data/*.json`, so anyone can see exactly what changed, when, in the repository history.
- **No sensitive secrets in GitHub.** The build reads only the public views with the anon key, which is public by design. The service key never leaves Supabase.

### 7.6 Keeping the hub separate from Cited Digital

1. **Hub-owned email account.** Create one mailbox for the hub and make it the owner of every service below. The hub can then be handed to a successor without touching any Cited Digital account.
2. **GitHub organization.** Move the repository from the personal account into a dedicated organization. Point a custom domain at Pages first, so the public address does not change when the repository moves.
3. **Supabase organization.** Create a new Supabase organization, not just a new project inside an existing one, because billing, members, and access are set at the organization level.
4. **Domain.** Register it under the hub account. DNS can live anywhere.
5. **Supporting services.** Turnstile, Resend, Sentry, and Plausible each get hub-owned accounts.
6. **Secrets.** They live only in the hub's Supabase project and GitHub organization. Nothing is shared with other projects.
7. **Footer credit.** The footer currently reads "Built from the county's public records by Cited Digital." Decide whether it stays. Either way, the About page names the publisher with a disclosure statement.

**Supabase plan note.** Free projects pause after about a week without activity, and because most reads come from static files, the database can look idle. The scheduled workflow pings a health endpoint to keep it awake. Moving to the Pro plan, about $25 a month, when Roads launches removes that risk and adds daily backups. Supabase limits how many free projects one person can own, so check that before creating the project.

---

## 8. Road repair tickets with map and photos

### 8.1 What the county offers today

The county's Road Concern page is a WPForms form (id 3078) with these fields: Resident name (first, last), street address, phone, email, Magistrate (District 1 Ricky Stewart, District 2 Larry Crutcher, District 3 Don Cherry, District 4 Paul Rister, Unknown), Exact location, Description, Severity (Emergency / Urgent / Routine / Long-term). It is protected by reCAPTCHA v3 and a per-page token. Submissions go to county staff and are never visible to the public. The page also directs emergencies to 911 and prompt issues to the Road Department at (270) 753-4846 (Mon to Fri, 7:00 to 3:30) or the Sheriff after hours.

**Constraint:** because of the token and reCAPTCHA, the hub cannot submit that form on a resident's behalf from a server, and attempting to would be fragile and arguably improper. The hub therefore does the next best thing: it captures everything once, posts the public version, and hands the resident a one-tap, pre-filled path into the county's own form.

### 8.2 Resident flow

1. **Where** : tap the map or "use my location". The hub reverse-geocodes to a road name and checks the maintainer: county road, state route (KYTC), or City of Murray street. If state or city, it shows the right contact instead and still lets the resident log it publicly with that label.
2. **What** : category (pothole, washout, drainage, downed tree, sign, bridge, gravel/grading, mowing/vegetation, other), severity using the county's four levels verbatim, description, up to four photos.
3. **Who** : name, phone, email, home address. Marked private, explained in one line: "The county requires this. The hub never shows it publicly."
4. **Review and post** : the public ticket is created (`CT-2026-0142`), and the resident sees it on the map immediately with a "pending review" badge on photos.
5. **Send to the county** : a panel titled "Now send it to the county (30 seconds)" with:
   - a single **Copy all** button that puts the fields on the clipboard in the county form's order, plus a per-field copy button for phones where multi-field paste is awkward;
   - an **Open county form** button (new tab);
   - the magistrate district pre-selected based on the pin location;
   - a checkbox "I submitted it" that sets status to *Submitted to county* with a timestamp, and an optional field for any confirmation number the county returns;
   - for Emergency severity, the 911 and Road Department phone numbers appear first and the public post is secondary.
6. **Follow up** : the resident gets a tracking link (and email if provided). Anyone can add "still an issue" or "looks fixed" confirmations with a photo. After 30 days with no activity the reporter is asked whether it was fixed.

### 8.3 Public tracking

- **Map**: clustered pins colored by status (Reported, Submitted to county, Acknowledged, Fixed, Closed/Not county road). Filter by category, severity, district, date, and "has photos". Tap a pin for the card with photos.
- **List**: sortable table, same filters, CSV export.
- **Ticket page**: timeline (reported → submitted → confirmations → fixed), photos before and after, location, maintainer, district and magistrate link, duplicate links.
- **District stats**: open tickets, median days from submitted to fixed (community-reported), per magistrate district. Framed carefully: "based on resident reports, not county records."
- **Duplicate handling**: new tickets within 75 m and same category in the last 90 days prompt "Is this the same problem?" and can be merged, keeping both reporters informed.

### 8.4 Map layers

- Base map (OSM).
- Ticket pins (from `tickets_public` view, GeoJSON endpoint).
- County road centerlines with maintainer attribute (sources to verify: KYTC Open Data county road and state route layers, OSM). Used for the maintainer check in 8.2.
- Magistrate district boundaries (source to confirm with the County Clerk or the state redistricting GIS; stored as GeoJSON once obtained). Powers "Who represents me".
- Optional overlays: bridges from the grants data (Howard Road, Graham Road, Doores Trail, etc.) so residents can see funded projects next to reported problems.

### 8.5 Photos

- Up to four per ticket and per confirmation, client-resized, EXIF stripped server-side, stored privately until an admin approves or 24 hours pass with no report flag (configurable: default to manual approval for the first months).
- Moderation queue with one-tap approve/reject and a reason list. Rejected photos are deleted, the ticket stays.
- Every public photo shows the capture date and "resident-submitted."

### 8.6 Working with the county

Offer the Road Department a free weekly CSV or email digest of tickets in their format, and a dedicated login to mark tickets *Acknowledged* or *Fixed*. If they adopt it, their updates appear with a "county" badge and the hub becomes the shared view both sides lack today. The data model already has `actor_type = county` on ticket events for this.

---

## 9. Feedback: change requests and enhancements for the hub

- **Idea board** at `/feedback`: title, category (data request, new feature, fix, question), description, optional email. Public once moderated (fast-path: auto-publish text, hold for review only if a link or flagged word is present).
- **Upvotes** by device token plus Turnstile; one vote per idea per device. Optional email verification lifts the device cap for power users.
- **Status pipeline**: New → Under review → Planned → In progress → Shipped → Declined (with a public reason). This replaces the current "Full Roadmap" tab; the roadmap becomes the Planned and In progress columns.
- **Changelog** auto-generated from Shipped items and deploys.
- **Report a data error** on every figure, motion, and document: pre-fills the record id, lands in the verification queue, resolved items appear in the public corrections log. This is the single most important trust feature for a site that says "every figure traced to a record."
- **Contact**: a plain contact form for things people do not want public.

---

## 10. Commitments tracker: holding officials to their own words

Neutrality and accountability fit together when every official is measured by the same rules against what they themselves said. The hub never judges whether a promise was a good idea. It records what was promised, where, and what happened.

### 10.1 What counts as a commitment

- **Campaign promises** from candidate websites, mailers, questionnaires, forum and debate recordings, social posts, and news interviews.
- **Commitments made in office** found in the minutes, such as "bring it back next meeting" or "hold the bids until the next meeting", plus adopted plans and grant timelines with dates.
- **Only specific, checkable commitments are scored.** "Pave 20 miles of county road a year" or "no increase in the county tax rate" can be checked against the record. "Support our roads" cannot, so it is archived and shown as a statement but never scored.
- **Each entry records the evidence up front:** the exact quote, the source link, an archived copy stored by the hub plus a Wayback Machine snapshot, the date, and the measure that will decide it. The measure is written when the commitment is logged, before any rating, so the goalposts cannot move later.

### 10.2 Ratings

The scale follows the promise trackers PolitiFact has run for years, which many voters already recognize.

| Rating | Meaning |
|---|---|
| Not yet rated | Logged, with no relevant action yet |
| In the works | Action started, such as a motion made, an agenda item, or a new budget line |
| Stalled | No action for six months, or blocked |
| Kept | The measure written at intake is met |
| Compromise | Partly met, or met in a reduced form |
| Broken | The deadline passed without it, or the official acted against it |

Rules that keep ratings fair to how a Fiscal Court works:

- **The wording decides the test.** "I will push for X" is kept by moving or voting for X, even if the court declines. "X will happen" is kept only when X happens. Every commitment page shows the official's own motions and votes on the topic, so effort is visible either way.
- **Authority is labeled.** A promise the office cannot deliver alone, such as work on a state road, is marked "outside their authority" and judged on whether the official took the steps the office allows.
- **Every rating cites evidence.** Each rating links the motions, votes, budget lines, or minutes pages behind it. When a newly verified motion matches an open commitment's topic, the review queue suggests it as evidence.

### 10.3 Ranking

Officials are ranked on promise-keeping, never on activity volume.

```
score = (kept + 0.5 × compromise) ÷ resolved
resolved = kept + compromise + broken
```

- **Counts always appear beside the score**, for example "72% · 9 kept, 3 compromise, 3 broken of 15 resolved · 6 pending".
- **A minimum of five resolved commitments** is required before an official appears in the ranked list. Below that, the page says there are too few resolved commitments to rank, so one early result cannot top the table.
- **One table covers current officeholders:** the Judge-Executive and all four magistrates. Ties sort alphabetically.
- **Candidates who did not win** keep their archived commitments on the record but are not scored, because they had no power to act.
- **A "says and votes" view** on each official's page puts stated positions next to their recorded motions and votes on that topic, with no commentary.

### 10.4 Fairness safeguards

- **One rulebook.** The same template, rating definitions, and thresholds apply to every official, and a methodology page publishes them.
- **Right to respond.** Each official gets a private link by letter and email to respond to any commitment or rating. Responses are published unedited beside the rating, up to 2,500 characters. They may be withheld only for defined reasons, such as naming a private individual.
- **Pending period.** A proposed change to Kept, Compromise, or Broken is shown as "proposed" with its evidence for seven days before it counts in the score. Officials and readers can flag it during that window, and an open flag holds it.
- **Second reviewer.** A Broken rating needs a second reviewer whenever the hub has more than one editor. Every rating change appears in a public change log with its date and reason.
- **Disclosure.** The About page names the publisher. If anyone involved with the hub is or becomes a candidate, the page says so, and that person's own commitments go in the tracker under the same rules.
- **Plain labels.** Rating names are defined terms on the methodology page. Page copy uses no adjectives about officials.

### 10.5 Timing

The general election was November 3, 2026, and new county terms begin in January 2027. Campaign sites and posts disappear quickly after an election, so capturing and archiving every Judge-Executive and magistrate candidate's commitments should start now. Those become the baseline for the incoming Fiscal Court's term. In-office commitments for current officials can be extracted from the 31 meetings already in the hub.

---

## 11. Phased delivery

| Phase | Scope | Outcome |
|---|---|---|
| **0. Foundation** (2 to 3 weeks) | Recreate source from the bundle (React components, data to JSON). Vite + TypeScript. Routing and permalinks. Five-door IA, compact mobile header, bottom tab bar. Theme tokens and contrast fixes. Neutral badge wording. Favicon, OG image, manifest. Global search. GitHub Actions build with prerendered routes, deployed to GitHub Pages. | Same content, dramatically easier to use and share. Unblocks everything else. |
| **1. Analytics on existing data** (3 to 4 weeks) | Re-key motions and votes into the structured model (one-time manual pass over 349 motions plus the split-vote prose). Member scorecards, mover × seconder matrix, split votes view, topic timeline, appointments tracker. Budget treemap, Sankey, variance ranking, line pages with sparklines, trends, follow the dollar. Table view and CSV on every chart. Capture and archive 2026 campaign commitments; extract in-office commitments from the existing minutes. | The two features residents asked for, built from data you already have. |
| **2. Backend, feedback, and commitments** (3 to 4 weeks) | Hub-owned Supabase organization and project, schema, RLS, edge functions, Turnstile, admin login. Idea board, votes, status pipeline, data-error flags, corrections log. Minutes ingest and verification queue. Publish workflow. Commitments tracker: ratings with pending period, evidence links, official responses, ranking. | Residents can shape the hub; new meetings flow in with a human check; officials are measured against their own commitments. |
| **3. Roads** (4 to 5 weeks) | PostGIS tables, map, ticket flow, photo pipeline and moderation, county hand-off panel, tracking pages, duplicates, confirmations, district stats, digests. Maintainer check from road layers. | The public road-request record the county does not provide. |
| **4. Expand** (ongoing) | Checkbook and vendor views when the claims register arrives through open records. Peer county comparison. Who-represents-me with district boundaries. Email alerts ("tell me when the Fiscal Court votes on roads"). County login for ticket status. Dark mode. | The "fully transparent county" roadmap becomes real features. |

Each phase ships on its own; phase 0 alone is a visible improvement.

---

## 12. Risks and how the plan handles them

| Risk | Mitigation |
|---|---|
| Ranking seen as partisan | One published rulebook, measures written before rating, five-commitment minimum, seven-day pending period, second reviewer for Broken, unedited official responses, publisher disclosure. |
| Supabase free project pauses when idle | Scheduled keep-alive ping; move to Pro when Roads launches. |
| Credibility attacks ("this is a campaign site") | Neutral wording, published methodology, corrections log, raw data downloads, the publisher clearly named on an About page and nowhere in the analysis copy. |
| Extraction errors in votes | Human verification before publish, source quote on every row, public flagging, visible verified-by date. |
| PII leakage from road tickets | Separate PII table, no public view includes it, EXIF stripped, moderation before photos go public, privacy policy in plain English. |
| Spam and abuse on public submissions | Turnstile, rate limits, honeypot, moderation queues, device tokens, report button on every public item. |
| County form changes break the hand-off | The hand-off is a copy-and-open flow, not an automated submit; a nightly check compares the county form's field list against the stored template and alerts the admin on change. |
| Map data licensing | OSM (ODbL) with attribution; KYTC open data with attribution; hub-compiled data CC BY 4.0. |
| Cost creep | All chosen services have free tiers that cover a county of 37,000. Hard caps on storage (photo limits) and function invocations (rate limits). Estimated steady-state cost under $25/month. |
| Bus factor | Source in git, data in JSON and Postgres, deploy from CI, documented runbooks in `docs/`. |

---

## 13. Immediate next steps

1. Create the hub-owned email account and the separate accounts listed in section 7.6.
2. Register a custom domain and point GitHub Pages at it, then move the repository into a dedicated GitHub organization.
3. Create the hub's own Supabase organization and project.
4. Start capturing and archiving 2026 campaign commitments from every Judge-Executive and magistrate candidate (section 10.5).
5. Start phase 0 by reconstructing the source tree from the bundle's data arrays into `data/*.json`, with neutral copy throughout.
