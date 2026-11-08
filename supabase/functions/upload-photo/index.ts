import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { service, hub, json, fail, preflight, sha256, ipOf, underLimit } from './common.ts';

const MAX = 5 * 1024 * 1024;
function sniff(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}
/** True if a JPEG carries an APP1 Exif segment (which can hold GPS). The hub's client strips it by re-encoding; API callers must too. */
function jpegHasExif(b: Uint8Array): boolean {
  let i = 2;
  while (i + 4 < b.length && b[i] === 0xff) {
    const marker = b[i + 1]; const len = (b[i + 2] << 8) | b[i + 3];
    if (marker === 0xe1 && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66) return true;
    if (marker === 0xda) break; // start of scan
    i += 2 + len;
  }
  return false;
}
function jpegSize(b: Uint8Array): { w: number; h: number } | null {
  let i = 2;
  while (i + 9 < b.length && b[i] === 0xff) { const m = b[i + 1]; const len = (b[i + 2] << 8) | b[i + 3]; if (m >= 0xc0 && m <= 0xc3) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] }; i += 2 + len; }
  return null;
}

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return fail('method', 'POST only', 405);
  const sb = service(); const ipHash = await sha256(ipOf(req));
  if (!(await underLimit(sb, `photo:ip:${ipHash}`, 30))) return fail('rate_limited', 'Too many uploads today', 429);
  let form: FormData; try { form = await req.formData(); } catch { return fail('bad_form', 'Send multipart/form-data with a "file" field'); }
  const file = form.get('file'); const ticketId = String(form.get('ticket_id') ?? '') || null;
  if (!(file instanceof File)) return fail('validation', 'Missing file');
  if (file.size > MAX) return fail('too_large', 'Photos must be under 5 MB');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes); if (!type) return fail('type', 'Only JPEG, PNG or WebP photos are accepted');
  if (type === 'image/jpeg' && jpegHasExif(bytes)) return fail('exif', 'Photo still contains metadata (EXIF). Please upload through the hub, which removes it.');
  const size = type === 'image/jpeg' ? jpegSize(bytes) : null;
  const id = crypto.randomUUID(); const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'; const path = `${new Date().getUTCFullYear()}/${id}.${ext}`;
  const { error: upErr } = await sb.storage.from('ticket-photos-private').upload(path, bytes, { contentType: type, upsert: false });
  if (upErr) return fail('storage', upErr.message, 500);
  const { error } = await hub(sb).from('ticket_photos').insert({ id, ticket_id: ticketId, status: 'pending', private_path: path, width: size?.w ?? null, height: size?.h ?? null, bytes: bytes.length });
  if (error) return fail('db', error.message, 500);
  if (ticketId) await hub(sb).from('ticket_events').insert({ ticket_id: ticketId, actor: 'resident', kind: 'note', note: 'Photo added (awaiting review)' });
  return json({ photo_id: id, status: 'pending' });
});
