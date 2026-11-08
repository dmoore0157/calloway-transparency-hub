import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import exifr from 'exifr';
import { Camera, Copy, Check, ExternalLink, MapPin, Phone } from 'lucide-react';
import { useMap, COUNTY_CENTER } from '../../components/MapView';
import { backendReady, callFn } from '../../lib/supabase';
import { deviceToken, recall, remember } from '../../lib/device';
import { api, type Ticket } from '../../lib/api';
import { CATEGORY_LABEL, SEVERITY, MAINTAINER_LABEL, COUNTY } from './labels';
import { members } from '../../lib/data';
import { Empty } from '../../components/ui';

type Photo = { id?: string; file: File; url: string; uploading: boolean; error?: string };
type Handoff = { form_url: string; fields: { label: string; value: string }[]; clipboard_text: string; mailto: string };
type Result = { id: string; reporter_secret: string; status: string; maintainer: string; district: { id: number | null; magistrate: string | null }; handoff: Handoff; possible_duplicates: Ticket[] };

export default function Report() {
  const [step, setStep] = useState(0);
  const [pos, setPos] = useState<[number, number] | null>(null); const [locText, setLocText] = useState(''); const [roadName, setRoadName] = useState(''); const [maintainer, setMaintainer] = useState('unknown');
  const [category, setCategory] = useState('pothole'); const [severity, setSeverity] = useState('routine'); const [description, setDescription] = useState(''); const [photos, setPhotos] = useState<Photo[]>([]);
  const [contact, setContact] = useState(() => recall('contact', { first_name: '', last_name: '', phone: '', email: '', home_address: '', email_opt_in: true }));
  const [district, setDistrict] = useState<string>('');
  const [nearby, setNearby] = useState<Ticket[]>([]); const [confirmNotDup, setConfirmNotDup] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [result, setResult] = useState<Result | null>(null);
  const mapEl = useRef<HTMLDivElement>(null); const marker = useRef<maplibregl.Marker | null>(null);
  const map = useMap(mapEl, { zoom: 10.5, onReady: (m) => {
    m.on('click', (e) => place([e.lngLat.lng, e.lngLat.lat]));
    m.on('geolocate', (e) => { const c = (e as unknown as { coords: GeolocationCoordinates }).coords; place([c.longitude, c.latitude]); });
  } });
  const place = (ll: [number, number]) => {
    setPos(ll);
    const m = map.current; if (!m) return;
    if (!marker.current) marker.current = new maplibregl.Marker({ color: '#FCBA45', draggable: true }).setLngLat(ll).addTo(m); else marker.current.setLngLat(ll);
    marker.current.on('dragend', () => { const p = marker.current!.getLngLat(); setPos([p.lng, p.lat]); });
    if (m.getZoom() < 14) m.easeTo({ center: ll, zoom: 15 });
  };
  useEffect(() => { if (!pos) return; api.nearby(pos[1], pos[0]).then(setNearby); reverseGeocode(pos).then((r) => { if (r) { if (!roadName) setRoadName(r.road); if (r.maintainer !== 'unknown') setMaintainer(r.maintainer); if (!locText) setLocText(r.display); } }); }, [pos]); // eslint-disable-line react-hooks/exhaustive-deps

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files).slice(0, 4 - photos.length)) {
      try { const gps = await exifr.gps(f).catch(() => null); if (gps && !pos && gps.latitude) place([gps.longitude, gps.latitude]); } catch { /* ignore */ }
      const resized = await resize(f); const url = URL.createObjectURL(resized);
      const p: Photo = { file: resized, url, uploading: true };
      setPhotos((ps) => [...ps, p]);
      try { const fd = new FormData(); fd.append('file', resized, 'photo.jpg'); fd.append('device_token', deviceToken()); const r = await callFn<{ photo_id: string }>('upload-photo', fd); setPhotos((ps) => ps.map((x) => (x.url === url ? { ...x, id: r.photo_id, uploading: false } : x))); }
      catch (e) { setPhotos((ps) => ps.map((x) => (x.url === url ? { ...x, uploading: false, error: (e as Error).message } : x))); }
    }
  };
  const submit = async () => {
    if (!pos) return; setBusy(true); setErr('');
    try {
      remember('contact', contact);
      const r = await callFn<Result>('submit-ticket', { device_token: deviceToken(), category, severity, description, location: { lat: pos[1], lng: pos[0] }, location_text: locText, road_name: roadName || undefined, maintainer, district_hint: district ? Number(district) : undefined, contact, photo_ids: photos.filter((p) => p.id).map((p) => p.id), confirm_not_duplicate: confirmNotDup, website: '' });
      setResult(r); setStep(4); window.scrollTo({ top: 0 });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  if (!backendReady) return <Empty>Reporting needs the hub's backend, which is not configured in this build. Use the <a href={COUNTY.form_url}>county's form</a> directly.</Empty>;
  const canNext = [Boolean(pos && locText.trim().length >= 3), description.trim().length >= 10 && !photos.some((p) => p.uploading), Object.values(contact).every((v) => typeof v !== 'string' || v.trim().length > 0), true][step];
  return (<>
    {step < 4 && <>
      <div className="steps">{[0, 1, 2, 3].map((i) => <span key={i} className={i <= step ? 'done' : ''} />)}</div>
      {severity === 'emergency' && <div className="notice bad" style={{ marginBottom: 12 }}><strong>Emergency?</strong> Call <a href="tel:911">911</a> first. For a blocked or flooding county road during work hours call the Road Department at <a href={`tel:${COUNTY.road_dept_phone.replace(/\D/g, '')}`}>{COUNTY.road_dept_phone}</a>; after hours call the Sheriff at <a href={`tel:${COUNTY.sheriff_phone.replace(/\D/g, '')}`}>{COUNTY.sheriff_phone}</a>. Then post it here so neighbors can see it.</div>}
    </>}
    <div style={{ display: step === 0 ? 'block' : 'none' }}>
      <h2>1. Where is the problem?</h2>
      <p className="small muted">Tap the map, use the location button, or add a photo taken at the spot and we'll read its location. Drag the pin to adjust.</p>
      <div ref={mapEl} className="map" role="region" aria-label="Pick the location" />
      <div className="grid cols-2" style={{ marginTop: 10 }}>
        <label className="field"><span>Describe the spot <span className="hint">road name, nearest address, landmark, or mile marker</span></span><input className="input" value={locText} onChange={(e) => setLocText(e.target.value)} placeholder="e.g. Doores Trail, 200 ft east of the culvert" /></label>
        <label className="field"><span>Road name</span><input className="input" value={roadName} onChange={(e) => setRoadName(e.target.value)} placeholder="auto-filled from the map when possible" /></label>
      </div>
      <div className="row"><span className="small muted">Who maintains it?</span>{Object.entries(MAINTAINER_LABEL).map(([k, l]) => <button key={k} type="button" className={`chip ${maintainer === k ? 'active' : ''}`} onClick={() => setMaintainer(k)}>{l}</button>)}</div>
      {maintainer === 'state' && <div className="notice warn" style={{ marginTop: 8 }}>State routes (US and KY highways) are maintained by the Kentucky Transportation Cabinet, {COUNTY.kytc_label}: <a href={`tel:${COUNTY.kytc_phone.replace(/\D/g, '')}`}>{COUNTY.kytc_phone}</a>. You can still post it here so it is on the public record.</div>}
      {maintainer === 'city_murray' && <div className="notice warn" style={{ marginTop: 8 }}>Streets inside Murray city limits are the {COUNTY.murray_label}: <a href={`tel:${COUNTY.murray_phone.replace(/\D/g, '')}`}>{COUNTY.murray_phone}</a>. You can still post it here.</div>}
      {nearby.length > 0 && <div className="notice" style={{ marginTop: 8 }}><strong>Already reported nearby?</strong> {nearby.map((t) => <span key={t.id}><Link to={`/roads/tickets/${t.id}`}>{t.id} ({CATEGORY_LABEL[t.category]})</Link> </span>)}<label className="small" style={{ display: 'block', marginTop: 4 }}><input type="checkbox" checked={confirmNotDup} onChange={(e) => setConfirmNotDup(e.target.checked)} /> This is a different problem</label></div>}
    </div>
    {step === 1 && <>
      <h2>2. What's wrong?</h2>
      <div className="row" style={{ marginBottom: 10 }}>{Object.entries(CATEGORY_LABEL).map(([k, l]) => <button key={k} type="button" className={`chip ${category === k ? 'active' : ''}`} onClick={() => setCategory(k)}>{l}</button>)}</div>
      <div className="grid cols-4" style={{ marginBottom: 10 }}>{SEVERITY.map((s) => <button key={s.key} type="button" className="stat" style={{ textAlign: 'left', cursor: 'pointer', ['--stat-bar' as string]: severity === s.key ? 'var(--amber)' : '#C9D5E3', outline: severity === s.key ? '3px solid var(--amber)' : undefined, outlineOffset: 1 }} onClick={() => setSeverity(s.key)} aria-pressed={severity === s.key}><div className="label">{s.label}</div><div className="small">{s.hint}</div></button>)}</div>
      <label className="field"><span>Describe it <span className="hint">size, how long it's been there, what happens when it rains, anything that helps a crew find and fix it. Please don't include personal information; this is public.</span></span><textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} style={{ minHeight: 120 }} /></label>
      <div className="row between"><span className="small"><Camera size={14} /> Photos ({photos.length}/4) <span className="muted">reviewed before they appear publicly; location data is removed</span></span><label className="btn small">Add photos<input type="file" accept="image/*" multiple capture="environment" style={{ display: 'none' }} onChange={(e) => addPhotos(e.target.files)} disabled={photos.length >= 4} /></label></div>
      {photos.length > 0 && <div className="photo-grid" style={{ marginTop: 8 }}>{photos.map((p) => <div key={p.url} style={{ position: 'relative' }}><img src={p.url} alt="" style={{ opacity: p.uploading ? .5 : 1 }} />{p.error && <span className="badge bad" style={{ position: 'absolute', bottom: 4, left: 4 }}>failed</span>}{p.uploading && <span className="badge" style={{ position: 'absolute', bottom: 4, left: 4 }}>uploading</span>}<button type="button" className="btn small" style={{ position: 'absolute', top: 4, right: 4, padding: '2px 6px' }} onClick={() => setPhotos((ps) => ps.filter((x) => x !== p))} aria-label="Remove photo">×</button></div>)}</div>}
    </>}
    {step === 2 && <>
      <h2>3. Your contact details</h2>
      <div className="notice" style={{ marginBottom: 12 }}>The county requires these on its form. <strong>The hub stores them privately and never shows them publicly.</strong> They are used only to send you your tracking link and to fill the county's form for you.</div>
      <div className="grid cols-2">
        <label className="field"><span>First name</span><input className="input" value={contact.first_name} onChange={(e) => setContact({ ...contact, first_name: e.target.value })} autoComplete="given-name" /></label>
        <label className="field"><span>Last name</span><input className="input" value={contact.last_name} onChange={(e) => setContact({ ...contact, last_name: e.target.value })} autoComplete="family-name" /></label>
        <label className="field"><span>Phone</span><input className="input" type="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} autoComplete="tel" /></label>
        <label className="field"><span>Email</span><input className="input" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} autoComplete="email" /></label>
      </div>
      <label className="field"><span>Your street address, city, state, zip</span><input className="input" value={contact.home_address} onChange={(e) => setContact({ ...contact, home_address: e.target.value })} autoComplete="street-address" /></label>
      <label className="field"><span>Your magistrate district <span className="hint">if you know it; otherwise leave "Not sure"</span></span><select className="input" value={district} onChange={(e) => setDistrict(e.target.value)}><option value="">Not sure</option>{members.filter((m) => m.district).map((m) => <option key={m.id} value={m.district!}>District {m.district} · {m.full_name}</option>)}</select></label>
      <label className="small"><input type="checkbox" checked={contact.email_opt_in} onChange={(e) => setContact({ ...contact, email_opt_in: e.target.checked })} /> Email me my tracking link and status changes</label>
    </>}
    {step === 3 && <>
      <h2>4. Review and post</h2>
      <div className="card"><div className="row between"><strong>{CATEGORY_LABEL[category]}</strong><span className="badge warn">{SEVERITY.find((s) => s.key === severity)?.label}</span></div><p className="small" style={{ margin: '6px 0' }}><MapPin size={13} /> {locText}{roadName && ` · ${roadName}`} · {MAINTAINER_LABEL[maintainer]}</p><p style={{ whiteSpace: 'pre-wrap' }}>{description}</p><p className="small muted" style={{ margin: 0 }}>{photos.filter((p) => p.id).length} photo(s) attached · reported by {contact.first_name} (name not shown publicly)</p></div>
      <p className="small muted" style={{ marginTop: 8 }}>Posting creates a public ticket. Next you'll get the county's form pre-filled so it reaches the Road Department too.</p>
      {err && <p className="small" style={{ color: 'var(--bad)' }}>{err}</p>}
    </>}
    {step < 4 && <div className="row between" style={{ marginTop: 14 }}>{step > 0 ? <button className="btn" onClick={() => setStep(step - 1)}>Back</button> : <span />}{step < 3 ? <button className="btn primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</button> : <button className="btn primary" disabled={busy} onClick={submit}>{busy ? 'Posting…' : 'Post and get the county form'}</button>}</div>}
    {step === 4 && result && <Handoff result={result} />}
  </>);
}

function Handoff({ result }: { result: Result }) {
  const [copied, setCopied] = useState<string | null>(null); const [submitted, setSubmitted] = useState(false); const [ref, setRef] = useState('');
  const copy = async (k: string, text: string) => { try { await navigator.clipboard.writeText(text); setCopied(k); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ } };
  const mark = async () => { try { await callFn('ticket-action', { action: 'submitted', ticket_id: result.id, reporter_secret: result.reporter_secret, county_reference: ref || undefined }); setSubmitted(true); } catch (e) { alert((e as Error).message); } };
  const secrets = recall<Record<string, string>>('secrets', {}); if (!secrets[result.id]) { secrets[result.id] = result.reporter_secret; remember('secrets', secrets); }
  return (<>
    <div className="card ok" style={{ borderLeft: '4px solid var(--ok)' }}><h2>Posted: <Link to={`/roads/tickets/${result.id}`}>{result.id}</Link></h2><p>It's on the public map now. Photos appear after a quick review. Your tracking page: <Link to={`/roads/tickets/${result.id}`}>{window.location.origin}{import.meta.env.BASE_URL}roads/tickets/{result.id}</Link></p>{result.possible_duplicates?.length > 0 && <p className="small">Similar nearby: {result.possible_duplicates.map((d) => <Link key={d.id} to={`/roads/tickets/${d.id}`}>{d.id} </Link>)}</p>}</div>
    <div className="card" style={{ marginTop: 12 }}>
      <h3>Now send it to the county (about 30 seconds)</h3>
      <p className="small">The county's form can't be submitted for you, so here is everything it asks for, in its order. Copy all, open the form, paste field by field, and tick the box when done.</p>
      <div className="row" style={{ marginBottom: 10 }}><button className="btn primary" onClick={() => copy('all', result.handoff.clipboard_text)}>{copied === 'all' ? <Check size={14} /> : <Copy size={14} />} Copy all fields</button><a className="btn brand" href={result.handoff.form_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open the county form</a><a className="btn" href={result.handoff.mailto}>Email it instead</a></div>
      <table className="data"><tbody>{result.handoff.fields.map((f) => <tr key={f.label}><td className="small muted" style={{ width: '38%' }}>{f.label}</td><td>{f.value}</td><td style={{ width: 40 }}><button className="btn small" onClick={() => copy(f.label, f.value)} aria-label={`Copy ${f.label}`}>{copied === f.label ? <Check size={12} /> : <Copy size={12} />}</button></td></tr>)}</tbody></table>
      <div className="notice" style={{ marginTop: 12 }}>{submitted ? <strong>Marked as sent to the county. Thank you.</strong> : <div className="row"><label className="small" style={{ flex: 1 }}>Confirmation number from the county, if any<input className="input" value={ref} onChange={(e) => setRef(e.target.value)} /></label><button className="btn primary" onClick={mark}>I submitted it to the county</button></div>}</div>
      <p className="small muted" style={{ marginTop: 10 }}><Phone size={12} /> Prefer to call? Road Department {COUNTY.road_dept_phone}, {COUNTY.hours}. Mention ticket {result.id}.</p>
    </div>
  </>);
}

async function resize(file: File, max = 1600): Promise<File> {
  const bmp = await createImageBitmap(file).catch(() => null); if (!bmp) return file;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height)); const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.85));
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' }); // canvas re-encode drops EXIF (and GPS) on the device
}

async function reverseGeocode(ll: [number, number]): Promise<{ road: string; display: string; maintainer: string } | null> {
  try {
    const r = await callFn<{ road: string; display: string; maintainer: string }>('geocode', { lat: ll[1], lng: ll[0] });
    return r;
  } catch { return null; }
}
export { COUNTY_CENTER };
