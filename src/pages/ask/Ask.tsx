import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Sparkles, ShieldCheck, FileText, Download, Printer, Share2, Copy, Check, ThumbsUp, ThumbsDown, ExternalLink, AlertTriangle, Loader2, Mail, Link2, X as Close } from 'lucide-react';
import { Meta } from '../../components/Meta';
import { Section, Empty } from '../../components/ui';
import { Markdown, toPlain } from '../../components/Markdown';
import { askQuestion, askStatus, shareAnswer, rateAnswer, sharedAnswer, AskError, type AskAnswer } from '../../lib/ask';
import { backendReady } from '../../lib/supabase';
import { useAsync } from '../../lib/useAsync';
import { dateLong } from '../../lib/format';

const SUGGESTIONS = [
  'What did the state auditors find in the most recent audit, and has it happened before?',
  'How did each magistrate vote on property tax rates since 2022?',
  'What has the Fiscal Court done about a new animal shelter?',
  'Who moved and seconded the most motions, and who voted no most often?',
  'How much does the county spend on the jail, and how is it funded?',
  'Who ran for Judge/Executive in 2026 and what were the results?',
];
const SITE = 'https://dmoore0157.github.io/calloway-transparency-hub';
const STATUS: Record<string, { label: string; cls: string }> = {
  answered: { label: 'Answered from the records', cls: 'ok' }, not_found: { label: 'Not in the records', cls: 'warn' },
  out_of_scope: { label: 'Outside what it covers', cls: '' }, opinion_declined: { label: 'No opinions', cls: '' },
  needs_clarification: { label: 'Needs more detail', cls: 'warn' }, not_verified: { label: 'Withheld: could not verify', cls: 'bad' }, error: { label: 'Error', cls: 'bad' },
};
type Turn = { q: string; mode: 'answer' | 'report'; steps: string[]; answer?: AskAnswer; error?: string };
const KEY = 'hub:ask-thread';
const load = (): Turn[] => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? '[]'); } catch { return []; } };
const save = (t: Turn[]) => { try { sessionStorage.setItem(KEY, JSON.stringify(t.slice(-8))); } catch { /* private mode */ } };

export function AskPage() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [mode, setMode] = useState<'answer' | 'report'>(params.get('mode') === 'report' ? 'report' : 'answer');
  const [turns, setTurns] = useState<Turn[]>(load);
  const [busy, setBusy] = useState(false);
  const { data: status, loading } = useAsync(() => askStatus(), [], null);
  const ready = Boolean(status?.ready);
  const endRef = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => save(turns), [turns]);
  useEffect(() => () => abort.current?.abort(), []);

  const submit = async (question = q, m = mode) => {
    const text = question.trim(); if (text.length < 4 || busy) return;
    setBusy(true); setQ(''); if (params.get('q')) setParams({}, { replace: true });
    const history = turns.filter((t) => t.answer?.status === 'answered').slice(-3).map((t) => ({ q: t.q, a: toPlain(t.answer!.answer) }));
    const turn: Turn = { q: text, mode: m, steps: [] };
    setTurns((ts) => [...ts, turn]);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
    const update = (patch: Partial<Turn>) => setTurns((ts) => ts.map((t, i) => (i === ts.length - 1 ? { ...t, ...patch } : t)));
    abort.current = new AbortController();
    try {
      const answer = await askQuestion(text, m, history, (s) => setTurns((ts) => ts.map((t, i) => (i === ts.length - 1 ? { ...t, steps: [...t.steps, s] } : t))), abort.current.signal);
      update({ answer });
    } catch (e) { update({ error: e instanceof AskError ? e.message : 'Something went wrong. Please try again.' }); }
    finally { setBusy(false); }
  };

  return (<>
    <Meta title="Ask the records" description="Ask questions about Calloway County's budgets, audits, votes, officials and elections. Every answer is drawn from the hub's public records, cited, and checked before it is shown." />
    <div className="eyebrow">Ask the records</div>
    <h1 style={{ marginTop: 4 }}>Ask a question. Get an answer from the public record, with sources.</h1>
    <p className="lede">The assistant searches only the hub's records: Fiscal Court minutes and votes, state audits, budgets, grants, debt, ordinances, officials, elections and the promise tracker. It cites every fact. Answers with figures it cannot match to a record are withheld instead of shown.</p>

    <div className="card" style={{ marginTop: 12 }}>
      {!backendReady ? <Empty>The assistant needs the hub's backend, which is not configured in this build.</Empty> : (<>
        {!loading && !ready && <div className="notice warn" style={{ marginBottom: 10 }}><strong>The assistant is being set up.</strong> Questions will open once it is connected. Meanwhile, the <Link to="/">search box</Link> covers every record.</div>}
        <label className="field" style={{ marginBottom: 8 }}><span>Your question <span className="hint">about Calloway County government records</span></span>
          <textarea className="input" value={q} maxLength={600} placeholder="e.g. What did the 2025 audit find, and what did the county say it would do?" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} disabled={!ready || busy} style={{ minHeight: 80 }} />
        </label>
        <div className="row between">
          <div className="row" role="radiogroup" aria-label="Answer type">
            <button className={`chip ${mode === 'answer' ? 'active' : ''}`} role="radio" aria-checked={mode === 'answer'} onClick={() => setMode('answer')}>Quick answer</button>
            <button className={`chip ${mode === 'report' ? 'active' : ''}`} role="radio" aria-checked={mode === 'report'} onClick={() => setMode('report')}><FileText size={13} /> Full report</button>
            <span className="tiny muted">{q.length}/600</span>
          </div>
          <button className="btn primary" disabled={!ready || busy || q.trim().length < 4} onClick={() => submit()}>{busy ? <><Loader2 size={15} className="spin" /> Working</> : <><Sparkles size={15} /> Ask</>}</button>
        </div>
        {turns.length === 0 && <div className="row" style={{ marginTop: 12, gap: 6 }}>{SUGGESTIONS.map((s) => <button key={s} className="chip" disabled={!ready || busy} onClick={() => submit(s)} style={{ textAlign: 'left' }}>{s}</button>)}</div>}
      </>)}
    </div>

    <div className="grid" style={{ marginTop: 16 }}>
      {turns.map((t, i) => <TurnView key={i} t={t} last={i === turns.length - 1} busy={busy} onAsk={(s, m) => submit(s, m ?? 'answer')} />)}
      <div ref={endRef} />
    </div>
    {turns.length > 0 && !busy && <div className="row" style={{ marginTop: 10 }}><button className="btn small" onClick={() => setTurns([])}>Start over</button></div>}
    <Rules />
  </>);
}

