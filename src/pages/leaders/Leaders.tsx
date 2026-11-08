import { useState } from 'react';
import { Link, NavLink, Outlet, useParams, Navigate } from 'react-router-dom';
import { ExternalLink, Phone, MapPin, ArrowRight, Vote } from 'lucide-react';
import { Meta } from '../../components/Meta';
import { Section, SourceNote, Stat, Ext, Crumb, ShareButton, Empty, SectionHero } from '../../components/ui';
import { FlagButton } from '../../components/FlagButton';
import { CommitmentSummary } from '../accountability/CommitmentSummary';
import { VotingRecord } from '../decisions/Members';
import { MotionRow } from '../../components/VoteBits';
import { people, members, memberById, offices, officialsMeta, elections, electionById, electionsMeta, audits, recordChecks, recordChecksMeta, motionById, issues, issuesMeta, type RecordCheck, type Member, type Officeholder, type Election, type Race, type Candidate } from '../../lib/data';
import { memberStats, issueRecord, namedInMinutes, recordScore, recordScores, RECORD_SCORE_MIN, type RecordScore } from '../../lib/analytics';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { backendReady } from '../../lib/supabase';
import { dateLong, dateShort } from '../../lib/format';
import { palette } from '../../lib/palette';

const TABS = [['/leaders', 'Profiles'], ['/leaders/promises', 'Promise scoreboard'], ['/leaders/elections', 'Elections'], ['/leaders/methodology', 'How ratings work']];
const TURNOVER = '2027-01-04';

export function LeadersLayout() {
  return (<>
    <Meta title="Leaders" description="Profiles of Calloway County's elected officials: voting records, promises kept or broken, audits on their watch, and election results." />
    <SectionHero n={4} name="The Leaders" tone="mint" base="/leaders" tabs={TABS} label="Leaders sections"
      title={<>Beyond the <span className="hl">slogans.</span></>}
      lede="Who leads Calloway County and what the record shows: votes, promises, audits on their watch and election results. Every official is measured by the same rules."
      aside={<><Stat label="Offices tracked" value={offices.length} sub="Fiscal Court and countywide offices" /><Stat label="Record checks" value={recordChecks.length} sub="Past statements tested against the minutes" /></>} />
    <Outlet />
  </>);
}

const officeFor = (id: string) => offices.find((o) => o.current.member_id === id || o.incoming?.member_id === id);
const roleNow = (m: Member) => (m.incoming ? m.title : m.id === 'rister' ? 'Magistrate, District 4' : m.title);

/** One card per official, used on the profiles grid. */
function PersonCard({ m, tag, tagClass }: { m: Member; tag?: string; tagClass?: string }) {
  const s = memberStats().find((x) => x.id === m.id);
  return <Link to={`/leaders/${m.id}`} className="linkcard" style={m.active === false ? { opacity: .85, borderTopColor: 'var(--line)' } : undefined}>
    <div className="row between" style={{ alignItems: 'flex-start' }}><div className="eyebrow">{roleNow(m)}</div>{tag && <span className={`badge ${tagClass ?? ''}`}>{tag}</span>}</div>
    <h3 style={{ margin: '4px 0 6px' }}>{m.full_name}</h3>
    {s ? <p>Attended {s.attended} of {s.total} meetings · {s.made} motions made · {s.nays} nay{s.nays === 1 ? '' : 's'}, {s.abstentions} abstention{s.abstentions === 1 ? '' : 's'}</p> : <p>{m.status_note ?? 'No Fiscal Court record yet.'}</p>}
    {!m.incoming && (() => { const r = recordScore(m.id); return <p style={{ marginTop: 6 }}><strong>Record check score: {pctText(r)}</strong>{r.scored ? ` (${r.points % 1 ? r.points.toFixed(1) : r.points} of ${r.scored})` : ' · no statement found to check'}</p>; })()}
  </Link>;
}

