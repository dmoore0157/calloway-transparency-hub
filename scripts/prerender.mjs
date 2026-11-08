// After `vite build`: write a real index.html for every known route (so deep links and link previews work on
// GitHub Pages, which only serves files), plus a 404.html that boots the app and restores the requested path.
import fs from 'node:fs';
import path from 'node:path';
const dist = 'dist';
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const base = (html.match(/<script type="module" crossorigin src="([^"]+)\/assets\//) || [, ''])[1] + '/';
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const meetings = read('data/meetings.json').meetings, motions = read('data/motions.json').motions, members = read('data/members.json').members, lines = read('data/budget/fy2027.json').lines;
const routes = [
  ['money', 'County Budget', 'Where Calloway County money comes from and where it goes, FY2018 to FY2027.'],
  ['money/sources', 'Where the money comes from', 'Calloway County General Fund revenue by source.'],
  ['money/where-it-goes', 'Where the money goes', 'Calloway County spending by category, with a follow-your-dollar calculator.'],
  ['money/budget-vs-actual', 'Budget vs. actual', 'What Calloway County planned to spend versus what it spent.'],
  ['money/lines', 'Budget line items', 'Every account in the Calloway County FY2026-27 budget.'],
  ['money/grants', 'Grants and outside funding', 'Outside money Calloway County pursued and won.'],
  ['money/debt', 'Debt and obligations', 'What Calloway County owes.'],
  ['decisions', 'Fiscal Court decisions', 'Meetings, motions, votes and member scorecards.'],
  ['decisions/meetings', 'Fiscal Court meetings', 'Every meeting since January 2024, summarized and linked to the minutes.'],
  ['decisions/votes', 'Vote tracker', 'Every motion: who moved it, who seconded, and the result.'],
  ['decisions/members', 'Members and scorecards', 'Attendance, motions, seconds, nays and abstentions for each member.'],
  ['decisions/ordinances', 'Ordinances', 'Calloway County ordinances by category.'],
  ['decisions/who-represents-me', 'Who represents me', 'Find your magistrate district.'],
  ['roads', 'Road requests map', 'Every road problem residents have reported, on a map.'],
  ['roads/report', 'Report a road problem', 'Report a pothole, washout, or drainage problem and get the county form pre-filled.'],
  ['roads/list', 'All road requests', 'Searchable list of resident road requests.'],
  ['roads/districts', 'Road requests by district', 'Open requests and response times by magistrate district.'],
  ['accountability', 'Promises and commitments', 'What Calloway County officials promised and what happened.'],
  ['accountability/all', 'All commitments', 'Every logged commitment.'],
  ['accountability/methodology', 'How ratings work', 'The published rulebook for rating promises.'],
  ['records', 'Reports and audits', 'The documents behind every number.'],
  ['records/sources', 'Sources', 'Where each figure comes from.'], ['records/glossary', 'Glossary', 'Plain-English definitions.'], ['records/data', 'Data downloads', 'Every dataset as JSON and CSV.'], ['records/corrections', 'Corrections log', 'Every correction made to the hub.'], ['records/about', 'About and methodology', 'Who runs the hub and how it is built.'],
  ['feedback', 'Feedback', 'Suggest improvements and vote on ideas.'], ['admin', 'Admin', 'Editor sign-in.'],
  ...meetings.map((m) => [`decisions/meetings/${m.id}`, `Fiscal Court meeting, ${m.date_label}`, m.summary[0]]),
  ...motions.map((m) => [`decisions/motions/${m.id}`, `Motion ${m.date}: ${m.text.slice(0, 80)}`, `${m.result_label}. Moved by ${m.mover ?? 'unknown'}${m.seconder ? `, seconded by ${m.seconder}` : ''}.`]),
  ...members.map((m) => [`decisions/members/${m.id}`, `${m.full_name}, ${m.title}`, `Attendance, motions, seconds and recorded votes for ${m.full_name}.`]),
  ...members.map((m) => [`accountability/${m.id}`, `${m.full_name}: promises and commitments`, `Commitments made by ${m.full_name} and what happened.`]),
  ...lines.map((l) => [`money/lines/${encodeURIComponent(l.account)}`, `${l.name} (${l.fund})`, `Budget line ${l.account}: $${l.amount.toLocaleString()} in FY2026-27.`]),
];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const seen = new Set();
for (const [route, title, desc] of routes) {
  if (seen.has(route)) continue; seen.add(route);
  const t = `${title} · Calloway County Transparency Hub`;
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(t)}</title>`).replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(desc)}$2`).replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(t)}$2`).replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(desc)}$2`);
  out = out.replace(/__BASE__/g, base);
  const dir = path.join(dist, route); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'index.html'), out);
}
fs.writeFileSync(path.join(dist, 'index.html'), html.replace(/__BASE__/g, base));
// 404 fallback: remember the requested path, load the app from the base, and restore it (see index.html).
const notFound = html.replace(/__BASE__/g, base).replace('<script>', `<script>try{sessionStorage.setItem('hub:redirect',location.pathname+location.search+location.hash);}catch(e){}location.replace('${base}');</script><script>`);
fs.writeFileSync(path.join(dist, '404.html'), notFound);
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
// copy data for downloads
fs.cpSync('data', path.join(dist, 'data'), { recursive: true });
console.log(`prerendered ${seen.size} routes, base ${base}`);
