import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { service, hub, json, fail, preflight, requireAdmin, audit, str, sha256 } from './common.ts';

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return fail('method', 'POST only', 405);
  const sb = service(); const admin = await requireAdmin(req, sb); if (!admin) return fail('forbidden', 'Editors only', 403);
  let b: Record<string, unknown>; try { b = await req.json(); } catch { return fail('bad_json', 'Body must be JSON'); }
  const action = str(b.action, 40); const who = admin.email;

  if (action === 'approve_photo' || action === 'reject_photo') {
    const id = str(b.photo_id, 60); const { data: p } = await hub(sb).from('ticket_photos').select('*').eq('id', id).maybeSingle(); if (!p) return fail('not_found', 'No photo', 404);
    if (action === 'approve_photo') {
      const { data: file, error } = await sb.storage.from('ticket-photos-private').download(p.private_path); if (error || !file) return fail('storage', error?.message ?? 'download failed', 500);
      const { error: up } = await sb.storage.from('ticket-photos').upload(p.private_path, file, { contentType: file.type || 'image/jpeg', upsert: true, cacheControl: '31536000' }); if (up) return fail('storage', up.message, 500);
      await hub(sb).from('ticket_photos').update({ status: 'approved', public_path: p.private_path, moderated_at: new Date().toISOString() }).eq('id', id);
      await sb.storage.from('ticket-photos-private').remove([p.private_path]);
    } else {
      await sb.storage.from('ticket-photos-private').remove([p.private_path]);
      await hub(sb).from('ticket_photos').update({ status: 'rejected', reject_reason: str(b.reason, 200) || null, moderated_at: new Date().toISOString() }).eq('id', id);
    }
    await audit(sb, who, action, id, { status: p.status }, { reason: str(b.reason, 200) }); return json({ ok: true });
  }
  if (action === 'ticket_status') {
    const id = str(b.ticket_id, 40); const to = str(b.to_status, 40); const note = str(b.note, 500) || null;
    const { error } = await hub(sb).rpc('set_ticket_status', { p_ticket: id, p_status: to, p_actor: admin.role === 'county' ? 'county' : 'admin', p_note: note }); if (error) return fail('db', error.message, 500);
    if (to === 'closed_duplicate' && str(b.duplicate_of, 40)) await hub(sb).from('tickets').update({ duplicate_of: str(b.duplicate_of, 40) }).eq('id', id);
    await audit(sb, who, action, id, null, { to, note }); return json({ ok: true });
  }
  if (action === 'idea_update') {
    const id = Number(b.idea_id); const patch: Record<string, unknown> = {};
    if (typeof b.status === 'string') patch.status = b.status; if (typeof b.status_note === 'string') patch.status_note = str(b.status_note, 1000) || null; if (typeof b.published === 'boolean') patch.published = b.published;
    const { error } = await hub(sb).from('ideas').update(patch).eq('id', id); if (error) return fail('db', error.message, 500);
    if (typeof b.status === 'string') await hub(sb).from('idea_comments').insert({ idea_id: id, actor: 'admin', body: `Status set to ${String(b.status).replace('_', ' ')}${patch.status_note ? `: ${patch.status_note}` : ''}`, published: true });
    await audit(sb, who, action, String(id), null, patch); return json({ ok: true });
  }
  if (action === 'resolve_flag') {
    const id = Number(b.flag_id); const status = str(b.status, 40); if (!['confirmed_corrected', 'rejected'].includes(status)) return fail('validation', 'Bad status');
    const { error } = await hub(sb).from('data_flags').update({ status, resolution: str(b.resolution, 2000) || null, resolved_at: new Date().toISOString() }).eq('id', id); if (error) return fail('db', error.message, 500);
    await audit(sb, who, action, String(id), null, { status }); return json({ ok: true });
  }
  if (action === 'commitment_create') {
    const row = { member_id: str(b.member_id, 40), origin: str(b.origin, 20), election_id: str(b.election_id, 40) || null, meeting_id: str(b.meeting_id, 60) || null, made_on: str(b.made_on, 10), quote: str(b.quote, 4000), summary: str(b.summary, 300), category: Array.isArray(b.category) ? b.category : null, scoreable: b.scoreable === true, wording_type: str(b.wording_type, 10) || 'outcome', measure: str(b.measure, 1000) || null, deadline: str(b.deadline, 10) || null, within_authority: b.within_authority !== false, authority_note: str(b.authority_note, 1000) || null, published: b.published === true };
    const { data, error } = await hub(sb).from('commitments').insert(row).select('id').single(); if (error) return fail('db', error.message, 500);
    if (str(b.source_url) || str(b.source_kind)) await hub(sb).from('commitment_sources').insert({ commitment_id: data.id, kind: str(b.source_kind, 40) || 'other', url: str(b.source_url, 2000) || null, archive_url: str(b.archive_url, 2000) || null, media_timestamp: str(b.media_timestamp, 20) || null });
    await audit(sb, who, action, String(data.id), null, row); return json({ id: data.id });
  }
  if (action === 'commitment_publish') {
    const id = Number(b.commitment_id); const { error } = await hub(sb).from('commitments').update({ published: b.published === true }).eq('id', id); if (error) return fail('db', error.message, 500);
    await audit(sb, who, action, String(id), null, { published: b.published }); return json({ ok: true });
  }
  if (action === 'rating_propose') {
    const id = Number(b.commitment_id); const rating = str(b.rating, 20); const reason = str(b.reason, 2000); if (!reason) return fail('validation', 'A public reason is required');
    const { data: c } = await hub(sb).from('commitments').select('scoreable, measure').eq('id', id).maybeSingle(); if (!c) return fail('not_found', 'No commitment', 404);
    if (!c.scoreable || !c.measure) return fail('validation', 'Only scoreable commitments with a written measure can be rated');
    const immediate = ['not_rated', 'in_the_works', 'stalled'].includes(rating);
    const { data, error } = await hub(sb).from('commitment_ratings').insert({ commitment_id: id, rating, reason, proposed_by: await uuidFor(who), state: immediate ? 'final' : 'proposed', effective_at: immediate ? new Date().toISOString() : new Date(Date.now() + 7 * 86400e3).toISOString() }).select('id').single(); if (error) return fail('db', error.message, 500);
    await audit(sb, who, action, String(data.id), null, { commitment_id: id, rating, reason }); return json({ id: data.id, state: immediate ? 'final' : 'proposed' });
  }
  if (action === 'rating_second') {
    const id = Number(b.rating_id); const me = await uuidFor(who);
    const { data: r } = await hub(sb).from('commitment_ratings').select('proposed_by').eq('id', id).maybeSingle(); if (!r) return fail('not_found', 'No rating', 404);
    if (r.proposed_by === me) return fail('validation', 'A different editor must second-review');
    const { error } = await hub(sb).from('commitment_ratings').update({ second_reviewer: me }).eq('id', id); if (error) return fail('db', error.message, 500);
    await audit(sb, who, action, String(id)); return json({ ok: true });
  }
  if (action === 'invite_response') {
    const memberId = str(b.member_id, 40); const sentTo = str(b.sent_to, 200); const token = crypto.randomUUID().replace(/-/g, '');
    await hub(sb).from('response_invites').insert({ token_hash: await sha256(token), member_id: memberId, sent_to: sentTo, expires_at: new Date(Date.now() + 90 * 86400e3).toISOString() });
    await audit(sb, who, action, memberId, null, { sent_to: sentTo }); return json({ invite_token: token, note: 'Send this link privately to the official; it is valid 90 days.' });
  }
  if (action === 'publish') {
    const token = Deno.env.get('GITHUB_DISPATCH_TOKEN'); const repo = Deno.env.get('GITHUB_REPO');
    if (!token || !repo) return fail('config', 'GITHUB_DISPATCH_TOKEN and GITHUB_REPO are not configured');
    const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/deploy.yml/dispatches`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'calloway-hub' }, body: JSON.stringify({ ref: 'main' }) });
    if (!r.ok) return fail('github', `GitHub returned ${r.status}`, 502);
    await hub(sb).from('publishes').insert({ triggered_by: who, datasets: ['site'] }); await audit(sb, who, action, repo); return json({ ok: true });
  }
  return fail('action', 'Unknown action');
});

// stable pseudo-uuid per editor email so "second reviewer must differ" works without auth.users lookups
async function uuidFor(email: string) { const h = await sha256('editor:' + email.toLowerCase()); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; }
