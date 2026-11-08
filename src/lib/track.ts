// Cookieless visit counting (see supabase/migrations/0006_site_analytics.sql). Sends only the page path, the
// referring site's host on the first page of a visit, and a phone/tablet/desktop bucket. Nothing is stored in the
// browser. Skipped when the reader has Do Not Track or Global Privacy Control turned on, and in local development.
import { supabase, backendReady } from './supabase';

const optedOut = () => {
  if (typeof navigator === 'undefined') return true;
  const n = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  return n.globalPrivacyControl === true || n.doNotTrack === '1' || n.msDoNotTrack === '1';
};
const enabled = () => backendReady && !import.meta.env.DEV && !optedOut();
const device = () => { const w = window.innerWidth; return w < 640 ? 'phone' : w < 1024 ? 'tablet' : 'desktop'; };

let first = true;
let last = '';
export function trackView(path: string) {
  if (!enabled() || path === last) return;
  last = path;
  let referrer: string | null = null;
  if (first) {
    try { const r = document.referrer ? new URL(document.referrer) : null; if (r && r.host !== window.location.host) referrer = r.hostname; } catch { /* no referrer */ }
    first = false;
  }
  supabase().rpc('track_view', { p_path: path, p_referrer: referrer, p_device: device() }).then(() => undefined, () => undefined);
}

export function trackSearch(term: string, results: number) {
  if (!enabled() || term.trim().length < 2) return;
  supabase().rpc('track_search', { p_term: term, p_results: results }).then(() => undefined, () => undefined);
}
