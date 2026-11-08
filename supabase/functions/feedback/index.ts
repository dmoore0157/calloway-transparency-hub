import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { service, hub, json, fail, preflight, sha256, ipOf, underLimit, verifyCaptcha, str, hasUrl, FLAGGED, sendEmail } from './common.ts';

const CATS = ['data_request', 'feature', 'fix', 'question', 'other'];
const TABLES = ['motions', 'meetings', 'budget_lines', 'tickets', 'commitments', 'commitment_ratings', 'grants', 'enactments', 'other'];

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return fail('method', 'POST only', 405);
  let b: Record<string, unknown>; try { b = await req.json(); } catch { return fail('bad_json', 'Body must be JSON'); }
  if (str(b.website)) return fail('spam', 'Rejected');
  const sb = service(); const ip = ipOf(req); const ipHash = await sha256(ip); const action = str(b.action, 20);
  const device = str(b.device_token, 80); const devHash = device ? await sha256(device) : null;

  if (action === 'idea') {
    if (!devHash) return fail('device', 'Missing device token');
    if (!(await verifyCaptcha(str(b.turnstile_token, 4000), ip))) return fail('captcha', 'Captcha check failed');
    if (!(await underLimit(sb, `idea:dev:${devHash}`, 5)) || !(await underLimit(sb, `idea:ip:${ipHash}`, 15))) return fail('rate_limited', 'Too many ideas today', 429);
    const title = str(b.title, 120), body = str(b.body, 3000), category = CATS.includes(str(b.category)) ? str(b.category) : 'other', email = str(b.email, 160) || null;
    if (title.length < 5 || body.length < 10) return fail('validation', 'Add a title (5+ characters) and details (10+ characters)');
    const published = !hasUrl(title + ' ' + body) && !FLAGGED.test(title + ' ' + body);
    const { data, error } = await hub(sb).from('ideas').insert({ title, body, category, published, submitter_token_hash: devHash, submitter_email: email, ip_hash: ipHash }).select('id').single();
    if (error) return fail('db', error.message, 500);
    await hub(sb).from('idea_votes').insert({ idea_id: data.id, voter_token_hash: devHash }).then(() => {}, () => {});
    return json({ id: data.id, published });
  }
  if (action === 'vote' || action === 'unvote') {
    if (!devHash) return fail('device', 'Missing device token');
    const ideaId = Number(b.idea_id); if (!ideaId) return fail('validation', 'Missing idea');
    if (!(await underLimit(sb, `vote:ip:${ipHash}`, 200))) return fail('rate_limited', 'Too many votes today', 429);
    if (action === 'vote') await hub(sb).from('idea_votes').upsert({ idea_id: ideaId, voter_token_hash: devHash }); else await hub(sb).from('idea_votes').delete().eq('idea_id', ideaId).eq('voter_token_hash', devHash);
    const { data } = await hub(sb).from('ideas').select('vote_count').eq('id', ideaId).maybeSingle();
    return json({ vote_count: data?.vote_count ?? 0 });
  }
  if (action === 'flag') {
    if (!(await underLimit(sb, `flag:ip:${ipHash}`, 20))) return fail('rate_limited', 'Too many reports today', 429);
    const table = str(b.record_table, 40), id = str(b.record_id, 120), message = str(b.message, 2000), email = str(b.email, 160) || null;
    if (!TABLES.includes(table) || !id || message.length < 10) return fail('validation', 'Say what the record gets wrong (10+ characters)');
    const { data, error } = await hub(sb).from('data_flags').insert({ record_table: table, record_id: id, message, reporter_email: email }).select('id').single();
    if (error) return fail('db', error.message, 500);
    const notify = Deno.env.get('ADMIN_EMAIL'); if (notify) await sendEmail(notify, `Hub flag #${data.id}: ${table} ${id}`, message);
    return json({ id: data.id });
  }
  if (action === 'contact') {
    if (!(await underLimit(sb, `contact:ip:${ipHash}`, 5))) return fail('rate_limited', 'Too many messages today', 429);
    const body = str(b.body, 4000); if (body.length < 10) return fail('validation', 'Write at least 10 characters');
    await hub(sb).from('contact_messages').insert({ name: str(b.name, 120) || null, email: str(b.email, 160) || null, body, ip_hash: ipHash });
    const notify = Deno.env.get('ADMIN_EMAIL'); if (notify) await sendEmail(notify, 'Hub contact message', `${str(b.name, 120)} <${str(b.email, 160)}>\n\n${body}`);
    return json({ ok: true });
  }
  if (action === 'response') {
    // an official responding to a commitment via a private invite link
    const token = str(b.invite_token, 120); const commitmentId = Number(b.commitment_id); const body = str(b.body, 2500);
    if (!token || !commitmentId || body.length < 1) return fail('validation', 'Missing fields');
    const { data: inv } = await hub(sb).from('response_invites').select('member_id, expires_at').eq('token_hash', await sha256(token)).maybeSingle();
    if (!inv || new Date(inv.expires_at) < new Date()) return fail('forbidden', 'Invalid or expired link', 403);
    const { data: c } = await hub(sb).from('commitments').select('id').eq('id', commitmentId).eq('member_id', inv.member_id).maybeSingle();
    if (!c) return fail('forbidden', 'This commitment does not belong to you', 403);
    await hub(sb).from('official_responses').insert({ commitment_id: commitmentId, member_id: inv.member_id, body, received_via: 'invite_link' });
    await hub(sb).from('response_invites').update({ used_at: new Date().toISOString() }).eq('token_hash', await sha256(token));
    return json({ ok: true, note: 'Received. Responses are published unedited within 48 hours.' });
  }
  return fail('action', 'Unknown action');
});
