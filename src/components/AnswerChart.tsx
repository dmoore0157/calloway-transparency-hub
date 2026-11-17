// Charts the "Ask the records" assistant asks for. The assistant returns numbers (checked against the records on
// the server); this draws them in the hub's validated palette: tooltips on every mark, a legend that toggles series,
// one highlighted category, value labels where they fit, and the shared table view and CSV download.
import { useMemo, useState, type ReactNode } from 'react';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList, ReferenceLine } from 'recharts';
import { ChartFrame } from './ui';
import { palette } from '../lib/palette';
import { usd } from '../lib/format';

export type ChartSpec = { type: 'column' | 'bar' | 'line' | 'grouped_column' | 'stacked_column'; title: string; subtitle: string; unit: 'usd' | 'count' | 'percent' | 'number'; categories: string[]; series: { name: string; values: number[] }[]; highlight: string | null; sources: number[] };
export type StatSpec = { label: string; value: string; note: string };

const MUTED_BAR = '#A3B1C2';   // de-emphasis fill for the categories that are not the point of the chart
const HIGHLIGHT = '#E09A00';   // series-2 amber, the emphasis hue on light cards

/** Full value, for tooltips and the table. */
export function fmtFull(v: number, unit: ChartSpec['unit']) {
  if (unit === 'usd') return usd(v, { cents: !Number.isInteger(v) });
  if (unit === 'percent') return `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
/** Short value, for axes and bar labels. */
export function fmtShort(v: number, unit: ChartSpec['unit']) {
  if (unit === 'percent') return `${Math.round(v * 10) / 10}%`;
  const a = Math.abs(v); const sign = v < 0 ? '-' : ''; const pre = unit === 'usd' ? '$' : '';
  if (a >= 1e9) return `${sign}${pre}${(a / 1e9).toFixed(a >= 1e10 ? 0 : 1)}B`;
  if (a >= 1e6) return `${sign}${pre}${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e4) return `${sign}${pre}${Math.round(a / 1e3)}K`;
  return `${sign}${pre}${a.toLocaleString('en-US', { maximumFractionDigits: unit === 'usd' ? 0 : 1 })}`;
}

export function StatTiles({ stats }: { stats: StatSpec[] }) {
  if (!stats.length) return null;
  return <div className="answer-stats">{stats.map((s, i) => <div key={i} className="stat"><div className="label">{s.label}</div><div className="value">{s.value}</div>{s.note && <div className="sub">{s.note}</div>}</div>)}</div>;
}

