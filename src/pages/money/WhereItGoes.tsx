import { useMemo, useState } from 'react';
import { ResponsiveContainer, Treemap, Tooltip, Sankey } from 'recharts';
import { yearend, fy2027, overview } from '../../lib/data';
import { usd } from '../../lib/format';
import { ChartFrame, Section, SourceNote } from '../../components/ui';
import { ExplainButton } from '../../components/Explain';
import { palette, tooltipStyle } from '../../lib/palette';

export default function WhereItGoes() {
  const p = palette();
  const cats = useMemo(() => { const c: Record<string, { total: number; lines: { n: string; a: number }[] }> = {}; for (const l of yearend.lines) { (c[l.c] ??= { total: 0, lines: [] }).total += l.a; c[l.c].lines.push({ n: l.n, a: l.a }); } return Object.entries(c).map(([name, v]) => ({ name, size: Math.round(v.total), lines: v.lines.sort((a, b) => b.a - a.a) })).sort((a, b) => b.size - a.size); }, []);
  const [sel, setSel] = useState<string | null>(null);
  const [bill, setBill] = useState(1000);
  const selected = cats.find((c) => c.name === sel);
  // largest six categories take the chart series, the rest step through navy-to-slate; names and dollars are always labeled below
  const fills = [...p.series.slice(0, 6), '#13304E', '#304860', '#4D5D73', '#6B7C93', '#8796AA', '#A3B1C2'];
  const colors = Object.fromEntries([...cats].sort((x, y) => y.size - x.size).map((c, i) => [c.name, fills[i % fills.length]])) as Record<string, string>;
  const treeData = cats.map((c) => ({ name: c.name, size: c.size, fill: colors[c.name] ?? p.series[0] }));
  const sankey = useMemo(() => buildSankey(), []);
  return (
    <>
      <p className="lede">The General Fund spent {usd(yearend.total)} in FY2024-25. Boxes are sized by dollars. Tap a category to see its line items, or scroll down to follow a dollar from revenue to spending in the current budget.</p>
      <ChartFrame title="General Fund spending by category, FY2024-25 (actual)" rows={cats.map((c) => ({ category: c.name, spent: c.size, share: ((c.size / yearend.total) * 100).toFixed(1) + '%' }))} columns={[{ key: 'category', label: 'Category' }, { key: 'spent', label: 'Spent', num: true, format: (v) => usd(v as number) }, { key: 'share', label: 'Share', num: true }]} filename="general-fund-by-category-fy2025.csv"
        footer={<SourceNote>{yearend.source} All lines reconcile to {usd(yearend.total, { cents: true })}.</SourceNote>}>
        <ResponsiveContainer width="100%" height={360}>
          <Treemap data={treeData} dataKey="size" nameKey="name" stroke={p.surface} content={<Cell onPick={setSel} />} isAnimationActive={false}>
            <Tooltip {...tooltipStyle()} formatter={(v) => usd(Number(v))} />
          </Treemap>
        </ResponsiveContainer>
        <div className="row" style={{ marginTop: 10 }}>{cats.map((c) => <button key={c.name} className={`chip ${sel === c.name ? 'active' : ''}`} onClick={() => setSel(sel === c.name ? null : c.name)}><span className="vote-dot" style={{ background: colors[c.name] }} />{c.name} <span className="muted">{usd(c.size, { compact: true })}</span></button>)}</div>
      </ChartFrame>
      {selected && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row between"><h3>{selected.name} <ExplainButton title={selected.name} amounts={[{ label: 'FY2024-25 actual', value: usd(selected.size) }, { label: 'Per resident', value: usd(selected.size / overview.population, { cents: true }) }]} source={yearend.source} /></h3><strong>{usd(selected.size)}</strong></div>
          <div className="table-wrap"><table className="data"><thead><tr><th>Line</th><th className="num">Spent</th><th className="num">Share of category</th></tr></thead><tbody>{selected.lines.map((l) => <tr key={l.n}><td>{l.n}</td><td className="num">{usd(l.a, { cents: true })}</td><td className="num">{((l.a / selected.size) * 100).toFixed(1)}%</td></tr>)}</tbody></table></div>
        </div>
      )}

      <Section title="Follow your dollar" />
      <div className="card">
        <p className="small">Enter what you paid the county in property tax and see how a dollar of General Fund spending was split in FY2024-25. This is proportional, not literal: your specific payment isn't tracked to a specific expense, and the Road and Jail funds are paid for mostly by state money, fees and transfers.</p>
        <label className="field" style={{ maxWidth: 240 }}><span>Your county property tax bill</span><input className="input" type="number" min={1} value={bill} onChange={(e) => setBill(Number(e.target.value) || 0)} /></label>
        <div className="grid cols-3">{cats.map((c) => <div key={c.name} className="row between small" style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}><span><span className="vote-dot" style={{ background: colors[c.name] }} />{c.name}</span><strong>{usd((bill * c.size) / yearend.total, { cents: true })}</strong></div>)}</div>
      </div>

      <Section title="How money flows in the FY2026-27 budget" />
      <ChartFrame title="Revenue → fund → spending category" intro="Left: where planned revenue comes from. Middle: which fund it lands in. Right: what it is budgeted to pay for. Transfers between funds are shown as flows from the sending fund; they are internal moves, not new money." rows={sankey.rows} filename="budget-flows-fy2027.csv" footer={<SourceNote>FY2026-27 adopted budget. Flows under $50,000 are grouped as "Other" to keep the picture readable.</SourceNote>}>
        <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 640 }}>
          <ResponsiveContainer width="100%" height={520}>
            <Sankey data={sankey.data} nodePadding={18} nodeWidth={12} margin={{ top: 10, right: 160, bottom: 10, left: 10 }} link={{ stroke: p.accent, strokeOpacity: 0.35 }} node={<SankeyNode />}>
              <Tooltip {...tooltipStyle()} formatter={(v) => usd(Number(v))} />
            </Sankey>
          </ResponsiveContainer>
        </div></div>
      </ChartFrame>
    </>
  );
}

