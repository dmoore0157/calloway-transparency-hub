// Fails the build if any published record lacks its source, or if the data files disagree with each other.
import fs from 'node:fs';
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const meetings = read('data/meetings.json').meetings, motions = read('data/motions.json').motions, members = read('data/members.json').members;
const errors = [];
const meetingIds = new Set(meetings.map((m) => m.id)); const memberIds = new Set(members.map((m) => m.id));
for (const m of meetings) { if (!m.minutes_url?.startsWith('https://')) errors.push(`meeting ${m.id} has no minutes URL`); if (!m.source_doc_id) errors.push(`meeting ${m.id} has no source_doc_id`); }
for (const m of motions) {
  if (!meetingIds.has(m.meeting_id)) errors.push(`motion ${m.id} references unknown meeting ${m.meeting_id}`);
  if (!m.minutes_url || !m.source_doc_id) errors.push(`motion ${m.id} has no source`);
  if (m.mover && !memberIds.has(m.mover)) errors.push(`motion ${m.id} unknown mover ${m.mover}`);
  if (m.seconder && !memberIds.has(m.seconder)) errors.push(`motion ${m.id} unknown seconder ${m.seconder}`);
  const roster = members.filter((x) => (!x.term_start || x.term_start <= m.date) && (!x.term_end || x.term_end >= m.date)).map((x) => x.id);
  for (const id of roster) if (!m.votes[id]) errors.push(`motion ${m.id} missing vote for ${id}`);
  for (const id of Object.keys(m.votes)) if (!roster.includes(id)) errors.push(`motion ${m.id} has a vote for ${id}, who was not on the court that day`);
  if (m.vote_method === 'voice_unanimous' && Object.values(m.votes).some((v) => v === 'nay' || v === 'abstain')) errors.push(`motion ${m.id} is marked unanimous but has a nay/abstain`);
}
const fy = read('data/budget/fy2027.json'); const total = fy.lines.filter((l) => l.kind === 'appropriation').reduce((s, l) => s + l.amount, 0);
if (Math.abs(total - fy.summary.total) > fy.summary.total * 0.02) errors.push(`FY2027 appropriation lines (${total}) differ from the stated total (${fy.summary.total}) by more than 2%`);
const auditsDoc = read('data/audits.json'); const findingIds = new Set();
for (const a of auditsDoc.audits) {
  const t = a.totals; if (t.receipts - t.disbursements + t.financing !== t.net_change) errors.push(`audit FY${a.fy}: receipts - disbursements + financing != net change`);
  if (t.balance_begin + t.net_change !== t.balance_end) errors.push(`audit FY${a.fy}: fund balance arithmetic does not reconcile`);
  if (!a.report_url?.startsWith('https://')) errors.push(`audit FY${a.fy} has no report URL`);
  for (const f of a.findings) { if (findingIds.has(f.id)) errors.push(`duplicate finding ${f.id}`); findingIds.add(f.id); if (!f.response || !f.recommendation || !f.summary) errors.push(`finding ${f.id} is missing text`); }
}
for (const a of auditsDoc.audits) for (const f of a.findings) if (f.repeat_of && !findingIds.has(f.repeat_of)) errors.push(`finding ${f.id} repeats unknown ${f.repeat_of}`);
for (const c of auditsDoc.chains) for (const id of c.ids) if (!findingIds.has(id)) errors.push(`chain ${c.key} references unknown finding ${id}`);
const el = read('data/elections.json'); const off = read('data/officials.json'); const allIds = new Set(members.map((m) => m.id));
for (const e of el.elections) for (const r of e.races) {
  if (r.candidates.filter((c) => c.result === 'won').length > 1) errors.push(`${e.id} ${r.office} ${r.district ?? ''}: more than one winner`);
  for (const c of r.candidates) { if (c.member_id && !allIds.has(c.member_id)) errors.push(`${e.id}: candidate ${c.name} references unknown member ${c.member_id}`); if (c.votes != null && c.pct == null) errors.push(`${e.id}: ${c.name} has votes but no percentage`); for (const l of c.links) if (!l.url.startsWith('http')) errors.push(`${e.id}: bad link for ${c.name}`); }
  const tot = r.candidates.reduce((s, c) => s + (c.votes ?? 0), 0); for (const c of r.candidates) if (c.votes != null && tot && Math.abs(c.votes / tot * 100 - c.pct) > 0.6) errors.push(`${e.id}: ${c.name} percentage does not match votes`);
}
for (const o of off.offices) { for (const h of [o.current, o.incoming].filter(Boolean)) if (h.member_id && !allIds.has(h.member_id)) errors.push(`office ${o.id} references unknown member ${h.member_id}`); }
for (const m of members) if (m.incoming && (!m.term_start || m.term_start <= '2026-11-08')) errors.push(`incoming member ${m.id} needs a future term_start`);
const rc = read('data/record_checks.json'); const motionIds = new Set(motions.map((m) => m.id));
for (const c of rc.checks) { if (!allIds.has(c.member_id)) errors.push(`record check ${c.id} unknown member`); for (const id of c.motion_ids) if (!motionIds.has(id)) errors.push(`record check ${c.id} references unknown motion ${id}`); if (!c.statement.source_url.startsWith('http')) errors.push(`record check ${c.id} has no source`); if (!rc.labels[c.record]) errors.push(`record check ${c.id} has unknown label ${c.record}`); }
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`data ok: ${meetings.length} meetings, ${motions.length} motions, ${fy.lines.length} budget lines, ${auditsDoc.audits.length} audits with ${findingIds.size} findings, ${el.elections.length} elections, ${off.offices.length} offices`);
