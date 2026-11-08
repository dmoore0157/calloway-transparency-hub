import { Link, NavLink, Outlet, useParams, Navigate } from 'react-router-dom';
import { ExternalLink, Phone, MapPin, ArrowRight, Vote } from 'lucide-react';
import { Meta } from '../../components/Meta';
import { Section, SourceNote, Stat, Ext, Crumb, ShareButton, Empty } from '../../components/ui';
import { FlagButton } from '../../components/FlagButton';
import { CommitmentSummary } from '../accountability/CommitmentSummary';
import { VotingRecord } from '../decisions/Members';
import { people, members, memberById, offices, officialsMeta, elections, electionById, electionsMeta, audits, type Member, type Officeholder, type Election, type Race, type Candidate } from '../../lib/data';
import { memberStats } from '../../lib/analytics';
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
    <div className="eyebrow">Leaders</div><h1 style={{ marginTop: 4 }}>Who leads Calloway County, and what the record shows</h1>
    <nav className="subnav" aria-label="Leaders sections">{TABS.map(([to, l]) => <NavLink key={to} to={to} end={to === '/leaders'} className={({ isActive }) => (isActive ? 'active' : '')}>{l}</NavLink>)}</nav>
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
      <div className="row"><ShareButton title={m.full_name} /><FlagButton table="members" id={m.id} /></div>
    </div>
    {m.next_role && <div className="notice" style={{ marginTop: 10, borderColor: p.accent }}><strong>Takes office as {m.next_role.title} on {dateLong(m.next_role.from_date)}.</strong> The record below is from {m.full_name.split(' ')[0]}'s years as a magistrate; the Judge/Executive record starts in 2027.</div>}
    {m.incoming && <div className="notice" style={{ marginTop: 10 }}><strong>Takes office {dateLong(m.term_start ?? TURNOVER)}.</strong> Campaign promises are logged now so they can be checked once {m.full_name.split(' ')[0]} is voting.</div>}
    {holder && <div className="card small" style={{ marginTop: 10 }}><Contact h={holder} /></div>}

    <CommitmentSummary memberId={id} />

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
        <span><Vote size={13} style={{ verticalAlign: '-2px', color: c.result === 'won' ? p.ok : p.muted }} /> {c.member_id ? <Link to={`/leaders/${c.member_id}`} style={{ fontWeight: 700 }}>{c.name}</Link> : <strong>{c.name}</strong>} <span className="small muted">{c.party}{c.incumbent ? ' · incumbent' : ''}</span></span>
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
