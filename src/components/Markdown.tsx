import { Fragment, type ReactNode } from 'react';

/** Small, safe Markdown renderer for assistant answers: headings, paragraphs, lists, tables, bold/italic,
 *  hub links and [n] citation markers. Everything renders as React text, so no HTML from the model runs. */
export function Markdown({ text, cite }: { text: string; cite: (n: number) => ReactNode }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  let i = 0; let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) { const level = Math.min(4, h[1].length + 1); const H = (`h${level}`) as 'h2' | 'h3' | 'h4'; blocks.push(<H key={key++} style={{ margin: '14px 0 6px' }}>{inline(h[2], cite)}</H>); i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { if (!/^\s*\|?\s*:?-{2,}/.test(lines[i])) rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())); i++; }
      const [head, ...body] = rows;
      blocks.push(<div key={key++} className="table-wrap" style={{ margin: '8px 0' }}><table className="data"><thead><tr>{head.map((c, j) => <th key={j}>{inline(c, cite)}</th>)}</tr></thead><tbody>{body.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j} className={/^[\s$(-]*[\d,.]+%?\)?\s*(\[\d+.*)?$/.test(c) ? 'num' : ''}>{inline(c, cite)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line); const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, '')); i++; }
      const L = ordered ? 'ol' : 'ul';
      blocks.push(<L key={key++} style={{ paddingLeft: 20, margin: '6px 0', display: 'grid', gap: 4 }}>{items.map((it, j) => <li key={j}>{inline(it, cite)}</li>)}</L>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*([-*•]|\d+[.)])\s+|\s*\|)/.test(lines[i])) { para.push(lines[i]); i++; }
    blocks.push(<p key={key++} style={{ margin: '8px 0' }}>{inline(para.join(' '), cite)}</p>);
  }
  return <div className="md">{blocks}</div>;
}

const HUB = /^https:\/\/dmoore0157\.github\.io\/calloway-transparency-hub\//;
function inline(s: string, cite: (n: number) => ReactNode): ReactNode[] {
  const out: ReactNode[] = []; let k = 0;
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[(\d+(?:\s*,\s*\d+)*)\]|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(<Fragment key={k++}>{s.slice(last, m.index)}</Fragment>);
    const tok = m[0];
    if (tok.startsWith('**')) out.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    else if (m[2]) out.push(<sup key={k++} className="cite">{m[2].split(',').map((n) => <Fragment key={n}>{cite(Number(n.trim()))}</Fragment>)}</sup>);
    else if (m[3] && m[4]) out.push(HUB.test(m[4]) ? <a key={k++} href={m[4]}>{m[3]}</a> : <Fragment key={k++}>{m[3]}</Fragment>);
    else out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(<Fragment key={k++}>{s.slice(last)}</Fragment>);
  return out;
}

/** Plain text with [n] markers kept, for copying and history. */
export const toPlain = (md: string) => md.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^#{1,4}\s+/gm, '').replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1');