function TurnView({ t, last, busy, onAsk }: { t: Turn; last: boolean; busy: boolean; onAsk: (q: string, m?: 'answer' | 'report') => void }) {
  return <div>
    <div className="row" style={{ justifyContent: 'flex-end' }}><div className="card" style={{ padding: '10px 14px', maxWidth: 680, background: 'var(--surface-2)' }}><span className="tiny muted">{t.mode === 'report' ? 'Report request' : 'Question'}</span><div>{t.q}</div></div></div>
    {!t.answer && !t.error && <div className="card" style={{ marginTop: 8 }} aria-live="polite">
      <div className="row small"><Loader2 size={15} className="spin" /> <strong>{t.mode === 'report' ? 'Researching and writing a report' : 'Checking the records'}</strong> <span className="muted">{t.mode === 'report' ? 'usually 30 to 90 seconds' : 'usually 10 to 30 seconds'}</span></div>
      <ul className="small muted" style={{ margin: '8px 0 0', paddingLeft: 18 }}>{t.steps.map((s, i) => <li key={i}>{s}</li>)}</ul>
    </div>}
    {t.error && <div className="notice bad" style={{ marginTop: 8 }}><AlertTriangle size={14} /> {t.error}</div>}
    {t.answer && <div style={{ marginTop: 8 }}><AnswerCard a={t.answer} onAsk={last && !busy ? onAsk : undefined} /></div>}
  </div>;
}

