import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { service, hub, json, fail, preflight, sha256, ipOf, underLimit, str } from './common.ts';

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return fail('method', 'POST only', 405);
  let b: Record<string, unknown>; try { b = await req.json(); } catch { return fail('bad_json', 'Body must be JSON'); }
  const sb = service(); const action = str(b.action, 30); const ticketId = str(b.ticket_id, 40); const ipHash = await sha256(ipOf(req));
  if (!ticketId) return fail('validation', 'Missing ticket id');
  const { data: t } = await hub(sb).from('tickets').select('id, status, reporter_token_hash, created_at').eq('id', ticketId).maybeSingle();
  if (!t) return fail('not_found', 'No such ticket', 404);
  const secret = str(b.reporter_secret, 80); const isReporter = Boolean(secret) && (await sha256(secret)) === t.reporter_token_hash;

  if (action === 'confirm') {
    const kind = str(b.kind, 20); if (!['still_issue', 'fixed'].includes(kind)) return fail('validation', 'kind must be still_issue or fixed');
    const device = str(b.device_token, 80); if (!device) return fail('device', 'Missing device token');
    const devHash = await sha256(device);
    if (!(await underLimit(sb, `confirm:${ticketId}:${devHash}`, 1))) return fail('rate_limited', 'One confirmation per ticket per day from each device', 429);
    if (!(await underLimit(sb, `confirm:ip:${ipHash}`, 40))) return fail('rate_limited', 'Too many confirmations today', 429);
    const note = str(b.note, 300) || null;
    await hub(sb).from('ticket_confirmations').insert({ ticket_id: ticketId, device_hash: devHash, kind, is_reporter: isReporter, note });
    await hub(sb).from('ticket_events').insert({ ticket_id: ticketId, actor: isReporter ? 'reporter' : 'resident', kind: kind === 'fixed' ? 'confirmation_fixed' : 'confirmation_still_issue', note, published: !note || note.length < 300 });
    if (kind === 'fixed' && !['fixed', 'closed_not_county', 'closed_duplicate', 'closed_invalid'].includes(t.status)) {
      const { data: fx } = await hub(sb).from('ticket_confirmations').select('device_hash, is_reporter').eq('ticket_id', ticketId).eq('kind', 'fixed');
      const distinct = new Set((fx ?? []).map((x) => x.device_hash)).size; const byReporter = (fx ?? []).some((x) => x.is_reporter);
      if (distinct >= 2 || byReporter) await hub(sb).rpc('set_ticket_status', { p_ticket: ticketId, p_status: 'fixed', p_actor: byReporter ? 'reporter' : 'resident', p_note: byReporter ? 'Reporter confirmed it is fixed' : 'Two residents confirmed it is fixed' }, { head: false }).then(() => {}, () => {});
    }
    if (kind === 'still_issue' && t.status === 'fixed') await hub(sb).from('ticket_events').insert({ ticket_id: ticketId, actor: 'system', kind: 'note', note: 'Reported still an issue after being marked fixed; flagged for review' });
    return json({ ok: true, is_reporter: isReporter });
  }
  if (action === 'submitted') {
    if (!isReporter) return fail('forbidden', 'Only the reporter can mark this', 403);
    const ref = str(b.county_reference, 80) || null;
    await hub(sb).from('tickets').update({ submitted_to_county_at: new Date().toISOString(), county_reference: ref }).eq('id', ticketId);
    if (t.status === 'reported') await hub(sb).rpc('set_ticket_status', { p_ticket: ticketId, p_status: 'submitted_to_county', p_actor: 'reporter', p_note: ref ? `County reference ${ref}` : null });
    await hub(sb).from('ticket_events').insert({ ticket_id: ticketId, actor: 'reporter', kind: 'submitted', note: ref ? `County reference ${ref}` : null });
    return json({ ok: true });
  }
  if (action === 'edit') {
    if (!isReporter) return fail('forbidden', 'Only the reporter can edit', 403);
    if (Date.now() - new Date(t.created_at).getTime() > 86400e3) return fail('too_late', 'Edits are allowed for 24 hours after posting');
    const patch: Record<string, string> = {}; if (str(b.description, 2000).length >= 10) patch.description = str(b.description, 2000); if (str(b.location_text, 300).length >= 3) patch.location_text = str(b.location_text, 300);
    if (!Object.keys(patch).length) return fail('validation', 'Nothing to change');
    await hub(sb).from('tickets').update(patch).eq('id', ticketId);
    await hub(sb).from('ticket_events').insert({ ticket_id: ticketId, actor: 'reporter', kind: 'edited' });
    return json({ ok: true });
  }
  return fail('action', 'Unknown action');
});
