// Downloads the Kentucky Administrative Regulations (KAR) that apply to county government from the Legislative
// Research Commission site and writes data/kar.json for the "Ask the records" assistant.
//   node scripts/fetch-kar.mjs   (needs network)
// Runs weekly in .github/workflows/krs.yml, after the statutes.
import fs from 'node:fs';

const BASE = 'https://apps.legislature.ky.gov/law/kar/titles/';
const OUT = 'data/kar.json';

/** Titles (all chapters) or title:chapter pairs to load, with the parts of county government each governs. */
export const SCOPE = [
  { title: '109', chapter: null, agency: 'Department for Local Government', offices: ['County budget', 'County finance', 'Fiscal Court', 'County Treasurer', 'Judge-Executive', 'Local government'] },
  { title: '31', chapter: null, agency: 'State Board of Elections', offices: ['Elections', 'County Clerk', 'County Board of Elections'] },
  { title: '45', chapter: '1', agency: 'Auditor of Public Accounts', offices: ['County audits', 'Fiscal Court', 'Sheriff', 'County Clerk'] },
  { title: '501', chapter: '3', agency: 'Department of Corrections', offices: ['County jail', 'Jailer'] },
  { title: '725', chapter: '1', agency: 'Department for Libraries and Archives', offices: ['Records retention', 'Open records', 'All county offices'] },
  { title: '401', chapter: '49', agency: 'Energy and Environment Cabinet', offices: ['Solid waste', 'Fiscal Court'] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad3 = (n) => String(Number(n)).padStart(3, '0');

async function get(url) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'CallowayTransparencyHub/1.0 (+https://dmoore0157.github.io/calloway-transparency-hub)' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) { if (attempt === 4) throw new Error(`${url}: ${e.message}`); await sleep(1500 * attempt); }
  }
}

const decode = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;|&rsquo;|&#8217;/g, "'").replace(/&quot;|&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&sect;/g, '§').replace(/\s+/g, ' ').trim();

/** Chapter links on a title page: .../titles/109/015/ */
export function parseTitle(html, title) {
  const out = new Map();
  for (const m of html.matchAll(new RegExp(`<a[^>]+href="[^"]*/law/kar/titles/${title}/(\\d{3})/?"[^>]*>([\\s\\S]*?)</a>`, 'gi'))) {
    const inner = m[2]; if (out.has(m[1]) || !/kar-status current/.test(inner)) continue;
    out.set(m[1], decode(/class="kar-name">([\s\S]*?)<\/span>/.exec(inner)?.[1] ?? ''));
  }
  return [...out].map(([chapter, name]) => ({ chapter: String(Number(chapter)), name }));
}

/** Regulation links on a chapter page, with their status (current / inactive). */
export function parseKarChapter(html) {
  const name = /<h1 class="header">[^<]*?-\s*([^<]+)<\/h1>/.exec(html)?.[1]?.trim() ?? '';
  const regs = [];
  for (const m of html.matchAll(/<a href="[^"]*\/law\/kar\/titles\/(\d+)\/(\d{3})\/(\d{3})\/?"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const inner = m[4];
    regs.push({ title: m[1], chapter: String(Number(m[2])), reg: m[3], name: decode(/class="citation-text">([\s\S]*?)<\/span>/.exec(inner)?.[1] ?? ''), status: /kar-status current/.test(inner) ? 'current' : 'inactive' });
  }
  return { name, regs };
}

/** Text of a regulation page: heading, RELATES TO / STATUTORY AUTHORITY / NECESSITY, numbered sections, history. */
export function parseRegulation(html) {
  const start = html.indexOf('<div id="regular-content"'); const end = html.indexOf('<div id="alternate-content"', start);
  const body = start >= 0 ? html.slice(start, end > 0 ? end : undefined) : html;
  const meta = {};
  for (const m of body.matchAll(/<h2 class="metadata-item-header">([\s\S]*?)<\/h2>\s*<span class="metadata-item-text">([\s\S]*?)<\/span>/g)) meta[decode(m[1]).replace(/:$/, '')] = decode(m[2]);
  const lines = [];
  for (const m of body.matchAll(/<section class="section"[^>]*data-level="(\d+)"[^>]*>\s*<h2 class="headers"[^>]*>([\s\S]*?)<\/h2>\s*<span class="section-text">([\s\S]*?)<\/span>\s*<\/section>/g)) lines.push(`${decode(m[2])} ${decode(m[3])}`.trim());
  const history = /<span class="history-body">([\s\S]*?)<\/span>/.exec(body)?.[1];
  return {
    heading: decode(/<span class="citation-text">([\s\S]*?)<\/span>/.exec(body)?.[1] ?? ''),
    relates_to: meta['RELATES TO'] ?? null, authority: meta['STATUTORY AUTHORITY'] ?? null, purpose: meta['NECESSITY, FUNCTION, AND CONFORMITY'] ?? null,
    text: lines.join('\n'), history: history ? decode(history) : null,
  };
}

async function main() {
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  const chapters = []; const regulations = []; const failures = [];
  for (const sc of SCOPE) {
    let list = sc.chapter ? [{ chapter: sc.chapter, name: '' }] : [];
    if (!sc.chapter) {
      try { list = parseTitle(await get(`${BASE}${sc.title}/`), sc.title); } catch (e) { failures.push(`title ${sc.title}: ${e.message}`); }
      if (!list.length) failures.push(`title ${sc.title}: no chapters found`);
    }
    for (const c of list) {
      const url = `${BASE}${sc.title}/${pad3(c.chapter)}/`;
      let parsed;
      try { parsed = parseKarChapter(await get(url)); } catch (e) { failures.push(`${sc.title} KAR ${c.chapter}: ${e.message}`); continue; }
      const current = parsed.regs.filter((r) => r.status === 'current');
      chapters.push({ cite: `${sc.title} KAR ${c.chapter}`, title: sc.title, chapter: c.chapter, name: parsed.name || c.name, agency: sc.agency, url, offices: sc.offices, regulations: current.length });
      console.log(`${sc.title} KAR ${c.chapter}: ${current.length} current regulations`);
      for (const r of current) {
        const cite = `${sc.title} KAR ${c.chapter}:${r.reg}`;
        const rurl = `${BASE}${sc.title}/${pad3(c.chapter)}/${r.reg}/`;
        try {
          const p = parseRegulation(await get(rurl));
          if (!p.text) throw new Error('no regulation text found');
          regulations.push({ cite, title: sc.title, chapter: c.chapter, name: p.heading || r.name, agency: sc.agency, url: rurl, offices: sc.offices, relates_to: p.relates_to, authority: p.authority, purpose: p.purpose, text: p.text.slice(0, 20000), history: p.history });
        } catch (e) {
          const old = prev?.regulations?.find((x) => x.cite === cite);
          if (old) regulations.push(old); failures.push(`${cite}: ${e.message}`);
        }
        await sleep(200);
      }
    }
  }
  if (regulations.length < 20) throw new Error(`only ${regulations.length} regulations fetched; refusing to overwrite ${OUT}. Failures: ${failures.slice(0, 10).join('; ')}`);
  fs.writeFileSync(OUT, JSON.stringify({ source: 'Kentucky Legislative Research Commission, apps.legislature.ky.gov/law/kar', fetched: new Date().toISOString().slice(0, 10), chapters, regulations }, null, 1) + '\n');
  console.log(`Wrote ${OUT}: ${chapters.length} chapters, ${regulations.length} regulations. ${failures.length} failures.`);
  if (failures.length) console.log(failures.slice(0, 40).join('\n'));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
