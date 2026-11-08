import { Link } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, BarChart, Bar, Legend } from 'recharts';
import { overview, fy2027, law, fundLawKey } from '../../lib/data';
import { usd, pct } from '../../lib/format';
import { ChartFrame, Section, SourceNote, Stat, Ext } from '../../components/ui';
import { ExplainButton } from '../../components/Explain';
import { palette, tooltipStyle } from '../../lib/palette';

export default function Overview() {
  const p = palette(); const s = overview.stats; const years = overview.years;
  const gf = overview.general_fund_spending.map((r) => ({ year: r.y, spending: r.v, average: s.avgSpend, source: r.src }));
  const funds = years.map((y, i) => ({ year: `FY${String(y).slice(2)}`, 'General Fund': overview.funds['General Fund'][i], 'Road Fund': overview.funds['Road Fund'][i], 'Jail Fund': overview.funds['Jail Fund'][i] }));
  const budgetUsed = Math.round((s.latestSpend / 6715931) * 100);
  return (
    <>
      <div className="grid cols-4">
        <Stat label={`Latest spending (FY${s.latestFY})`} value={usd(s.latestSpend, { compact: true })} sub="General Fund, most recent year on record" color={p.src.yearend} />
        <Stat label="vs. the year before" value={`+${pct(s.latestYoY)}`} sub={`FY${s.latestFY} vs. FY${s.latestFY - 1}`} />
        <Stat label="Per resident" value={usd(s.latestPerRes)} sub={`÷ ${overview.population.toLocaleString()} residents (2020 census)`} />
        <Stat label="Budget used" value={`${budgetUsed}%`} sub={`spent ${usd(s.latestSpend, { compact: true })} of a ${usd(6715931, { compact: true })} plan`} color={p.ok} />
      </div>
      <div className="grid cols-3" style={{ marginTop: 12 }}>
        <div className="card accent"><strong>Up {s.growth}% in eight years.</strong> General Fund spending grew from {usd(s.spanLow)} (FY2018) to {usd(s.spanHigh)} (FY{s.latestFY}).</div>
        <div className="card accent"><strong>The county budgets more than it spends.</strong> Over eight years it used about {s.avgExec}% of its General Fund budget on average.</div>
        <div className="card accent"><strong>Typical year ≈ {usd(s.avgSpend, { compact: true })}.</strong> That's the 8-year average; FY{s.latestFY} is running above it.</div>
      </div>

      <Section title="The whole budget for FY2026-27" action={<Link to="/money/lines" className="small">Every line item ›</Link>} />
      <div className="card">
        <div className="row between"><div><div className="eyebrow">Adopted budget, all funds</div><div style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 700 }}>{usd(fy2027.summary.total)}</div><div className="small muted">{fy2027.summary.period}. By Kentucky law the budget must balance, so planned revenue equals appropriations.</div></div></div>
        <div className="grid cols-3" style={{ marginTop: 12 }}>
          {fy2027.summary.funds.slice(0, 6).map((f) => (
            <div key={f.name} className="card" style={{ padding: 12 }}>
              <div className="row between"><strong>{f.name}</strong><ExplainButton title={f.name} amounts={[{ label: 'FY2026-27 budget', value: usd(f.total) }, { label: 'Share of all funds', value: f.pct }]} source="FY2026-27 adopted budget" /></div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 700 }}>{usd(f.total)}</div>
              <div className="small muted">{f.pct} of the budget · {f.note}</div>
            </div>
          ))}
        </div>
        <SourceNote>Calloway County Fiscal Court adopted budget FY2026-27, uniform budget form filed with the Kentucky Department for Local Government.</SourceNote>
      </div>

      <Section title="General Fund spending over time" />
      <ChartFrame title="FY2018 to FY2025, actual spending" intro="The solid line is what the county's main fund actually spent. The dashed line is the 8-year average. Dot color shows the record behind each figure; audited and self-reported numbers are never blended." rows={gf} columns={[{ key: 'year', label: 'Year' }, { key: 'spending', label: 'Spending', num: true, format: (v) => usd(v as number) }, { key: 'source', label: 'Record' }]} filename="general-fund-spending.csv"
        footer={<><div className="row small" style={{ marginTop: 8 }}>{Object.entries(overview.source_labels).map(([k, l]) => <span key={k}><span className="vote-dot" style={{ background: p.src[k] }} />{l}</span>)}</div><SourceNote>FY2018–21 KY Auditor of Public Accounts; FY2022–25 county quarterly filings to the Dept. for Local Government. State audits for FY2023–25 were released in 2026 and are summarized under <Link to="/records/audits">State audits</Link>. FY2026 financials are not yet in the state system.</SourceNote></>}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={gf} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={p.line} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="year" tick={{ fill: p.muted, fontSize: 12 }} /><YAxis tickFormatter={(v) => usd(v, { compact: true })} tick={{ fill: p.muted, fontSize: 12 }} width={56} />
            <Tooltip {...tooltipStyle()} formatter={(v) => usd(Number(v))} />
            <ReferenceLine y={s.avgSpend} stroke={p.muted} strokeDasharray="6 4" label={{ value: '8-yr avg', fill: p.muted, fontSize: 11, position: 'insideTopLeft' }} />
            <Line type="monotone" dataKey="spending" name="General Fund spending" stroke={p.series[0]} strokeWidth={2.5} dot={(props) => <circle key={props.index} cx={props.cx} cy={props.cy} r={5} fill={p.src[props.payload.source]} stroke={p.surface} strokeWidth={1.5} />} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>

      <Section title="The three main funds" />
      <ChartFrame title="General, Road and Jail funds, FY2018 to FY2025" intro="Most county money flows through these three accounts. Tap a fund name for what it pays for." rows={funds} filename="three-funds.csv" columns={[{ key: 'year', label: 'Year' }, { key: 'General Fund', label: 'General Fund', num: true, format: (v) => usd(v as number) }, { key: 'Road Fund', label: 'Road Fund', num: true, format: (v) => usd(v as number) }, { key: 'Jail Fund', label: 'Jail Fund', num: true, format: (v) => usd(v as number) }]}
        footer={<><div className="row" style={{ marginTop: 10 }}>{(['General Fund', 'Road Fund', 'Jail Fund'] as const).map((f, i) => <span key={f} className="chip"><span className="vote-dot" style={{ background: p.series[i] }} />{f}: <strong>{usd(overview.funds[f][years.length - 1], { compact: true })}</strong><ExplainButton title={f} amounts={[{ label: `FY${s.latestFY} spending`, value: usd(overview.funds[f][years.length - 1]) }, { label: 'Per resident', value: usd(Math.round(overview.funds[f][years.length - 1] / overview.population)) }]} source="County financial report filed with KY DLG (FY2025)." /></span>)}</div>
          <div style={{ marginTop: 12 }}><div className="eyebrow" style={{ marginBottom: 6 }}>What law governs these funds?</div>{Object.entries(fundLawKey).map(([f, k]) => <div key={f} className="notice" style={{ marginBottom: 6 }}><span className="badge brand">State law</span> <strong>{f}:</strong> <Ext href={law[k].url}>{law[k].law}</Ext><br /><span className="small">{law[k].detail}</span></div>)}</div></>}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={funds} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={p.line} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="year" tick={{ fill: p.muted, fontSize: 12 }} /><YAxis tickFormatter={(v) => usd(v, { compact: true })} tick={{ fill: p.muted, fontSize: 12 }} width={56} />
            <Tooltip {...tooltipStyle()} formatter={(v) => usd(Number(v))} /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="General Fund" fill={p.series[0]} radius={[3, 3, 0, 0]} /><Bar dataKey="Road Fund" fill={p.series[1]} radius={[3, 3, 0, 0]} /><Bar dataKey="Jail Fund" fill={p.series[2]} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <Section title="People on the payroll" />
      <div className="card">
        <p className="small">As of {overview.staffing.asOf}, per the {overview.staffing.source}. Headcounts change with hiring and vacancies. Fee-office staff (Sheriff, Clerk) are not paid on county salary lines.</p>
        <div className="grid cols-2">
          <div><div className="eyebrow">Paid from the county budget</div>{overview.staffing.budgetFunded.map(([n, c]) => <div key={String(n)} className="row between small" style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}><span>{n}</span><strong>{c}</strong></div>)}</div>
          <div><div className="eyebrow">Fee offices (self-funded)</div>{overview.staffing.feeOffices.map(([n, c]) => <div key={String(n)} className="row between small" style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}><span>{n}</span><strong>{c}</strong></div>)}</div>
        </div>
      </div>
    </>
  );
}
