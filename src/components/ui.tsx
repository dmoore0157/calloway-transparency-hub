import { type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Table2, BarChart3, Share2, Check, ExternalLink } from 'lucide-react';
import { downloadCsv } from '../lib/csv';

export const Section = ({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) => (
  <div className="section-title"><h2>{title}</h2>{action && <span style={{ marginLeft: 'auto' }}>{action}</span>}{children}</div>
);

export const Stat = ({ label, value, sub, color }: { label: string; value: ReactNode; sub?: ReactNode; color?: string }) => (
  <div className="stat" style={color ? { borderTopColor: color } : undefined}><div className="label">{label}</div><div className="value">{value}</div>{sub && <div className="sub">{sub}</div>}</div>
);

export const SourceNote = ({ children }: { children: ReactNode }) => <p className="src"><strong>Source:</strong> {children}</p>;

export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;

export const Ext = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{children} <ExternalLink size={13} /></a>
);

export function ShareButton({ title }: { title?: string }) {
  const [done, setDone] = useState(false);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: title ?? document.title, url }); return; }
      await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 1500);
    } catch { /* cancelled */ }
  };
  return <button className="btn small" onClick={share}>{done ? <Check size={14} /> : <Share2 size={14} />} {done ? 'Link copied' : 'Share'}</button>;
}

/** Chart with a "view as table" toggle and CSV download, so no number is locked inside a picture. */
type Col = { key: string; label: string; num?: boolean; format?: (v: unknown) => ReactNode };
export function ChartFrame({ title, intro, rows, columns, filename, children, footer }: { title: ReactNode; intro?: ReactNode; rows: Record<string, unknown>[]; columns?: Col[]; filename: string; children: ReactNode; footer?: ReactNode }) {
  const [table, setTable] = useState(false);
  const cols: Col[] = columns ?? (rows[0] ? Object.keys(rows[0]).map((k) => ({ key: k, label: k, num: typeof rows[0][k] === 'number' })) : []);
  return (
    <div className="card">
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 220 }}><h3 style={{ marginBottom: 4 }}>{title}</h3>{intro && <p className="small muted" style={{ marginBottom: 8 }}>{intro}</p>}</div>
        <div className="row">
          <button className="btn small" onClick={() => setTable(!table)} aria-pressed={table}>{table ? <BarChart3 size={14} /> : <Table2 size={14} />} {table ? 'Chart' : 'Table'}</button>
          <button className="btn small" onClick={() => downloadCsv(filename, rows, cols.map((c) => c.key))}><Download size={14} /> CSV</button>
        </div>
      </div>
      {table ? (
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table className="data"><thead><tr>{cols.map((c) => <th key={c.key} className={c.num ? 'num' : ''}>{c.label}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>{c.format ? c.format(r[c.key]) : String(r[c.key] ?? '')}</td>)}</tr>)}</tbody></table>
        </div>
      ) : children}
      {footer}
    </div>
  );
}

export function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
      <button className="btn small" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      <span className="small muted">Page {page} of {pages}</span>
      <button className="btn small" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
    </div>
  );
}

export const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, [string, string]> = {
    reported: ['Reported', ''], submitted_to_county: ['Sent to county', 'accent'], acknowledged: ['Acknowledged', 'accent'], in_progress: ['In progress', 'accent'], fixed: ['Fixed', 'ok'],
    closed_not_county: ['Not a county road', 'warn'], closed_duplicate: ['Duplicate', ''], closed_invalid: ['Closed', ''],
    new: ['New', ''], under_review: ['Under review', 'accent'], planned: ['Planned', 'accent'], shipped: ['Shipped', 'ok'], declined: ['Declined', 'warn'],
    not_rated: ['Not yet rated', ''], in_the_works: ['In the works', 'accent'], stalled: ['Stalled', 'warn'], kept: ['Kept', 'ok'], compromise: ['Compromise', 'accent'], broken: ['Broken', 'bad'],
  };
  const [label, cls] = map[status] ?? [status, ''];
  return <span className={`badge ${cls}`}>{label}</span>;
};

export const Crumb = ({ items }: { items: { to?: string; label: string }[] }) => (
  <nav aria-label="Breadcrumb" className="small muted" style={{ marginBottom: 8 }}>
    {items.map((it, i) => <span key={i}>{i > 0 && ' › '}{it.to ? <Link to={it.to}>{it.label}</Link> : it.label}</span>)}
  </nav>
);
