import { Link, useParams } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { members, memberById, motions, meetings, links, CATEGORY_ORDER } from '../../lib/data';
import { memberStats, moverSeconderMatrix } from '../../lib/analytics';
import { Section, SourceNote, Empty, Crumb, ShareButton, Stat, Ext, ChartFrame } from '../../components/ui';
import { MotionRow } from '../../components/VoteBits';
import { usd, dateShort } from '../../lib/format';
import { palette, tooltipStyle } from '../../lib/palette';
import { CommitmentSummary } from '../accountability/CommitmentSummary';

export default function Members() {
  const stats = memberStats(); const matrix = moverSeconderMatrix(); const p = palette();
  const max = Math.max(1, ...Object.values(matrix).flatMap((r) => Object.values(r)));
  const rows = stats.map((s) => ({ member: memberById[s.id].full_name, title: memberById[s.id].title, attended: `${s.attended}/${s.total}`, made: s.made, seconded: s.seconded, nays: s.nays, abstentions: s.abstentions, dollars_moved: s.dollarsMoved }));
  return (
    <>
      <p className="lede">The five members of the Fiscal Court, with what the minutes record for each: attendance, motions made and seconded, and every nay or abstention. Counts sit side by side and are never ranked, because more motions is neither better nor worse.</p>
      <div className="grid cols-3">
        {stats.map((s) => { const m = memberById[s.id]; return (
          <Link key={s.id} to={`/decisions/members/${s.id}`} className="linkcard">
            <div className="eyebrow">{m.title}</div><h3>{m.full_name}</h3>
            <div className="grid cols-2" style={{ gap: 6 }}>
              <div><div className="small muted">Motions made</div><strong style={{ fontSize: 20, fontFamily: 'var(--serif)' }}>{s.made}</strong></div>
              <div><div className="small muted">Seconded</div><strong style={{ fontSize: 20, fontFamily: 'var(--serif)' }}>{s.seconded}</strong></div>
              <div><div className="small muted">Nays</div><strong style={{ fontSize: 20, fontFamily: 'var(--serif)', color: s.nays ? 'var(--bad)' : undefined }}>{s.nays}</strong></div>
              <div><div className="small muted">Abstentions</div><strong style={{ fontSize: 20, fontFamily: 'var(--serif)', color: s.abstentions ? 'var(--warn)' : undefined }}>{s.abstentions}</strong></div>
            </div>
            <p style={{ marginTop: 8 }}>Attended {s.attended} of {s.total} meetings · motions naming {usd(s.dollarsMoved, { compact: true })}</p>
          </Link>); })}
      </div>
      <Section title="Who moves, who seconds" />
      <ChartFrame title="Mover × seconder, substantive motions" intro="Rows are who made the motion; columns are who seconded it. Darker cells are more frequent pairs. Working pairs, and pairs that never occur, both show up here." rows={members.map((a) => ({ mover: a.short_name, ...Object.fromEntries(members.map((b) => [b.short_name, matrix[a.id][b.id]])) }))} filename="mover-seconder-matrix.csv" footer={<SourceNote>Fiscal Court minutes, Jan 2024 to Apr 2026, excluding routine motions.</SourceNote>}>
        <div style={{ overflowX: 'auto' }}>
          <div className="matrix" style={{ gridTemplateColumns: `110px repeat(${members.length}, minmax(64px, 1fr))`, minWidth: 440 }}>
            <div className="small muted" style={{ textAlign: 'left' }}>moved by ↓ / seconded by →</div>{members.map((b) => <div key={b.id} className="small" style={{ fontWeight: 700 }}>{b.short_name}</div>)}
            {members.map((a) => (<Fragment2 key={a.id}>
              <div className="small" style={{ textAlign: 'left', fontWeight: 700 }}>{a.short_name}</div>
              {members.map((b) => { const n = matrix[a.id][b.id]; const t = n / max; return <div key={b.id} style={{ background: a.id === b.id ? 'var(--surface-2)' : `rgba(201,168,76,${0.12 + t * 0.85})`, color: t > 0.55 ? '#1A2744' : 'var(--ink)', fontWeight: 700 }}>{a.id === b.id ? '—' : n}</div>; })}
            </Fragment2>))}
          </div>
        </div>
      </ChartFrame>
      <Section title="Motions made, by topic" />
      <ChartFrame title="What each member moves" rows={stats.map((s) => ({ member: memberById[s.id].short_name, ...s.byCategory }))} filename="motions-by-member-topic.csv">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={stats.map((s) => ({ member: memberById[s.id].short_name, ...s.byCategory }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={p.line} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="member" tick={{ fill: p.muted, fontSize: 12 }} /><YAxis tick={{ fill: p.muted, fontSize: 12 }} width={30} /><Tooltip {...tooltipStyle()} />
            {CATEGORY_ORDER.map((c, i) => <Bar key={c} dataKey={c} stackId="a" fill={p.series[i % p.series.length]} />)}
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <div className="card" style={{ marginTop: 12 }}><table className="data"><thead><tr><th>Member</th><th>Attended</th><th className="num">Made</th><th className="num">Seconded</th><th className="num">Nays</th><th className="num">Abstained</th><th className="num">Dollars named</th></tr></thead><tbody>{rows.map((r) => <tr key={r.member}><td>{r.member} <span className="small muted">{r.title}</span></td><td>{r.attended}</td><td className="num">{r.made}</td><td className="num">{r.seconded}</td><td className="num">{r.nays}</td><td className="num">{r.abstentions}</td><td className="num">{usd(r.dollars_moved)}</td></tr>)}</tbody></table></div>
      <SourceNote>Fiscal Court minutes. Official names and contact details: <Ext href={links.officials}>county elected-officials page</Ext>.</SourceNote>
    </>
  );
}
import { Fragment as Fragment2 } from 'react';

export function MemberPage() {
  const { id = '' } = useParams(); const m = memberById[id];
  if (!m) return <Empty>No member found. <Link to="/decisions/members">All members</Link></Empty>;
  const s = memberStats().find((x) => x.id === id)!;
  const made = motions.filter((x) => x.mover === id && !x.is_routine); const seconded = motions.filter((x) => x.seconder === id && !x.is_routine);
  const dissent = motions.filter((x) => ['nay', 'abstain'].includes(x.votes[id]));
  const missed = meetings.filter((mt) => mt.absent.includes(id));
  const topics = Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <Crumb items={[{ to: '/decisions', label: 'Decisions' }, { to: '/decisions/members', label: 'Members' }, { label: m.full_name }]} />
      <div className="row between"><div><div className="eyebrow">{m.title}{m.district ? ` · District ${m.district}` : ''}</div><h2>{m.full_name}</h2></div><ShareButton /></div>
      <div className="grid cols-4">
        <Stat label="Attendance" value={`${s.attended}/${s.total}`} sub={missed.length ? `Missed: ${missed.map((x) => dateShort(x.date)).join(', ')}` : 'Present at every tracked meeting'} />
        <Stat label="Motions made" value={s.made} sub="substantive only" /><Stat label="Motions seconded" value={s.seconded} />
        <Stat label="Nays and abstentions" value={`${s.nays} · ${s.abstentions}`} sub="the only individually recorded votes" color={dissent.length ? 'var(--accent)' : undefined} />
      </div>
      <CommitmentSummary memberId={id} />
      <Section title="Recorded nays and abstentions" />
      {dissent.length === 0 ? <Empty>The minutes record no nay or abstention by {m.short_name} in the tracked period. Every other vote was a voice vote with all ayes.</Empty> : <ul className="list-reset grid">{dissent.map((x) => <MotionRow key={x.id} m={x} />)}</ul>}
      <Section title="Topics of motions made" />
      <div className="row">{topics.length === 0 ? <span className="muted small">No substantive motions made.</span> : topics.map(([c, n]) => <Link key={c} to={`/decisions/votes?member=${id}&cat=${encodeURIComponent(c)}`} className="chip">{c} <strong>{n}</strong></Link>)}</div>
      <Section title={`Motions made (${made.length})`} action={<Link to={`/decisions/votes?member=${id}`} className="small">Filter the tracker ›</Link>} />
      <ul className="list-reset grid">{made.slice(0, 12).map((x) => <MotionRow key={x.id} m={x} />)}</ul>
      {made.length > 12 && <p className="small"><Link to={`/decisions/votes?member=${id}`}>See all {made.length} in the vote tracker ›</Link></p>}
      <Section title={`Motions seconded (${seconded.length})`} />
      <ul className="list-reset grid">{seconded.slice(0, 6).map((x) => <MotionRow key={x.id} m={x} />)}</ul>
      <SourceNote>Fiscal Court minutes, Jan 2024 to Apr 2026. "All voted aye" votes are recorded as aye for every present member.</SourceNote>
    </>
  );
}