export function AnswerCard({ a, onAsk, shared }: { a: AskAnswer; onAsk?: (q: string, m?: 'answer' | 'report') => void; shared?: boolean }) {
  const st = STATUS[a.status] ?? STATUS.error;
  const anchor = (n: number) => `${a.id}-s${n}`;
  const cite = (n: number): ReactNode => (a.sources.some((s) => s.n === n) ? <a href={`#${anchor(n)}`} onClick={(e) => { e.preventDefault(); document.getElementById(anchor(n))?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} aria-label={`Source ${n}`}>[{n}]</a> : null);
  const checked = a.status === 'answered';
  return <article className="card" style={{ borderLeft: `4px solid ${st.cls === 'ok' ? 'var(--ok)' : st.cls === 'bad' ? 'var(--bad)' : 'var(--accent)'}` }}>
    <div className="row between" style={{ alignItems: 'flex-start' }}>
      <div><span className={`badge ${st.cls}`}>{st.label}</span>{a.mode === 'report' && <span className="badge" style={{ marginLeft: 6 }}>Report</span>}<h2 style={{ margin: '8px 0 4px', fontSize: 21 }}>{a.title}</h2>{shared && <p className="small muted" style={{ margin: 0 }}>Question: {a.question}</p>}</div>
    </div>
    <Markdown text={a.answer} cite={cite} />
    {checked && <p className="small" style={{ margin: '10px 0 0', color: 'var(--ok)' }}><ShieldCheck size={14} style={{ verticalAlign: '-2px' }} /> Every figure was matched to the {a.sources.length} record{a.sources.length === 1 ? '' : 's'} cited below{a.verification.repaired ? ', after the assistant corrected a figure it could not match' : ''}.{a.corpus_built ? ` Records as of ${dateLong(a.corpus_built)}.` : ''}</p>}
    {a.sources.length > 0 && <>
      <h3 style={{ margin: '14px 0 6px', fontSize: 15 }}>{a.status === 'not_verified' ? 'Records the assistant consulted' : 'Sources'}</h3>
      <ol className="small" style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 6 }}>{a.sources.map((s) => <li key={s.id} id={anchor(s.n)} value={s.n} style={{ scrollMarginTop: 90 }}>
        {s.url ? <a href={s.url}>{s.title}</a> : <span>{s.title}</span>}
        <span className="muted"> · {s.source_label}{s.date ? ` · ${s.date}` : ''}</span>
        {s.source_url && <> · <a href={s.source_url} target="_blank" rel="noopener noreferrer">original document <ExternalLink size={11} /></a></>}
      </li>)}</ol>
    </>}
    {a.follow_ups.length > 0 && onAsk && <div className="row" style={{ marginTop: 12, gap: 6 }}><span className="tiny muted">Ask next:</span>{a.follow_ups.map((f) => <button key={f} className="chip" onClick={() => onAsk(f)}>{f}</button>)}</div>}
    <Actions a={a} onAsk={onAsk} shared={shared} />
  </article>;
}

