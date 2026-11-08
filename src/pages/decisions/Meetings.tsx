import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { meetings, meetingById, meetingsMeta, motions, memberById, members, grants, rosterOn } from '../../lib/data';
import { dateLong, usd } from '../../lib/format';
import { Section, SourceNote, Empty, Ext, Crumb, ShareButton, Stat } from '../../components/ui';
import { MotionRow } from '../../components/VoteBits';
import { FlagButton } from '../../components/FlagButton';

export default function Meetings() {
  const [q, setQ] = useState('');
  const rows = useMemo(() => meetings.filter((m) => !q || `${m.date_label} ${m.summary.join(' ')} ${m.vote_notes.join(' ')}`.toLowerCase().includes(q.toLowerCase())), [q]);
  return (
    <>
      <p className="lede">Every Fiscal Court meeting the county has published minutes for, November 2021 to the present, summarized in plain English and linked to the official minutes. {meetingsMeta.regular_schedule}.</p>
      <input className="input" placeholder="Search meetings (e.g. bridge, tax rate, cannabis, dump truck)…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search meetings" />
      <div style={{ marginTop: 12 }} className="grid">
        {rows.length === 0 && <Empty>No meetings match "{q}".</Empty>}
        {rows.map((mt) => { const ms = motions.filter((m) => m.meeting_id === mt.id); const rec = ms.filter((m) => m.vote_method !== 'voice_unanimous'); return (
          <div key={mt.id} className="card" style={{ borderLeft: `4px solid ${rec.length ? 'var(--accent)' : 'var(--line)'}` }}>
            <div className="row between"><Link to={`/decisions/meetings/${mt.id}`}><h3 style={{ margin: 0 }}>{mt.date_label}{mt.kind === 'special' && <span className="badge warn" style={{ marginLeft: 8 }}>Special</span>}</h3></Link><span className="small muted">{ms.length} motions{rec.length ? ` · ${rec.length} recorded vote${rec.length > 1 ? 's' : ''}` : ''}</span></div>
            <ul style={{ margin: '8px 0 0', paddingLeft: 18, display: 'grid', gap: 4, fontSize: 14 }}>{mt.summary.slice(0, 4).map((b, i) => <li key={i}>{b}</li>)}{mt.summary.length > 4 && <li className="muted">+{mt.summary.length - 4} more</li>}</ul>
            {(mt.absent.length > 0 || mt.absent_other.length > 0) && <p className="small muted" style={{ margin: '8px 0 0' }}>Absent: {[...mt.absent.map((a) => memberById[a].full_name), ...mt.absent_other].join(', ')}</p>}
          </div>); })}
      </div>
      <SourceNote>Calloway County Fiscal Court minutes, <Ext href={meetingsMeta.minutes_index_url}>callowaycountyky.gov/meeting-minutes</Ext>. Summaries are the hub's; the PDF is the authoritative record.</SourceNote>
    </>
  );
}

export function MeetingPage() {
  const { id = '' } = useParams(); const mt = meetingById[id];
  if (!mt) return <Empty>No meeting found. <Link to="/decisions/meetings">All meetings</Link></Empty>;
  const ms = motions.filter((m) => m.meeting_id === mt.id).sort((a, b) => a.seq - b.seq);
  const subst = ms.filter((m) => !m.is_routine); const dollars = ms.reduce((s, m) => s + (m.dollar_amount ?? 0), 0);
  const mk = mt.date.slice(2); const gs = grants.filter((g) => g.mk === mk);
  const idx = meetings.findIndex((m) => m.id === mt.id); const prev = meetings[idx + 1]; const next = meetings[idx - 1];
  const present = members.filter((m) => rosterOn(mt.date).some((r) => r.id === m.id) && !mt.absent.includes(m.id));
  return (
    <>
      <Crumb items={[{ to: '/decisions', label: 'Decisions' }, { to: '/decisions/meetings', label: 'Meetings' }, { label: mt.date_label }]} />
      <div className="row between"><h2>Fiscal Court meeting, {dateLong(mt.date)}{mt.kind === 'special' && <span className="badge warn" style={{ marginLeft: 8, verticalAlign: 'middle' }}>Special session</span>}</h2><ShareButton /></div>
      <div className="grid cols-4">
        <Stat label="Motions" value={ms.length} sub={`${subst.length} substantive`} /><Stat label="Recorded votes" value={ms.filter((m) => m.vote_method !== 'voice_unanimous').length} /><Stat label="Dollars named in motions" value={dollars ? usd(dollars, { compact: true }) : '—'} sub="amounts stated in motion text" /><Stat label="Present" value={`${present.length} of ${rosterOn(mt.date).length}`} sub={mt.absent.length ? `Absent: ${mt.absent.map((a) => memberById[a].short_name).join(', ')}` : 'Full court'} />
      </div>
      <Section title="What happened" />
      <div className="card accent"><ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>{mt.summary.map((b, i) => <li key={i}>{b}</li>)}</ul>
        {mt.vote_notes.length > 0 && <div className="notice" style={{ marginTop: 12 }}><strong>Recorded or split votes.</strong><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{mt.vote_notes.map((n, i) => <li key={i} className="small">{n}</li>)}</ul></div>}
        {mt.absent_other.length > 0 && <p className="small muted" style={{ margin: '8px 0 0' }}>Also recorded absent: {mt.absent_other.join(', ')}.</p>}
        {mt.extraction === 'hub-2026-11' && <div className="notice" style={{ marginTop: 12 }}>This meeting was added in November 2026 from the county's minutes PDF by the hub's own extraction and has not yet been independently reviewed. The PDF is the authoritative record; use "Report an error" if anything here does not match it.</div>}
        <SourceNote><Ext href={mt.minutes_url}>Official minutes (PDF)</Ext></SourceNote>
        <FlagButton table="meetings" id={mt.id} />
      </div>
      {gs.length > 0 && <><Section title="Outside funding decided at this meeting" /><div className="card"><table className="data"><tbody>{gs.map((g, i) => <tr key={i}><td>{g.prog}</td><td>{g.purpose}</td><td className="num">{g.amt || '—'}</td><td><span className="badge accent">{g.stage}</span></td></tr>)}</tbody></table><p className="small" style={{ margin: '8px 0 0' }}><Link to="/money/grants">All grants and outside funding ›</Link></p></div></>}
      <Section title={`All ${ms.length} motions, in order`} />
      <ul className="list-reset grid">{ms.map((m) => <MotionRow key={m.id} m={m} showMeeting={false} />)}</ul>
      <div className="row between" style={{ marginTop: 16 }}>{prev ? <Link to={`/decisions/meetings/${prev.id}`} className="btn small">‹ {prev.date_label}</Link> : <span />}{next ? <Link to={`/decisions/meetings/${next.id}`} className="btn small">{next.date_label} ›</Link> : <span />}</div>
    </>
  );
}
