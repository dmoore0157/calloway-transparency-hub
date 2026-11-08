import { Link, NavLink, Outlet } from 'react-router-dom';
import { Meta } from '../../components/Meta';
import { Section, SourceNote, Ext, Empty } from '../../components/ui';
import { links, law, glossary, meetingsMeta } from '../../lib/data';
import { useAsync } from '../../lib/useAsync';
import { api } from '../../lib/api';
import { backendReady } from '../../lib/supabase';
import { dateShort } from '../../lib/format';

const TABS = [['/records', 'Reports & audits'], ['/records/sources', 'Sources'], ['/records/glossary', 'Glossary'], ['/records/data', 'Data downloads'], ['/records/corrections', 'Corrections log'], ['/records/about', 'About & methodology']];
export function RecordsLayout() {
  return (<>
    <Meta title="Records" description="Calloway County audits, state filings, sources, glossary, data downloads and the hub's methodology." />
    <div className="eyebrow">Records</div><h1 style={{ marginTop: 4 }}>The documents behind every number</h1>
    <nav className="subnav" aria-label="Records sections">{TABS.map(([to, l]) => <NavLink key={to} to={to} end={to === '/records'} className={({ isActive }) => (isActive ? 'active' : '')}>{l}</NavLink>)}</nav>
    <Outlet />
  </>);
}

const AUDITS = [2021, 2020, 2019, 2018].map((y) => ({ year: y, label: `Fiscal Court audit, FY${y}`, url: 'https://auditor.ky.gov/Auditreports/Pages/default.aspx' }));
export function Reports() {
  return (<>
    <p className="lede">Independent audits from the Kentucky Auditor of Public Accounts, the county's own filings to the Department for Local Government (DLG), and the adopted budgets. Audited and self-reported figures are labeled everywhere they appear and are never blended.</p>
    <Section title="Independent audits (KY Auditor of Public Accounts)" />
    <div className="card"><p className="small">The most recent published Fiscal Court audit covers FY2021. Audits are searchable on the Auditor's site by county and year.</p><ul style={{ margin: 0, paddingLeft: 18 }}>{AUDITS.map((a) => <li key={a.year}><Ext href={a.url}>{a.label}</Ext></li>)}</ul></div>
    <Section title="County filings to the state (unaudited)" />
    <div className="card"><p className="small">Quarterly financial reports and adopted budgets are filed with DLG on the state's uniform form. They are the county's own numbers and are labeled "county-reported" on this site.</p><ul style={{ margin: 0, paddingLeft: 18 }}><li><Ext href="https://kydlgweb.ky.gov/Counties/16_CountyHome.cfm">Calloway County on the DLG portal</Ext> (budgets, quarterly reports, FY2022 to FY2025)</li><li><Ext href={links.budget}>Adopted budgets and administrative code</Ext> (county site)</li><li><Ext href={meetingsMeta.minutes_index_url}>Fiscal Court minutes</Ext> (county site)</li><li><Ext href={links.ordinances}>Ordinances</Ext> · <Ext href={links.forms}>Forms</Ext> · <Ext href={links.officials}>Elected officials</Ext></li></ul></div>
    <Section title="What law governs county money" />
    <div className="grid cols-2">{Object.values(law).map((l) => <div key={l.law} className="notice"><span className="badge brand">State law</span> <Ext href={l.url}>{l.law}</Ext><br /><span className="small">{l.detail}</span></div>)}</div>
  </>);
}

export function Sources() {
  const rows = [
    ['FY2018–FY2021 revenue, spending, budget vs. actual, debt', 'KY Auditor of Public Accounts, Calloway County Fiscal Court audits', 'Independently audited'],
    ['FY2022–FY2025 revenue, spending, budget vs. actual', 'County quarterly financial reports filed with KY DLG', 'County-reported, unaudited'],
    ['FY2024-25 General Fund line items', 'County year-end General Fund expenditure report', 'County year-end report'],
    ['FY2026-27 budget lines, all funds', 'Adopted budget, uniform DLG form', 'Adopted budget'],
    ['Meetings, motions and votes since Nov 2021; grants and debt', 'Official Fiscal Court minutes (PDF), callowaycountyky.gov', 'Compiled from minutes; meetings added Nov 2026 are marked as not yet independently reviewed'],
    ['Ordinances', 'County ordinance records, callowaycountyky.gov', 'Linked to county PDFs'],
    ['Staffing counts', 'Calloway County Treasurer, June 2026', 'County-reported'],
    ['Population (37,103)', 'U.S. Census 2020', 'Federal'],
    ['Road tickets, ideas, commitments', 'Submitted by residents and hub editors; stored in the hub database', 'Hub-collected, moderated'],
  ];
  return (<>
    <p className="lede">Where each kind of figure on this site comes from. Every page also carries a source line for exactly the documents it uses.</p>
    <div className="table-wrap"><table className="data"><thead><tr><th>What</th><th>Source</th><th>Record type</th></tr></thead><tbody>{rows.map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td><span className="badge">{r[2]}</span></td></tr>)}</tbody></table></div>
    <SourceNote>Documents are public records of Calloway County and the Commonwealth of Kentucky. Hub-compiled datasets are released under CC BY 4.0.</SourceNote>
  </>);
}

