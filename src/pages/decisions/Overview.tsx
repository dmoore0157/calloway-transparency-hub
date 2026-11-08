import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { meetings, motions, members, CATEGORY_ORDER } from '../../lib/data';
import { memberStats, recordedVotes, topicsByQuarter } from '../../lib/analytics';
import { Section, Stat, ChartFrame, SourceNote } from '../../components/ui';
import { MotionRow } from '../../components/VoteBits';
import { palette, tooltipStyle } from '../../lib/palette';
import { dateLong } from '../../lib/format';

export default function DecisionsOverview() {
  const p = palette(); const stats = memberStats(); const rec = recordedVotes(); const topics = topicsByQuarter();
  const subst = motions.filter((m) => !m.is_routine);
  const cats = CATEGORY_ORDER.filter((c) => topics.some((t) => (t as Record<string, unknown>)[c]));
  return (
    <>
      <p className="lede">The Fiscal Court is the Judge-Executive plus four magistrates. It meets the third Wednesday of each month at 9:00 a.m. Everything here is compiled from the official minutes, and every item links to its PDF.</p>
      <div className="grid cols-4">
        <Stat label="Meetings tracked" value={meetings.length} sub={`${dateLong(meetings[meetings.length - 1].date)} to ${dateLong(meetings[0].date)}`} />
        <Stat label="Motions" value={motions.length} sub={`${subst.length} substantive, ${motions.length - subst.length} routine`} />
        <Stat label="Recorded or split votes" value={rec.length} sub="roll calls, nays, abstentions, failed seconds" color={p.accent} />
        <Stat label="Unanimous by voice" value={`${Math.round(((motions.length - rec.length) / motions.length) * 100)}%`} sub="of all motions passed with all ayes" />
      </div>
      <div className="notice" style={{ marginTop: 12 }}><strong>How to read vote counts.</strong> Kentucky fiscal courts vote by voice. The minutes name an individual member's vote only on a roll call, a nay, or an abstention. When the minutes say "all voted aye," every present member is recorded here as aye. So the recorded votes below are the only places the public record distinguishes members.</div>

      <Section title="Who makes the motions" action={<Link to="/decisions/members" className="small">Scorecards and the mover-seconder matrix ›</Link>} />
      <div className="grid cols-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {stats.map((s) => { const m = members.find((x) => x.id === s.id)!; return (
          <Link key={s.id} to={`/decisions/members/${s.id}`} className="linkcard">
            <h3 style={{ fontSize: 16 }}>{m.full_name}</h3><p style={{ marginBottom: 6 }}>{m.title}</p>
            <div className="small"><strong>{s.made}</strong> motions made · <strong>{s.seconded}</strong> seconded<br /><strong>{s.nays}</strong> nay{s.nays === 1 ? '' : 's'} · <strong>{s.abstentions}</strong> abstention{s.abstentions === 1 ? '' : 's'}<br />attended {s.attended} of {s.total}</div>
          </Link>); })}
      </div>
      <p className="tiny muted" style={{ marginTop: 8 }}>Counts exclude routine motions (approving minutes, paying bills, adjourning). More motions is not better or worse; it often reflects committee assignments. Members are never ranked on activity.</p>

      <Section title="Every recorded or split vote" action={<Link to="/decisions/votes?filter=recorded" className="small">All in the tracker ›</Link>} />
      <ul className="list-reset grid">{rec.map((m) => <MotionRow key={m.id} m={m} />)}</ul>

      <Section title="What the court spends its time on" />
      <ChartFrame title="Substantive motions by topic, per quarter" intro="A motion can carry more than one topic." rows={topics} filename="motions-by-topic.csv" footer={<SourceNote>Fiscal Court minutes, January 2024 to April 2026. Topics are assigned by keyword and reviewed; report any that look wrong.</SourceNote>}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topics} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={p.line} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="quarter" tick={{ fill: p.muted, fontSize: 11 }} /><YAxis tick={{ fill: p.muted, fontSize: 12 }} width={30} />
            <Tooltip {...tooltipStyle()} /><Legend wrapperStyle={{ fontSize: 11 }} />
            {cats.map((c, i) => <Bar key={c} dataKey={c} stackId="a" fill={p.series[i % p.series.length]} />)}
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </>
  );
}
