import { Link, useParams } from 'react-router-dom';
import { Section, Empty, Crumb, ShareButton, StatusBadge, Ext, SourceNote } from '../../components/ui';
import { api, type Commitment } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { backendReady } from '../../lib/supabase';
import { members, memberById, meetingById } from '../../lib/data';
import { dateLong, dateShort } from '../../lib/format';
import { FlagButton } from '../../components/FlagButton';

export function Scoreboard() {
  const { data: scores, loading } = useAsync(() => api.scores(), [], []);
  const { data: recent } = useAsync(() => api.commitments(), [], []);
  const ranked = [...scores].filter((s) => s.ranked).sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.full_name.localeCompare(b.full_name));
  const unranked = scores.filter((s) => !s.ranked);
  return (<>
    <p className="lede">Every current official is held to the same test: what they promised, in their own words, against what the public record shows happened. The hub endorses no one. It records the promise, the source, the measure, and the outcome.</p>
    {!backendReady ? <Empty>The commitments tracker needs the hub's backend, which is not configured in this build.</Empty> : loading ? <p className="muted">Loading…</p> : (<>
      <Section title="Promise-keeping ranking" />
      {ranked.length === 0 ? (
        <div className="card"><p style={{ margin: 0 }}><strong>No official is ranked yet.</strong> An official appears in the ranking only after five of their scoreable commitments have been resolved as Kept, Compromise, or Broken, so a single early result can't top the table. Commitments are being gathered from the 2026 campaign and from Fiscal Court minutes; each appears below as it is logged.</p></div>
      ) : (
        <div className="table-wrap"><table className="data"><thead><tr><th>#</th><th>Official</th><th className="num">Score</th><th className="num">Kept</th><th className="num">Compromise</th><th className="num">Broken</th><th className="num">Pending</th></tr></thead>
          <tbody>{ranked.map((s, i) => <tr key={s.member_id}><td>{i + 1}</td><td><Link to={`/leaders/${s.member_id}`}>{s.full_name}</Link> <span className="small muted">{memberById[s.member_id]?.title}</span></td><td className="num"><strong>{Math.round((s.score ?? 0) * 100)}%</strong> <span className="tiny muted">of {s.resolved}</span></td><td className="num">{s.kept}</td><td className="num">{s.compromise}</td><td className="num">{s.broken}</td><td className="num">{s.pending}</td></tr>)}</tbody></table></div>
      )}
      <p className="tiny muted">Score = (kept + ½ × compromise) ÷ resolved. Counts always appear beside the score. <Link to="/leaders/methodology">Full rules ›</Link></p>
      <Section title="Every official" />
      <div className="grid cols-3">{[...ranked, ...unranked].map((s) => <Link key={s.member_id} to={`/leaders/${s.member_id}`} className="linkcard"><div className="eyebrow">{memberById[s.member_id]?.title}</div><h3>{s.full_name}</h3><p>{s.scoreable_total === 0 ? 'No scoreable commitments logged yet' : `${s.scoreable_total} scoreable · ${s.kept} kept · ${s.compromise} compromise · ${s.broken} broken · ${s.pending} pending`}</p>{!s.ranked && s.scoreable_total > 0 && <p className="tiny">Not ranked until 5 are resolved ({s.resolved} so far)</p>}</Link>)}</div>
      <Section title="Recently logged" action={<Link to="/leaders/promises/all" className="small">All commitments ›</Link>} />
      {recent.length === 0 ? <Empty>No commitments published yet.</Empty> : <ul className="list-reset grid">{recent.slice(0, 6).map((c) => <CommitmentRow key={c.id} c={c} />)}</ul>}
    </>)}
  </>);
}

export function CommitmentRow({ c }: { c: Commitment }) {
  return (
    <li className="card" style={{ padding: '12px 14px' }}>
      <div className="row between"><Link to={`/leaders/commitments/${c.id}`} style={{ fontWeight: 700, color: 'inherit' }}>{c.summary}</Link><StatusBadge status={c.current_rating ?? 'not_rated'} /></div>
      <div className="small muted" style={{ marginTop: 4 }}><Link to={`/leaders/${c.member_id}`}>{memberById[c.member_id]?.full_name ?? c.member_id}</Link> · {c.origin === 'campaign' ? 'campaign promise' : 'commitment in office'} · {dateShort(c.made_on)}{!c.scoreable && ' · statement, not scored'}{c.proposed_rating && <> · <span className="badge warn">proposed: {c.proposed_rating.replace('_', ' ')}</span></>}</div>
    </li>
  );
}

