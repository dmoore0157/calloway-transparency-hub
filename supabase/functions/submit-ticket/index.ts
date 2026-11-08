import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { service, hub, json, fail, preflight, sha256, ipOf, underLimit, verifyCaptcha, str, sendEmail } from './common.ts';

const CATEGORIES = ['pothole', 'washout', 'drainage', 'downed_tree', 'sign', 'bridge', 'gravel_grading', 'vegetation', 'other'];
const SEVERITIES: Record<string, string> = { emergency: 'Emergency (e.g., downed trees, flooding)', urgent: 'Urgent (e.g., safety hazards)', routine: 'Routine (e.g., potholes, grading requests)', long_term: 'Long-term (e.g., drainage redesign)' };
const MAINTAINERS = ['county', 'state', 'city_murray', 'private', 'unknown'];
const MAGISTRATES: Record<number, string> = { 1: 'District 1 - Ricky Stewart', 2: 'District 2 - Larry Crutcher', 3: 'District 3 - Don Cherry', 4: 'District 4 - Paul Rister' };
const FORM_URL = 'https://callowaycountyky.gov/calloway-county-road-concern/';
const SITE = Deno.env.get('SITE_URL') ?? 'https://dmoore0157.github.io/calloway-transparency-hub';
// Calloway County bounding box with a margin
const inCounty = (lat: number, lng: number) => lat > 36.40 && lat < 36.85 && lng > -88.60 && lng < -87.90;

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return fail('method', 'POST only', 405);
  let b: Record<string, unknown>; try { b = await req.json(); } catch { return fail('bad_json', 'Body must be JSON'); }
  if (str(b.website)) return fail('spam', 'Rejected'); // honeypot
  const sb = service(); const ip = ipOf(req); const ipHash = await sha256(ip); const device = str(b.device_token, 80);
  if (!device) return fail('device', 'Missing device token');
  if (!(await verifyCaptcha(str(b.turnstile_token, 4000), ip))) return fail('captcha', 'Captcha check failed');
  if (!(await underLimit(sb, `ticket:ip:${ipHash}`, 10)) || !(await underLimit(sb, `ticket:dev:${await sha256(device)}`, 3))) return fail('rate_limited', 'Too many reports today from this device or network. Call the Road Department at (270) 753-4846 for anything urgent.', 429);

  const category = str(b.category, 40); const severity = str(b.severity, 20); const description = str(b.description, 2000); const location_text = str(b.location_text, 300); const road_name = str(b.road_name, 120) || null; const maintainer = MAINTAINERS.includes(str(b.maintainer)) ? str(b.maintainer) : 'unknown';
  const loc = (b.location ?? {}) as { lat?: number; lng?: number }; const lat = Number(loc.lat), lng = Number(loc.lng);
  if (!CATEGORIES.includes(category)) return fail('validation', 'Pick a problem type');
  if (!SEVERITIES[severity]) return fail('validation', 'Pick a severity');
  if (description.length < 10) return fail('validation', 'Describe the problem in at least 10 characters');
  if (location_text.length < 3) return fail('validation', 'Describe the location');
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inCounty(lat, lng)) return fail('validation', 'Place the pin inside Calloway County');
  const c = (b.contact ?? {}) as Record<string, unknown>; const contact = { first_name: str(c.first_name, 80), last_name: str(c.last_name, 80), phone: str(c.phone, 40), email: str(c.email, 160), home_address: str(c.home_address, 240), email_opt_in: c.email_opt_in !== false };
  if (!contact.first_name || !contact.last_name || !contact.phone || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email) || !contact.home_address) return fail('validation', 'The county requires name, phone, email and address. They stay private.');
  const districtHint = Number(b.district_hint); const district_id = MAGISTRATES[districtHint] ? districtHint : null;

  // duplicate check
  const { data: near } = await sb.rpc('nearby_tickets', { lat, lng, meters: 75, days: 90 });
  const dups = ((near ?? []) as { id: string; category: string }[]).filter((t) => t.category === category);
  if (dups.length && b.confirm_not_duplicate !== true) return json({ error: { code: 'possible_duplicate', message: 'A similar problem was reported nearby. Confirm it is different, or add to the existing ticket.' }, possible_duplicates: dups }, 409);

  const secret = crypto.randomUUID().replace(/-/g, '');
  const { data: t, error } = await hub(sb).from('tickets').insert({ category, severity, description, location: `SRID=4326;POINT(${lng} ${lat})`, location_text, road_name, maintainer, district_id, reporter_token_hash: await sha256(secret), ip_hash: ipHash }).select('id, status, maintainer, district_id, road_name').single();
  if (error || !t) return fail('db', error?.message ?? 'Could not save', 500);
  await hub(sb).from('ticket_contacts').insert({ ticket_id: t.id, ...contact });
  const { data: ev } = await hub(sb).from('ticket_events').insert({ ticket_id: t.id, actor: 'reporter', kind: 'created' }).select('id').single();
  const photoIds = Array.isArray(b.photo_ids) ? (b.photo_ids as unknown[]).filter((x) => typeof x === 'string').slice(0, 4) : [];
  if (photoIds.length) await hub(sb).from('ticket_photos').update({ ticket_id: t.id, event_id: ev?.id ?? null }).in('id', photoIds).is('ticket_id', null);

  const magistrate = t.district_id ? MAGISTRATES[t.district_id as number] : 'Unknown/Not Sure';
  const fields = [
    { label: 'Resident Information – First', value: contact.first_name }, { label: 'Resident Information – Last', value: contact.last_name },
    { label: 'Your Street Address, City, State, Zip', value: contact.home_address }, { label: 'Phone Number', value: contact.phone }, { label: 'Email', value: contact.email },
    { label: 'Magistrate (if known)', value: magistrate },
    { label: 'Exact location of the issue', value: `${location_text}${road_name ? ` (${road_name})` : ''} — GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}. Public ticket ${t.id} at ${SITE}/roads/tickets/${t.id}` },
    { label: 'Description of the concern', value: description }, { label: 'Severity Level', value: SEVERITIES[severity] },
  ];
  const clipboard_text = fields.map((f) => `${f.label}: ${f.value}`).join('\n');
  const mailto = `mailto:?subject=${encodeURIComponent(`Road concern ${t.id}: ${location_text}`)}&body=${encodeURIComponent(clipboard_text)}`;
  if (contact.email_opt_in) await sendEmail(contact.email, `Your road report ${t.id} is posted`, `Thank you for reporting a road problem through the Calloway County Transparency Hub.\n\nTrack it: ${SITE}/roads/tickets/${t.id}\n\nTo send it to the county, open ${FORM_URL} and paste these fields:\n\n${clipboard_text}\n\nRoad Department: (270) 753-4846, Mon–Fri 7:00–3:30. Emergencies: 911.`);
  return json({ id: t.id, reporter_secret: secret, status: t.status, maintainer: t.maintainer, district: { id: t.district_id, magistrate: t.district_id ? MAGISTRATES[t.district_id as number].split(' - ')[1] : null }, handoff: { form_url: FORM_URL, fields, clipboard_text, mailto }, possible_duplicates: dups });
});
