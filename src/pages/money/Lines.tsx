import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fy2027, motions, memberById } from '../../lib/data';
import { usd, dateShort } from '../../lib/format';
import { Section, SourceNote, Pager, Crumb, ShareButton, Empty } from '../../components/ui';
import { ExplainButton } from '../../components/Explain';
import { FlagButton } from '../../components/FlagButton';
import { downloadCsv } from '../../lib/csv';
import { Download } from 'lucide-react';

const FUNDS = ['All', ...Array.from(new Set(fy2027.lines.map((l) => l.fund)))];

export default function Lines() {
  const [q, setQ] = useState(''); const [fund, setFund] = useState('All'); const [kind, setKind] = useState<'all' | 'revenue' | 'appropriation'>('all'); const [page, setPage] = useState(1);
  const rows = useMemo(() => fy2027.lines.filter((l) => (fund === 'All' || l.fund === fund) && (kind === 'all' || l.kind === kind) && (!q || `${l.name} ${l.account} ${l.fund}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => b.amount - a.amount), [q, fund, kind]);
  const total = rows.reduce((s, l) => s + l.amount, 0); const PER = 40; const pages = Math.ceil(rows.length / PER); const view = rows.slice((page - 1) * PER, page * PER);
  return (
    <>
      <p className="lede">Every one of the {fy2027.lines.length} accounts in the FY2026-27 adopted budget, across all funds. Search by name (try "salary", "bridge", "insurance"), or filter by fund and by spending vs. revenue.</p>
      <div className="card">
        <input className="input" placeholder="Search budget lines…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search budget lines" />
        <div className="row" style={{ marginTop: 10 }}>{FUNDS.map((f) => <button key={f} className={`chip ${fund === f ? 'active' : ''}`} onClick={() => { setFund(f); setPage(1); }}>{f}</button>)}</div>
        <div className="row" style={{ marginTop: 8 }}>{(['all', 'appropriation', 'revenue'] as const).map((k) => <button key={k} className={`chip ${kind === k ? 'active' : ''}`} onClick={() => { setKind(k); setPage(1); }}>{k === 'all' ? 'Spending and revenue' : k === 'appropriation' ? 'Spending' : 'Revenue'}</button>)}
          <span style={{ marginLeft: 'auto' }} className="small muted">{rows.length} lines · {usd(total)}</span>
          <button className="btn small" onClick={() => downloadCsv('budget-lines-fy2027.csv', rows)}><Download size={14} /> CSV</button></div>
      </div>
      {rows.length === 0 ? <Empty>No budget lines match. Try a broader search.</Empty> : (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="data"><thead><tr><th>Account</th><th>Line</th><th>Fund</th><th>Type</th><th className="num">FY2026-27</th></tr></thead>
            <tbody>{view.map((l) => <tr key={l.fund + l.account}><td className="small muted">{l.account}</td><td><Link to={`/money/lines/${encodeURIComponent(l.account)}?fund=${encodeURIComponent(l.fund)}`}>{l.name}</Link><ExplainButton title={l.name} amounts={[{ label: 'FY2026-27 budget', value: usd(l.amount) }]} source={fy2027.source} /></td><td className="small">{l.fund}</td><td><span className={`badge ${l.kind === 'revenue' ? 'ok' : ''}`}>{l.kind === 'revenue' ? 'Revenue' : 'Spending'}</span></td><td className="num">{usd(l.amount)}</td></tr>)}</tbody></table>
        </div>
      )}
      <Pager page={page} pages={pages} onChange={setPage} />
      <SourceNote>{fy2027.source}</SourceNote>
    </>
  );
}

export function LinePage() {
  const { account = '' } = useParams(); const fund = new URLSearchParams(window.location.search).get('fund');
  const matches = fy2027.lines.filter((l) => l.account === decodeURIComponent(account) && (!fund || l.fund === fund));
  const line = matches[0];
  if (!line) return <Empty>No budget line with account {account}. <Link to="/money/lines">Back to all lines</Link></Empty>;
  const words = line.name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 4);
  const related = motions.filter((m) => !m.is_routine && words.some((w) => m.text.toLowerCase().includes(w))).slice(0, 8);
  const fundTotal = fy2027.lines.filter((l) => l.fund === line.fund && l.kind === line.kind).reduce((s, l) => s + l.amount, 0);
  return (
    <>
      <Crumb items={[{ to: '/money', label: 'Money' }, { to: '/money/lines', label: 'Line items' }, { label: line.account }]} />
      <div className="card">
        <div className="row between"><div><div className="eyebrow">{line.fund} · account {line.account}</div><h2>{line.name}</h2></div><ShareButton /></div>
        <div className="grid cols-3">
          <div className="stat"><div className="label">FY2026-27 {line.kind === 'revenue' ? 'planned revenue' : 'appropriation'}</div><div className="value">{usd(line.amount)}</div></div>
          <div className="stat"><div className="label">Share of {line.fund} {line.kind === 'revenue' ? 'revenue' : 'spending'}</div><div className="value">{((line.amount / fundTotal) * 100).toFixed(1)}%</div></div>
          <div className="stat"><div className="label">Per resident</div><div className="value">{usd(line.amount / 37103, { cents: true })}</div></div>
        </div>
        <p className="small" style={{ marginTop: 12 }}><ExplainButton title={line.name} label="Plain-English explanation" /> Tap for a plain-English note on this line, when one exists.</p>
        <SourceNote>{fy2027.source}</SourceNote>
        <FlagButton table="budget_lines" id={`${line.fund}:${line.account}`} />
      </div>
      <Section title="Fiscal Court motions that mention this" />
      {related.length === 0 ? <Empty>No motions in the tracked minutes mention this line by name.</Empty> : (
        <div className="card"><ul className="list-reset">{related.map((m) => <li key={m.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}><Link to={`/decisions/motions/${m.id}`}>{m.text}</Link><div className="small muted">{dateShort(m.date)} · moved by {m.mover ? memberById[m.mover].full_name : 'unknown'} · {m.result_label}</div></li>)}</ul></div>
      )}
    </>
  );
}