export function Profiles() {
  const { data: scores } = useAsync(() => api.scores(), [], []);
  const now = members.filter((m) => m.active !== false);
  const from2027: Member[] = [memberById.rister, memberById.stewart, memberById.crutcher, memberById.houston, memberById.beane].filter(Boolean);
  const others = offices.filter((o) => !o.current.member_id);
  const former = people.filter((m) => m.active === false);
  const ranked = scores.filter((s) => s.ranked).length;
  return (<>
    <p className="lede">One page per official: how they voted, what they promised and whether it happened, what the state auditors found on their watch, and how they were elected. Every official is measured by the same rules, and the hub endorses no one.</p>
    <div className="notice" style={{ marginBottom: 14 }}><strong>The court changes on January 4, 2027.</strong> Voters replaced two of the five members in 2026: Magistrate Paul Rister becomes Judge/Executive, Cole Houston takes District 3 and Darrell Beane takes District 4. Kenny Imes and Don Cherry leave office. {backendReady && <>Promise-keeping scores: {ranked === 0 ? 'no official has five resolved commitments yet, so no one is ranked' : `${ranked} ranked`}. <Link to="/leaders/promises">Scoreboard ›</Link></>}</div>
    <Section title="Fiscal Court today (through January 3, 2027)" />
    <div className="grid cols-3">{now.map((m) => <PersonCard key={m.id} m={m} tag={m.next_role ? `Becomes ${m.next_role.title} Jan 2027` : m.term_end === '2027-01-03' ? 'Leaves office Jan 2027' : 'Re-elected 2026'} tagClass={m.next_role ? 'accent' : m.term_end === '2027-01-03' ? 'warn' : 'ok'} />)}</div>
    <Section title="Fiscal Court from January 4, 2027" />
    <div className="grid cols-3">{from2027.map((m) => <PersonCard key={m.id} m={m} tag={m.incoming ? 'New member' : m.next_role ? 'New role' : 'Continuing'} tagClass={m.incoming || m.next_role ? 'accent' : ''} />)}</div>
    <Section title="Other elected county officials" />
    <div className="grid cols-3">{others.map((o) => <Link key={o.id} to={`/leaders/office/${o.id}`} className="linkcard"><div className="row between" style={{ alignItems: 'flex-start' }}><div className="eyebrow">{o.office}</div>{o.incoming && <span className="badge accent">Changes Jan 2027</span>}</div><h3 style={{ margin: '4px 0 6px' }}>{o.current.name}</h3><p>{o.incoming ? `${o.incoming.name} takes office ${dateShort(o.incoming.takes_office ?? TURNOVER)}.` : o.current.note ?? o.body}</p></Link>)}</div>
    <Section title="Former members" />
    <div className="grid cols-3">{former.map((m) => <PersonCard key={m.id} m={m} tag="Former" />)}</div>
    <Section title="Record check scores: what they said against what they did" />
    <span id="record-scores" />
    <RecordScoreTable />
    <CompareRecord />
    <SourceNote>Roster and contact details from the <Ext href={officialsMeta.officials_url}>county's elected officials page</Ext>; terms from the 2022 and 2026 election results. {officialsMeta.term_note}</SourceNote>
  </>);
}

function Contact({ h }: { h: Officeholder }) {
  if (!h.phone && !h.address && !h.url) return null;
  return <div className="row small" style={{ gap: 14 }}>{h.phone && <span><Phone size={13} style={{ verticalAlign: '-2px' }} /> <a href={`tel:${h.phone.replace(/[^\d]/g, '')}`}>{h.phone}</a></span>}{h.address && <span><MapPin size={13} style={{ verticalAlign: '-2px' }} /> {h.address}</span>}{h.url && <Ext href={h.url}>Office website</Ext>}</div>;
}

