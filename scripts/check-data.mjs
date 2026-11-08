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
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`data ok: ${meetings.length} meetings, ${motions.length} motions, ${fy.lines.length} budget lines`);
