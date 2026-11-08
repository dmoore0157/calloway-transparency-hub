import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { overview, fy2027, law } from '../../lib/data';
import { usd } from '../../lib/format';
import { ChartFrame, Section, SourceNote, Ext } from '../../components/ui';
import { ExplainButton } from '../../components/Explain';
import { palette, tooltipStyle } from '../../lib/palette';

export default function Sources() {
  const p = palette(); const yrs = overview.years; const last = yrs.length - 1;
  const rows = yrs.map((y, i) => { const r: Record<string, unknown> = { year: `FY${String(y).slice(2)}`, record: overview.source_by_year[i] }; for (const s of overview.revenue_sources) r[s.name] = s.values[i]; r.total = overview.revenue_total_by_year[i]; return r; });
  const sorted = [...overview.revenue_sources].sort((a, b) => b.values[last] - a.values[last]);
  const total = overview.revenue_total_by_year[last];
  const lawFor: Record<string, string> = { 'Insurance premium tax': 'insTax', 'Transient (lodging) tax': 'transient', 'Excess fees (from fee offices)': 'sheriffFees', '911 fees': 'e911' };
  return (
    <>
      <p className="lede">The General Fund took in {usd(total)} in FY{yrs[last]}. Property and other taxes are the county's largest and steadiest source of its own money. Tap any source for what it is.</p>
      <div className="grid cols-2">
        {sorted.map((s, i) => (
          <div key={s.name} className="card" style={{ padding: 12, borderLeft: `4px solid ${p.series[i % p.series.length]}` }}>
            <div className="row between"><strong>{s.name}</strong><ExplainButton title={s.name} amounts={[{ label: `FY${yrs[last]}`, value: usd(s.values[last]) }, { label: 'Share of revenue', value: `${((s.values[last] / total) * 100).toFixed(1)}%` }, { label: 'Change since FY2018', value: `${s.values[0] ? Math.round(((s.values[last] - s.values[0]) / s.values[0]) * 100) : 0}%` }]} source={`County financial report filed with KY DLG, FY${yrs[last]}.`} /></div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700 }}>{usd(s.values[last])}</div>
            <div className="small muted">{((s.values[last] / total) * 100).toFixed(1)}% of General Fund revenue{lawFor[s.name] && <> · <Ext href={law[lawFor[s.name]].url}>{law[lawFor[s.name]].law}</Ext></>}</div>
          </div>
        ))}
      </div>

      <Section title="Eight years of revenue, by source" />
      <ChartFrame title="General Fund revenue, FY2018 to FY2025" intro="FY2021 was the pandemic year: large one-time federal funds and transfers between accounts make it look unusual. Stacked by source." rows={rows} filename="general-fund-revenue.csv"
        columns={[{ key: 'year', label: 'Year' }, ...overview.revenue_sources.map((s) => ({ key: s.name, label: s.name, num: true, format: (v: unknown) => usd(v as number) })), { key: 'total', label: 'Total', num: true, format: (v) => usd(v as number) }, { key: 'record', label: 'Record' }]}
        footer={<SourceNote>FY2018–21 KY Auditor of Public Accounts; FY2022–25 county filings to the Dept. for Local Government, labeled and never blended.</SourceNote>}>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={rows} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={p.line} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="year" tick={{ fill: p.muted, fontSize: 12 }} /><YAxis tickFormatter={(v) => usd(v, { compact: true })} tick={{ fill: p.muted, fontSize: 12 }} width={56} />
            <Tooltip {...tooltipStyle()} formatter={(v) => usd(Number(v))} /><Legend wrapperStyle={{ fontSize: 11 }} />
            {sorted.map((s, i) => <Bar key={s.name} dataKey={s.name} stackId="a" fill={p.series[i % p.series.length]} />)}
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <Section title="Planned revenue for FY2026-27, by fund" />
      <div className="grid cols-2">
        {fy2027.summary.funds.filter((f) => f.rev.length).map((f) => (
          <div key={f.name} className="card">
            <div className="row between"><h3 style={{ marginBottom: 2 }}>{f.name}</h3><strong>{usd(f.total)}</strong></div>
            <table className="data" style={{ fontSize: 13 }}><tbody>{f.rev.map(([n, v]) => <tr key={String(n)}><td>{n}<ExplainButton title={String(n)} /></td><td className="num" style={{ color: Number(v) < 0 ? 'var(--bad)' : undefined }}>{usd(Number(v))}</td></tr>)}</tbody></table>
            <p className="tiny muted" style={{ margin: '6px 0 0' }}>Negative "surplus, borrowing and transfers" means this fund sends money to other funds rather than receiving it.</p>
          </div>
        ))}
      </div>
    </>
  );
}
