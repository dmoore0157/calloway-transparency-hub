// "Ask the records" endpoint.
//   POST { action: 'ask', question, mode: 'answer'|'report', history?, device_token, captcha_token? }  -> text/event-stream
//        events: step {text}, done {answer}, error {code, message}
//   POST { action: 'share', id, device_token }         -> { url }
//   POST { action: 'rate', id, helpful, comment?, device_token } -> { ok }
//   GET  ?status                                         -> { ready, corpus }
// Secrets: ANTHROPIC_API_KEY (required for answers). Optional: AI_MODEL, AI_DAILY_LIMIT, CORPUS_URL, SITE_URL, TURNSTILE_SECRET.
import Anthropic from 'npm:@anthropic-ai/sdk@1.6.0';
import { service, hub, cors, json, fail, preflight, sha256, ipOf, underLimit, verifyCaptcha, str, FLAGGED } from './common.ts';
import { Index, type Corpus, type LiveData, type Source } from './core.ts';
import { ask, type ModelClient } from './agent.ts';

const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://dmoore0157.github.io/calloway-transparency-hub';
const CORPUS_URL = Deno.env.get('CORPUS_URL') ?? `${SITE_URL}/data/ai-corpus.json`;
const MODEL = Deno.env.get('AI_MODEL') ?? 'claude-opus-5-5';
const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? 400);

let cached: { index: Index; at: number; etag: string | null } | null = null;
async function loadIndex(): Promise<Index> {
  if (cached && Date.now() - cached.at < 15 * 60_000) return cached.index;
  const r = await fetch(CORPUS_URL, { headers: cached?.etag ? { 'If-None-Match': cached.etag } : {} });
  if (r.status === 304 && cached) { cached.at = Date.now(); return cached.index; }
  if (!r.ok) { if (cached) return cached.index; throw new Error(`corpus fetch failed (${r.status})`); }
  const corpus = (await r.json()) as Corpus;
  cached = { index: new Index(corpus), at: Date.now(), etag: r.headers.get('etag') };
  return cached.index;
}

function liveData(): LiveData {
  const sb = service();
  return {
    async commitments(memberId) {
      let q = sb.from('commitments_public').select('id, member_id, origin, made_on, quote, summary, scoreable, wording_type, measure, deadline, current_rating, proposed_rating').order('made_on', { ascending: false }).limit(40);
      if (memberId) q = q.eq('member_id', memberId);
      const [{ data: cs }, { data: scores }] = await Promise.all([q, sb.from('commitment_scores').select('*')]);
      const records: Source[] = (cs ?? []).map((c) => ({ id: `commitment:${c.id}`, title: `Commitment #${c.id}: ${c.summary}`, type: 'commitment', url: `/leaders/commitments/${c.id}`, source_url: null, source_label: 'Hub promise tracker', date: c.made_on, text: `Commitment #${c.id} by ${c.member_id} (${c.origin === 'campaign' ? 'campaign promise' : 'commitment in office'}), made ${c.made_on}: "${c.quote}" Summary: ${c.summary}. Scoreable: ${c.scoreable ? 'yes' : 'no'}. Current rating: ${c.current_rating ?? 'not rated'}${c.proposed_rating ? ` (proposed: ${c.proposed_rating})` : ''}. Test that decides it: ${c.measure ?? 'not scoreable'}${c.deadline ? `; deadline ${c.deadline}` : ''}.` }));
      const sc = (scores ?? []).filter((s) => !memberId || s.member_id === memberId);
      const scoreText = sc.map((s) => `${s.full_name}: ${s.scoreable_total} scoreable commitments; kept ${s.kept}, compromise ${s.compromise}, broken ${s.broken}, pending ${s.pending}; ${s.ranked ? `promise-keeping score ${Math.round(Number(s.score) * 100)}%` : 'not ranked (needs 5 resolved commitments)'}`).join('. ');
      records.push({ id: `scores:${memberId ?? 'all'}`, title: 'Promise-keeping scores', type: 'commitment', url: '/leaders/promises', source_url: null, source_label: 'Hub promise tracker', date: null, text: scoreText || 'No scores.' });
      return { records, summary: `${records.map((r) => `id: ${r.id}\n${r.text}`).join('\n---\n')}` || 'No commitments logged.' };
    },
    async roadRequests() {
      const [{ data: stats }, { data: rows }] = await Promise.all([sb.schema('hub').from('district_ticket_stats').select('*'), sb.from('tickets_public').select('status')]);
      const by: Record<string, number> = {}; for (const r of rows ?? []) by[r.status] = (by[r.status] ?? 0) + 1;
      const text = `Resident road requests on the hub: ${(rows ?? []).length} in total. By status: ${Object.entries(by).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(', ') || 'none'}. By magistrate district (county-maintained roads): ${(stats ?? []).map((s) => `District ${s.district_id}: open ${s.open_tickets}, fixed ${s.fixed_tickets}${s.median_days_to_fix != null ? `, median ${Math.round(Number(s.median_days_to_fix))} days to fix` : ''}`).join('; ') || 'no data'}.`;
      const rec: Source = { id: 'roads:summary', title: 'Road requests summary (live)', type: 'road_requests', url: '/roads/districts', source_url: null, source_label: 'Hub road requests', date: new Date().toISOString().slice(0, 10), text };
      return { records: [rec], summary: `id: roads:summary\n${text}` };
    },
  };
}

