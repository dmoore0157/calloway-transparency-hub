import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { motions, members, memberById, meetingById, CATEGORY_ORDER, motionNotes } from '../../lib/data';
import { Section, SourceNote, Empty, Pager, Crumb, ShareButton, Ext, Stat } from '../../components/ui';
import { MotionRow, VoteDots, cap } from '../../components/VoteBits';
import { FlagButton } from '../../components/FlagButton';
import { methodLabel, voteLabel } from '../../lib/analytics';
import { dateLong, usd } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { Download } from 'lucide-react';

export default function Votes() {
  const [sp, setSp] = useSearchParams();
  const filter = sp.get('filter') ?? 'subst'; const member = sp.get('member') ?? 'All'; const cat = sp.get('cat') ?? 'All'; const q = sp.get('q') ?? ''; const page = Number(sp.get('page') ?? 1);
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v && v !== 'All' && !(k === 'filter' && v === 'subst')) n.set(k, v); else n.delete(k); if (k !== 'page') n.delete('page'); setSp(n, { replace: true }); };
  const rows = useMemo(() => motions.filter((m) => (filter === 'all' || (filter === 'subst' && !m.is_routine) || (filter === 'recorded' && m.vote_method !== 'voice_unanimous') || (filter === 'money' && m.dollar_amount))
    && (member === 'All' || m.mover === member || m.seconder === member || ['nay', 'abstain'].includes(m.votes[member]))
    && (cat === 'All' || m.category.includes(cat))
    && (!q || `${m.text} ${m.result_label} ${m.note ?? ''} ${m.date}`.toLowerCase().includes(q.toLowerCase()))), [filter, member, cat, q]);
  const PER = 30; const pages = Math.ceil(rows.length / PER); const view = rows.slice((page - 1) * PER, page * PER);
  const counts = { all: motions.length, subst: motions.filter((m) => !m.is_routine).length, recorded: motions.filter((m) => m.vote_method !== 'voice_unanimous').length, money: motions.filter((m) => m.dollar_amount).length };
  return (
    <>
      <p className="lede">Every motion the Fiscal Court has taken since January 2024: what was decided, who made the motion, who seconded it, and the result. Filter by member to see what each official moved, seconded, or voted against.</p>
      <div className="grid cols-4">
        {([['subst', 'Substantive motions'], ['recorded', 'Recorded / split votes'], ['money', 'Motions naming dollars'], ['all', 'All motions']] as const).map(([k, l]) => <button key={k} className="stat" style={{ textAlign: 'left', cursor: 'pointer', borderTopColor: filter === k ? 'var(--action)' : undefined }} onClick={() => set('filter', k)} aria-pressed={filter === k}><div className="label">{l}</div><div className="value">{counts[k]}</div></button>)}
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <input className="input" placeholder="Search motions (tax rate, bridge, ordinance, cannabis, dump truck…)" value={q} onChange={(e) => set('q', e.target.value)} aria-label="Search motions" />
        <div className="row" style={{ marginTop: 10 }}><span className="small muted">Member:</span>{['All', ...members.map((m) => m.id)].map((id) => <button key={id} className={`chip ${member === id ? 'active' : ''}`} onClick={() => set('member', id)}>{id === 'All' ? 'All' : memberById[id].short_name}</button>)}</div>
        <div className="row" style={{ marginTop: 8 }}><span className="small muted">Topic:</span>{['All', ...CATEGORY_ORDER].map((c) => <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => set('cat', c)}>{c}</button>)}</div>
        <div className="row between" style={{ marginTop: 8 }}><span className="small muted">{rows.length} motions</span><button className="btn small" onClick={() => downloadCsv('motions.csv', rows.map((m) => ({ id: m.id, date: m.date, motion: m.text, mover: m.mover, seconder: m.seconder, result: m.result_label, method: m.vote_method, note: m.note, dollars: m.dollar_amount, routine: m.is_routine, topics: m.category.join('; '), ...Object.fromEntries(members.map((mm) => ['vote_' + mm.short_name, m.votes[mm.id]])), minutes: m.minutes_url })))}><Download size={14} /> CSV</button></div>
      </div>
      <div className="notice" style={{ margin: '12px 0' }}>{motionNotes.voice_votes}</div>
      {rows.length === 0 ? <Empty>No motions match. Try a broader search or clear a filter.</Empty> : <ul className="list-reset grid">{view.map((m) => <MotionRow key={m.id} m={m} />)}</ul>}
      <Pager page={page} pages={pages} onChange={(p) => set('page', String(p))} />
      <SourceNote>Calloway County Fiscal Court minutes. {motionNotes.verification}</SourceNote>
    </>
  );
}

