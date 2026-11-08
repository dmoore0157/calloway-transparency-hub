import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ThumbsUp, Download } from 'lucide-react';
import { Meta } from '../../components/Meta';
import { Section, Empty, Hero, Crumb, ShareButton, StatusBadge } from '../../components/ui';
import { api, type Idea } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { backendReady, callFn } from '../../lib/supabase';
import { deviceToken, recall, remember } from '../../lib/device';
import { relTime } from '../../lib/format';
import { roadmap } from '../../lib/data';

const CATS = [['feature', 'New feature'], ['data_request', 'Data request'], ['fix', 'Fix something'], ['question', 'Question'], ['other', 'Other']];
const STATUSES = ['new', 'under_review', 'planned', 'in_progress', 'shipped', 'declined'];

export default function Feedback() {
  const { data: ideas, loading, reload } = useAsync(() => api.ideas(), [], []);
  const [status, setStatus] = useState('all'); const [showForm, setShowForm] = useState(false);
  const [voted, setVoted] = useState<number[]>(() => recall('voted', []));
  const vote = async (id: number) => {
    const has = voted.includes(id);
    try { await callFn('feedback', { action: has ? 'unvote' : 'vote', device_token: deviceToken(), idea_id: id }); const n = has ? voted.filter((v) => v !== id) : [...voted, id]; setVoted(n); remember('voted', n); reload(); } catch (e) { alert((e as Error).message); }
  };
  const list = ideas.filter((i) => status === 'all' || i.status === status);
  return (
    <>
      <Meta title="Feedback" description="Suggest improvements to the Calloway County Transparency Hub, vote on ideas, and see what is planned." />
      <Hero pill="Feedback" compact title={<>Shape the <span className="hl">hub.</span></>} />
      <p className="lede">Suggest a feature, request a dataset, or report something broken. Ideas are public. Votes decide what gets built next, and every idea gets a status and a reason.</p>
      {!backendReady && <Empty>The feedback board needs the hub's backend, which is not configured in this build.</Empty>}
      {backendReady && (<>
        <div className="row between"><button className="btn primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Close' : 'Suggest an improvement'}</button><Link to="/records/corrections" className="small">Corrections log ›</Link></div>
        {showForm && <IdeaForm onDone={() => { setShowForm(false); reload(); }} />}
        <div className="row" style={{ margin: '14px 0 8px' }}><button className={`chip ${status === 'all' ? 'active' : ''}`} onClick={() => setStatus('all')}>All</button>{STATUSES.map((s) => <button key={s} className={`chip ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}><StatusBadge status={s} /> {ideas.filter((i) => i.status === s).length}</button>)}</div>
        {loading ? <p className="muted">Loading…</p> : list.length === 0 ? <Empty>No ideas here yet. Be the first.</Empty> : (
          <ul className="list-reset grid">{list.map((i) => <IdeaCard key={i.id} idea={i} voted={voted.includes(i.id)} onVote={() => vote(i.id)} />)}</ul>
        )}
      </>)}
      <Section title="What's on the roadmap that needs records we don't have yet" />
      <div className="grid cols-2">{Object.entries(roadmap).filter(([k]) => ['checkbook', 'vendors', 'projects', 'openrec'].includes(k)).map(([k, r]) => <div key={k} className="card"><h3 style={{ fontSize: 16, textTransform: 'capitalize' }}>{k === 'openrec' ? 'Open records log' : k === 'projects' ? 'Capital projects' : k === 'vendors' ? 'Vendor spending' : 'County checkbook'}</h3><p className="small">{r.see}</p><p className="small muted" style={{ margin: 0 }}><strong>Needs:</strong> {r.needs}</p></div>)}</div>
    </>
  );
}

function IdeaCard({ idea, voted, onVote }: { idea: Idea; voted: boolean; onVote: () => void }) {
  return (
    <li className="card" style={{ display: 'flex', gap: 14 }}>
      <button className={`btn small ${voted ? 'brand' : ''}`} style={{ flexDirection: 'column', minWidth: 56, height: 56 }} onClick={onVote} aria-pressed={voted} aria-label={`Vote for ${idea.title}`}><ThumbsUp size={16} /><strong>{idea.vote_count}</strong></button>
      <div style={{ flex: 1 }}>
        <div className="row between"><Link to={`/feedback/ideas/${idea.id}`} style={{ color: 'inherit', fontWeight: 700 }}>{idea.title}</Link><StatusBadge status={idea.status} /></div>
        <p className="small" style={{ margin: '4px 0' }}>{idea.body.length > 220 ? idea.body.slice(0, 220) + '…' : idea.body}</p>
        <div className="tiny muted">{CATS.find((c) => c[0] === idea.category)?.[1] ?? idea.category} · {relTime(idea.created_at)}{idea.status_note && <> · <em>{idea.status_note}</em></>}</div>
      </div>
    </li>
  );
}

function IdeaForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [category, setCategory] = useState('feature'); const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [result, setResult] = useState<{ published: boolean } | null>(null);
  const submit = async () => {
    setBusy(true); setErr('');
    try { const r = await callFn<{ id: number; published: boolean }>('feedback', { action: 'idea', device_token: deviceToken(), title, body, category, email: email || undefined, website: '' }); setResult(r); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  if (result) return <div className="card ok" style={{ marginTop: 12 }}><p style={{ margin: 0 }}>{result.published ? 'Posted. Thank you.' : 'Received. Because it contains a link or flagged words it will appear after a quick review.'} <button className="btn small" onClick={onDone}>Done</button></p></div>;
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <label className="field"><span>Title</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Add a chart of jail costs per inmate" /></label>
      <label className="field"><span>Details <span className="hint">what you want to see, and why it matters</span></span><textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} /></label>
      <div className="row" style={{ marginBottom: 12 }}>{CATS.map(([k, l]) => <button key={k} type="button" className={`chip ${category === k ? 'active' : ''}`} onClick={() => setCategory(k)}>{l}</button>)}</div>
      <label className="field"><span>Email <span className="hint">optional, private, only to tell you when it ships</span></span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      {err && <p className="small" style={{ color: 'var(--bad)' }}>{err}</p>}
      <button className="btn primary" disabled={busy || title.trim().length < 5 || body.trim().length < 10} onClick={submit}>{busy ? 'Posting…' : 'Post idea'}</button>
    </div>
  );
}

export function IdeaPage() {
  const { id = '0' } = useParams(); const n = Number(id);
  const { data: idea, loading } = useAsync(() => api.idea(n), [n], null);
  const { data: comments } = useAsync(() => api.ideaComments(n), [n], []);
  if (loading) return <p className="muted">Loading…</p>;
  if (!idea) return <Empty>Idea not found. <Link to="/feedback">All ideas</Link></Empty>;
  return (<>
    <Crumb items={[{ to: '/feedback', label: 'Feedback' }, { label: `Idea #${idea.id}` }]} />
    <div className="card"><div className="row between"><StatusBadge status={idea.status} /><ShareButton /></div><h2>{idea.title}</h2><p style={{ whiteSpace: 'pre-wrap' }}>{idea.body}</p><p className="small muted">{idea.vote_count} votes · {CATS.find((c) => c[0] === idea.category)?.[1]} · {relTime(idea.created_at)}</p>{idea.status_note && <div className="notice"><strong>From the hub team:</strong> {idea.status_note}</div>}</div>
    <Section title="Updates" />
    {comments.length === 0 ? <Empty>No updates yet.</Empty> : <ul className="timeline">{comments.map((c) => <li key={c.id}><div className="small muted">{c.actor === 'admin' ? 'Hub team' : 'Resident'} · {relTime(c.created_at)}</div><div>{c.body}</div></li>)}</ul>}
    <p className="small"><Download size={12} /> Ideas are exported with the other public datasets.</p>
  </>);
}
