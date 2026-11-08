import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { findTerm, type Term } from '../lib/data';

export type ExplainDetail = { title: string; def?: Term; amounts?: { label: string; value: string }[]; source?: string; extra?: ReactNode };
const Ctx = createContext<(d: ExplainDetail) => void>(() => {});
export const useExplain = () => useContext(Ctx);

export function ExplainProvider({ children }: { children: ReactNode }) {
  const [detail, setDetail] = useState<ExplainDetail | null>(null);
  const open = useCallback((d: ExplainDetail) => setDetail({ ...d, def: d.def ?? findTerm(d.title) }), []);
  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetail(null); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [detail]);
  return (
    <Ctx.Provider value={open}>
      {children}
      {detail && (
        <>
          <div className="drawer-backdrop" onClick={() => setDetail(null)} />
          <aside className="drawer" role="dialog" aria-modal="true" aria-label={detail.title}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <span className="badge accent">{detail.def?.badge === 'cat' ? 'Category' : detail.def?.badge === 'fund' ? 'Fund' : detail.def?.badge === 'in' ? 'Revenue' : 'Term'}</span>
              <button className="btn small" onClick={() => setDetail(null)} aria-label="Close"><X size={16} /></button>
            </div>
            <h2 style={{ fontSize: 22 }}>{detail.title}</h2>
            {detail.def ? (
              <>
                <h4>What it is</h4><p>{detail.def.what}</p>
                <h4>Why it matters</h4><p>{detail.def.why}</p>
              </>
            ) : <p className="muted">No plain-English note is written for this item yet. Use "Report an error or gap" below to request one.</p>}
            {detail.amounts && detail.amounts.length > 0 && (
              <div className="card" style={{ padding: 12, marginTop: 10 }}>
                {detail.amounts.map((a) => (<div key={a.label} className="row between small"><span className="muted">{a.label}</span><strong>{a.value}</strong></div>))}
              </div>
            )}
            {detail.extra}
            {detail.source && <p className="src">Source: {detail.source}</p>}
          </aside>
        </>
      )}
    </Ctx.Provider>
  );
}

export function ExplainButton({ title, def, amounts, source, label }: ExplainDetail & { label?: string }) {
  const open = useExplain();
  return <button type="button" className="explain-btn" aria-label={label ?? `What is ${title}?`} onClick={(e) => { e.stopPropagation(); open({ title, def, amounts, source }); }}>i</button>;
}
