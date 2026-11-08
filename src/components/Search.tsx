import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, X } from 'lucide-react';
import { getIndex, type SearchDoc } from '../lib/search';
import { trackSearch } from '../lib/track';

export function SearchBox({ autoFocus, onDone, big }: { autoFocus?: boolean; onDone?: () => void; big?: boolean }) {
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  const results = useMemo(() => (q.trim().length < 2 ? [] : (getIndex().search(q).slice(0, 24) as unknown as (SearchDoc & { score: number })[])), [q]);
  // count a search once the reader stops typing for a moment
  useEffect(() => { const t = q.trim(); if (t.length < 2) return; const id = setTimeout(() => trackSearch(t, results.length), 1500); return () => clearTimeout(id); }, [q, results.length]);
  const grouped = useMemo(() => { const g: Record<string, SearchDoc[]> = {}; for (const r of results) (g[r.type] ??= []).push(r); return g; }, [results]);
  return (
    <div>
      <div className="searchbar" style={{ padding: big ? '4px 8px 4px 18px' : '0 6px 0 14px' }}>
        <SearchIcon size={18} color="var(--ink-muted)" />
        <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search motions, budget lines, meetings, ordinances…" aria-label="Search the hub" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', padding: big ? '12px 0' : '10px 0', fontSize: big ? 16 : 14, color: 'inherit' }} />
        {q && <button className="btn small" onClick={() => setQ('')} aria-label="Clear"><X size={14} /></button>}
      </div>
      {q.trim().length >= 2 && (
        <div className="card" style={{ marginTop: 8, maxHeight: '60vh', overflowY: 'auto' }}>
          {results.length === 0 && <p className="muted small" style={{ margin: 0 }}>No matches. Try a shorter word, like "bridge" or "tax".</p>}
          {Object.entries(grouped).map(([type, docs]) => (
            <div key={type} style={{ marginBottom: 10 }}>
              <div className="eyebrow" style={{ marginBottom: 4 }}>{type}{docs.length > 1 ? 's' : ''} · {docs.length}</div>
              <ul className="list-reset">
                {docs.map((d) => (
                  <li key={d.id}><button className="question" style={{ padding: '8px 10px', marginBottom: 4, fontWeight: 500 }} onClick={() => { nav(d.href); onDone?.(); }}>
                    <span>{d.title}</span>{d.meta && <span className="small muted">{d.meta}</span>}</button></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
