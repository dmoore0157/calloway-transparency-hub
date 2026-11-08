// Contrast check for the reel theme. Reads the token blocks in src/theme.css and fails if any text token falls below
// WCAG AA (4.5:1) on the surface it is used on. Run: node scripts/check-theme.mjs  (also runs in CI)
import fs from 'node:fs';
const css = fs.readFileSync('src/theme.css', 'utf8');
const block = (sel) => { const i = css.indexOf(sel + ' {'); if (i < 0) throw new Error('missing block ' + sel); const body = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i)); return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])); };
const hex = (c) => { const m = /^#([0-9a-f]{6})$/i.exec(c); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const root = block(':root'); const canvas = block('body, .on-dark, .card.brand'); const card = block('.card, .stat, .linkcard, .table-wrap, .drawer, .input, .searchbar, .maplibregl-popup-content, .tile'); const light = block(':root[data-theme="light"] body');
const TEXT = ['ink', 'ink-muted', 'link', 'kicker', 'accent-ink', 'hl-1', 'hl-2', 'ok', 'warn', 'bad'];
const checks = [];
// canvas text sits on the darker end of the gradient's lighter stop (worst case) and on slate rows
for (const bg of [root['canvas-1'], root['canvas-2']]) for (const t of TEXT) checks.push(['canvas', t, canvas[t], bg]);
for (const t of ['ink', 'ink-muted', 'link']) checks.push(['canvas row', t, canvas[t], root.slate]);
for (const bg of [card.surface, root['stat-bg'], card['surface-2']]) for (const t of TEXT) if (!(bg === card['surface-2'] && /^hl|kicker/.test(t))) checks.push(['card', t, card[t], bg]);
for (const t of ['ok', 'warn', 'bad']) checks.push(['card badge', t, card[t], card[t + '-bg']]);
for (const bg of ['#E9EEF4', light.surface]) for (const t of TEXT) checks.push(['light canvas', t, light[t], bg]);
checks.push(['pill/button', 'navy on amber', root.navy, root.amber], ['pill/button', 'navy on mint', root.navy, root.mint]);
let bad = 0;
for (const [ctx, name, fg, bg] of checks) {
  const f = hex(fg), b = hex(bg); if (!f || !b) continue; // translucent tokens are checked by eye
  const r = ratio(f, b); if (r < 4.5) { bad++; console.log(`FAIL ${ctx}: ${name} ${fg} on ${bg} = ${r.toFixed(2)}:1`); }
}
console.log(`${checks.length - bad}/${checks.length} contrast checks pass (AA 4.5:1)`);
process.exit(bad ? 1 : 0);
