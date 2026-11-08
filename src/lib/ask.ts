// Client for the "Ask the records" edge function: streams progress, then the checked answer.
import { SUPABASE_ANON_KEY, functionsUrl, backendReady, supabase, callFn } from './supabase';
import { deviceToken } from './device';

export type AskSource = { n: number; id: string; title: string; type: string; url: string; source_url: string | null; source_label: string; date: string | null };
export type AskStatus = 'answered' | 'not_found' | 'out_of_scope' | 'opinion_declined' | 'needs_clarification' | 'not_verified' | 'error';
export type AskAnswer = {
  id: string; question: string; mode: 'answer' | 'report'; status: AskStatus; title: string; answer: string;
  sources: AskSource[]; follow_ups: string[]; corpus_built?: string; created_at?: string;
  verification: { sources_checked: number; figures_checked: number; unverified: string[]; repaired: boolean };
};

export class AskError extends Error { constructor(public code: string, message: string) { super(message); } }

export async function askStatus(): Promise<{ ready: boolean; model: string; corpus: { built?: string; error?: string } | null } | null> {
  if (!backendReady) return null;
  try {
    const r = await fetch(functionsUrl('ask'), { headers: { apikey: SUPABASE_ANON_KEY!, Authorization: `Bearer ${SUPABASE_ANON_KEY!}` } });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

/** Ask a question. Calls onStep with progress lines while the assistant works. */
export async function askQuestion(question: string, mode: 'answer' | 'report', history: { q: string; a: string }[], onStep: (s: string) => void, signal?: AbortSignal): Promise<AskAnswer> {
  if (!backendReady) throw new AskError('not_configured', 'The assistant needs the hub backend, which is not configured in this build.');
  const res = await fetch(functionsUrl('ask'), {
    method: 'POST', signal,
    headers: { apikey: SUPABASE_ANON_KEY!, Authorization: `Bearer ${SUPABASE_ANON_KEY!}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ action: 'ask', question, mode, history, device_token: deviceToken() }),
  });
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => ({}));
    throw new AskError(j?.error?.code ?? 'failed', j?.error?.message ?? `Request failed (${res.status})`);
  }
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const ev = /^event: (.+)$/m.exec(chunk)?.[1]; const data = /^data: (.+)$/m.exec(chunk)?.[1];
      if (!ev || !data) continue;
      const payload = JSON.parse(data);
      if (ev === 'step') onStep(payload.text);
      else if (ev === 'done') return { ...payload, question, mode } as AskAnswer;
      else if (ev === 'error') throw new AskError(payload.code, payload.message);
    }
  }
  throw new AskError('failed', 'The connection closed before the answer arrived. Please try again.');
}

export const shareAnswer = (id: string) => callFn<{ url: string }>('ask', { action: 'share', id, device_token: deviceToken() });
export const rateAnswer = (id: string, helpful: boolean, comment?: string) => callFn<{ ok: boolean }>('ask', { action: 'rate', id, helpful, comment, device_token: deviceToken() });

export async function sharedAnswer(id: string): Promise<AskAnswer | null> {
  if (!backendReady) return null;
  const { data } = await supabase().from('ai_answers_shared').select('*').eq('id', id).maybeSingle();
  return (data as AskAnswer | null) ?? null;
}
