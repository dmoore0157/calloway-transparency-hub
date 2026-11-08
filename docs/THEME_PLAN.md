# Reel theme: plan to restyle the whole hub

> **Status (Nov 8, 2026): shipped.** Built with the recommended defaults: dark canvas with light cards, reel headlines and chapter pills 01 to 05, strong grid behind page openers only, and a "Light" option in the theme switch (footer and mobile menu). Contrast is checked in CI by `scripts/check-theme.mjs`; social cards and app icons are regenerated with `npm run brand`.

Goal: make the site look and feel like the "Calloway County Transparency Hub" reel (`docs/design/reel-reference-frames.png`),
keeping every page as readable and accessible as it is today. Preview of the proposed system:
`docs/design/reel-style-tile.png` (source `docs/design/reel-style-tile.html`).

## 1. What the reel does

| Element | In the reel | Sampled values |
|---|---|---|
| Canvas | Dark gradient, charcoal at the top to night navy at the bottom; one scene uses a blue variant | `#22242F` to `#18243C`; blue `#1E3C5C` to `#243C60` |
| Texture | Thin white grid, horizontal lines plus slanted verticals (about 80°), full bleed | white lines; on the site at 5 to 8% opacity |
| Decoration | Two concentric outline arcs, amber outside, mint inside, cropped off the right edge | 2px strokes |
| Accents | Amber and mint, used for alternate words in headlines, pills, bars, dots, arrows | amber `#FCBA45`, mint `#5ED8C4` |
| Headlines | Very heavy sans, all caps, tight tracking, two-line stacks, last word colored, ends in a period ("FOLLOW THE **MONEY.**") | Inter 900, letter-spacing about -0.025em, line-height 0.98 |
| Section tags | Rounded pills with a number: "01 THE MONEY", "02 THE DECISIONS", "03 THE LEADERS" | navy text on amber or mint |
| Stat cards | Light rounded cards, huge navy number on the left, small caps label and a colored bar on the right | card `#EAF0F6`, number `#13304E`, label `#4D5D73` |
| Link rows | Slate rounded rows: colored dot, all-caps label, matching arrow | row `#304860`, white text |
| Footer lockup | "CALLOWAY COUNTY" in mint caps over "TRANSPARENCY HUB" in grey, page dots on the right | mint, grey `#A9B6C8`, dots `#586A80` with amber current |
| Mark | Amber circle with a navy bar-chart glyph | replaces today's "CC" square |
| Calls to action | Amber pill, navy text ("EXPLORE IT. SHARE IT.") | |
| Voice | Short, punchy, neutral: "No spin. Just the records." "Sourced. Checkable. Public." | |

## 2. Key decisions (please confirm)

1. **Dark canvas, light content cards (recommended).** The reel itself puts its numbers on light cards over a dark
   background. Doing the same on the site keeps long tables, budget lines and minutes readable: page chrome, heroes and
   section openers go dark; everything people read closely sits on light cards (`#F4F7FB`) with navy ink. Alternative:
   fully dark cards everywhere, which reads well in short bursts but worse for long tables and older eyes.
2. **Keep a light option.** The theme switch becomes "Reel (default)", "Light" (light canvas, same accents and type,
   for bright screens) and print. The current cream and serif look is retired.
3. **One typeface: Inter**, self-hosted from the `@fontsource-variable/inter` package (no Google dependency, works on
   GitHub Pages). Heavy all-caps display for page and section titles; regular Inter for body and tables. Georgia goes.
4. **Doors become numbered chapters** like the reel: 01 The Money, 02 The Decisions, 03 The Roads, 04 The Leaders,
   05 The Records. Nav labels stay short ("Money"); the chapter pill appears on each section's landing hero.
5. **Grid texture strength.** Reel-strength lines behind heroes only; a fainter version (about 5%) on the rest of the
   canvas; none on cards. Turned off for print and when the reader prefers reduced transparency.

## 3. Design tokens (old to new)

