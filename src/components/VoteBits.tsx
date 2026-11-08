import { Link } from 'react-router-dom';
import { members, memberById, type Motion, type VoteValue } from '../lib/data';
import { voteLabel, methodLabel } from '../lib/analytics';
import { dateShort, usd } from '../lib/format';

export function VoteDots({ votes }: { votes: Record<string, VoteValue> }) {
  return <span className="row" style={{ gap: 6 }}>{members.filter((m) => votes[m.id]).map((m) => <span key={m.id} className="small" title={`${m.full_name}: ${voteLabel[votes[m.id]]}`}><span className={`vote-dot vote-${votes[m.id]}`} />{m.short_name}</span>)}</span>;
}

export function MotionRow({ m, showMeeting = true }: { m: Motion; showMeeting?: boolean }) {
  const unanimous = m.vote_method === 'voice_unanimous';
  return (
    <li className="card" style={{ padding: '12px 14px', borderLeft: `4px solid ${unanimous ? 'var(--line)' : m.outcome === 'no_second' ? 'var(--warn)' : 'var(--accent)'}` }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <Link to={`/decisions/motions/${m.id}`} style={{ color: 'inherit', fontWeight: 600, flex: 1, minWidth: 200 }}>{cap(m.text)}{m.fragment && <span className="small muted" style={{ fontWeight: 400 }}> (motion text incomplete; see minutes)</span>}</Link>
        <span className={`badge ${m.outcome === 'passed' ? (unanimous ? '' : 'accent') : 'warn'}`}>{m.result_label}</span>
      </div>
      <div className="small muted" style={{ marginTop: 4 }}>
        {showMeeting && <>{dateShort(m.date)} · </>}
        {m.mover ? <>Moved by <Link to={`/decisions/members/${m.mover}`}>{memberById[m.mover].short_name}</Link></> : 'Mover not named'}{m.seconder && <>, seconded by <Link to={`/decisions/members/${m.seconder}`}>{memberById[m.seconder].short_name}</Link></>}
        {m.dollar_amount ? <> · {usd(m.dollar_amount)}</> : null}{m.is_routine && <> · routine</>}
      </div>
      {!unanimous && <div style={{ marginTop: 6 }}><VoteDots votes={m.votes} /><div className="small" style={{ marginTop: 4 }}>{methodLabel[m.vote_method]}{m.note ? `: ${m.note}` : ''}</div></div>}
      <div className="row" style={{ marginTop: 6, gap: 4 }}>{m.category.map((c) => <span key={c} className="badge">{c}</span>)}</div>
    </li>
  );
}
export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
