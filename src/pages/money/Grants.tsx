import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { grants } from '../../lib/data';
import { Section, SourceNote, Empty } from '../../components/ui';
import { downloadCsv } from '../../lib/csv';
import { Download } from 'lucide-react';

export default function Grants() {
  const cats = ['All', ...Array.from(new Set(grants.map((g) => g.cat)))];
  const [cat, setCat] = useState('All'); const [q, setQ] = useState('');
  const rows = useMemo(() => grants.filter((g) => (cat === 'All' || g.cat === cat) && (!q || `${g.prog} ${g.purpose} ${g.stage} ${g.kind}`.toLowerCase().includes(q.toLowerCase()))), [cat, q]);
  const byCat = useMemo(() => { const c: Record<string, number> = {}; for (const g of grants) c[g.cat] = (c[g.cat] ?? 0) + 1; return c; }, []);
  return (
    <>
      <p className="lede">Outside money the county pursued or won, from the public record of Fiscal Court actions: bridge programs, broadband, FEMA, economic development. Each row links to the meeting where it was decided. Spend-by-grant reconciliation still needs the county's claims register.</p>
      <div className="grid cols-4" style={{ marginBottom: 12 }}>{Object.entries(byCat).map(([c, n]) => <div key={c} className="stat"><div className="label">{c}</div><div className="value">{n}</div><div className="sub">funding items</div></div>)}</div>
      <div className="card">
        <input className="input" placeholder="Search programs, purposes, stages…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search grants" />
        <div className="row" style={{ marginTop: 10 }}>{cats.map((c) => <button key={c} className={`chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</button>)}<button className="btn small" style={{ marginLeft: 'auto' }} onClick={() => downloadCsv('grants.csv', rows)}><Download size={14} /> CSV</button></div>
      </div>
      <Section title={`${rows.length} funding items`} />
      {rows.length === 0 ? <Empty>No funding items match.</Empty> : (
        <div className="table-wrap"><table className="data"><thead><tr><th>Decided</th><th>Program</th><th>Purpose</th><th>Amount</th><th>Local match</th><th>Type</th><th>Stage</th></tr></thead>
          <tbody>{rows.map((g, i) => <tr key={i}><td className="small">{g.meeting_id ? <Link to={`/decisions/meetings/${g.meeting_id}`}>{g.mk}</Link> : g.mk}</td><td>{g.prog}</td><td>{g.purpose}</td><td className="num">{g.amt || '—'}</td><td className="num">{g.match || '—'}</td><td className="small">{g.kind || '—'}</td><td><span className="badge accent">{g.stage}</span></td></tr>)}</tbody></table></div>
      )}
      <SourceNote>Calloway County Fiscal Court minutes, January 2024 to April 2026. Amounts are as stated in the minutes; "up to" means an application ceiling, not an award.</SourceNote>
    </>
  );
}