| Token | Today | Reel theme | Notes |
|---|---|---|---|
| `--bg` | `#F5F1EA` cream | gradient `#22242F` to `#18243C` | plus grid texture layer |
| `--surface` (cards) | `#FFFFFF` | `#F4F7FB` | stat cards `#EAF0F6` |
| `--surface-2` | `#EFE9DF` | `#E3EAF2` | table headers, quiet fills |
| `--ink` (on cards) | `#2C2C2C` | `#13304E` navy | 11.7:1 on card |
| `--ink-muted` (on cards) | `#5E5B54` | `#4D5D73` | 6.3:1 |
| new `--ink-on-dark` | none | `#F0F0F6` | 13.6:1 on canvas |
| new `--muted-on-dark` | none | `#A9B6C8` | 7.5:1 |
| `--line` | `#E3DCD0` | cards `#D5DFEA`, canvas `rgba(240,240,246,.10)` | |
| `--brand` (header, footer) | `#1A2744` | transparent over canvas; footer `#121B2E` | |
| `--accent` | `#C9A84C` gold | amber `#FCBA45` | fills, pills, focus rings, bars |
| new `--accent-2` | none | mint `#5ED8C4` | second accent on dark |
| `--action` (links, primary) | `#B3232A` red | on dark: mint; on cards: deep teal `#0B7A6B` (4.9:1); primary buttons: amber pill with navy text (7.9:1) | red leaves the brand |
| `--accent-ink` | `#8A6B1F` | deep amber `#9A6400` (4.7:1 on card) | amber text on light only |
| new `--row` | none | `#304860` | link rows, nav pills on dark |
| `--ok / --warn / --bad` | green / orange / red | kept as reserved status colors, always with a word or icon: ok `#0B6B4F` on `#DDF3EA`, warn `#8A4B00` on `#FDEBD3`, bad `#C2353C` on `#F9DEDF` | never reused for series |
| `--radius` | 10px | 16px cards, 12px rows, 999px pills | |
| `--shadow` | soft | none on dark; `0 1px 0 rgba(19,48,78,.06)` on cards | |

Mint and amber are never used as text on light cards (1.5:1); there they appear only as fills, bars and dots.

## 4. Charts

Recharts colors come from `src/lib/palette.ts`. Proposed categorical order, reel hues deepened until they pass the
dataviz validator (lightness band, chroma, color-blind separation, normal-vision separation):

- **On light cards (default):** teal `#13A08C`, amber `#E09A00`, blue `#2F6FD6`, rose `#D9497F`, violet `#7357D9`,
  olive `#5E8A1F`. All checks pass; amber is 2.2:1 against the card, so amber series always carry a direct label or
  the existing table view (every chart already has one).
- **On dark panels (full-dark mode):** teal `#1FA08D`, amber `#C58510`, blue `#4A8DEB`, rose `#DB5E92`, violet
  `#9480EC`, copper `#B56A2E`. All checks pass.
- **Record-type colors** (audited / county-reported / year-end): navy `#13304E`, amber `#E09A00`, violet `#7357D9`.
- Single-series charts use teal; "highlight one bar" uses amber against slate-grey others. Gridlines `#D5DFEA`.
- Add `node <dataviz>/validate_palette.js` for both palettes to CI so a future color change cannot quietly fail.

## 5. Components

| Component | Change |
|---|---|
| Header | Transparent over the canvas, amber mark plus two-line lockup (white "Calloway County", mint "TRANSPARENCY HUB"); nav links white, current page gets a slate pill with an amber underline; Ask button stays the amber pill. Sticky with a navy blur once scrolled. |
| Mobile bottom nav | Night-navy bar, white icons, current item amber; dot indicator echoing the reel's page dots. |
| Footer | Reel lockup on the left, links in muted grey, page-dot motif; "No spin. Just the records." line. |
| Page heroes (new `Hero` component) | Chapter pill, display headline with the last word in amber or mint, one-line lede, optional stat cards on the right, arcs decoration, strong grid. Used on every section landing page and the home page. |
| Section titles | Mint all-caps label with a hairline rule to the right (as in the tile). |
| Cards | Light, 16px radius, navy ink. `.card.accent` gets a 4px amber or mint left edge instead of gold. |
| Stat (`Stat`) | Reel stat card: big navy number (Inter 900, tabular), small caps label, colored bar. Count-up animation once on scroll, off for reduced motion. |
| Link cards and door list | Reel link rows: dot, caps label, sub-label, arrow; used on Home, section overviews and Records. |
| Buttons | Primary amber pill; secondary mint pill; ghost outline on dark; navy pill on cards. |
| Chips, filters, subnav | Pill shapes; selected = navy on cards, slate with amber underline on dark. |
| Badges | Uppercase micro-pills; status colors as in section 3; "Repeat finding", "Open seat", "Former" use them consistently. |
| Notices | Light cards with an amber (info), orange (warn) or red (bad) left edge and an icon. |
| Tables | Navy ink, caps headers, tabular numbers, zebra on `#F7FAFD`; unchanged structure. |
| Forms | White fields on cards, navy text, amber focus ring (3px); on dark, slate fields. |
| Vote dots, timelines | Keep meaning (aye green, nay red, abstain orange, absent grey) with the new status values; timeline dots amber. |
| Map | Switch the MapLibre style to a dark basemap (OpenFreeMap "dark" or a recolored "liberty"); ticket pins amber (open), mint (fixed), slate (closed). |
| Ask the records | Question bubbles slate, answer on light cards, citation markers in deep teal, "Ask" pill amber; share panel gets a reel-style preview card. |
| Markdown, print | Print stylesheet stays light and serif-free, drops texture and arcs. |