function Actions({ a, onAsk, shared }: { a: AskAnswer; onAsk?: (q: string, m?: 'answer' | 'report') => void; shared?: boolean }) {
  const [copied, setCopied] = useState(false); const [shareUrl, setShareUrl] = useState<string | null>(shared ? `${SITE}/ask/a/${a.id}` : null);
  const [shareErr, setShareErr] = useState(''); const [panel, setPanel] = useState(false); const [rated, setRated] = useState<null | boolean>(null); const [comment, setComment] = useState(''); const [sent, setSent] = useState(false);
  const shareable = a.status === 'answered' || a.status === 'not_found';
  const copy = async () => { try { await navigator.clipboard.writeText(asMarkdown(a, shareUrl)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* blocked */ } };
  const share = async () => {
    setShareErr('');
    try { const url = shareUrl ?? (await shareAnswer(a.id)).url; setShareUrl(url); setPanel(true); if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) await navigator.share({ title: a.title, text: shareText(a), url }).catch(() => undefined); }
    catch (e) { setShareErr((e as Error).message); }
  };
  return <>
    <div className="row" style={{ marginTop: 14, gap: 6, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
      <button className="btn small" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}</button>
      <button className="btn small" onClick={() => download(`${slug(a.title)}.md`, asMarkdown(a, shareUrl), 'text/markdown')}><Download size={14} /> Markdown</button>
      <button className="btn small" onClick={() => download(`${slug(a.title)}.html`, asHtml(a, shareUrl), 'text/html')} title="Opens in any browser or in Word"><FileText size={14} /> Document</button>
      <button className="btn small" onClick={() => printDoc(asHtml(a, shareUrl))}><Printer size={14} /> Print or PDF</button>
      {shareable && <button className="btn small brand" onClick={share}><Share2 size={14} /> Share</button>}
      {onAsk && a.mode === 'answer' && a.status === 'answered' && <button className="btn small" onClick={() => onAsk(a.question, 'report')}><FileText size={14} /> Turn into a full report</button>}
    </div>
    {shareErr && <p className="small" style={{ color: 'var(--bad)' }}>{shareErr}</p>}
    {panel && shareUrl && <div className="card" style={{ marginTop: 8, padding: 12, background: 'var(--surface-2)' }}>
      <div className="row between"><strong className="small">Share this answer</strong><button className="iconbtn" aria-label="Close" onClick={() => setPanel(false)} style={{ color: 'inherit' }}><Close size={16} /></button></div>
      <p className="tiny muted" style={{ margin: '4px 0 8px' }}>The link shows this question, the answer and its sources. It does not show who asked.</p>
      <div className="row" style={{ gap: 6 }}>
        <input className="input" readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} style={{ flex: 1, minWidth: 200 }} />
        <button className="btn small" onClick={() => navigator.clipboard.writeText(shareUrl).catch(() => undefined)}><Link2 size={14} /> Copy link</button>
      </div>
      <div className="row" style={{ gap: 6, marginTop: 8 }}>
        <a className="btn small" target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}>Facebook</a>
        <a className="btn small" target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(a))}&url=${encodeURIComponent(shareUrl)}`}>X</a>
        <a className="btn small" target="_blank" rel="noopener noreferrer" href={`https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(a.title)}`}>Reddit</a>
        <a className="btn small" target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}>LinkedIn</a>
        <a className="btn small" href={`mailto:?subject=${encodeURIComponent(a.title)}&body=${encodeURIComponent(`${shareText(a)}\n\n${shareUrl}`)}`}><Mail size={14} /> Email</a>
        <a className="btn small" href={`sms:?&body=${encodeURIComponent(`${shareText(a)} ${shareUrl}`)}`}>Text message</a>
      </div>
    </div>}
    {!shared && <div className="row small" style={{ marginTop: 10, gap: 6 }}>
      {rated === null ? <><span className="muted">Was this useful?</span><button className="btn small" aria-label="Helpful" onClick={() => { setRated(true); rateAnswer(a.id, true).catch(() => undefined); }}><ThumbsUp size={14} /></button><button className="btn small" aria-label="Not helpful" onClick={() => setRated(false)}><ThumbsDown size={14} /></button></>
        : sent || rated ? <span className="muted">Thanks for the feedback.</span>
        : <><input className="input" style={{ flex: 1, minWidth: 220 }} placeholder="What was wrong or missing? (optional)" value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} /><button className="btn small" onClick={() => { setSent(true); rateAnswer(a.id, false, comment).catch(() => undefined); }}>Send</button></>}
    </div>}
  </>;
}

function Rules() {
  return <>
    <Section title="How the assistant stays accurate and neutral" />
    <div className="grid cols-2">
      <div className="card small"><strong>Records only.</strong> It can search the hub's records, count motions and votes exactly, and do arithmetic on retrieved figures. It has no web access and does not answer from general knowledge.</div>
      <div className="card small"><strong>Every fact cited, every figure checked.</strong> Before an answer is shown, the hub checks that each citation points to a record the assistant actually read and that every number appears in those records or in a calculation from them. If not, it gets one chance to fix it; otherwise the answer is withheld.</div>
      <div className="card small"><strong>Stays on topic.</strong> It answers only about Calloway County government records on the hub. Anything else gets a polite "outside what this covers" and no partial answer.</div>
      <div className="card small"><strong>No opinions.</strong> It never endorses, ranks or criticizes a candidate or official and never says how to vote. It shows what the record says so you can decide.</div>
    </div>
    <p className="tiny muted" style={{ marginTop: 10 }}>Answers are generated by an AI model (Anthropic's Claude) from the hub's records and can still be incomplete. Check the linked sources before relying on an answer, and use "Report an error" on any record page if something is wrong. Questions are stored for 30 days to improve the assistant, without your name or IP address; shared answers stay until removed. Limit: 15 questions an hour.</p>
  </>;
}

export function SharedAnswerPage() {
  const { id = '' } = useParams();
  const { data, loading } = useAsync(() => sharedAnswer(id), [id], null);
  return (<>
    <Meta title={data ? data.title : 'Shared answer'} description={data ? `Answered from Calloway County public records: ${data.question}` : 'An answer from the Calloway County Transparency Hub assistant.'} />
    <div className="eyebrow"><Link to="/ask">Ask the records</Link> · shared answer</div>
    {loading ? <p className="muted">Loading…</p> : !data ? <Empty>This shared answer was not found. It may have been removed. <Link to="/ask">Ask your own question</Link>.</Empty> : <>
      <p className="small muted" style={{ margin: '6px 0 10px' }}>Answered {data.created_at ? dateLong(data.created_at.slice(0, 10)) : ''} from the hub's records{data.corpus_built ? ` as of ${dateLong(data.corpus_built)}` : ''}. Records may have changed since; the sources link to the current versions.</p>
      <AnswerCard a={data} shared />
      <div className="card brand" style={{ marginTop: 16 }}><h3>Have your own question?</h3><p className="small" style={{ margin: '0 0 8px' }}>Ask about budgets, audits, votes, officials or elections. Every answer is cited and checked against the public record.</p><Link className="btn" to={`/ask?q=${encodeURIComponent(data.question)}`}>Ask the records</Link></div>
    </>}
  </>);
}

/* ---------- exports ---------- */

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'answer';
const shareText = (a: AskAnswer) => `${a.title}: answered from Calloway County public records, with sources.`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function asMarkdown(a: AskAnswer, url: string | null) {
  const src = a.sources.map((s) => `${s.n}. ${s.title} (${s.source_label}${s.date ? `, ${s.date}` : ''})${s.url ? ` ${s.url}` : ''}${s.source_url ? ` | original: ${s.source_url}` : ''}`).join('\n');
  return `# ${a.title}\n\n**Question:** ${a.question}\n\n${a.answer}\n\n${src ? `## Sources\n\n${src}\n\n` : ''}---\nAnswered by the Calloway County Transparency Hub assistant from public records${a.corpus_built ? ` as of ${a.corpus_built}` : ''}. Check the sources before relying on it.${url ? `\nLink: ${url}` : ''}\n`;
}

