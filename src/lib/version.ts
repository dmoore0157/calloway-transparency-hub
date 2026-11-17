// The hub is a single-page app, so a tab left open keeps running the build it loaded, even after a newer one is
// published. On navigation, and when the tab comes back into view (phones keep tabs alive for days), this compares
// the running build with dist/version.json and reloads once when they differ. One reload per newer id, so a stale
// copy of version.json on the CDN cannot loop. Pages with forms only reload when nothing has been typed.

const CHECK_EVERY_MS = 60 * 1000;
const NEVER = [/^\/roads\/report/, /^\/feedback/, /^\/admin/]; // multi-step forms whose state is not saved
let lastCheck = 0;

/** Ask keeps its conversation in sessionStorage, so it can reload when the box is empty and no answer is loading. */
function safeToReload(path: string): boolean {
  if (NEVER.some((rx) => rx.test(path))) return false;
  for (const el of document.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>('main textarea, main input[type="text"], main input:not([type])')) {
    if (el.disabled || el.value.trim()) return false;
  }
  return true;
}

export function checkForNewVersion(path: string) {
  if (import.meta.env.DEV || typeof __BUILD_ID__ !== 'string' || typeof fetch !== 'function') return;
  if (NEVER.some((rx) => rx.test(path))) return;
  const now = Date.now();
  if (now - lastCheck < CHECK_EVERY_MS) return;
  lastCheck = now;
  fetch(`${import.meta.env.BASE_URL}version.json?t=${now}`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((v: { id?: string } | null) => {
      const id = v?.id;
      if (!id || id === __BUILD_ID__) return;
      if (!safeToReload(window.location.pathname.replace(import.meta.env.BASE_URL.replace(/\/$/, ''), '') || '/')) { lastCheck = 0; return; }
      try {
        if (sessionStorage.getItem('hub:reloaded-for') === id) return;
        sessionStorage.setItem('hub:reloaded-for', id);
      } catch { /* storage unavailable: still reload once per page load */ }
      window.location.reload();
    })
    .catch(() => undefined);
}

/** Also check when a backgrounded tab is shown again or restored from the back-forward cache. */
export function watchForNewVersion(getPath: () => string) {
  if (typeof document === 'undefined') return () => undefined;
  const onShow = () => { if (document.visibilityState === 'visible') checkForNewVersion(getPath()); };
  document.addEventListener('visibilitychange', onShow);
  window.addEventListener('pageshow', onShow);
  return () => { document.removeEventListener('visibilitychange', onShow); window.removeEventListener('pageshow', onShow); };
}
