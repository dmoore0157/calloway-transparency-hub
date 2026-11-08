const KEY = 'hub:device';
export function deviceToken(): string {
  try {
    let t = localStorage.getItem(KEY);
    if (!t) { t = crypto.randomUUID(); localStorage.setItem(KEY, t); }
    return t;
  } catch { return 'anon-' + Math.random().toString(36).slice(2); }
}
export function remember<T>(key: string, value: T) { try { localStorage.setItem('hub:' + key, JSON.stringify(value)); } catch { /* ignore */ } }
export function recall<T>(key: string, fallback: T): T { try { const v = localStorage.getItem('hub:' + key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; } }