function mdToHtml(md: string, a: AskAnswer): string {
  const inline = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\[(\d+(?:,\s*\d+)*)\]/g, (_m, g: string) => `<sup>${g.split(',').map((n) => { const k = Number(n.trim()); return a.sources.some((s) => s.n === k) ? `<a href="#s${k}">[${k}]</a>` : ''; }).join('')}</sup>`);
  const lines = md.split('\n'); const out: string[] = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(l); if (h) { out.push(`<h${Math.min(4, h[1].length + 1)}>${inline(h[2])}</h${Math.min(4, h[1].length + 1)}>`); i++; continue; }
    if (/^\s*\|/.test(l)) { const rows: string[][] = []; while (i < lines.length && /^\s*\|/.test(lines[i])) { if (!/^\s*\|?\s*:?-{2,}/.test(lines[i])) rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())); i++; } out.push(`<table><thead><tr>${rows[0].map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`); continue; }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) { const ord = /^\s*\d/.test(l); const items: string[] = []; while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ''))}</li>`); i++; } out.push(`<${ord ? 'ol' : 'ul'}>${items.join('')}</${ord ? 'ol' : 'ul'}>`); continue; }
    const p: string[] = []; while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*([-*•]|\d+[.)])\s+|\s*\|)/.test(lines[i])) { p.push(lines[i]); i++; }
    out.push(`<p>${inline(p.join(' '))}</p>`);
  }
  return out.join('\n');
}

function asHtml(a: AskAnswer, url: string | null) {
  const src = a.sources.map((s) => `<li id="s${s.n}" value="${s.n}">${s.url ? `<a href="${esc(s.url)}">${esc(s.title)}</a>` : esc(s.title)} <span class="m">· ${esc(s.source_label)}${s.date ? ` · ${esc(s.date)}` : ''}</span>${s.source_url ? ` · <a href="${esc(s.source_url)}">original document</a>` : ''}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(a.title)}</title>
<style>body{font:16px/1.55 Georgia,'Times New Roman',serif;color:#222;max-width:760px;margin:32px auto;padding:0 18px}h1{font-size:26px;margin:0 0 6px}h2{font-size:20px;margin:22px 0 6px}h3{font-size:17px}.m{color:#666;font-size:13px}.q{background:#f4f1ea;padding:10px 14px;border-radius:6px}table{border-collapse:collapse;width:100%;font:14px Arial,sans-serif;margin:10px 0}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f4f1ea}sup a{text-decoration:none}ol{font-size:14px}footer{margin-top:28px;border-top:1px solid #ccc;padding-top:10px;font:12px Arial,sans-serif;color:#555}@media print{a{color:#222}}</style></head><body>
<p class="m">Calloway County Transparency Hub · Ask the records${a.mode === 'report' ? ' · Report' : ''}</p><h1>${esc(a.title)}</h1><p class="q"><strong>Question:</strong> ${esc(a.question)}</p>
${mdToHtml(a.answer, a)}
${src ? `<h2>Sources</h2><ol>${src}</ol>` : ''}
<footer>Answered by the Calloway County Transparency Hub assistant from public records${a.corpus_built ? ` as of ${esc(a.corpus_built)}` : ''}. Every figure was matched to the cited records before it was shown, but answers are AI-generated: check the sources before relying on them. ${url ? `Online: <a href="${esc(url)}">${esc(url)}</a>` : ''} Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.</footer></body></html>`;
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const u = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = u; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(u), 2000);
}

function printDoc(html: string) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  const d = f.contentWindow?.document; if (!d) return;
  d.open(); d.write(html); d.close();
  setTimeout(() => { f.contentWindow?.focus(); f.contentWindow?.print(); setTimeout(() => f.remove(), 2000); }, 300);
}
