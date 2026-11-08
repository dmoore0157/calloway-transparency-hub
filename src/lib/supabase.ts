import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
export const backendReady = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!backendReady) throw new Error('Backend is not configured');
  if (!client) client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}
export const functionsUrl = (name: string) => `${SUPABASE_URL}/functions/v1/${name}`;
export const publicPhotoUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/ticket-photos/${path}`;

export async function callFn<T = unknown>(name: string, body: unknown, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { apikey: SUPABASE_ANON_KEY!, Authorization: `Bearer ${SUPABASE_ANON_KEY!}` };
  if (!(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  try {
    const { data } = await supabase().auth.getSession();
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  } catch { /* anonymous */ }
  const res = await fetch(functionsUrl(name), { method: 'POST', ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) }, body: body instanceof FormData ? body : JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
  return json as T;
}