export function MotionPage() {
  const { id = '' } = useParams(); const m = motions.find((x) => x.id === id);
  if (!m) return <Empty>No motion found. <Link to="/decisions/votes">Vote tracker</Link></Empty>;
  const mt = meetingById[m.meeting_id]; const all = motions.filter((x) => x.meeting_id === m.meeting_id).sort((a, b) => a.seq - b.seq); const i = all.findIndex((x) => x.id === m.id);
  const tally = members.reduce((acc, mem) => { const v = m.votes[mem.id]; acc[v] = (acc[v] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  return (
    <>
      <Crumb items={[{ to: '/decisions', label: 'Decisions' }, { to: `/decisions/meetings/${mt.id}`, label: mt.date_label }, { label: `Motion ${m.seq}` }]} />
      <div className="card" style={{ borderLeft: `4px solid ${m.vote_method === 'voice_unanimous' ? 'var(--line)' : 'var(--accent)'}` }}>
        <div className="row between"><span className="eyebrow">Motion · {dateLong(m.date)}</span><ShareButton /></div>
        <h2>{cap(m.text)}</h2>
        {m.text_note && <div className={`notice ${m.fragment ? 'warn' : ''}`} style={{ marginBottom: 10 }}>{m.text_note}</div>}
        <div className="row"><span className={`badge ${m.outcome === 'passed' ? 'ok' : 'warn'}`}>{m.result_label}</span>{m.category.map((c) => <span key={c} className="badge">{c}</span>)}{m.is_routine && <span className="badge">Routine</span>}</div>
        <div className="grid cols-3" style={{ marginTop: 12 }}>
          <Stat label="Moved by" value={m.mover ? <Link to={`/decisions/members/${m.mover}`}>{memberById[m.mover].full_name}</Link> : '—'} />
          <Stat label="Seconded by" value={m.seconder ? <Link to={`/decisions/members/${m.seconder}`}>{memberById[m.seconder].full_name}</Link> : '—'} />
          <Stat label="How it was decided" value={<span style={{ fontSize: 18 }}>{methodLabel[m.vote_method]}</span>} sub={m.dollar_amount ? `Names ${usd(m.dollar_amount)}` : undefined} />
        </div>
        <Section title="How each member is recorded" />
        <div className="table-wrap"><table className="data"><thead><tr><th>Member</th><th>Recorded as</th></tr></thead><tbody>{members.map((mem) => <tr key={mem.id}><td><Link to={`/decisions/members/${mem.id}`}>{mem.full_name}</Link> <span className="small muted">{mem.title}</span></td><td><span className={`vote-dot vote-${m.votes[mem.id]}`} />{voteLabel[m.votes[mem.id]]}</td></tr>)}</tbody></table></div>
        <p className="small muted" style={{ marginTop: 8 }}>{Object.entries(tally).map(([k, n]) => `${n} ${voteLabel[k as keyof typeof voteLabel].toLowerCase()}`).join(', ')}. {m.vote_method === 'voice_unanimous' ? 'The minutes record "all voted aye"; individual ayes are inferred from attendance.' : m.note}</p>
        <SourceNote><Ext href={m.minutes_url}>Official minutes, {mt.date_label} (PDF)</Ext>. {motionNotes.verification}</SourceNote>
        <div className="row"><FlagButton table="motions" id={m.id} /><VoteDots votes={m.votes} /></div>
      </div>
      <div className="row between" style={{ marginTop: 12 }}>{all[i - 1] ? <Link className="btn small" to={`/decisions/motions/${all[i - 1].id}`}>‹ Previous motion</Link> : <span />}<Link className="btn small" to={`/decisions/meetings/${mt.id}`}>Whole meeting</Link>{all[i + 1] ? <Link className="btn small" to={`/decisions/motions/${all[i + 1].id}`}>Next motion ›</Link> : <span />}</div>
    </>
  );
}
