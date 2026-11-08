import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { backendReady } from '../../lib/supabase';
import { Section, StatusBadge } from '../../components/ui';
import { relTime } from '../../lib/format';
import { CATEGORY_LABEL } from './labels';

export function LiveTicketsStrip() {
  const { data } = useAsync(() => api.tickets({ limit: 4 }), [], []);
  if (!backendReady) return null;
  return (<>
    <Section title="Latest road requests from residents" action={<Link to="/roads" className="small">Map and all requests ›</Link>} />
    {data.length === 0 ? <div className="card small muted">No road requests yet. <Link to="/roads/report">Report the first one</Link>, and the county will get it too.</div> : (
      <div className="grid cols-4">{data.map((t) => <Link key={t.id} to={`/roads/tickets/${t.id}`} className="linkcard" style={{ borderTopColor: 'var(--accent)' }}><div className="row between"><span className="tiny muted">{t.id}</span><StatusBadge status={t.status} /></div><h3 style={{ fontSize: 15, marginTop: 6 }}>{CATEGORY_LABEL[t.category] ?? t.category} · {t.road_name ?? t.location_text}</h3><p>{relTime(t.created_at)}{t.photo_count ? ` · ${t.photo_count} photo${t.photo_count > 1 ? 's' : ''}` : ''}</p></Link>)}</div>
    )}
  </>);
}