function Cell(props: Record<string, unknown> & { onPick?: (n: string) => void }) {
  const { x, y, width, height, name, fill, onPick } = props as { x: number; y: number; width: number; height: number; name: string; fill: string; onPick?: (n: string) => void };
  if (width == null || !name || !Number.isFinite(x)) return null; // Recharts also renders a nameless root node
  return (
    <g onClick={() => onPick?.(name)} style={{ cursor: 'pointer' }}>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" rx={3} />
      {width > 70 && height > 30 && <text x={x + 6} y={y + 16} fill={labelInk(fill)} fontSize={11} fontWeight={700}>{name.length > width / 6.5 ? name.slice(0, Math.max(3, width / 6.5 - 1)) + '…' : name}</text>}
    </g>
  );
}

function SankeyNode(props: Record<string, unknown>) {
  const { x, y, width, height, payload } = props as { x: number; y: number; width: number; height: number; payload: { name: string; value: number; depth: number } };
  const p = palette();
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={payload.depth === 1 ? p.series[0] : payload.depth === 0 ? p.series[2] : p.series[1]} rx={2} />
      <text x={payload.depth === 2 ? x + width + 6 : x - 6} y={y + height / 2} textAnchor={payload.depth === 2 ? 'start' : 'end'} dominantBaseline="middle" fontSize={11} fill={p.ink}>{payload.name} <tspan fill={p.muted}>{usd(payload.value, { compact: true })}</tspan></text>
    </g>
  );
}

function buildSankey() {
  const nodes: { name: string }[] = []; const idx = new Map<string, number>();
  const id = (n: string) => { if (!idx.has(n)) { idx.set(n, nodes.length); nodes.push({ name: n }); } return idx.get(n)!; };
  const links: { source: number; target: number; value: number }[] = []; const rows: Record<string, unknown>[] = [];
  const MIN = 50000;
  for (const f of fy2027.summary.funds) {
    if (!f.rev.length && !f.app.length) continue;
    const fund = `${f.name}`;
    let otherIn = 0;
    for (const [n, v] of f.rev) { const val = Number(v); if (val <= 0) continue; if (val < MIN) { otherIn += val; continue; } links.push({ source: id(String(n)), target: id(fund), value: val }); rows.push({ from: n, to: fund, amount: val }); }
    if (otherIn) { links.push({ source: id('Other revenue'), target: id(fund), value: otherIn }); rows.push({ from: 'Other revenue', to: fund, amount: otherIn }); }
    let otherOut = 0;
    for (const [n, v] of f.app) { const val = Number(v); if (val <= 0) continue; if (val < MIN) { otherOut += val; continue; } links.push({ source: id(fund), target: id(`${n} `), value: val }); rows.push({ from: fund, to: n, amount: val }); }
    if (otherOut) { links.push({ source: id(fund), target: id('Other spending '), value: otherOut }); rows.push({ from: fund, to: 'Other spending', amount: otherOut }); }
  }
  return { data: { nodes, links }, rows };
}

/** Navy or white label, whichever reads better on the box color. */
function labelInk(hex: string) {
  const n = parseInt(hex.slice(1), 16); const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  const L = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  return (1.05 / (L + 0.05)) >= ((L + 0.05) / (0.0332 + 0.05)) ? '#FFFFFF' : '#13304E';
}
