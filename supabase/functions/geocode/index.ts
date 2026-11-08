import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { service, hub, json, fail, preflight, sha256, ipOf, underLimit } from './common.ts';

const UA = Deno.env.get('NOMINATIM_USER_AGENT') ?? 'CallowayCountyTransparencyHub/1.0 (public road-ticket tool)';
const STATE_ROUTE = /\b(US|U\.S\.|KY|State Route|SR|Highway|Hwy)[\s-]?\d+/i;

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  let lat: number, lng: number;
  if (req.method === 'POST') { const b = await req.json().catch(() => ({})); lat = Number(b.lat); lng = Number(b.lng); } else { const u = new URL(req.url); lat = Number(u.searchParams.get('lat')); lng = Number(u.searchParams.get('lng')); }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fail('validation', 'lat and lng required');
  const sb = service();
  if (!(await underLimit(sb, `geo:ip:${await sha256(ipOf(req))}`, 300))) return fail('rate_limited', 'Too many lookups', 429);
  const key = `rev:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const { data: cached } = await hub(sb).from('geocode_cache').select('result').eq('key', key).maybeSingle();
  if (cached) return json(cached.result);
  // Photon (komoot) first: no key, friendly to server-side callers. Nominatim as a fallback.
  let road = '', town = '', county = '', display = '', osm: unknown = null;
  const ph = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1`, { headers: { 'User-Agent': UA } }).catch(() => null);
  if (ph?.ok) {
    const j = await ph.json(); const p = j.features?.[0]?.properties ?? {};
    road = p.street ?? (p.osm_key === 'highway' ? p.name : '') ?? ''; town = p.city ?? p.town ?? p.village ?? p.locality ?? ''; county = p.county ?? ''; display = j.features?.[0] ? [road || p.name, town, p.postcode].filter(Boolean).join(', ') : ''; osm = p.osm_id ?? null;
  }
  if (!road) {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } }).catch(() => null);
    if (r?.ok) { const j = await r.json(); const a = j.address ?? {}; road = a.road ?? a.pedestrian ?? a.footway ?? road; town = a.town ?? a.city ?? a.village ?? a.hamlet ?? town; county = a.county ?? county; display = j.display_name ?? display; osm = j.osm_id ?? osm; }
    else if (!ph?.ok) return fail('upstream', 'Geocoder unavailable', 502);
  }
  let maintainer = 'unknown';
  if (STATE_ROUTE.test(road) || STATE_ROUTE.test(display)) maintainer = 'state';
  else if (/^Murray$/i.test(town) && /Calloway/i.test(county)) maintainer = 'city_murray';
  else if (/Calloway/i.test(county) && road) maintainer = 'county';
  const result = { road, display: display || [road, town].filter(Boolean).join(', '), maintainer, county, town, osm };
  await hub(sb).from('geocode_cache').insert({ key, result }).then(() => {}, () => {});
  return json(result);
});
