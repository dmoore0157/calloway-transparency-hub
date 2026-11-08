import { useEffect } from 'react';
export function Meta({ title, description }: { title: string; description?: string }) {
  useEffect(() => {
    document.title = title ? `${title} · Calloway County Transparency Hub` : 'Calloway County Transparency Hub';
    if (description) { let m = document.querySelector('meta[name="description"]'); if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'description'); document.head.appendChild(m); } m.setAttribute('content', description); }
  }, [title, description]);
  return null;
}