/** Election rows for one person, matched by member id or by name. */
function candidacies(memberId: string | null, names: string[]) {
  const norm = (s: string) => s.toLowerCase().replace(/["'.]/g, '').replace(/\s+/g, ' ').trim();
  const lastName = (s: string) => norm(s).split(' ').pop();
  const out: { e: Election; r: Race; c: Candidate }[] = [];
  for (const e of elections) for (const r of e.races) for (const c of r.candidates) {
    if ((memberId && c.member_id === memberId) || (!memberId && names.some((n) => lastName(n) === lastName(c.name) && norm(c.name).split(' ')[0][0] === norm(n)[0]))) out.push({ e, r, c });
  }
  return out;
}

function ElectionHistory({ rows }: { rows: { e: Election; r: Race; c: Candidate }[] }) {
  if (rows.length === 0) return <Empty>No election results on file yet for this official.</Empty>;
  return <div className="table-wrap"><table className="data"><thead><tr><th>Election</th><th>Office</th><th>Result</th><th className="num">Votes</th><th>Opponents</th></tr></thead><tbody>
    {rows.map(({ e, r, c }) => <tr key={e.id + r.office + r.district}><td><Link to={`/leaders/elections/${e.id}`}>{e.label}</Link></td><td>{r.office}{r.district ? `, District ${r.district}` : ''}</td><td><ResultBadge c={c} race={r} kind={e.kind} /></td><td className="num">{c.votes != null ? `${c.votes.toLocaleString()} (${c.pct}%)` : c.pct != null ? `${c.pct}%` : ''}</td><td className="small">{r.candidates.filter((x) => x !== c).map((x) => `${x.name} (${x.party[0]}${x.pct != null ? `, ${x.pct}%` : ''})`).join('; ') || 'Unopposed'}</td></tr>)}
  </tbody></table></div>;
}

function ResultBadge({ c, race, kind }: { c: Candidate; race: Race; kind: string }) {
  if (c.result === 'withdrew') return <span className="badge">Withdrew</span>;
  if (c.result === 'pending') return <span className="badge warn">Pending</span>;
  const unopposed = race.candidates.filter((x) => x.result !== 'withdrew').length === 1;
  if (c.result === 'won') return <span className="badge ok">{kind === 'primary' ? 'Won primary' : unopposed ? 'Elected, unopposed' : 'Elected'}</span>;
  return <span className="badge bad">{kind === 'primary' ? 'Lost primary' : 'Not elected'}</span>;
}

/** Fiscal Court audits covering years this person served. */
function AuditsOnWatch({ sinceYear, untilYear, isJudge }: { sinceYear: number | null; untilYear: number | null; isJudge: boolean }) {
  if (!sinceYear) return null;
  const rows = audits.filter((a) => a.fy >= sinceYear && (!untilYear || a.fy <= untilYear));
  if (rows.length === 0) return <Empty>No state audit has been published yet for a year this official served.</Empty>;
  const findings = rows.reduce((n, a) => n + a.findings.length, 0); const repeats = rows.reduce((n, a) => n + a.findings.filter((f) => f.repeat_of).length, 0);
  return <>
    <p className="small muted" style={{ marginTop: -6 }}>{rows.length} audit{rows.length === 1 ? '' : 's'} cover years on this official's watch, with {findings} finding{findings === 1 ? '' : 's'}{repeats ? `, ${repeats} of them repeats` : ''}. {isJudge ? 'The Judge/Executive signs the county’s response to each finding.' : 'Magistrates approve the budget, claims and the treasurer’s reports that the auditors test.'}</p>
    <div className="table-wrap"><table className="data"><thead><tr><th>Audit</th><th className="num">Findings</th><th>What was flagged</th></tr></thead><tbody>
      {rows.map((a) => <tr key={a.fy}><td><Link to={`/records/audits/${a.fy}`}>FY{a.fy}</Link><div className="tiny muted">released {a.released ? dateShort(a.released) : dateShort(a.report_date)}</div></td><td className="num">{a.findings.length}</td><td className="small">{a.findings.map((f) => f.title).join(' · ') || 'None'}</td></tr>)}
    </tbody></table></div>
  </>;
}

const sinceOf = (m: Member) => { const o = offices.find((x) => x.current.member_id === m.id); return o?.current.since ? Number(o.current.since) : m.term_start ? Number(m.term_start.slice(0, 4)) : m.id === 'hale' ? 2019 : null; };

export function LeaderPage() {
  const { id = '' } = useParams(); const m = memberById[id];
  if (!m) { const o = offices.find((x) => x.id === id); return o ? <Navigate to={`/leaders/office/${id}`} replace /> : <Empty>No official found. <Link to="/leaders">All leaders</Link></Empty>; }
  const office = officeFor(id); const holder = office?.current.member_id === id ? office.current : office?.incoming?.member_id === id ? office.incoming : null;
  const rows = candidacies(id, [m.full_name]);
  const links = Array.from(new Map(rows.flatMap((r) => r.c.links).map((l) => [l.url, l])).values());
  const since = sinceOf(m); const until = m.term_end ? Number(m.term_end.slice(0, 4)) - (m.term_end.endsWith('-01-03') ? 1 : 0) : null;
  const p = palette();
  return (<>
    <Meta title={`${m.full_name}, ${roleNow(m)}`} description={`${m.full_name}: voting record, promises, audits and election results.`} />
    <Crumb items={[{ to: '/leaders', label: 'Leaders' }, { label: m.full_name }]} />
    <div className="row between" style={{ alignItems: 'flex-start' }}>
      <div><div className="eyebrow">{roleNow(m)}{m.party ? ` · ${m.party}` : ''}{m.active === false ? ' · Former' : ''}</div><h2 style={{ margin: '2px 0 4px' }}>{m.full_name}</h2>{m.status_note && <p className="small muted" style={{ margin: 0, maxWidth: 720 }}>{m.status_note}</p>}</div>
      <div className="row"><Link className="btn small" to={`/ask?q=${encodeURIComponent(`Summarize ${m.full_name}'s record on the Fiscal Court: votes, motions, statements checked against the minutes, and audits during their term.`)}&mode=report`}>Ask for a report</Link><ShareButton title={m.full_name} /><FlagButton table="members" id={m.id} /></div>
    </div>
    {m.next_role && <div className="notice" style={{ marginTop: 10, borderColor: p.accent }}><strong>Takes office as {m.next_role.title} on {dateLong(m.next_role.from_date)}.</strong> The record below is from {m.full_name.split(' ')[0]}'s years as a magistrate; the Judge/Executive record starts in 2027.</div>}
    {m.incoming && <div className="notice" style={{ marginTop: 10 }}><strong>Takes office {dateLong(m.term_start ?? TURNOVER)}.</strong> Campaign promises are logged now so they can be checked once {m.full_name.split(' ')[0]} is voting.</div>}
    {holder && (holder.phone || holder.address || holder.url) && <div className="card small" style={{ marginTop: 10 }}><Contact h={holder} /></div>}

    <CommitmentSummary memberId={id} />

    <RecordChecks memberId={id} />

    <IssueRecordTable memberId={id} />

    <NamedInMinutes m={m} />

    <Section title="Fiscal Court record" action={<Link to={`/decisions/votes?member=${id}`} className="small">Vote tracker ›</Link>} />
    <VotingRecord id={id} />

    <Section title="State audits on this official's watch" />
    <AuditsOnWatch sinceYear={since} untilYear={until} isJudge={m.role === 'judge_executive'} />

    <Section title="Elections" />
    <ElectionHistory rows={rows} />
    {links.length > 0 && <div className="row small" style={{ marginTop: 8 }}><span className="muted">Published statements and campaign pages:</span>{links.map((l) => <Ext key={l.url} href={l.url}>{l.label}</Ext>)}</div>}
    <SourceNote>Votes from the Fiscal Court minutes; commitments from the hub's tracker under the <Link to="/leaders/methodology">published rules</Link>; audits from the Kentucky Auditor of Public Accounts; election results from the Secretary of State, the State Board of Elections and the County Clerk. The hub links every candidate's own statements and endorses no one.</SourceNote>
  </>);
}

export function OfficePage() {
  const { id = '' } = useParams(); const o = offices.find((x) => x.id === id);
  if (!o) return <Empty>No office found. <Link to="/leaders">All leaders</Link></Empty>;
  if (o.current.member_id) return <Navigate to={`/leaders/${o.current.member_id}`} replace />;
  const rows = candidacies(null, [o.current.name, ...(o.incoming ? [o.incoming.name] : [])]);
  const links = Array.from(new Map(rows.flatMap((r) => r.c.links).map((l) => [l.url, l])).values());
  return (<>
    <Meta title={`${o.current.name}, ${o.office}`} description={`${o.office}: who holds the office, how they were elected, and the state audits of the office.`} />
    <Crumb items={[{ to: '/leaders', label: 'Leaders' }, { label: o.office }]} />
    <div className="row between" style={{ alignItems: 'flex-start' }}><div><div className="eyebrow">{o.office}{o.current.party ? ` · ${o.current.party}` : ''}</div><h2 style={{ margin: '2px 0 4px' }}>{o.current.name}</h2><p className="small muted" style={{ margin: 0, maxWidth: 720 }}>{o.current.since ? `In office since ${o.current.since}. ` : ''}{o.current.note ?? ''}</p></div><div className="row"><ShareButton title={o.current.name} /><FlagButton table="offices" id={o.id} /></div></div>
    {o.incoming && <div className="notice" style={{ marginTop: 10 }}><strong>{o.incoming.name}{o.incoming.party ? ` (${o.incoming.party})` : ''} takes office {dateLong(o.incoming.takes_office ?? TURNOVER)}</strong>{o.incoming.term_end ? `, for a term through ${o.incoming.term_end.slice(0, 4)}.` : '.'}</div>}
    <div className="card" style={{ marginTop: 10 }}><p className="small" style={{ margin: '0 0 8px' }}><strong>What the office does.</strong> {o.what}</p><Contact h={o.current} /></div>
    {(o.body === 'Fee office' || o.body === 'State-county office') && <div className="notice warn" style={{ marginTop: 10 }}>This office's promises are not yet tracked. Fee offices run on their own budgets and the Fiscal Court does not vote on their day-to-day decisions, so the hub measures them through the state's annual audits below and their election record.</div>}
    <Section title="Elections" />
    <ElectionHistory rows={rows} />
    {links.length > 0 && <div className="row small" style={{ marginTop: 8 }}><span className="muted">Published statements and campaign pages:</span>{links.map((l) => <Ext key={l.url} href={l.url}>{l.label}</Ext>)}</div>}
    {o.audits && o.audits.length > 0 && <>
      <Section title="State audits of this office" />
      <div className="card"><ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>{o.audits.map((a, i) => <li key={i} className="small">{a.href ? <Link to={a.href}>{a.label}</Link> : <Ext href={a.report ?? '#'}>{a.label ?? `Audit, ${a.year}`}</Ext>}</li>)}</ul><p className="tiny muted" style={{ margin: '8px 0 0' }}>Reports open on the Kentucky Auditor of Public Accounts site. Findings for these offices have not yet been transcribed into the hub; the Fiscal Court audits have.</p></div>
    </>}
    <SourceNote>{officialsMeta.source}</SourceNote>
  </>);
}

/** Statements the official made, set beside what the minutes record on the same subject while they held office. */
function RecordChecks({ memberId }: { memberId: string }) {
  const checks = recordChecks.filter((c) => c.member_id === memberId);
  const m = memberById[memberId];
  if (checks.length === 0) return m && !m.incoming ? <>
    <Section title="What they said, against what they did in office" />
    <span id="record" />
    <div className="card"><p className="small" style={{ margin: 0 }}><strong>No checkable statement found yet.</strong> The hub searched published voter guides, candidate questionnaires and interviews from 2018 to 2026 and found no direct quote from {m.full_name} about issues or their record to set beside the minutes, so there is no record check score. Their votes are still measured below on the same twelve issues as every member. Know of a published statement? <Link to="/feedback">Send it in</Link>.</p></div>
  </> : null;
  const p = palette();
  const color = (r: RecordCheck['record']) => (r === 'acted' || r === 'supported' ? p.ok : r === 'none' || r === 'contradicted' ? p.bad : r === 'partial' ? p.accent : p.muted);
  const badge = (r: RecordCheck['record']) => (r === 'acted' || r === 'supported' ? 'ok' : r === 'none' || r === 'contradicted' ? 'bad' : r === 'partial' ? 'accent' : '');
  const counts = { none: checks.filter((c) => c.record === 'none').length, partial: checks.filter((c) => c.record === 'partial').length, acted: checks.filter((c) => c.record === 'acted' || c.record === 'supported').length, contradicted: checks.filter((c) => c.record === 'contradicted').length };
  return <>
    <Section title="What they said, against what they did in office" />
    <span id="record" />
    <RecordScoreCard s={recordScore(memberId)} />
    <div className="notice" style={{ marginBottom: 12 }}><strong>How to read this.</strong> {m.full_name.split(' ')[0]} already held office when these statements were made, so each one is set beside the Fiscal Court minutes on the same subject. {recordChecksMeta.period} Of {checks.length} statements checked: {counts.none} with no recorded action, {counts.partial} with partial action or votes for others' proposals, {counts.acted} matching the record{counts.contradicted ? `, ${counts.contradicted} contradicted by the record` : ''}. The labels describe the record, not whether the idea was good.</div>
    <div className="grid">{checks.map((c) => <div key={c.id} id={c.id} className="card" style={{ borderLeft: `4px solid ${color(c.record)}`, scrollMarginTop: 80 }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}><div><span className="eyebrow">{c.topic}</span><h3 style={{ margin: '4px 0 6px' }}>{c.label}</h3></div><span className={`badge ${badge(c.record)}`}>{recordChecksMeta.labels[c.record]}</span></div>
      <blockquote style={{ margin: '6px 0 10px', padding: '8px 12px', borderLeft: '3px solid var(--line)', fontFamily: 'var(--serif)', fontSize: 15.5 }}>“{c.statement.quote}”<footer className="small muted" style={{ marginTop: 4 }}>{m.full_name}, {dateLong(c.statement.said_on)}, <Ext href={c.statement.source_url}>{c.statement.source_label}</Ext>{c.statement.context ? ` · ${c.statement.context}` : ''}</footer></blockquote>
      <p className="small" style={{ margin: '0 0 4px', fontWeight: 700 }}>What the minutes show</p>
      <ul className="small" style={{ paddingLeft: 18, margin: '0 0 8px', display: 'grid', gap: 4 }}>{c.what_minutes_show.map((b, i) => <li key={i}>{b}</li>)}</ul>
      {c.motion_ids.length > 0 && <details><summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>The motions ({c.motion_ids.length})</summary><ul className="list-reset grid" style={{ marginTop: 8 }}>{c.motion_ids.map((id) => motionById[id] ? <MotionRow key={id} m={motionById[id]} /> : null)}</ul></details>}
      <div className="row small" style={{ marginTop: 8, gap: 12 }}>{c.commitment_id && backendReady && <Link to={`/leaders/commitments/${c.commitment_id}`}>Tracked as commitment #{c.commitment_id} ›</Link>}{c.caveat && <span className="muted">{c.caveat}</span>}<span style={{ marginLeft: 'auto' }}><FlagButton table="record_checks" id={c.id} /></span></div>
    </div>)}</div>
    <SourceNote>{recordChecksMeta.method} Compiled {dateShort(recordChecksMeta.compiled)}.</SourceNote>
  </>;
}

const pctText = (s: RecordScore) => (s.scored === 0 ? 'No score' : s.pct == null ? 'Not enough checks' : `${Math.round(s.pct * 100)}%`);
const scoreParts = (s: RecordScore) => [s.acted && `${s.acted} acted on`, s.partial && `${s.partial} partial`, s.none && `${s.none} no recorded action`, s.supported && `${s.supported} claim${s.supported === 1 ? '' : 's'} supported`, s.contradicted && `${s.contradicted} contradicted`].filter(Boolean).join(' · ');

/** The record check score for one official, with every count beside it. */
function RecordScoreCard({ s }: { s: RecordScore }) {
  return <div className="grid cols-2" style={{ marginBottom: 12 }}>
    <div className="stat" style={{ ['--stat-bar' as string]: s.pct == null ? '#A3B1C2' : s.pct >= 0.5 ? '#13A08C' : '#E09A00' }}>
      <div className="label">Record check score</div>
      <div className="value">{pctText(s)}</div>
      <div className="sub">{s.scored ? `${s.points % 1 ? s.points.toFixed(1) : s.points} of ${s.scored} points` : 'No scored checks'}{s.pct == null && s.scored ? ` · needs ${RECORD_SCORE_MIN} scored checks` : ''}</div>
    </div>
    <div className="card small" style={{ margin: 0 }}><strong>How it's scored.</strong> Each statement checked against the minutes: acted on it or claim supported = 1 point, partial = ½, no recorded action or claim contradicted = 0. Context items are not scored. {scoreParts(s) || 'Nothing scored yet.'} <Link to="/leaders/methodology#record-score">Rules ›</Link></div>
  </div>;
}

/** Every member who has sat on the court, by record check score. Counts always shown; unscored members listed with the reason. */
export function RecordScoreTable() {
  const rows = recordScores();
  return <>
    <div className="table-wrap"><table className="data"><thead><tr><th>Official</th><th className="num">Score</th><th className="num">Checked</th><th>Breakdown</th></tr></thead>
      <tbody>{rows.map((s) => { const m = memberById[s.memberId]; return <tr key={s.memberId}>
        <td><Link to={`/leaders/${s.memberId}#record`}>{m.full_name}</Link><div className="tiny muted">{roleNow(m)}{m.active === false ? ' · former' : m.term_end ? ` · term ends ${dateShort(m.term_end)}` : ''}</div></td>
        <td className="num"><strong>{pctText(s)}</strong>{s.scored > 0 && <div className="tiny muted">{s.points % 1 ? s.points.toFixed(1) : s.points} of {s.scored} pts</div>}</td>
        <td className="num">{s.scored + s.context}</td>
        <td className="small">{s.scored + s.context === 0 ? 'No checkable statement found' : scoreParts(s) || 'Context only'}{s.context ? ` · ${s.context} context` : ''}</td>
      </tr>; })}</tbody></table></div>
    <p className="tiny muted" style={{ marginTop: 6 }}>Scores rest only on statements the hub could find and check, so the number of checks differs by person; read the checks behind each score. Most of one official's checks may be claims about past work while another's are plans tested against their own record. Both are scored by the same rule. <Link to="/leaders/methodology#record-score">Rules ›</Link></p>
  </>;
}

/** The same list of recurring issues, applied to every member who has sat on the court. */
function IssueRecordTable({ memberId }: { memberId: string }) {
  const m = memberById[memberId];
  if (!m || m.incoming) return null;
  const rows = issueRecord(memberId);
  const first = m.short_name;
  return <>
    <Section title="Record on the county's recurring issues" action={<Link to="/leaders#compare" className="small">Compare all members ›</Link>} />
    <p className="small muted" style={{ marginTop: -6 }}>The same twelve issues are checked for every member. "Moved" and "seconded" count motions {first} brought or backed; "for" and "against" are recorded votes; "missed" counts meetings {first} was absent when the issue came up. Open a row to see the motions.</p>
    <div className="table-wrap"><table className="data"><thead><tr><th>Issue</th><th className="num">Motions</th><th className="num">Moved</th><th className="num">Seconded</th><th className="num">For</th><th className="num">Against</th><th className="num">Abstained</th><th className="num">Missed</th><th>Last action</th></tr></thead><tbody>
      {rows.map((r) => <IssueRow key={r.issue.id} r={r} />)}
    </tbody></table></div>
    <SourceNote>{issuesMeta.method} Fiscal Court minutes, November 2021 to September 2026.</SourceNote>
  </>;
}
function IssueRow({ r }: { r: ReturnType<typeof issueRecord>[number] }) {
  const [open, setOpen] = useState(false);
  return <>
    <tr style={{ cursor: r.total ? 'pointer' : undefined }} onClick={() => r.total && setOpen(!open)}>
      <td><strong>{r.issue.label}</strong><div className="tiny muted">{r.issue.why}</div></td>
      <td className="num">{r.total}</td><td className="num">{r.moved}</td><td className="num">{r.seconded}</td><td className="num">{r.aye}</td><td className="num" style={{ color: r.nay ? 'var(--bad)' : undefined }}>{r.nay}</td><td className="num" style={{ color: r.abstain ? 'var(--warn)' : undefined }}>{r.abstain}</td><td className="num">{r.absent}</td>
      <td className="small">{r.last ? <Link to={`/decisions/motions/${r.last.id}`} onClick={(e) => e.stopPropagation()}>{dateShort(r.last.date)}</Link> : <span className="muted">none in tracked minutes</span>}{r.total > 0 && <span className="tiny muted"> · {open ? 'hide' : 'show'} motions</span>}</td>
    </tr>
    {open && <tr><td colSpan={9} style={{ background: 'var(--surface-2)' }}><ul className="list-reset grid" style={{ gap: 6 }}>{r.motions.slice(0, 12).map((x) => <MotionRow key={x.id} m={x} />)}</ul>{r.motions.length > 12 && <p className="small muted" style={{ margin: '6px 0 0' }}>{r.motions.length - 12} more in the <Link to="/decisions/votes">vote tracker</Link>.</p>}</td></tr>}
  </>;
}

/** Every line of the minutes that names the member outside routine motions. */
function NamedInMinutes({ m }: { m: Member }) {
  if (m.incoming) return null;
  const rows = namedInMinutes(m.short_name);
  return <>
    <Section title="Named in the minutes" />
    {rows.length === 0 ? <Empty>The meeting summaries do not single out {m.short_name} by name; every recorded action was a motion, second or vote listed above.</Empty> : <ul className="timeline">{rows.map((r, i) => <li key={i}><Link to={`/decisions/meetings/${r.meeting.id}`} className="small" style={{ fontWeight: 700 }}>{dateShort(r.meeting.date)}</Link><div className="small">{r.text}</div></li>)}</ul>}
  </>;
}

/** Side-by-side matrix for the profiles page: moved + seconded over motions on each issue, per member. */
export function CompareRecord() {
  const cols = people.filter((x) => !x.incoming);
  const recs = Object.fromEntries(cols.map((x) => [x.id, issueRecord(x.id)]));
  return <>
    <Section title="Compare the record on the recurring issues" />
    <span id="compare" />
    <p className="small muted" style={{ marginTop: -6 }}>For each issue: motions the member moved or seconded, over the motions on that issue while they sat on the court. Recorded votes against are in red. The Judge/Executive presents most items, so his "moved" count is naturally high; the question for a magistrate is whether they ever brought anything themselves. Open any profile for the motions.</p>
    <div className="table-wrap"><table className="data"><thead><tr><th>Issue</th>{cols.map((x) => <th key={x.id} className="num"><Link to={`/leaders/${x.id}`}>{x.short_name}</Link>{x.active === false && <div className="tiny muted">former</div>}</th>)}</tr></thead><tbody>
      {issues.map((iss, i) => <tr key={iss.id}><td><strong>{iss.label}</strong></td>{cols.map((x) => { const r = recs[x.id][i]; return <td key={x.id} className="num">{r.total ? <>{r.moved + r.seconded}<span className="muted">/{r.total}</span>{r.nay ? <span style={{ color: 'var(--bad)' }}> ({r.nay} no)</span> : null}</> : <span className="muted">–</span>}</td>; })}</tr>)}
    </tbody></table></div>
    <SourceNote>{issuesMeta.method}</SourceNote>
  </>;
}

/* ---------- Elections ---------- */

export function Elections() {
  return <Navigate to={`/leaders/elections/${elections[0].id}`} replace />;
}

export function ElectionPage() {
  const { id = '' } = useParams(); const e = electionById[id];
  if (!e) return <Empty>No election found. <Link to="/leaders/elections">Elections</Link></Empty>;
  const contested = e.races.filter((r) => r.candidates.filter((c) => c.result !== 'withdrew').length > 1).length;
  const seatsChanged = e.races.filter((r) => r.open_seat).length;
  return (<>
    <Meta title={e.label} description={`Calloway County ${e.label}: every county race, candidate, vote total and result, with links to each candidate's statements.`} />
    <div className="row" style={{ marginBottom: 12 }}>{elections.map((x) => <NavLink key={x.id} to={`/leaders/elections/${x.id}`} className={({ isActive }) => `chip ${isActive ? 'active' : ''}`}>{x.label.replace(' election', '')}</NavLink>)}</div>
    <div className="row between" style={{ alignItems: 'flex-start' }}><div><h2 style={{ margin: 0 }}>{e.label}</h2><p className="small muted" style={{ margin: '4px 0 0' }}>{e.status}.</p></div><ShareButton title={e.label} /></div>
    <div className="grid cols-4" style={{ marginTop: 12 }}>
      <Stat label="County races" value={e.races.length} sub={`${contested} contested, ${e.races.length - contested} with one candidate or none`} />
      <Stat label="Open seats" value={seatsChanged} sub="seats changing hands" />
      <Stat label="Ballots cast" value={e.ballots ? e.ballots.toLocaleString() : 'n/a'} sub={e.ballots_note ?? (e.ballots ? 'countywide' : 'turnout not yet published')} />
      <Stat label="Candidates" value={e.races.reduce((n, r) => n + r.candidates.length, 0)} sub="across county races" />
    </div>
    {e.notes.map((n, i) => <div key={i} className="notice" style={{ marginTop: 10 }}>{n}</div>)}
    <Section title="Races" />
    <div className="grid">{e.races.map((r) => <RaceCard key={r.office + (r.district ?? '')} r={r} kind={e.kind} />)}</div>
    <Section title="Sources" />
    <div className="card small"><ul style={{ margin: 0, paddingLeft: 18 }}>{e.sources.map((s) => <li key={s.url}><Ext href={s.url}>{s.label}</Ext>{s.kind === 'official' && <span className="badge" style={{ marginLeft: 6 }}>official</span>}</li>)}</ul></div>
    <SourceNote>{electionsMeta.how_compiled} Compiled {dateShort(electionsMeta.compiled)}. Something wrong or missing? <Link to="/feedback">Tell us</Link>.</SourceNote>
  </>);
}

function RaceCard({ r, kind }: { r: Race; kind: string }) {
  const p = palette();
  const live = r.candidates.filter((c) => c.result !== 'withdrew');
  const max = Math.max(1, ...live.map((c) => c.pct ?? 0));
  return <div className="card" style={{ padding: 14 }}>
    <div className="row between" style={{ alignItems: 'flex-start' }}><h3 style={{ margin: 0 }}>{r.office}{r.district ? `, District ${r.district}` : ''}</h3><span className="row" style={{ gap: 4 }}>{r.open_seat && <span className="badge accent">Open seat</span>}{live.length <= 1 && <span className="badge">{live.length === 0 ? 'No candidate' : 'Unopposed'}</span>}</span></div>
    {r.note && <p className="small muted" style={{ margin: '4px 0 0' }}>{r.note}</p>}
    <ul className="list-reset" style={{ marginTop: 10, display: 'grid', gap: 8 }}>{r.candidates.map((c) => <li key={c.name}>
      <div className="row between" style={{ alignItems: 'baseline' }}>
        <span><Vote size={13} style={{ verticalAlign: '-2px', color: c.result === 'won' ? p.ok : p.muted }} /> {c.member_id ? <Link to={`/leaders/${c.member_id}`} style={{ fontWeight: 700 }}>{c.name}</Link> : <strong>{c.name}</strong>}{c.member_id && recordChecks.some((x) => x.member_id === c.member_id) && <Link to={`/leaders/${c.member_id}#record`} className="badge accent" style={{ marginLeft: 6 }}>record check</Link>} <span className="small muted">{c.party}{c.incumbent ? ' · incumbent' : ''}</span></span>
        <span className="row" style={{ gap: 8 }}><span className="small" style={{ fontVariantNumeric: 'tabular-nums' }}>{c.votes != null ? `${c.votes.toLocaleString()} votes` : ''}{c.pct != null ? ` · ${c.pct}%` : ''}</span><ResultBadge c={c} race={r} kind={kind} /></span>
      </div>
      {c.pct != null && <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, marginTop: 4 }}><div style={{ width: `${(c.pct / max) * 100}%`, height: 6, borderRadius: 3, background: c.result === 'won' ? p.series[0] : p.series[1] }} /></div>}
      {(c.note || c.links.length > 0 || c.filed) && <div className="row tiny muted" style={{ marginTop: 4, gap: 10 }}>{c.note && <span>{c.note}</span>}{c.filed && <span>Filed {dateShort(c.filed)}</span>}{c.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">{l.label} <ExternalLink size={10} /></a>)}</div>}
    </li>)}</ul>
    {r.candidates.length === 0 && <p className="small muted" style={{ margin: '8px 0 0' }}>No one filed for this seat.</p>}
    {r.candidates.some((c) => c.member_id) && <p className="tiny muted" style={{ margin: '8px 0 0' }}>Names link to the hub's profile, with voting record and promises. <ArrowRight size={10} style={{ verticalAlign: '-1px' }} /></p>}
  </div>;
}

/** Compact strip for the home page. */
export function ElectionStrip() {
  const e = elections[0]; const je = e.races.find((r) => r.office.startsWith('County Judge'));
  if (!je) return null;
  const w = je.candidates.find((c) => c.result === 'won');
  return <div className="card accent"><div className="row between" style={{ alignItems: 'flex-start' }}><div><div className="eyebrow">{e.label}</div><h3 style={{ margin: '4px 0' }}>{w ? `${w.name} elected Judge/Executive` : 'Judge/Executive race'}</h3><p className="small" style={{ margin: 0 }}>{je.candidates.map((c) => `${c.name} (${c.party[0]}) ${c.pct}%`).join(' · ')}. Two of five Fiscal Court seats change hands in January 2027.</p></div><Link to={`/leaders/elections/${e.id}`} className="btn small">All races</Link></div></div>;
}
