import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import { useMap } from '../../components/MapView';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { callFn, publicPhotoUrl } from '../../lib/supabase';
import { deviceToken, recall } from '../../lib/device';
import { Section, Empty, Crumb, ShareButton, StatusBadge, SourceNote } from '../../components/ui';
import { FlagButton } from '../../components/FlagButton';
import { CATEGORY_LABEL, SEVERITY, MAINTAINER_LABEL, COUNTY } from './labels';
import { members } from '../../lib/data';
import { dateLong, relTime } from '../../lib/format';

export default function TicketPage() {
  const { id = '' } = useParams();
  const { data: t, loading, reload } = useAsync(() => api.ticket(id), [id], null);
  const { data: events, reload: reloadEvents } = useAsync(() => api.ticketEvents(id), [id], []);
  const { data: photos } = useAsync(() => api.ticketPhotos(id), [id], []);
  const mapEl = useRef<HTMLDivElement>(null);
  useMap(mapEl, { center: t ? [t.lng, t.lat] : undefined, zoom: 14, interactive: false, onReady: (m) => { if (t) new maplibregl.Marker({ color: '#FCBA45' }).setLngLat([t.lng, t.lat]).addTo(m); } });
  const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const confirm = async (kind: 'still_issue' | 'fixed') => { setBusy(true); try { await callFn('ticket-action', { action: 'confirm', ticket_id: id, kind, note: note || undefined, device_token: deviceToken() }); setMsg(kind === 'fixed' ? 'Thanks. Two independent "fixed" confirmations (or one from the reporter) mark it fixed.' : 'Thanks. Noted as still an issue.'); setNote(''); reload(); reloadEvents(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); } };
  const secret = recall<Record<string, string>>('secrets', {})[id];
  if (loading) return <p className="muted">Loading…</p>;
  if (!t) return <Empty>No ticket {id}. <Link to="/roads">Back to the map</Link></Empty>;
  const mag = members.find((m) => m.district === t.district_id);
  return (<>
    <Crumb items={[{ to: '/roads', label: 'Roads' }, { label: t.id }]} />
    <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
      <div className="row between"><div><div className="eyebrow">{t.id} · {CATEGORY_LABEL[t.category]} · {SEVERITY.find((s) => s.key === t.severity)?.label}</div><h2>{t.road_name ?? t.location_text}</h2></div><div className="row"><StatusBadge status={t.status} /><ShareButton /></div></div>
      <p style={{ whiteSpace: 'pre-wrap' }}>{t.description}</p>
      <div className="grid cols-2">
        <div ref={mapEl} className="map" style={{ height: 220 }} aria-label="Ticket location" />
        <div className="small">
          <div className="row between" style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}><span className="muted">Where</span><strong>{t.location_text}</strong></div>
          <div className="row between" style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}><span className="muted">Maintained by</span><strong>{MAINTAINER_LABEL[t.maintainer]}</strong></div>
          <div className="row between" style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}><span className="muted">District</span><strong>{t.district_id ? <Link to={`/decisions/members/${mag?.id}`}>District {t.district_id} · {mag?.full_name}</Link> : 'Not determined'}</strong></div>
          <div className="row between" style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}><span className="muted">Reported</span><strong>{dateLong(t.created_at.slice(0, 10))}</strong></div>
          <div className="row between" style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}><span className="muted">Sent to county</span><strong>{t.submitted_to_county_at ? dateLong(t.submitted_to_county_at.slice(0, 10)) + (t.county_reference ? ` · ref ${t.county_reference}` : '') : 'Not yet confirmed by reporter'}</strong></div>
          {t.fixed_at && <div className="row between" style={{ padding: '6px 0' }}><span className="muted">Fixed</span><strong>{dateLong(t.fixed_at.slice(0, 10))}</strong></div>}
          {t.duplicate_of && <div style={{ padding: '6px 0' }}>Duplicate of <Link to={`/roads/tickets/${t.duplicate_of}`}>{t.duplicate_of}</Link></div>}
        </div>
      </div>
      <div className="row" style={{ marginTop: 10 }}><FlagButton table="tickets" id={t.id} label="Report a problem with this ticket" />{secret && <span className="badge ok">You reported this</span>}</div>
    </div>
    <Section title={`Photos (${photos.length})`} />
    {photos.length === 0 ? <div className="card small muted">No approved photos yet. {t.photo_count === 0 && 'Photos submitted with a report appear after review.'}</div> : <div className="photo-grid">{photos.map((p) => <a key={p.id} href={publicPhotoUrl(p.public_path)} target="_blank" rel="noopener noreferrer"><img src={publicPhotoUrl(p.public_path)} alt={p.caption ?? 'Resident-submitted photo'} loading="lazy" /><div className="tiny muted">{p.taken_at ? dateLong(p.taken_at.slice(0, 10)) : relTime(p.created_at)} · resident-submitted</div></a>)}</div>}
    <Section title="Timeline" />
    <ul className="timeline">{events.map((e) => <li key={e.id}><div className="small muted">{relTime(e.created_at)} · {e.actor === 'county' ? 'County' : e.actor === 'admin' ? 'Hub team' : e.actor === 'reporter' ? 'Reporter' : e.actor === 'resident' ? 'A resident' : 'System'}</div><div>{label(e.kind, e.to_status)}{e.note && <span className="small"> · {e.note}</span>}</div></li>)}</ul>
    <Section title="Is this still a problem?" />
    <div className="card">
      <p className="small">Anyone can confirm. Two independent "looks fixed" confirmations, or one from the original reporter, mark the ticket fixed.</p>
      <label className="field"><span>Note <span className="hint">optional</span></span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></label>
      <div className="row"><button className="btn" disabled={busy} onClick={() => confirm('still_issue')}>Still an issue</button><button className="btn primary" disabled={busy} onClick={() => confirm('fixed')}>Looks fixed</button>{msg && <span className="small">{msg}</span>}</div>
    </div>
    <SourceNote>Resident-submitted. Reporter contact details are stored privately and never published. Road Department: {COUNTY.road_dept_phone}, {COUNTY.hours}.</SourceNote>
  </>);
}
const label = (kind: string, to: string | null) => ({ created: 'Reported through the hub', status_change: `Status changed to ${to?.replace(/_/g, ' ')}`, confirmation_still_issue: 'Confirmed still an issue', confirmation_fixed: 'Reported as fixed', note: 'Note added', merged: 'Merged as a duplicate', county_update: 'Update from the county', submitted: 'Reporter submitted it to the county form', edited: 'Reporter edited the description' } as Record<string, string>)[kind] ?? kind;
