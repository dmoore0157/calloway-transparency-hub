import { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { overview } from '../../lib/data';
import { usd } from '../../lib/format';
import { ChartFrame, SourceNote, Section } from '../../components/ui';
import { ExplainButton } from '../../components/Explain';
import { palette, tooltipStyle } from '../../lib/palette';

export default function BudgetVsActual() {
  const p = palette(); const bva = overview.budget_vs_actual; const years = Object.keys(bva.by_year);
  const [year, setYear] = useState(years[years.length - 1]);
  const labels = bva.labels as Record<string, string>;
  const data = Object.entries((bva.by_year as Record<string, Record<string, { b: number; a: number }>>)[year]).map(([k, v]) => ({ key: k, category: labels[k] ?? k, budgeted: v.b, actual: v.a, variance: v.a - v.b, used: v.b ? Math.round((v.a / v.b) * 100) : 0 })).sort((a, b) => b.budgeted - a.budgeted);
  const totals = data.reduce((acc, d) => ({ b: acc.b + d.budgeted, a: acc.a + d.actual }), { b: 0, a: 0 });
  const trend = years.map((y) => { const yr = (bva.by_year as Record<string, Record<string, { b: number; a: number }>>)[y]; const b = Object.values(yr).reduce((s, v) => s + v.b, 0); const a = Object.values(yr).reduce((s, v) => s + v.a, 0); return { year: y, budgeted: b, actual: a, used: Math.round((a / b) * 100), record: (bva.source_by_year as Record<string, string>)[y] }; });
  const src = (bva.source_by_year as Record<string, string>)[year];
  return (
    <>
      <p className="lede">Kentucky counties must adopt a balanced budget, but they rarely spend all of it. Here is the plan next to what actually happened, by category, for the General Fund.</p>
      <div className="row" style={{ marginBottom: 12 }}>{years.map((y) => <button key={y} className={`chip ${year === y ? 'active' : ''}`} onClick={() => setYear(y)}>{y}</button>)}</div>
      <div className="grid cols-3">
        <div className="stat"><div className="label">Budgeted, {year}</div><div className="value">{usd(totals.b, { compact: true })}</div><div className="sub">final budget after amendments</div></div>
        <div className="stat" style={{ borderTopColor: p.src[src] }}><div className="label">Actually spent</div><div className="value">{usd(totals.a, { compact: true })}</div><div className="sub">{overview.source_labels[src as keyof typeof overview.source_labels]}</div></div>
        <div className="stat" style={{ borderTopColor: p.ok }}><div className="label">Share of plan used</div><div className="value">{Math.round((totals.a / totals.b) * 100)}%</div><div className="sub">{usd(totals.b - totals.a, { compact: true })} left unspent</div></div>
      </div>
      <Section title={`${year}: plan vs. actual by category`} />
      <ChartFrame title="Budgeted vs. actually spent" intro={year === 'FY2021' ? 'FY2021 was the pandemic year, with large one-time federal funds and transfers between accounts.' : 'Tap a category name below the chart for what it covers.'} rows={data} filename={`budget-vs-actual-${year}.csv`}
        columns={[{ key: 'category', label: 'Category' }, { key: 'budgeted', label: 'Budgeted', num: true, format: (v) => usd(v as number) }, { key: 'actual', label: 'Actual', num: true, format: (v) => usd(v as number) }, { key: 'used', label: '% used', num: true, format: (v) => `${v}%` }]}
        footer={<><div className="row" style={{ marginTop: 10 }}>{data.map((d) => <span key={d.key} className="chip">{d.category}<ExplainButton title={d.category} amounts={[{ label: `${year} budgeted`, value: usd(d.budgeted) }, { label: `${year} actually spent`, value: usd(d.actual) }, { label: 'Share of plan used', value: `${d.used}%` }]} source={`${overview.source_labels[src as keyof typeof overview.source_labels]}, ${year}.`} /></span>)}</div><SourceNote>{overview.source_labels[src as keyof typeof overview.source_labels]}, fiscal year ended June 30, {year.slice(2)}. "Budgeted" is the final budget after amendments.</SourceNote></>}>
        <ResponsiveContainer width="100%" height={Math.max(260, data.length * 44)}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
            <CartesianGrid stroke={p.line} strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => usd(v, { compact: true })} tick={{ fill: p.muted, fontSize: 12 }} /><YAxis type="category" dataKey="category" width={150} tick={{ fill: p.ink, fontSize: 12 }} />
            <Tooltip {...tooltipStyle()} formatter={(v) => usd(Number(v))} /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="budgeted" name="Budgeted" fill={p.accent} radius={[0, 3, 3, 0]} /><Bar dataKey="actual" name="Actually spent" fill={p.series[0]} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
      <Section title="Biggest gaps between plan and reality" />
      <div className="card">
        <table className="data"><thead><tr><th>Category</th><th className="num">Unspent</th><th className="num">% of plan used</th><th>Reading</th></tr></thead>
          <tbody>{[...data].sort((a, b) => a.variance - b.variance).map((d) => <tr key={d.key}><td>{d.category}</td><td className="num">{usd(-d.variance)}</td><td className="num">{d.used}%</td><td className="small muted">{d.used < 50 ? 'Spent less than half of what was planned' : d.used < 85 ? 'Well under plan' : d.used <= 100 ? 'Close to plan' : 'Over plan'}</td></tr>)}</tbody></table>
      </div>
      <Section title="Eight-year trend" />
      <ChartFrame title="Total General Fund plan vs. actual, FY2018 to FY2025" rows={trend} filename="budget-vs-actual-trend.csv" columns={[{ key: 'year', label: 'Year' }, { key: 'budgeted', label: 'Budgeted', num: true, format: (v) => usd(v as number) }, { key: 'actual', label: 'Actual', num: true, format: (v) => usd(v as number) }, { key: 'used', label: '% used', num: true, format: (v) => `${v}%` }, { key: 'record', label: 'Record' }]}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={p.line} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="year" tick={{ fill: p.muted, fontSize: 12 }} /><YAxis tickFormatter={(v) => usd(v, { compact: true })} tick={{ fill: p.muted, fontSize: 12 }} width={56} />
            <Tooltip {...tooltipStyle()} formatter={(v) => usd(Number(v))} /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="budgeted" name="Budgeted" fill={p.accent} /><Bar dataKey="actual" name="Actually spent" fill={p.series[0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </>
  );
}