## 6. Brand assets

- New mark (amber circle, navy bar-chart glyph) as `favicon.svg`, PWA icons, and the header.
- Social cards: replace `og-default.png` with reel-style 1200x630 cards: one per chapter ("Follow the money.", "See how
  they voted.", "Beyond the slogans.", "No spin. Just the records."), generated at build time from one SVG template
  and wired into the prerendered pages' `og:image`. Shared Ask answers get a card with the answer title.
- Optional 1080x1920 story cards in the same template for the hub's own social posts.

## 7. Page-by-page

| Area | Changes |
|---|---|
| Home | Reel opener as the hero: "No spin. Just the records." with the search box and Ask entry; stat cards (General Fund spending, motions tracked, meetings); chapter link rows 01 to 05; last-meeting card and live road tickets on light cards; election strip as a reel card. |
| Money | Hero "Follow the money." with the latest spending stat; charts on light cards with the new palette; budget line explorer table unchanged in structure. |
| Decisions | Hero "See how they voted." with motions and meetings stats; vote dots and mover-seconder matrix recolored (matrix uses a teal sequential ramp). |
| Roads | Hero "Fix it. Track it." (or keep current copy); dark map; report flow steps use amber progress. |
| Leaders | Hero "Beyond the slogans."; profile header as a dark band with name in display type; record-check cards keep their colored left edge; election race cards use teal and slate bars. |
| Records and audits | Hero "Sourced. Checkable. Public."; audit charts in the new palette; repeat chains as reel link rows. |
| Ask, Feedback, Admin, About | Same tokens; Admin stays plain light for long working sessions. |

## 8. Accessibility and quality gates

- Contrast (computed): white on canvas 13.6:1, muted grey on canvas 7.5:1, amber on canvas 9.0:1, mint on canvas
  8.9:1, navy on card 11.7:1, navy on amber pill 7.9:1, navy on mint pill 7.8:1, deep teal link on card 4.9:1, deep
  amber text on card 4.7:1, red status text on card 5.1:1. Body text never drops below 4.5:1.
- All-caps display type only for headings up to about eight words; body copy stays sentence case.
- Grid and arcs are decorative (`aria-hidden`), sit behind content, and disappear in print, forced-colors and
  `prefers-reduced-transparency`. Count-up and any motion respect `prefers-reduced-motion`.
- Screenshot every prerendered route at 390px and 1280px before and after; add an automated contrast check over the
  token pairs and the palette validator to CI.

## 9. Rollout

| Phase | Scope | Effort |
|---|---|---|
| 1. Foundation | Inter self-hosted; new tokens in `theme.css` (Reel default, Light option); canvas gradient and texture; header, mobile nav and footer; remove hard-coded colors in `Shell.tsx` and `Audits.tsx`; status palette. | about half a day |
| 2. Components | `Hero`, reel `Stat`, link rows, buttons, chips, badges, notices, cards, forms; chart palette in `palette.ts`; validator and contrast checks in CI. | about a day |
| 3. Pages | Home and the five section landing pages get reel heroes and chapter pills; Leaders, Audits, Ask, Roads polish; dark map style. | about a day |
| 4. Brand and sharing | New mark and favicon; generated social cards per chapter and for shared Ask answers; optional story cards. | about half a day |
| 5. QA | Before-and-after screenshots of all routes, contrast and palette checks, print check, then publish. | a few hours |

Each phase ships on its own, so the site never sits half-styled; phases 1 and 2 together already make every page
look like the reel.

## 10. Open questions

1. Dark canvas with light cards (recommended), or fully dark cards?
2. Adopt the reel's headline voice on section heroes ("Follow the money.", "See how they voted.", "Beyond the
   slogans.") and chapter numbers 01 to 05?
3. Is the reel's bright grid wanted at full strength behind heroes, or kept subtle everywhere?
4. Keep a Light option in the theme switch, or ship Reel only?