function modelClient(apiKey: string): ModelClient {
  const anthropic = new Anthropic({ apiKey, maxRetries: 2, timeout: 90_000 });
  return {
    // Server-side fallbacks re-run a refused request on another model inside the same call.
    // deno-lint-ignore no-explicit-any
    create: async (p) => (await anthropic.beta.messages.create({ ...p, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } as any)) as any,
  };
}

const newId = () => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; const b = crypto.getRandomValues(new Uint8Array(10)); return Array.from(b, (x) => a[x % a.length]).join(''); };

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (req.method === 'GET') {
    let corpus: unknown = null; try { corpus = (await loadIndex()).corpus.meta; } catch (e) { corpus = { error: (e as Error).message }; }
    return json({ ready: Boolean(apiKey), model: MODEL, corpus });
  }
  if (req.method !== 'POST') return fail('method', 'Use POST', 405);
  const body = await req.json().catch(() => ({}));
  const action = str(body.action, 20);
  const device = str(body.device_token, 100);
  if (!device) return fail('device', 'Missing device token');
  const sb = service(); const devHash = await sha256('dev:' + device);

  if (action === 'share') {
    const id = str(body.id, 20);
    const { data } = await hub(sb).from('ai_answers').update({ shared: true, shared_at: new Date().toISOString() }).eq('id', id).eq('device_hash', devHash).in('status', ['answered', 'not_found']).select('id').maybeSingle();
    if (!data) return fail('not_found', 'Only your own answered questions can be shared.', 404);
    return json({ url: `${SITE_URL}/ask/a/${data.id}` });
  }

  if (action === 'rate') {
    const id = str(body.id, 20); const comment = str(body.comment, 1000);
    if (comment && FLAGGED.test(comment)) return fail('content', 'Please rephrase your comment.');
    const { error } = await hub(sb).from('ai_feedback').insert({ answer_id: id, helpful: Boolean(body.helpful), comment: comment || null, device_hash: devHash });
    if (error) return fail('save', 'Could not save feedback.', 500);
    return json({ ok: true });
  }

  if (action !== 'ask') return fail('action', 'Unknown action');
  if (!apiKey) return fail('not_configured', 'The assistant is being set up and is not answering questions yet.', 503);
  const question = str(body.question, 600);
  const mode = body.mode === 'report' ? 'report' : 'answer';
  if (question.length < 4) return fail('question', 'Ask a longer question.');
  const history = (Array.isArray(body.history) ? body.history : []).slice(-3).map((h: { q?: unknown; a?: unknown }) => ({ q: str(h?.q, 600), a: str(h?.a, 2500) })).filter((h: { q: string }) => h.q);
  const ip = ipOf(req);
  if (!(await verifyCaptcha(str(body.captcha_token, 2000), ip))) return fail('captcha', 'Please complete the check and try again.', 403);
  const ipHash = await sha256('ip:' + ip);
  const limits: [string, number, number][] = [[`ai:h:${devHash}`, 15, 3600], [`ai:d:${devHash}`, 40, 86400], [`ai:ip:${ipHash}`, 80, 86400], ['ai:global', DAILY_LIMIT, 86400]];
  if (mode === 'report') limits.push([`ai:r:${devHash}`, 6, 86400]);
  for (const [bucket, limit, win] of limits) if (!(await underLimit(sb, bucket, limit, win))) return fail('rate_limited', bucket === 'ai:global' ? 'The assistant has reached its daily limit. Please try again tomorrow.' : 'You have asked a lot of questions. Please try again later.', 429);

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      const keepAlive = setInterval(() => controller.enqueue(enc.encode(': keep-alive\n\n')), 15000);
      try {
        send('step', { text: 'Loading the records' });
        const index = await loadIndex();
        const result = await ask({ question, mode, history }, { client: modelClient(apiKey), index, live: liveData(), model: MODEL, siteUrl: SITE_URL, onStep: (t) => send('step', { text: t }) });
        const id = newId();
        await hub(sb).from('ai_answers').insert({ id, question, mode, status: result.status, title: result.title, answer: result.answer, sources: result.sources, follow_ups: result.follow_ups, verification: result.verification, steps: result.steps, model: result.model, usage: result.usage, device_hash: devHash, corpus_built: index.corpus.meta.built });
        send('done', { id, ...result, corpus_built: index.corpus.meta.built });
      } catch (e) {
        const err = e as { status?: number; message?: string };
        console.error('ask failed', err?.status, err?.message);
        send('error', { code: err?.status === 429 ? 'busy' : 'failed', message: err?.status === 429 ? 'The assistant is busy. Please try again in a minute.' : 'Something went wrong. Please try again.' });
      } finally { clearInterval(keepAlive); controller.close(); }
    },
  });
  return new Response(stream, { headers: { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' } });
});
