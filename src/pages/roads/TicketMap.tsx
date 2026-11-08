import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { useMap, addTicketLayer, MapLegend } from '../../components/MapView';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { backendReady } from '../../lib/supabase';
import { Empty, StatusBadge } from '../../components/ui';
import { CATEGORY_LABEL } from './labels';
import { relTime } from '../../lib/format';

const OPEN = ['reported', 'submitted_to_county', 'acknowledged', 'in_progress'];
export default function TicketMap() {
  const ref = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<'open' | 'fixed' | 'all'>('open');
  const statuses = filter === 'open' ? OPEN : filter === 'fixed' ? ['fixed'] : undefined;
  const { data: fc } = useAsync(() => api.geojson(statuses), [filter], { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection);
  const { data: tickets } = useAsync(() => api.tickets({ status: statuses, limit: 12 }), [filter], []);
  const map = useMap(ref, { onReady: (m) => addTicketLayer(m, fc, (p, ll) => { new maplibregl.Popup({ offset: 10 }).setLngLat(ll).setHTML(`<strong>${CATEGORY_LABEL[String(p.category)] ?? p.category}</strong><br/>${p.road_name ?? p.location_text}<br/><a href="${import.meta.env.BASE_URL}roads/tickets/${p.id}">${p.id} ›</a>`).addTo(m); }) });
  if (map.current?.isStyleLoaded()) addTicketLayer(map.current, fc);
  const counts = { open: fc.features.length };
  return (<>
    <p className="lede">Every road problem residents have reported through the hub, where it is, and what has happened since. The county's own form doesn't show the public what has been submitted; this does.</p>
    {!backendReady && <Empty>The road ticket system needs the hub's backend, which is not configured in this build.</Empty>}
    <div className="row between" style={{ marginBottom: 8 }}>
      <div className="row">{(['open', 'fixed', 'all'] as const).map((f) => <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f === 'open' ? 'Open' : f === 'fixed' ? 'Fixed' : 'All'}</button>)}<span className="small muted">{counts.open} shown</span></div>
      <Link to="/roads/report" className="btn primary">Report a problem</Link>
    </div>
    <div ref={ref} className="map tall" role="region" aria-label="Map of road requests" />
    <MapLegend />
    <div className="grid cols-3" style={{ marginTop: 16 }}>
      {tickets.length === 0 ? <div className="card small muted">No {filter === 'all' ? '' : filter} requests yet.</div> : tickets.map((t) => <Link key={t.id} to={`/roads/tickets/${t.id}`} className="linkcard" style={{ borderTopColor: 'var(--accent)' }}><div className="row between"><span className="tiny muted">{t.id}</span><StatusBadge status={t.status} /></div><h3 style={{ fontSize: 15, marginTop: 6 }}>{CATEGORY_LABEL[t.category]} · {t.road_name ?? t.location_text}</h3><p>{t.description.slice(0, 100)}{t.description.length > 100 ? '…' : ''}</p><p className="tiny">{relTime(t.created_at)}{t.photo_count ? ` · ${t.photo_count} photo${t.photo_count > 1 ? 's' : ''}` : ''}{t.district_id ? ` · District ${t.district_id}` : ''}</p></Link>)}
    </div>
    <div className="grid cols-3" style={{ marginTop: 16 }}><div className="card"><div className="eyebrow">How it works</div><p className="small" style={{ margin: '6px 0 0' }}>You report it here with a pin and photos. The hub posts it publicly and hands you the county's form, pre-filled.</p></div><div className="card"><div className="eyebrow">Your privacy</div><p className="small" style={{ margin: '6px 0 0' }}>Your name, phone, email and address are stored privately and never shown. Only the problem is public.</p></div><div className="card"><div className="eyebrow">Tracking</div><p className="small" style={{ margin: '6px 0 0' }}>Anyone can confirm "still an issue" or "looks fixed", with a photo. Districts are compared on response time.</p></div></div>
  </>);
}
