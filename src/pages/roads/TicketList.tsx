import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Empty, StatusBadge } from '../../components/ui';
import { CATEGORY_LABEL, SEVERITY } from './labels';
import { dateShort } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';

export default function TicketList() {
  const { data, loading } = useAsync(() => api.tickets({ limit: 1000 }), [], []);
  const [status, setStatus] = useState('all'); const [cat, setCat] = useState('all'); const [district, setDistrict] = useState('all'); const [q, setQ] = useState('');
  const rows = useMemo(() => data.filter((t) => (status === 'all' || (status === 'open' ? ['reported', 'submitted_to_county', 'acknowledged', 'in_progress'].includes(t.status) : t.status === status)) && (cat === 'all' || t.category === cat) && (district === 'all' || String(t.district_id) === district) && (!q || `${t.id} ${t.road_name} ${t.location_text} ${t.description}`.toLowerCase().includes(q.toLowerCase()))), [data, status, cat, district, q]);
  return (<>
    <div className="card">
      <input className="input" placeholder="Search by road, ticket id, or words in the description…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tickets" />
      <div className="row" style={{ marginTop: 8 }}>{[['all', 'All'], ['open', 'Open'], ['fixed', 'Fixed'], ['closed_not_county', 'Not county']].map(([k, l]) => <button key={k} className={`chip ${status === k ? 'active' : ''}`} onClick={() => setStatus(k)}>{l}</button>)}</div>
      <div className="row" style={{ marginTop: 8 }}><button className={`chip ${cat === 'all' ? 'active' : ''}`} onClick={() => setCat('all')}>All types</button>{Object.entries(CATEGORY_LABEL).map(([k, l]) => <button key={k} className={`chip ${cat === k ? 'active' : ''}`} onClick={() => setCat(k)}>{l}</button>)}</div>
      <div className="row between" style={{ marginTop: 8 }}><div className="row"><span className="small muted">District:</span>{['all', '1', '2', '3', '4'].map((d) => <button key={d} className={`chip ${district === d ? 'active' : ''}`} onClick={() => setDistrict(d)}>{d === 'all' ? 'All' : d}</button>)}</div><button className="btn small" onClick={() => downloadCsv('road-tickets.csv', rows)}><Download size={14} /> CSV</button></div>
    </div>
    {loading ? <p className="muted">Loading…</p> : rows.length === 0 ? <Empty>No requests match.</Empty> : (
      <div className="table-wrap" style={{ marginTop: 12 }}><table className="data"><thead><tr><th>Ticket</th><th>Type</th><th>Where</th><th>Severity</th><th>District</th><th>Status</th><th>Reported</th><th>Photos</th></tr></thead>
        <tbody>{rows.map((t) => <tr key={t.id}><td><Link to={`/roads/tickets/${t.id}`}>{t.id}</Link></td><td>{CATEGORY_LABEL[t.category]}</td><td>{t.road_name ?? ''} <span className="small muted">{t.location_text}</span></td><td>{SEVERITY.find((s) => s.key === t.severity)?.label}</td><td>{t.district_id ?? '—'}</td><td><StatusBadge status={t.status} /></td><td className="small">{dateShort(t.created_at.slice(0, 10))}</td><td className="num">{t.photo_count}</td></tr>)}</tbody></table></div>
    )}
  </>);
}