export function Glossary() {
  const terms = Object.entries(glossary).sort(([a], [b]) => a.localeCompare(b));
  return (<>
    <p className="lede">Plain-English definitions of {terms.length} terms you will see on budget lines and in meeting minutes. These same notes open when you tap an ⓘ anywhere on the site.</p>
    <div className="grid">{terms.map(([k, t]) => <div key={k} id={k} className="card" style={{ padding: 12 }}><div className="row between"><strong>{k}</strong><span className="badge">{t.badge}</span></div><p className="small" style={{ margin: '4px 0' }}>{t.what}</p><p className="small muted" style={{ margin: 0 }}><em>Why it matters:</em> {t.why}</p></div>)}</div>
  </>);
}

export function DataDownloads() {
  const base = import.meta.env.BASE_URL;
  const files = [['data/budget/overview.json', 'Budget overview: revenue by source, funds, budget vs. actual, FY2018–FY2025'], ['data/budget/fy2027.json', 'FY2026-27 adopted budget, every line across all funds'], ['data/budget/yearend_fy2025.json', 'FY2024-25 General Fund year-end lines'], ['data/meetings.json', 'Meetings with summaries, attendance and vote notes'], ['data/motions.json', 'Every motion with mover, seconder, result and per-member votes'], ['data/grants.json', 'Grants and outside funding'], ['data/debt.json', 'Debt and obligations'], ['data/enactments.json', 'Ordinances index'], ['data/glossary.json', 'Glossary terms'], ['data/members.json', 'Fiscal Court members']];
  return (<>
    <p className="lede">Every dataset the site uses, as JSON. CSV downloads are on each chart and table. Live data (road tickets, ideas, commitments) is available read-only from the hub's public API views listed in the project documentation.</p>
    <div className="card"><ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>{files.map(([f, d]) => <li key={f}><a href={base + f} download>{f}</a> <span className="small muted">{d}</span></li>)}</ul></div>
    <SourceNote>License: hub-compiled data CC BY 4.0 (credit "Calloway County Transparency Hub"). Source documents remain public records.</SourceNote>
  </>);
}

export function Corrections() {
  const { data, loading } = useAsync(() => api.corrections(), [], []);
  return (<>
    <p className="lede">Every reader can flag an error on any record. When a flag changes something, the before-and-after is logged here. Nothing is quietly edited.</p>
    {!backendReady ? <Empty>The corrections log is stored in the hub database, which is not configured in this build.</Empty> : loading ? <p className="muted">Loading…</p> : data.length === 0 ? <Empty>No corrections yet. Flags under review are not shown until resolved.</Empty> : (
      <div className="table-wrap"><table className="data"><thead><tr><th>Date</th><th>Record</th><th>Reported</th><th>Resolution</th></tr></thead><tbody>{data.map((c) => <tr key={c.id}><td>{dateShort(c.resolved_at.slice(0, 10))}</td><td className="small">{c.record_table} · {c.record_id}</td><td className="small">{c.message}</td><td className="small">{c.resolution}</td></tr>)}</tbody></table></div>
    )}
  </>);
}

export function About() {
  const { data: st } = useAsync(() => api.status(), [], null);
  return (<>
    <p className="lede">The Calloway County Transparency Hub is an independent, nonpartisan public-records project. It is not affiliated with Calloway County government or any candidate or campaign.</p>
    <Section title="What we publish, and how" />
    <div className="card">
      <p><strong>Figures.</strong> Revenue, spending, and budget figures come from independent state audits and the county's own filings to the Department for Local Government, always labeled as audited or county-reported and never blended. Budget lines come from the adopted budget.</p>
      <p><strong>Decisions.</strong> Meetings, motions, seconds, and votes are compiled from the official Fiscal Court minutes and link to each PDF. Kentucky fiscal courts vote by voice, so when the minutes say "all voted aye" every present member is recorded as aye; nays, abstentions, roll calls, and failed seconds are recorded from the minutes text. Topic tags are assigned by keyword and reviewed.</p>
      <p><strong>Commitments.</strong> The promises tracker records what officials said, where, and what happened, under one published rulebook that applies to every official. See the <Link to="/accountability/methodology">commitments methodology</Link>.</p>
      <p><strong>Resident submissions.</strong> Road tickets and ideas are posted by residents. Contact details required by the county are stored privately and never shown. Photos are reviewed before they appear. Anyone can flag any item.</p>
      <p><strong>Corrections.</strong> Flags go to a review queue; corrections are logged publicly. If we can't source it, we don't publish it.</p>
    </div>
    <Section title="Who runs it" />
    <div className="card"><p>The hub is published by David Moore. If anyone involved with the hub becomes a candidate for county office, that will be disclosed here and that person's own commitments will be tracked under the same rules as everyone else's.</p><p className="small muted" style={{ margin: 0 }}>Contact: use the <Link to="/feedback">Feedback</Link> page. Press and public-records questions are welcome.</p></div>
    <Section title="Status" />
    <div className="card small">{st ? <>Tickets: {st.tickets} · Photos awaiting review: {st.photos_pending} · Ideas published: {st.ideas} · Open flags: {st.flags_open} · Commitments published: {st.commitments} · Last data publish: {st.last_publish ? dateShort(st.last_publish.slice(0, 10)) : 'initial build'}</> : 'Backend status unavailable in this build.'} · Built from data files committed to the public repository; every change to the data is in the repository history.</div>
  </>);
}