export function AllCommitments() {
  const { data, loading } = useAsync(() => api.commitments(), [], []);
  return (<>{loading ? <p className="muted">Loading…</p> : data.length === 0 ? <Empty>No commitments published yet.</Empty> : <ul className="list-reset grid">{data.map((c) => <CommitmentRow key={c.id} c={c} />)}</ul>}</>);
}

export function CommitmentPage() {
  const { id = '0' } = useParams(); const n = Number(id);
  const { data: c, loading } = useAsync(() => api.commitment(n), [n], null);
  const { data: d } = useAsync(() => api.commitmentDetail(n), [n], { ratings: [], sources: [], evidence: [], responses: [] });
  if (loading) return <p className="muted">Loading…</p>;
  if (!c) return <Empty>Commitment not found. <Link to="/leaders/promises">Scoreboard</Link></Empty>;
  const m = memberById[c.member_id]; const mt = c.meeting_id ? meetingById[c.meeting_id] : null;
  return (<>
    <Crumb items={[{ to: '/leaders/promises', label: 'Promises' }, { to: `/leaders/${c.member_id}`, label: m?.full_name ?? c.member_id }, { label: `Commitment #${c.id}` }]} />
    <div className="card" style={{ borderLeft: `4px solid ${c.current_rating === 'kept' ? 'var(--ok)' : c.current_rating === 'broken' ? 'var(--bad)' : 'var(--accent)'}` }}>
      <div className="row between"><span className="eyebrow">{c.origin === 'campaign' ? 'Campaign promise' : 'Commitment in office'} · {dateLong(c.made_on)}</span><ShareButton /></div>
      <h2>{c.summary}</h2>
      <blockquote style={{ margin: '8px 0 12px', padding: '10px 14px', borderLeft: '3px solid var(--line)', fontFamily: 'var(--serif)', fontSize: 17 }}>"{c.quote}"<footer className="small muted" style={{ marginTop: 6 }}>{m?.full_name}{mt ? <>, Fiscal Court meeting of <Link to={`/decisions/meetings/${mt.id}`}>{mt.date_label}</Link></> : null}</footer></blockquote>
      <div className="row"><StatusBadge status={c.current_rating ?? 'not_rated'} />{c.proposed_rating && <span className="badge warn">Proposed: {c.proposed_rating.replace('_', ' ')} (in 7-day review)</span>}{!c.scoreable && <span className="badge">Statement, not scored</span>}<span className="badge">{c.wording_type === 'effort' ? 'Promise of effort' : 'Promise of outcome'}</span>{!c.within_authority && <span className="badge warn">Outside this office's authority</span>}</div>
      {c.measure && <div className="notice" style={{ marginTop: 12 }}><strong>How this will be judged (written before any rating):</strong> {c.measure}{c.deadline && <> · <strong>By:</strong> {dateLong(c.deadline)}</>}</div>}
      {c.authority_note && <p className="small muted">{c.authority_note}</p>}
      <FlagButton table="commitments" id={String(c.id)} />
    </div>
    <Section title="Sources" />
    {d.sources.length === 0 ? <Empty>No sources attached.</Empty> : <div className="card"><ul style={{ margin: 0, paddingLeft: 18 }}>{d.sources.map((s) => <li key={s.id} className="small">{s.kind.replace('_', ' ')}{s.media_timestamp && ` at ${s.media_timestamp}`} · {s.url && <Ext href={s.url}>original</Ext>} {s.archive_url && <> · <Ext href={s.archive_url}>archived copy</Ext></>} · captured {dateShort(s.captured_at.slice(0, 10))}</li>)}</ul></div>}
    <Section title="Rating history" />
    {d.ratings.length === 0 ? <Empty>Not yet rated.</Empty> : <ul className="timeline">{d.ratings.map((r) => <li key={r.id}><div className="row"><StatusBadge status={r.rating} /><span className="small muted">{r.state === 'proposed' ? `proposed ${dateShort(r.proposed_at.slice(0, 10))}, counts from ${dateShort(r.effective_at.slice(0, 10))}` : `final since ${dateShort(r.effective_at.slice(0, 10))}`}{r.second_reviewed && ' · second-reviewed'}</span></div><div className="small">{r.reason}</div></li>)}</ul>}
    <Section title="Evidence from the public record" />
    {d.evidence.length === 0 ? <Empty>No evidence linked yet.</Empty> : <div className="card"><ul style={{ margin: 0, paddingLeft: 18 }}>{d.evidence.map((e) => <li key={e.id} className="small">{e.motion_id && <Link to={`/decisions/motions/${e.motion_id}`}>Motion {e.motion_id}</Link>}{e.budget_line_id && <Link to={`/money/lines/${encodeURIComponent(e.budget_line_id)}`}>Budget line {e.budget_line_id}</Link>}{e.document_id && <span>Document {e.document_id}</span>}{e.note && <> · {e.note}</>}</li>)}</ul></div>}
    <Section title="Response from the official" />
    {d.responses.length === 0 ? <div className="card small muted">No response received. Officials get a private link to respond to any commitment or rating; responses are published unedited.</div> : d.responses.map((r) => <div key={r.id} className="card"><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{r.body}</p><p className="tiny muted" style={{ margin: '6px 0 0' }}>{memberById[r.member_id]?.full_name}, via {r.received_via.replace('_', ' ')}, {dateShort(r.created_at.slice(0, 10))}. Published unedited.</p></div>)}
    <SourceNote>Commitments are logged with the verbatim quote, a source link, and an archived copy. The measure is written at intake, before any rating.</SourceNote>
  </>);
}

export function Methodology() {
  return (<>
    <p className="lede">One rulebook, applied to every official the same way. The hub never judges whether a promise was a good idea. It records what was promised, where, the test that will decide it, and what happened.</p>
    <Section title="What counts as a commitment" />
    <div className="card"><ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
      <li><strong>Campaign promises</strong> from candidate websites, mailers, questionnaires, forum and debate recordings, social posts, and interviews.</li>
      <li><strong>Commitments made in office</strong> recorded in the minutes ("bring it back next meeting", "hold the bids until…") and adopted plans with dates.</li>
      <li><strong>Only specific, checkable commitments are scored.</strong> "No increase in the county tax rate" can be checked. "Support our roads" cannot; it is archived as a statement and never scored.</li>
      <li><strong>Evidence first.</strong> Each entry records the exact quote, the source link, an archived copy, the date, and the measure that will decide it, written at intake so the goalposts cannot move.</li>
    </ul></div>
    <Section title="Ratings" />
    <div className="card"><table className="data"><tbody>
      {[['not_rated', 'Logged, with no relevant action yet'], ['in_the_works', 'Action started: a motion, an agenda item, a new budget line'], ['stalled', 'No action for six months, or blocked'], ['kept', 'The measure written at intake is met'], ['compromise', 'Partly met, or met in a reduced form'], ['broken', 'The deadline passed without it, or the official acted against it']].map(([k, d]) => <tr key={k}><td><StatusBadge status={k} /></td><td className="small">{d}</td></tr>)}
    </tbody></table>
      <p className="small" style={{ marginTop: 10 }}><strong>The wording decides the test.</strong> "I will push for X" is kept by moving or voting for X, even if the court declines. "X will happen" is kept only when X happens. Every commitment page shows the official's own motions and votes on the topic, so effort is visible either way.</p>
      <p className="small"><strong>Authority is labeled.</strong> A promise the office cannot deliver alone, such as work on a state road, is marked and judged on whether the official took the steps the office allows.</p>
    </div>
    <Section title="Ranking" />
    <div className="card"><p><code>score = (kept + 0.5 × compromise) ÷ resolved</code>, where resolved = kept + compromise + broken.</p><ul style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 6 }} className="small">
      <li>Counts always appear beside the score.</li><li>An official needs at least five resolved commitments before appearing in the ranked list.</li><li>Only current officeholders are ranked. Candidates who did not win keep their archived commitments on the record but are not scored, because they had no power to act.</li><li>Activity counts (motions made, seconded) are never ranked; more motions is neither better nor worse.</li>
    </ul></div>
    <Section title="Fairness safeguards" />
    <div className="card"><ul style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 6 }} className="small">
      <li><strong>Right to respond.</strong> Each official receives a private link to respond to any commitment or rating. Responses are published unedited, up to 2,500 characters, withheld only for listed reasons such as naming a private individual.</li>
      <li><strong>Seven-day pending period.</strong> A proposed Kept, Compromise, or Broken rating is shown as "proposed" with its evidence for seven days before it counts. Anyone can flag it during that window; an open flag holds it.</li>
      <li><strong>Second reviewer.</strong> A Broken rating needs a second reviewer whenever the hub has more than one editor.</li>
      <li><strong>Public change log.</strong> Every rating change appears with its date and reason on the commitment page.</li>
      <li><strong>Disclosure.</strong> The About page names the publisher. If anyone involved with the hub is or becomes a candidate, that is disclosed and their own commitments are tracked under the same rules.</li>
    </ul></div>
    <p className="small muted" style={{ marginTop: 12 }}>Members covered: {members.map((m) => m.full_name).join(', ')}. The general election was November 3, 2026; new terms begin January 2027.</p>
  </>);
}
