// Merge hub-extracted meeting JSON (scratch format) into data/meetings.json and data/motions.json.
// Usage: node scripts/merge-minutes.mjs <dir-with-json>
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
const meetingsFile = JSON.parse(fs.readFileSync('data/meetings.json', 'utf8'));
const motionsFile = JSON.parse(fs.readFileSync('data/motions.json', 'utf8'));
const members = JSON.parse(fs.readFileSync('data/members.json', 'utf8')).members;
const rosterOn = (date) => members.filter((m) => (!m.term_start || m.term_start <= date) && (!m.term_end || m.term_end >= date)).map((m) => m.id);
const ROUTINE = /(waive the formal reading|approve the minutes|payment of (the )?bil|pay the bills|adjourn|financial (statement|report)|treasurer.s report|approve the statement|approve the report|cash transfers?( as presented)?$|approve the transfers?( as presented)?$|expenditure transfers|budget transfers( as presented)?$)/i;
const CATS = [['Roads & bridges', /road|bridge|pav|gravel|culvert|asphalt|dump truck|grader|tractor|drive\b|lane\b|trail\b|street|flex|rural secondary/i], ['Budget & finance', /budget|transfer|line item|certificate of deposit|\bcd\b|loan|check|bills|financial|settlement|excess fee|treasurer|amendment|tax|money market|escrow|fund/i], ['Ordinances & resolutions', /ordinance|resolution|first reading|second reading|repeal/i], ['Appointments & boards', /appoint|board|commission|council|term/i], ['Personnel', /personnel|job description|salary|salaries|hire|employee|position|incentive|wages|stipend|cost-of-living|pay adjust/i], ['Contracts & bids', /bid|contract|agreement|vendor|rfp|renewal|service|mou|memorandum/i], ['Property & surplus', /surplus|property|lot\b|lots\b|purchase|vehicle|equipment|deed|lease|acres|land/i], ['Public safety', /sheriff|jail|911|fire|ems\b|emergency|cert\b|firearm|deputy|policy|siren|detention/i], ['Grants & outside funding', /grant|fema|cdbg|arpa|kytc|transportation cabinet|ccbip|flex|homeland|donation/i], ['Meetings & procedure', /executive session|calendar|schedule|holiday|adjourn|minutes|mission statement/i]];
const cats = (t) => { const c = CATS.filter(([, rx]) => rx.test(t)).map(([k]) => k); return c.length ? c : ['Other']; };
const dollars = (t) => { const m = t.match(/\$\s?([\d,]+(?:\.\d+)?)\s*(k|m)?\b/i); if (!m) return null; const v = parseFloat(m[1].replace(/,/g, '')); return v * (m[2]?.toLowerCase() === 'k' ? 1000 : m[2]?.toLowerCase() === 'm' ? 1e6 : 1); };
const label = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const have = new Set(meetingsFile.meetings.map((m) => m.id));
let added = 0, addedMotions = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  if (have.has(j.id)) { console.log('skip existing', j.id); continue; }
  const roster = rosterOn(j.date); const present = j.present; const absent = roster.filter((m) => !present.includes(m));
  const meeting = { id: j.id, date: j.date, kind: j.kind, date_label: label(j.date), minutes_url: j.url, absent, absent_other: j.absent_other ?? [], summary: j.summary, vote_notes: j.vote_notes ?? [], source_doc_id: 'minutes-' + j.id, extraction: 'hub-2026-11' };
  meetingsFile.meetings.push(meeting); added++;
  j.motions.forEach((m, i) => {
    const votes = {}; for (const id of roster) votes[id] = present.includes(id) ? 'aye' : 'absent';
    let outcome = 'passed', method = 'voice_unanimous', result = 'Unanimous (voice)', note = m.note ?? null;
    if (m.r === 'roll_call') { method = 'roll_call'; for (const id of m.ayes ?? []) votes[id] = 'aye'; for (const id of m.nays ?? []) votes[id] = 'nay'; const a = (m.ayes ?? []).length, n = (m.nays ?? []).length; outcome = a > n ? 'passed' : 'failed'; result = `Roll-call vote — ${outcome} ${a}–${n}`; }
    else if (m.r === 'nay') { method = 'voice_with_nays'; for (const id of m.nays ?? []) votes[id] = 'nay'; const n = (m.nays ?? []).length; const a = present.length - n; result = `Passed ${a}–${n}`; }
    else if (m.r === 'abstain') { method = 'voice_with_abstention'; for (const id of m.abstains ?? []) votes[id] = 'abstain'; result = `Passed ${present.length - (m.abstains ?? []).length}–0 — abstention`; }
    else if (m.r === 'no_second') { method = 'no_vote'; outcome = 'no_second'; for (const id of roster) votes[id] = 'not_recorded'; result = 'No second — motion died'; }
    motionsFile.motions.push({ id: `${j.id}-${String(i + 1).padStart(2, '0')}`, meeting_id: j.id, date: j.date, seq: i + 1, text: m.a, mover: m.m ?? null, seconder: m.s ?? null, outcome, vote_method: method, result_label: result, note, is_routine: ROUTINE.test(m.a), category: cats(m.a), dollar_amount: dollars(m.a), votes, source_doc_id: 'minutes-' + j.id, minutes_url: j.url, fragment: false, text_note: null, extraction: 'hub-2026-11' });
    addedMotions++;
  });
}
meetingsFile.meetings.sort((a, b) => b.date.localeCompare(a.date) || (a.kind === 'special' ? -1 : 1));
motionsFile.motions.sort((a, b) => b.date.localeCompare(a.date) || a.meeting_id.localeCompare(b.meeting_id) || b.seq - a.seq);
motionsFile.notes.extraction = 'Meetings marked "hub-2026-11" were added in November 2026 from the county\'s minutes PDFs by the hub\'s own extraction and have not yet been independently reviewed; the linked PDF is authoritative. Meetings marked "legacy" came from the original hub compilation.';
fs.writeFileSync('data/meetings.json', JSON.stringify(meetingsFile, null, 1)); fs.writeFileSync('data/motions.json', JSON.stringify(motionsFile, null, 1));
console.log(`added ${added} meetings, ${addedMotions} motions; totals ${meetingsFile.meetings.length} meetings, ${motionsFile.motions.length} motions`);
