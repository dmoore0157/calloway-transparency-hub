import { Link, useParams, Navigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList } from 'recharts';
import { AlertTriangle, CheckCircle2, Repeat, FileText, ExternalLink } from 'lucide-react';
import { Meta } from '../../components/Meta';
import { Section, SourceNote, Stat, Ext, ChartFrame, Crumb, ShareButton } from '../../components/ui';
import { FlagButton } from '../../components/FlagButton';
import { audits, auditsMeta, auditByFy, findingById, type Audit, type AuditFinding } from '../../lib/data';
import { usd, dateLong, dateShort } from '../../lib/format';
import { palette, tooltipStyle } from '../../lib/palette';

const AREA_LABEL: Record<string, string> = { receipts: 'Cash collections', 'capital assets': 'Capital assets', budget: 'Budgeting', debt: 'Debt', 'federal awards': 'Federal grants', 'financial reporting': 'Financial reporting', disbursements: 'Purchasing & payments' };
const monthsLate = (a: Audit) => Math.round((new Date(a.report_date).getTime() - new Date(a.year_end).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
const opinionLabel = (o: string) => (o === 'unmodified' ? 'Clean (unmodified)' : o === 'adverse' ? 'Adverse' : o === 'qualified' ? 'Qualified' : o);

function KindBadges({ f }: { f: AuditFinding }) {
  return <span className="row" style={{ gap: 4 }}>{f.kind.map((k) => <span key={k} className={`badge ${k.includes('weakness') ? 'bad' : 'warn'}`}>{k}</span>)}{f.repeat_of && <span className="badge accent"><Repeat size={10} style={{ verticalAlign: '-1px' }} /> repeat of {f.repeat_of}</span>}</span>;
}

/** Audits overview: every state audit of the Fiscal Court, what it found, and which problems came back. */
export function Audits() {
  const p = palette();
  const latest = audits[0];
  const allFindings = audits.flatMap((a) => a.findings.map((f) => ({ ...f, fy: a.fy })));
  const repeats = allFindings.filter((f) => f.repeat_of).length;
  const perYear = audits.slice().reverse().map((a) => ({ fy: `FY${a.fy}`, findings: a.findings.length, repeats: a.findings.filter((f) => f.repeat_of).length, new: a.findings.filter((f) => !f.repeat_of).length, months: monthsLate(a), report: dateShort(a.report_date) }));
  const openChain = auditsMeta.chains.find((c) => c.key === 'disbursements');
  return (<>
    <Meta title="State audits of the Fiscal Court" description="Every Kentucky Auditor of Public Accounts audit of the Calloway County Fiscal Court: findings, repeat problems, the county's responses and what happened next." />
    <p className="lede">Every year the Kentucky Auditor of Public Accounts examines the Fiscal Court's books and publishes what it finds. This page lists each audit, what the auditors flagged, what county officials said they would do about it, and whether the same problem came back the next year.</p>
    <div className="grid cols-4">
      <Stat label="Audits published" value={audits.length} sub={`FY${audits[audits.length - 1].fy} to FY${latest.fy}; no FY2022 report`} />
      <Stat label="Findings in total" value={allFindings.length} sub={`${repeats} of them repeats of an earlier finding`} color={p.bad} />
      <Stat label="Latest audit" value={`FY${latest.fy}`} sub={`${latest.findings.length} finding${latest.findings.length === 1 ? '' : 's'}, released ${latest.released ? dateShort(latest.released) : dateShort(latest.report_date)}`} />
      <Stat label="Years with a material weakness" value={audits.filter((a) => a.material_weakness).length} sub={`of ${audits.length} audits`} color={p.bad} />
    </div>
    {openChain && <div className="notice warn" style={{ marginTop: 12 }}><strong>Still open:</strong> {openChain.label.toLowerCase()} has been flagged in each of the last three audits ({openChain.ids.map((id, i) => <span key={id}>{i > 0 && ', '}<Link to={`/records/audits/${findingById[id].fy}#${id}`}>{id}</Link></span>)}). {openChain.outcome}</div>}

    <Section title="Findings by audit year" />
    <ChartFrame title="How many problems each audit reported" intro="Each bar is one audit. The darker part is findings repeated from an earlier audit." rows={perYear} filename="audit-findings-by-year.csv" columns={[{ key: 'fy', label: 'Fiscal year' }, { key: 'findings', label: 'Findings', num: true }, { key: 'repeats', label: 'Repeats', num: true }, { key: 'report', label: 'Report dated' }]}
      footer={<SourceNote>Schedules of Findings in each <Ext href={auditsMeta.index_url}>Fiscal Court audit</Ext>, Kentucky Auditor of Public Accounts. No FY2022 Fiscal Court audit was published.</SourceNote>}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={perYear} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke={p.line} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="fy" tick={{ fill: p.muted, fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fill: p.muted, fontSize: 12 }} width={28} />
          <Tooltip {...tooltipStyle()} />
          <Bar dataKey="new" name="New findings" stackId="a" fill={p.series[1]} />
          <Bar dataKey="repeats" name="Repeat findings" stackId="a" fill={p.series[0]} radius={[3, 3, 0, 0]}><LabelList dataKey="findings" position="top" style={{ fill: p.ink, fontSize: 12, fontWeight: 700 }} /></Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>

    <Section title="Problems that kept coming back" />
    <p className="small muted" style={{ marginTop: -6 }}>Auditors mark a finding as a repeat when the prior year's audit raised the same issue. These are the chains in Calloway County's audits, oldest first.</p>
    <div className="grid cols-2">{auditsMeta.chains.map((c) => {
      const last = findingById[c.ids[c.ids.length - 1]]; const open = c.key === 'disbursements';
      return <div key={c.key} className={`card ${open ? 'accent' : ''}`} style={{ padding: 14 }}>
        <div className="row between"><h3 style={{ margin: 0 }}>{c.label}</h3><span className={`badge ${open ? 'bad' : 'ok'}`}>{open ? 'Open' : 'Resolved or not repeated'}</span></div>
        <div className="row small" style={{ margin: '8px 0' }}>{c.ids.map((id) => <Link key={id} to={`/records/audits/${findingById[id].fy}#${id}`} className="chip">{id}</Link>)}</div>
        <p className="small" style={{ margin: '0 0 6px' }}>{last.summary}</p>
        <p className="small muted" style={{ margin: 0 }}><strong>Outcome:</strong> {c.outcome}</p>
      </div>; })}</div>

    <Section title="Every audit" />
    <div className="grid">{audits.map((a) => <AuditCard key={a.fy} a={a} />)}</div>
    {auditsMeta.gaps.map((g) => <div key={g.fy} className="notice" style={{ marginTop: 10 }}><strong>FY{g.fy}:</strong> {g.note}</div>)}

    <Section title="How long the audits took" />
    <ChartFrame title="Months from the end of the fiscal year to the signed audit report" intro="Kentucky counties' books close June 30. The FY2023 report was not signed until April 2026, almost three years later, and was released the same day as the FY2024 report." rows={perYear} filename="audit-timeliness.csv" columns={[{ key: 'fy', label: 'Fiscal year' }, { key: 'months', label: 'Months to report', num: true }, { key: 'report', label: 'Report dated' }]}
      footer={<SourceNote>Report dates are the auditor's signature dates in each report; release dates come from the Auditor's released-audits list.</SourceNote>}>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={perYear} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke={p.line} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="fy" tick={{ fill: p.muted, fontSize: 12 }} /><YAxis tick={{ fill: p.muted, fontSize: 12 }} width={28} />
          <Tooltip {...tooltipStyle()} formatter={(v) => `${v} months`} />
          <Bar dataKey="months" name="Months to report" radius={[3, 3, 0, 0]}>{perYear.map((r) => <Cell key={r.fy} fill={r.months > 18 ? p.bad : p.series[0]} />)}<LabelList dataKey="months" position="top" style={{ fill: p.ink, fontSize: 12, fontWeight: 700 }} /></Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>

    <Section title="What the audited totals say" />
    <div className="table-wrap"><table className="data"><thead><tr><th>Fiscal year</th><th className="num">Receipts (all funds)</th><th className="num">Disbursements</th><th className="num">Change in balances</th><th className="num">Fund balances, June 30</th><th className="num">Long-term debt, June 30</th></tr></thead>
      <tbody>{audits.map((a) => <tr key={a.fy}><td><Link to={`/records/audits/${a.fy}`}>FY{a.fy}</Link></td><td className="num">{usd(a.totals.receipts)}</td><td className="num">{usd(a.totals.disbursements)}</td><td className="num" style={{ color: a.totals.net_change < 0 ? p.bad : p.ok }}>{a.totals.net_change < 0 ? '−' : '+'}{usd(Math.abs(a.totals.net_change))}</td><td className="num">{usd(a.totals.balance_end)}</td><td className="num">{usd(a.debt_end)}</td></tr>)}</tbody></table></div>
    <p className="small muted" style={{ marginTop: 8 }}>These are the independently audited, all-funds totals on the regulatory (cash) basis. The budget pages use General Fund figures and, for FY2022 to FY2025, the county's own filings; the two are not blended. The FY2021 jump in receipts is federal pandemic money. Change in balances includes loan proceeds where the county financed equipment.</p>
    <SourceNote>{auditsMeta.source}. {auditsMeta.how_compiled} Compiled {dateShort(auditsMeta.compiled)}.</SourceNote>
  </>);
}

function AuditCard({ a }: { a: Audit }) {
  return <Link to={`/records/audits/${a.fy}`} className="linkcard">
    <div className="row between"><h3 style={{ margin: 0 }}>FY{a.fy} audit <span className="small muted" style={{ fontWeight: 400 }}>year ended {dateShort(a.year_end)}</span></h3><span className={`badge ${a.findings.length === 0 ? 'ok' : a.findings.some((f) => f.repeat_of) ? 'bad' : 'warn'}`}>{a.findings.length} finding{a.findings.length === 1 ? '' : 's'}{a.findings.some((f) => f.repeat_of) ? ', incl. repeat' : ''}</span></div>
    <p style={{ marginTop: 6 }}>{a.findings.length ? a.findings.map((f) => f.title).join(' · ') : 'No findings.'}</p>
    <p className="tiny muted" style={{ marginTop: 6 }}>Report dated {dateShort(a.report_date)}{a.released ? `, released ${dateShort(a.released)}` : ''} · {a.auditor}, Auditor of Public Accounts · Judge/Executive {a.judge_executive}</p>
  </Link>;
}

/** One audit year: opinions, totals, every finding with the county's response and what happened next. */
export function AuditPage() {
  const { fy } = useParams();
  const a = fy ? auditByFy[fy] : undefined;
  if (!a) return <Navigate to="/records/audits" replace />;
  const p = palette();
  const idx = audits.findIndex((x) => x.fy === a.fy); const newer = audits[idx - 1]; const older = audits[idx + 1];
  return (<>
    <Meta title={`FY${a.fy} state audit of the Fiscal Court`} description={`Kentucky Auditor of Public Accounts audit of the Calloway County Fiscal Court for the year ended ${dateLong(a.year_end)}: ${a.findings.length} finding${a.findings.length === 1 ? '' : 's'}.`} />
    <Crumb items={[{ to: '/records', label: 'Records' }, { to: '/records/audits', label: 'Audits' }]} />
    <div className="row between" style={{ alignItems: 'flex-start' }}>
      <div><h2 style={{ margin: 0 }}>FY{a.fy} audit of the Calloway County Fiscal Court</h2><p className="small muted" style={{ margin: '4px 0 0' }}>Year ended {dateLong(a.year_end)} · report dated {dateLong(a.report_date)}{a.released ? ` · released ${dateLong(a.released)}` : ''} · {a.auditor}, Auditor of Public Accounts</p></div>
      <div className="row"><ShareButton title={`FY${a.fy} audit`} /><FlagButton table="audits" id={String(a.fy)} /></div>
    </div>
    <div className="row" style={{ margin: '12px 0' }}>
      <a className="btn primary small" href={a.report_url} target="_blank" rel="noopener noreferrer"><FileText size={14} /> Full report (PDF) <ExternalLink size={12} /></a>
      {a.press_url && <a className="btn small" href={a.press_url} target="_blank" rel="noopener noreferrer">Auditor's press release <ExternalLink size={12} /></a>}
    </div>
    <div className="grid cols-4">
      <Stat label="Opinion, state (regulatory) basis" value={<span style={{ fontSize: 20 }}>{opinionLabel(a.opinions.regulatory)}</span>} sub="Did the cash-basis statement fairly present receipts and disbursements?" color={a.opinions.regulatory === 'unmodified' ? p.ok : p.bad} />
      <Stat label="Opinion, GAAP basis" value={<span style={{ fontSize: 20 }}>{opinionLabel(a.opinions.gaap)}</span>} sub="Standard for Kentucky counties, which report on a cash basis rather than full accrual accounting" />
      <Stat label="Findings" value={a.findings.length} sub={a.findings.some((f) => f.repeat_of) ? `${a.findings.filter((f) => f.repeat_of).length} repeated from a prior audit` : a.findings.length ? 'none repeated from the prior audit' : 'a clean report'} color={a.findings.length ? p.bad : p.ok} />
      <Stat label="Material weakness" value={a.material_weakness ? 'Yes' : 'No'} sub={a.noncompliance ? 'Material noncompliance with state law also reported' : 'No material noncompliance reported'} color={a.material_weakness ? p.bad : p.ok} />
    </div>
    {a.single_audit && <div className="notice" style={{ marginTop: 10 }}>This year also included a federal single audit because the county spent more than $750,000 of federal money. Major program: {a.major_program}. Opinion on federal compliance: {opinionLabel(a.opinions.federal_compliance ?? '')}.</div>}

    <Section title="Who was responsible" />
    <div className="card small"><p style={{ margin: 0 }}><strong>County Judge/Executive:</strong> {a.judge_executive}{a.treasurer && <> · <strong>County Treasurer:</strong> {a.treasurer}</>}. The Judge/Executive is the county's chief financial officer under state law and signs the responses to each finding; the Fiscal Court as a whole approves the budget, claims and the treasurer's reports. {a.judge_executive_note}</p>
      <p className="muted" style={{ margin: '6px 0 0' }}>See how the court voted on budgets, claims and amendments in the <Link to="/decisions/votes">vote tracker</Link> and each member's record in the <Link to="/decisions/members">scorecards</Link>.</p></div>

    <Section title={`Findings (${a.findings.length})`} />
    {a.findings.length === 0 && <div className="empty">The auditors reported no findings this year.</div>}
    {a.findings.map((f) => <FindingCard key={f.id} f={f} fy={a.fy} />)}

    {a.prior_findings && a.prior_findings.length > 0 && <>
      <Section title="What happened to the prior year's findings" />
      <div className="table-wrap"><table className="data"><thead><tr><th>Prior finding</th><th>Status reported by the auditors</th></tr></thead><tbody>{a.prior_findings.map((pf) => { const prev = findingById[pf.id]; return <tr key={pf.id}><td>{prev ? <Link to={`/records/audits/${prev.fy}#${pf.id}`}>{pf.id}</Link> : pf.id}<div className="small muted">{prev?.title}</div></td><td><span className={`badge ${pf.status === 'Resolved' ? 'ok' : pf.status === 'Repeated' ? 'bad' : 'warn'}`}>{pf.status}</span></td></tr>; })}</tbody></table></div>
    </>}

    <Section title="Audited totals, all funds" />
    <div className="grid cols-3">
      <Stat label="Receipts" value={usd(a.totals.receipts, { compact: true })} sub="all funds, cash basis" /><Stat label="Disbursements" value={usd(a.totals.disbursements, { compact: true })} sub="all funds, cash basis" />
      <Stat label="Fund balances, June 30" value={usd(a.totals.balance_end, { compact: true })} sub={`${a.totals.net_change < 0 ? 'down' : 'up'} ${usd(Math.abs(a.totals.net_change), { compact: true })} for the year${a.totals.financing ? `, including ${usd(a.totals.financing, { compact: true })} of loan proceeds` : ''}`} color={a.totals.net_change < 0 ? p.bad : p.ok} />
    </div>
    <p className="small muted" style={{ marginTop: 8 }}>Long-term debt at June 30, {a.fy}: {usd(a.debt_end)}. Debt is explained on the <Link to="/money/debt">debt page</Link>.</p>
    <SourceNote><Ext href={a.report_url}>Report of the Audit of the Calloway County Fiscal Court, year ended {dateLong(a.year_end)}</Ext>, Kentucky Auditor of Public Accounts. Findings are condensed from the report's Schedule of Findings; the bullet points, dollar figures, recommendations and responses follow the report text.</SourceNote>
    <div className="row between" style={{ marginTop: 16 }}>{older ? <Link to={`/records/audits/${older.fy}`}>← FY{older.fy} audit</Link> : <span />}{newer ? <Link to={`/records/audits/${newer.fy}`}>FY{newer.fy} audit →</Link> : <span />}</div>
  </>);
}

function FindingCard({ f, fy }: { f: AuditFinding; fy: number }) {
  const prev = f.repeat_of ? findingById[f.repeat_of] : null;
  const resolved = /resolved|corrected|not repeated/i.test(f.next_status ?? '') && !/repeated as/i.test(f.next_status ?? '');
  return <div id={f.id} className="card" style={{ scrollMarginTop: 80 }}>
    <div className="row between" style={{ alignItems: 'flex-start' }}><div><span className="eyebrow">{f.id} · {AREA_LABEL[f.area] ?? f.area}</span><h3 style={{ margin: '4px 0 6px' }}>{f.title}</h3></div><KindBadges f={f} /></div>
    <p style={{ marginTop: 0 }}>{f.summary}</p>
    <details><summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>What the auditors found, in detail</summary>
      <ul className="small" style={{ paddingLeft: 18, margin: '8px 0' }}>{f.details.map((d, i) => <li key={i}>{d}</li>)}</ul>
      {f.dollars.filter((d) => d.amount != null).length > 0 && <div className="row small" style={{ marginBottom: 8 }}>{f.dollars.filter((d) => d.amount != null).map((d) => <span key={d.label} className="chip">{d.label}: <strong>{usd(d.amount as number)}</strong></span>)}</div>}
      <p className="small" style={{ margin: '6px 0' }}><strong>Why it happened (per the report):</strong> {f.cause}</p>
      {f.questioned_costs != null && <p className="small" style={{ margin: '6px 0' }}><strong>Questioned federal costs:</strong> {usd(f.questioned_costs)}</p>}
    </details>
    <div className="grid cols-2" style={{ marginTop: 10 }}>
      <div className="notice"><strong>Auditors recommended</strong><p className="small" style={{ margin: '4px 0 0' }}>{f.recommendation}</p></div>
      <div className="notice" style={{ borderColor: 'var(--series-2, #5B7A9E)' }}><strong>County's response</strong> <span className="tiny muted">({f.response_by})</span><p className="small" style={{ margin: '4px 0 0', fontStyle: 'italic' }}>“{f.response}”</p>{f.auditor_reply && <p className="small" style={{ margin: '6px 0 0' }}><strong>Auditor's reply:</strong> {f.auditor_reply}</p>}</div>
    </div>
    <div className="row small" style={{ marginTop: 10, gap: 12 }}>
      {prev && <span><Repeat size={13} style={{ verticalAlign: '-2px' }} /> Repeats <Link to={`/records/audits/${prev.fy}#${prev.id}`}>{prev.id}</Link> (FY{prev.fy})</span>}
      {f.next_status && <span>{resolved ? <CheckCircle2 size={13} style={{ verticalAlign: '-2px', color: 'var(--ok)' }} /> : <AlertTriangle size={13} style={{ verticalAlign: '-2px', color: 'var(--warn)' }} />} <strong>What happened next:</strong> {f.next_status}</span>}
      <span style={{ marginLeft: 'auto' }}><FlagButton table="audit_findings" id={f.id} label="Report an error" /></span>
    </div>
    <span className="sr-only">FY{fy}</span>
  </div>;
}
