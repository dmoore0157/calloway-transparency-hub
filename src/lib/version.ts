// The hub is a single-page app, so a tab left open keeps running the build it loaded, even after a newer one is
// published. On navigation (at most every few minutes) this compares the running build with dist/version.json and
// reloads once when they differ. One reload per newer id, so a stale copy of version.json on the CDN cannot loop.

const CHECK_EVERY_MS = 3 * 60 * 1000;
const SKIP = [/^\/roads\/report/, /^\/ask/, /^\/feedback/, /^\/admin/]; // pages where a reload could lose typed text
let lastCheck = 0;

export function checkForNewVersion(path: string) {
  if (import.meta.env.DEV || typeof __BUILD_ID__ !== 'string' || typeof fetch !== 'function') return;
  if (SKIP.some((rx) => rx.test(path))) return;
  const now = Date.now();
  if (now - lastCheck < CHECK_EVERY_MS) return;
  lastCheck = now;
  fetch(`${import.meta.env.BASE_URL}version.json?t=${now}`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((v: { id?: string } | null) => {
      const id = v?.id;
      if (!id || id === __BUILD_ID__) return;
      try {
        if (sessionStorage.getItem('hub:reloaded-for') === id) return;
        sessionStorage.setItem('hub:reloaded-for', id);
      } catch { /* storage unavailable: still reload once per page load */ }
      window.location.reload();
    })
    .catch(() => undefined);
}