export function AnswerChart({ c, cite, idx }: { c: ChartSpec; cite: (n: number) => ReactNode; idx: number }) {
  const p = palette();
  const colors = p.series;
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const multi = c.series.length > 1;
  const horizontal = c.type === 'bar';
  const stacked = c.type === 'stacked_column';
  const keys = c.series.map((_s, i) => `s${i}`);

  // rows for the chart and the table view; ranked bars read largest first
  const rows = useMemo(() => {
    const r = c.categories.map((cat, i) => {
      const o: Record<string, string | number> = { category: cat };
      c.series.forEach((s, j) => { o[keys[j]] = s.values[i]; });
      return o;
    });
    if (horizontal && !multi) r.sort((a, b) => Number(b.s0) - Number(a.s0));
    return r;
  }, [c]); // eslint-disable-line react-hooks/exhaustive-deps

  const tableRows = rows.map((r) => Object.fromEntries([['category', r.category], ...c.series.map((s, j) => [s.name, r[keys[j]]])]));
  const columns = [{ key: 'category', label: c.categories.length && /^(FY)?\d{4}/.test(c.categories[0]) ? 'Year' : 'Category' }, ...c.series.map((s) => ({ key: s.name, label: s.name, num: true, format: (v: unknown) => fmtFull(Number(v), c.unit) }))];

  const allVals = c.series.flatMap((s) => s.values);
  const hasNeg = allVals.some((v) => v < 0);
  const fewBars = c.categories.length <= (horizontal ? 10 : 7);
  const height = horizontal ? Math.max(180, rows.length * 36 + 40) : 260;
  const toggle = (name: string) => setHidden((h) => { const n = new Set(h); if (n.has(name)) n.delete(name); else if (n.size < c.series.length - 1) n.add(name); return n; });
  const colorFor = (j: number) => colors[j % 6];

  const tooltip = (
    <Tooltip
      cursor={c.type === 'line' ? { stroke: p.line, strokeWidth: 1 } : { fill: 'rgba(19,48,78,.06)' }}
      content={({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        return <div className="chart-tip">
          <div className="chart-tip-title">{String(label)}</div>
          {payload.map((pl) => { const j = keys.indexOf(String(pl.dataKey)); return <div key={String(pl.dataKey)} className="chart-tip-row">
            {multi && <span className="chart-swatch" style={{ background: colorFor(j) }} />}
            <strong>{fmtFull(Number(pl.value), c.unit)}</strong>{multi && <span className="muted"> {c.series[j]?.name}</span>}
          </div>; })}
        </div>;
      }} />
  );

  const axisTick = { fontSize: 11.5, fill: p.muted };
  const valueAxis = { tick: axisTick, tickFormatter: (v: number) => fmtShort(v, c.unit), axisLine: false, tickLine: false, width: 56 } as const;
  const catAxis = { tick: { ...axisTick, fontSize: c.categories.length > 5 ? 10.5 : 11.5 }, axisLine: { stroke: p.line }, tickLine: false, interval: (c.categories.length <= 7 ? 0 : 'preserveStartEnd') as 0 | 'preserveStartEnd', minTickGap: 2 };
  const cellFill = (cat: string, j: number) => (!multi && c.highlight ? (cat === c.highlight ? HIGHLIGHT : MUTED_BAR) : colorFor(j));

  let chart: ReactNode;
  if (c.type === 'line') {
    chart = <LineChart data={rows} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
      <CartesianGrid stroke={p.line} vertical={false} />
      <XAxis dataKey="category" {...catAxis} />
      <YAxis {...valueAxis} />
      {hasNeg && <ReferenceLine y={0} stroke={p.muted} />}
      {tooltip}
      {c.series.map((s, j) => hidden.has(s.name) ? null : <Line key={keys[j]} type="monotone" dataKey={keys[j]} stroke={colorFor(j)} strokeWidth={2.5} isAnimationActive={false}
        dot={(d: { cx?: number; cy?: number; index?: number; payload?: Record<string, unknown> }) => { const hl = c.highlight && d.payload?.category === c.highlight; return <circle key={d.index} cx={d.cx} cy={d.cy} r={hl ? 6 : 4} fill={hl ? HIGHLIGHT : colorFor(j)} stroke="#fff" strokeWidth={2} />; }}
        activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }} />)}
    </LineChart>;
  } else if (horizontal) {
    chart = <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 64, left: 4, bottom: 0 }} barCategoryGap="22%">
      <CartesianGrid stroke={p.line} horizontal={false} />
      <XAxis type="number" {...valueAxis} width={undefined} />
      <YAxis type="category" dataKey="category" tick={{ fontSize: 12, fill: p.ink }} axisLine={false} tickLine={false} width={118} interval={0} />
      {tooltip}
      {c.series.map((s, j) => hidden.has(s.name) ? null : <Bar key={keys[j]} dataKey={keys[j]} fill={colorFor(j)} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
        {!multi && rows.map((r) => <Cell key={String(r.category)} fill={cellFill(String(r.category), j)} />)}
        {!multi && fewBars && <LabelList dataKey={keys[j]} position="right" formatter={(v: number) => fmtShort(v, c.unit)} style={{ fontSize: 11.5, fill: p.ink, fontWeight: 600 }} />}
      </Bar>)}
    </BarChart>;
  } else {
    chart = <BarChart data={rows} margin={{ top: 20, right: 8, left: 0, bottom: 0 }} barCategoryGap={multi ? '18%' : '28%'} barGap={2}>
      <CartesianGrid stroke={p.line} vertical={false} />
      <XAxis dataKey="category" {...catAxis} />
      <YAxis {...valueAxis} />
      {hasNeg && <ReferenceLine y={0} stroke={p.muted} />}
      {tooltip}
      {c.series.map((s, j) => hidden.has(s.name) ? null : <Bar key={keys[j]} dataKey={keys[j]} stackId={stacked ? 'a' : undefined} fill={colorFor(j)} radius={stacked && j < c.series.length - 1 ? 0 : [4, 4, 0, 0]} maxBarSize={multi ? 22 : 34} isAnimationActive={false} stroke={stacked ? '#fff' : undefined} strokeWidth={stacked ? 1 : 0}>
        {!multi && rows.map((r) => <Cell key={String(r.category)} fill={cellFill(String(r.category), j)} />)}
        {!multi && fewBars && <LabelList dataKey={keys[j]} position="top" formatter={(v: number) => fmtShort(v, c.unit)} style={{ fontSize: 11, fill: p.ink, fontWeight: 600 }} />}
      </Bar>)}
    </BarChart>;
  }

  return <ChartFrame
    title={<>{c.title}{c.sources.length > 0 && <sup className="cite">{c.sources.map((n) => <span key={n}>{cite(n)}</span>)}</sup>}</>}
    intro={c.subtitle || undefined}
    rows={tableRows} columns={columns} filename={`ask-chart-${idx + 1}`}
    footer={multi ? <div className="chart-legend" role="group" aria-label="Show or hide series">{c.series.map((s, j) => <button key={s.name} type="button" className={`legend-key ${hidden.has(s.name) ? 'off' : ''}`} aria-pressed={!hidden.has(s.name)} onClick={() => toggle(s.name)}><span className="chart-swatch" style={{ background: colorFor(j) }} />{s.name}</button>)}<span className="tiny muted">Tap a name to hide or show it</span></div>
      : c.highlight ? <p className="tiny muted" style={{ margin: '6px 0 0' }}><span className="chart-swatch" style={{ background: HIGHLIGHT }} /> {c.highlight} highlighted</p> : null}>
    <div style={{ width: '100%', height }} role="img" aria-label={`${c.title}. ${c.series.map((s) => `${s.name}: ${c.categories.map((cat, i) => `${cat} ${fmtFull(s.values[i], c.unit)}`).join(', ')}`).join('. ')}`}>
      <ResponsiveContainer>{chart as React.ReactElement}</ResponsiveContainer>
    </div>
  </ChartFrame>;
}
