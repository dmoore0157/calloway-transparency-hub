import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { Empty, SourceNote } from '../../components/ui';
import { members } from '../../lib/data';
import { DistrictLookup } from './DistrictLookup';

export default function Districts() {
  const { data, loading } = useAsync(() => api.districtStats(), [], []);
  return (<>
    <p className="lede">Road requests by magistrate district, with how long fixes take based on resident reports. Framed carefully: these are resident-reported outcomes, not county work orders.</p>
    {loading ? <p className="muted">Loading…</p> : data.length === 0 ? <Empty>No district data yet.</Empty> : (
      <div className="grid cols-4">{data.map((d) => { const mag = members.find((m) => m.district === d.district_id); return (
        <div key={d.district_id} className="card"><div className="eyebrow">{d.name}</div><h3 style={{ fontSize: 16 }}>{mag ? <Link to={`/decisions/members/${mag.id}`}>{mag.full_name}</Link> : '—'}</h3>
          <div className="row between small"><span>Open requests</span><strong>{d.open_tickets}</strong></div><div className="row between small"><span>Fixed</span><strong>{d.fixed_tickets}</strong></div><div className="row between small"><span>Median days to fix</span><strong>{d.median_days_to_fix != null ? Math.round(d.median_days_to_fix) : '—'}</strong></div>
          <p className="tiny muted" style={{ margin: '8px 0 0' }}><Link to={`/roads/list`}>See requests ›</Link></p></div>); })}</div>
    )}
    <p className="small muted" style={{ marginTop: 10 }}>District is assigned from the pin location once district boundaries are loaded. Until then, tickets show "—" for district and the reporter's choice of magistrate is used on the county form.</p>
    <DistrictLookup />
    <SourceNote>Hub ticket records. Fix dates come from resident confirmations or county updates, whichever arrives first.</SourceNote>
  </>);
}
