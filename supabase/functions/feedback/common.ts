import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';

export const service = (): SupabaseClient => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
export const hub = (sb: SupabaseClient) => sb.schema('hub');

const ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*';
export const cors: Record<string, string> = { 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', Vary: 'Origin' };
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
export const fail = (code: string, message: string, status = 400) => json({ error: { code, message } }, status);
export const preflight = (req: Request) => (req.method === 'OPTIONS' ? new Response('ok', { headers: cors }) : null);

export async function sha256(s: string): Promise<string> {
  const salt = Deno.env.get('TOKEN_HASH_SALT') ?? 'calloway-hub';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const ipOf = (req: Request) => (req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown').split(',')[0].trim();

/** Sliding-window counter in hub.rate_limits. Returns true when under the limit. */
export async function underLimit(sb: SupabaseClient, bucket: string, limit: number, windowSeconds = 86400): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000).toISOString();
  const { data } = await hub(sb).from('rate_limits').select('count').eq('bucket', bucket).eq('window_start', windowStart).maybeSingle();
  const count = (data?.count ?? 0) + 1;
  await hub(sb).from('rate_limits').upsert({ bucket, window_start: windowStart, count });
  return count <= limit;
}

/** Cloudflare Turnstile (or hCaptcha) check. Enforced only when a secret is configured. */
export async function verifyCaptcha(token: string | undefined, ip: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET');
  if (!secret) return true;
  if (!token) return false;
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret, response: token, remoteip: ip }) });
  const j = await r.json().catch(() => ({ success: false }));
  return Boolean(j.success);
}

export async function requireAdmin(req: Request, sb: SupabaseClient): Promise<{ email: string; role: string } | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user?.email) return null;
  const { data: a } = await hub(sb).from('admins').select('email, role').ilike('email', data.user.email).maybeSingle();
  return a ? { email: a.email, role: a.role } : null;
}

export async function audit(sb: SupabaseClient, actor: string, action: string, target: string, before?: unknown, after?: unknown) {
  await hub(sb).from('audit_log').insert({ actor_email: actor, action, target, before: before ?? null, after: after ?? null });
}

export const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const hasUrl = (s: string) => /https?:\/\/|www\./i.test(s);
export const FLAGGED = /\b(fuck|shit|bitch|nigg|fag|retard)/i;

export async function sendEmail(to: string, subject: string, text: string) {
  const key = Deno.env.get('RESEND_API_KEY'); const from = Deno.env.get('EMAIL_FROM');
  if (!key || !from || !to) return false;
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to, subject, text }) });
  return r.ok;
}
