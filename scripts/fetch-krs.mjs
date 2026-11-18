// Downloads the Kentucky Revised Statutes chapters that govern county government and its offices from the
// Legislative Research Commission site and writes data/krs.json for the "Ask the records" assistant.
//   node scripts/fetch-krs.mjs [--only 67,68]   (needs network and `pdftotext` from poppler-utils)
// Runs weekly in .github/workflows/krs.yml. Section text comes from the official PDF of each section.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const BASE = 'https://apps.legislature.ky.gov/law/statutes/';
const OUT = 'data/krs.json';

/** Chapters to load, with the parts of county government each one governs (used as search tags). */
export const CHAPTERS = {
  '61': ['Open meetings', 'Open records', 'Public officers', 'All county offices'],
  '62': ['Oaths and bonds of officers', 'All county offices'],
  '63': ['Removal and vacancies in office', 'All county offices'],
  '64': ['Fees and salaries of county officers', 'County Clerk', 'Sheriff', 'Fiscal Court'],
  '65': ['Local government general provisions', 'Interlocal agreements', 'Special districts', 'Ethics code', 'Fiscal Court', '911 dispatch'],
  '65A': ['Special districts', 'Fiscal Court'],
  '66': ['County bonds and debt', 'Fiscal Court'],
  '67': ['Fiscal Court', 'Judge-Executive', 'Magistrates', 'County ordinances', 'County administrative code'],
  '68': ['County finance', 'County Treasurer', 'County budget', 'Fiscal Court', 'Judge-Executive'],
  '69': ['County Attorney'],
  '70': ['Sheriff', 'Constables'],
  '71': ['Jailer', 'County jail'],
  '72': ['Coroner'],
  '75': ['Fire protection districts', 'Fire departments'],
  '91A': ['Local taxes', 'Insurance premium tax', 'Transient room tax', 'Fiscal Court'],
  '100': ['Planning and zoning'],
  '132': ['Property tax rates', 'Property Valuation Administrator', 'Fiscal Court'],
  '133': ['Property tax assessment', 'Board of Assessment Appeals', 'Property Valuation Administrator'],
  '134': ['Tax collection', 'Sheriff', 'Delinquent taxes', 'County Clerk'],
  '147A': ['Area development districts'],
  '178': ['County roads', 'Road department', 'Fiscal Court'],
  '179': ['County roads', 'County road engineer', 'Road department', 'County road aid'],
  '424': ['Legal notices and advertising', 'Publication requirements'],
  '441': ['County jail', 'Jailer', 'Fiscal Court'],
  '45A': ['Purchasing and bids', 'Local procurement', 'Fiscal Court'],
  '116': ['Voter registration', 'Elections'],
  '117': ['Elections', 'County Clerk', 'County Board of Elections'],
  '118': ['Elections', 'Candidates', 'Ballots'],
  '121': ['Campaign finance'],
};

const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? new Set(process.argv[i + 1].split(',')) : null; })();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, binary = false) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'CallowayTransparencyHub/1.0 (+https://dmoore0157.github.io/calloway-transparency-hub)' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return binary ? Buffer.from(await r.arrayBuffer()) : await r.text();
    } catch (e) { if (attempt === 4) throw new Error(`${url}: ${e.message}`); await sleep(1500 * attempt); }
  }
}

const decode = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

