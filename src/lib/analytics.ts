import { motions, members, meetings, rosterOn, issues, type Motion, type VoteValue, type Issue } from './data';

export type MemberStats = { id: string; attended: number; total: number; made: number; seconded: number; nays: number; abstentions: number; dollarsMoved: number; byCategory: Record<string, number> };

export function substantive(ms: Motion[] = motions) { return ms.filter((m) => !m.is_routine); }

export function memberStats(ms: Motion[] = motions): MemberStats[] {
  return members.map((mem) => {
    const s: MemberStats = { id: mem.id, attended: 0, total: meetings.length, made: 0, seconded: 0, nays: 0, abstentions: 0, dollarsMoved: 0, byCategory: {} };
    const mine = meetings.filter((mt) => rosterOn(mt.date).some((r) => r.id === mem.id)); s.total = mine.length;
    for (const mt of mine) if (!mt.absent.includes(mem.id)) s.attended++;
    for (const m of ms) {
      if (m.is_routine) continue;
      if (m.mover === mem.id) { s.made++; s.dollarsMoved += m.dollar_amount ?? 0; for (const c of m.category) s.byCategory[c] = (s.byCategory[c] ?? 0) + 1; }
      if (m.seconder === mem.id) s.seconded++;
    }
    for (const m of ms) { const v = m.votes[mem.id]; if (v === 'nay') s.nays++; if (v === 'abstain') s.abstentions++; }
    return s;
  });
}

export function moverSeconderMatrix(ms: Motion[] = motions) {
  const n: Record<string, Record<string, number>> = {};
  for (const a of members) { n[a.id] = {}; for (const b of members) n[a.id][b.id] = 0; }
  for (const m of ms) if (!m.is_routine && m.mover && m.seconder) n[m.mover][m.seconder]++;
  return n;
}

export function recordedVotes(ms: Motion[] = motions) { return ms.filter((m) => m.vote_method !== 'voice_unanimous'); }

export function topicsByQuarter(ms: Motion[] = motions) {
  const out: Record<string, Record<string, number>> = {};
  for (const m of ms) {
    if (m.is_routine) continue;
    const d = new Date(m.date + 'T12:00:00'); const q = `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`;
    out[q] ??= {}; for (const c of m.category) out[q][c] = (out[q][c] ?? 0) + 1;
  }
  return Object.entries(out).sort(([a], [b]) => a.localeCompare(b)).map(([quarter, cats]) => ({ quarter, ...cats }));
}

export const voteLabel: Record<VoteValue, string> = { aye: 'Aye', nay: 'Nay', abstain: 'Abstained', absent: 'Absent', not_recorded: 'Not recorded' };
export const methodLabel: Record<string, string> = { voice_unanimous: 'Voice vote, all ayes', roll_call: 'Roll-call vote', voice_with_nays: 'Voice vote with nays', voice_with_abstention: 'Voice vote with abstention', no_vote: 'No vote taken' };

/** A member's participation on one recurring issue, from the minutes. */
export type IssueRecord = { issue: Issue; total: number; moved: number; seconded: number; aye: number; nay: number; abstain: number; absent: number; last: Motion | null; motions: Motion[] };
export function issueMotions(issue: Issue, ms: Motion[] = motions) {
  const rx = issue.pattern ? new RegExp(issue.pattern, 'i') : null;
  return ms.filter((m) => (issue.category ? m.category.includes(issue.category) : false) || (rx ? rx.test(m.text) || rx.test(m.note ?? '') : false));
}
export function issueRecord(memberId: string, ms: Motion[] = motions): IssueRecord[] {
  return issues.map((issue) => {
    const mine = issueMotions(issue, ms).filter((m) => rosterOn(m.date).some((r) => r.id === memberId)).sort((a, b) => b.date.localeCompare(a.date));
    const r: IssueRecord = { issue, total: mine.length, moved: 0, seconded: 0, aye: 0, nay: 0, abstain: 0, absent: 0, last: mine[0] ?? null, motions: mine };
    for (const m of mine) {
      if (m.mover === memberId) r.moved++; if (m.seconder === memberId) r.seconded++;
      const v = m.votes[memberId]; if (v === 'aye') r.aye++; else if (v === 'nay') r.nay++; else if (v === 'abstain') r.abstain++; else if (v === 'absent') r.absent++;
    }
    return r;
  });
}
/** Meeting-summary lines that name the member, oldest to newest. */
export function namedInMinutes(shortName: string, title?: string) {
  const rx = new RegExp(`(Squire|Judge|Magistrate)\\s+${shortName}\\b|\\b${shortName}'s\\b|\\b${shortName}\\b(?= (?:abstain|recus|asked|presented|voted|noted|moved|withdrew|attended|spoke))`, 'i');
  void title;
  return meetings.flatMap((mt) => [...mt.summary, ...(mt.vote_notes ?? [])].filter((b) => rx.test(b)).map((b) => ({ meeting: mt, text: b }))).sort((a, b) => b.meeting.date.localeCompare(a.meeting.date));
}