/** Chapter links on the title-and-chapter index: "CHAPTER 67 COUNTY GOVERNMENT (...)". */
export function parseIndex(html) {
  const out = {};
  for (const m of html.matchAll(/<a[^>]+href="[^"]*chapter\.aspx\?id=(\d+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = decode(m[2]); const c = /^CHAPTER\s+([0-9]+[A-Z]?)\b\.?\s*(.*)$/i.exec(label);
    if (c && !out[c[1].toUpperCase()]) out[c[1].toUpperCase()] = { id: m[1], title: c[2].trim() };
  }
  return out;
}

/** Section links on a chapter page: <a class="statute" href="...statute.aspx?id=5473">.020  County road engineer or supervisor. </a> */
export function parseChapter(html) {
  const out = [];
  for (const m of html.matchAll(/<a[^>]*class="statute"[^>]*href="[^"]*statute\.aspx\?id=(\d+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = decode(m[2]); const s = /^(\.\d+[A-Z0-9-]*)\s+(.*)$/.exec(label);
    if (s) out.push({ id: m[1], suffix: s[1], title: s[2].trim() });
  }
  return out;
}

/** Clean pdftotext output of one section: unwrap lines, keep the history line separate. */
export function cleanSectionText(raw) {
  const lines = raw.replace(/\f/g, '\n').split('\n').map((l) => l.replace(/\s+$/, ''))
    .filter((l) => !/^\s*Page \d+ of \d+\s*$/i.test(l) && !/Legislative Research Commission PDF Version/i.test(l));
  const text = lines.join('\n').replace(/-\n(?=[a-z])/g, '').replace(/([^\n])\n(?!\n|\s*\(\w{1,4}\)|\s*(?:History|Effective|Catchline|Legislative Research Commission Note)\b)/g, '$1 ').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  const hist = /(?:^|\n)\s*(History:[\s\S]*)$/.exec(text);
  const eff = /Effective:\s*([^\n]+?)(?=\s*History:|\n|$)/.exec(text);
  return { body: hist ? text.slice(0, hist.index).trim() : text, history: hist ? hist[1].replace(/\s+/g, ' ').trim() : null, effective: eff ? eff[1].trim() : null };
}

function pdfText(buf) {
  const tmp = path.join(os.tmpdir(), `krs-${process.pid}.pdf`);
  fs.writeFileSync(tmp, buf);
  try { return execFileSync('pdftotext', ['-enc', 'UTF-8', tmp, '-'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }); } finally { fs.rmSync(tmp, { force: true }); }
}

async function main() {
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  const index = parseIndex(await get(`${BASE}index.aspx`));
  const chapters = []; const sections = []; const failures = [];
  for (const [num, offices] of Object.entries(CHAPTERS)) {
    if (only && !only.has(num)) continue;
    const ch = index[num.toUpperCase()];
    if (!ch) { failures.push(`chapter ${num} not in index`); continue; }
    const url = `${BASE}chapter.aspx?id=${ch.id}`;
    const list = parseChapter(await get(url));
    chapters.push({ chapter: num, title: ch.title, url, offices, sections: list.length });
    console.log(`KRS Chapter ${num}: ${list.length} sections`);
    const queue = [...list];
    const worker = async () => {
      for (let s = queue.shift(); s; s = queue.shift()) {
        const cite = `${num}${s.suffix}`;
        const surl = `${BASE}statute.aspx?id=${s.id}`;
        const base = { cite, chapter: num, title: s.title, url: surl, offices };
        if (/^(Repealed|Renumbered|Recodified|Expired)\b/i.test(s.title)) { sections.push({ ...base, status: 'repealed', text: s.title, history: null, effective: null }); continue; }
        try {
          const { body, history, effective } = cleanSectionText(pdfText(await get(surl, true)));
          sections.push({ ...base, status: 'in_force', text: body.slice(0, 20000), history, effective });
        } catch (e) {
          const old = prev?.sections?.find((x) => x.cite === cite);
          if (old) sections.push(old); failures.push(`${cite}: ${e.message}`);
        }
        await sleep(150);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  }
  if (only && prev) { // partial run: keep the chapters that were not refreshed
    for (const c of prev.chapters) if (!only.has(c.chapter)) chapters.push(c);
    for (const s of prev.sections) if (!only.has(s.chapter)) sections.push(s);
  }
  const key = (c) => c.split('.').map((p, i) => (i ? p.padEnd(6, '0') : p.padStart(5, '0'))).join('.');
  sections.sort((a, b) => key(a.cite).localeCompare(key(b.cite)));
  chapters.sort((a, b) => key(a.chapter).localeCompare(key(b.chapter)));
  const inForce = sections.filter((s) => s.status === 'in_force').length;
  if (inForce < 100) throw new Error(`only ${inForce} sections fetched; refusing to overwrite ${OUT}. Failures: ${failures.slice(0, 10).join('; ')}`);
  fs.writeFileSync(OUT, JSON.stringify({ source: 'Kentucky Legislative Research Commission, apps.legislature.ky.gov/law/statutes', fetched: new Date().toISOString().slice(0, 10), chapters, sections }, null, 1) + '\n');
  console.log(`Wrote ${OUT}: ${chapters.length} chapters, ${sections.length} sections (${inForce} in force). ${failures.length} failures.`);
  if (failures.length) console.log(failures.slice(0, 40).join('\n'));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
