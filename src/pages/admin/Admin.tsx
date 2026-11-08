import { type ReactNode, useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { palette, tooltipStyle } from '../../lib/palette';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { Meta } from '../../components/Meta';
import { supabase, backendReady, callFn } from '../../lib/supabase';
import { Empty, Section, StatusBadge, Stat } from '../../components/ui';
import { useAsync } from '../../lib/useAsync';
import { members, meetings, memberById } from '../../lib/data';
import { relTime, dateShort } from '../../lib/format';

const hub = () => supabase().schema('hub');

export function AdminLayout() {
  const [session, setSession] = useState<Session | null>(null); const [ready, setReady] = useState(false); const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    if (!backendReady) { setReady(true); return; }
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (!session) { setIsAdmin(null); return; } (async () => { try { const { data } = await supabase().rpc('is_admin'); setIsAdmin(Boolean(data)); } catch { setIsAdmin(false); } })(); }, [session]);
  if (!backendReady) return <Empty>Admin needs the backend configured.</Empty>;
  if (!ready) return <p className="muted">Loading…</p>;
  if (!session) return <Login />;
  if (isAdmin === false) return <Empty>Signed in as {session.user.email}, but this address is not on the editor list. <button className="btn small" onClick={() => supabase().auth.signOut()}>Sign out</button></Empty>;
  return (<>
    <Meta title="Admin" />
    <div className="row between"><div><div className="eyebrow">Admin</div><h1 style={{ marginTop: 4 }}>Review queues</h1></div><div className="small muted">{session.user.email} · <button className="btn small" onClick={() => supabase().auth.signOut()}>Sign out</button></div></div>
    <nav className="subnav">{[['/admin', 'Overview'], ['/admin/photos', 'Photos'], ['/admin/tickets', 'Tickets'], ['/admin/ideas', 'Ideas'], ['/admin/flags', 'Flags'], ['/admin/commitments', 'Commitments'], ['/admin/traffic', 'Traffic']].map(([to, l]) => <NavLink key={to} to={to} end={to === '/admin'} className={({ isActive }) => (isActive ? 'active' : '')}>{l}</NavLink>)}</nav>
    <Outlet />
  </>);
}

function Login() {
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [err, setErr] = useState('');
  const send = async () => { setErr(''); const { error } = await supabase().auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL + 'admin' } }); if (error) setErr(error.message); else setSent(true); };
  return (<div className="card" style={{ maxWidth: 420, margin: '24px auto' }}><h2>Editor sign-in</h2>{sent ? <p>Check your email for a sign-in link.</p> : <><label className="field"><span>Email</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>{err && <p className="small" style={{ color: 'var(--bad)' }}>{err}</p>}<button className="btn primary" onClick={send} disabled={!email}>Send sign-in link</button></>}<p className="tiny muted" style={{ marginTop: 10 }}>Only allow-listed editor addresses can act. Everything an editor does is logged.</p></div>);
}

export function AdminOverview() {
  const { data } = useAsync(async () => {
    const [p, i, f, t, c] = await Promise.all([hub().from('ticket_photos').select('id', { count: 'exact', head: true }).eq('status', 'pending'), hub().from('ideas').select('id', { count: 'exact', head: true }).eq('published', false), hub().from('data_flags').select('id', { count: 'exact', head: true }).eq('status', 'open'), hub().from('tickets').select('id', { count: 'exact', head: true }).in('status', ['reported', 'submitted_to_county']), hub().from('commitment_ratings').select('id', { count: 'exact', head: true }).eq('state', 'proposed')]);
    return { photos: p.count ?? 0, ideas: i.count ?? 0, flags: f.count ?? 0, tickets: t.count ?? 0, ratings: c.count ?? 0 };
  }, [], { photos: 0, ideas: 0, flags: 0, tickets: 0, ratings: 0 });
  return (<div className="grid cols-4">{[['Photos awaiting review', data.photos, '/admin/photos'], ['Ideas held for review', data.ideas, '/admin/ideas'], ['Open flags', data.flags, '/admin/flags'], ['Open tickets', data.tickets, '/admin/tickets'], ['Proposed ratings', data.ratings, '/admin/commitments']].map(([l, n, to]) => <Link key={String(l)} to={String(to)} className="stat" style={{ textDecoration: 'none' }}><div className="label">{l}</div><div className="value">{n}</div></Link>)}</div>);
}

export function AdminPhotos() {
  const { data, loading, reload } = useAsync(async () => (await hub().from('ticket_photos').select('*').eq('status', 'pending').order('created_at')).data ?? [], [], [] as Record<string, unknown>[]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => { data.forEach(async (p) => { const { data: s } = await supabase().storage.from('ticket-photos-private').createSignedUrl(String(p.private_path), 600); if (s) setUrls((u) => ({ ...u, [String(p.id)]: s.signedUrl })); }); }, [data]);
  const act = async (id: string, action: 'approve' | 'reject', reason?: string) => { await callFn('admin-action', { action: action === 'approve' ? 'approve_photo' : 'reject_photo', photo_id: id, reason }); reload(); };
  if (loading) return <p className="muted">Loading…</p>;
  if (!data.length) return <Empty>No photos waiting.</Empty>;
  return (<div className="grid cols-3">{data.map((p) => <div key={String(p.id)} className="card"><img src={urls[String(p.id)]} alt="" style={{ width: '100%', borderRadius: 8 }} /><p className="small muted">Ticket <Link to={`/roads/tickets/${p.ticket_id}`}>{String(p.ticket_id ?? 'unattached')}</Link> · {relTime(String(p.created_at))}</p><div className="row"><button className="btn primary small" onClick={() => act(String(p.id), 'approve')}>Approve</button>{['Not a road issue', 'Identifiable person or plate', 'Offensive', 'Duplicate', 'Unreadable'].map((r) => <button key={r} className="btn small" onClick={() => act(String(p.id), 'reject', r)}>{r}</button>)}</div></div>)}</div>);
}

export function AdminTickets() {
  const { data, loading, reload } = useAsync(async () => (await hub().from('tickets').select('id,status,category,severity,location_text,road_name,district_id,created_at').order('created_at', { ascending: false }).limit(200)).data ?? [], [], [] as Record<string, unknown>[]);
  const [note, setNote] = useState('');
  const set = async (id: string, to_status: string) => { await callFn('admin-action', { action: 'ticket_status', ticket_id: id, to_status, note: note || undefined }); setNote(''); reload(); };
  if (loading) return <p className="muted">Loading…</p>;
  return (<>
    <label className="field"><span>Note to attach to the next status change (public)</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
    <div className="table-wrap"><table className="data"><thead><tr><th>Ticket</th><th>Where</th><th>Status</th><th>Set status</th></tr></thead><tbody>{data.map((t) => <tr key={String(t.id)}><td><Link to={`/roads/tickets/${t.id}`}>{String(t.id)}</Link><div className="tiny muted">{String(t.category)} · {String(t.severity)} · {dateShort(String(t.created_at).slice(0, 10))}</div></td><td className="small">{String(t.road_name ?? '')} {String(t.location_text)}</td><td><StatusBadge status={String(t.status)} /></td><td><select className="input" value={String(t.status)} onChange={(e) => set(String(t.id), e.target.value)}>{['reported', 'submitted_to_county', 'acknowledged', 'in_progress', 'fixed', 'closed_not_county', 'closed_duplicate', 'closed_invalid'].map((s) => <option key={s} value={s}>{s}</option>)}</select></td></tr>)}</tbody></table></div>
  </>);
}

export function AdminIdeas() {
  const { data, loading, reload } = useAsync(async () => (await hub().from('ideas').select('*').order('created_at', { ascending: false }).limit(200)).data ?? [], [], [] as Record<string, unknown>[]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const update = async (id: number, patch: Record<string, unknown>) => { await callFn('admin-action', { action: 'idea_update', idea_id: id, ...patch }); reload(); };
  if (loading) return <p className="muted">Loading…</p>;
  return (<div className="grid">{data.map((i) => <div key={String(i.id)} className="card"><div className="row between"><strong>{String(i.title)}</strong><span className="row"><StatusBadge status={String(i.status)} />{!i.published && <span className="badge warn">unpublished</span>}<span className="small muted">{String(i.vote_count)} votes</span></span></div><p className="small">{String(i.body)}</p><div className="row"><select className="input" style={{ width: 'auto' }} value={String(i.status)} onChange={(e) => update(Number(i.id), { status: e.target.value })}>{['new', 'under_review', 'planned', 'in_progress', 'shipped', 'declined'].map((s) => <option key={s}>{s}</option>)}</select><input className="input" style={{ flex: 1 }} placeholder="Public status note (why planned / declined / shipped)" value={notes[String(i.id)] ?? String(i.status_note ?? '')} onChange={(e) => setNotes({ ...notes, [String(i.id)]: e.target.value })} /><button className="btn small" onClick={() => update(Number(i.id), { status_note: notes[String(i.id)] ?? '' })}>Save note</button><button className="btn small" onClick={() => update(Number(i.id), { published: !i.published })}>{i.published ? 'Unpublish' : 'Publish'}</button></div></div>)}</div>);
}

export function AdminFlags() {
  const { data, loading, reload } = useAsync(async () => (await hub().from('data_flags').select('*').eq('status', 'open').order('created_at')).data ?? [], [], [] as Record<string, unknown>[]);
  const [res, setRes] = useState<Record<string, string>>({});
  const resolve = async (id: number, status: string) => { await callFn('admin-action', { action: 'resolve_flag', flag_id: id, status, resolution: res[String(id)] ?? '' }); reload(); };
  if (loading) return <p className="muted">Loading…</p>;
  if (!data.length) return <Empty>No open flags.</Empty>;
  return (<div className="grid">{data.map((f) => <div key={String(f.id)} className="card"><div className="small muted">{String(f.record_table)} · {String(f.record_id)} · {relTime(String(f.created_at))}{f.reporter_email ? ` · ${f.reporter_email}` : ''}</div><p>{String(f.message)}</p><input className="input" placeholder="Public resolution note (what changed, or why not)" value={res[String(f.id)] ?? ''} onChange={(e) => setRes({ ...res, [String(f.id)]: e.target.value })} /><div className="row" style={{ marginTop: 8 }}><button className="btn primary small" onClick={() => resolve(Number(f.id), 'confirmed_corrected')}>Confirmed and corrected</button><button className="btn small" onClick={() => resolve(Number(f.id), 'rejected')}>Not an error</button></div></div>)}</div>);
}

export function AdminCommitments() {
  const nav = useNavigate();
  const { data, loading, reload } = useAsync(async () => (await hub().from('commitments').select('*, commitment_ratings(*), commitment_sources(*)').order('created_at', { ascending: false })).data ?? [], [], [] as Record<string, unknown>[]);
  const [form, setForm] = useState({ member_id: members[0].id, origin: 'campaign', election_id: '2026-general', meeting_id: '', made_on: '', quote: '', summary: '', scoreable: true, wording_type: 'outcome', measure: '', deadline: '', within_authority: true, authority_note: '', source_kind: 'website', source_url: '', archive_url: '', media_timestamp: '', published: false });
  const [rating, setRating] = useState<Record<string, { rating: string; reason: string }>>({});
  const [err, setErr] = useState('');
  const create = async () => { setErr(''); try { await callFn('admin-action', { action: 'commitment_create', ...form, meeting_id: form.meeting_id || null, election_id: form.origin === 'campaign' ? form.election_id : null, deadline: form.deadline || null, measure: form.measure || null }); setForm({ ...form, quote: '', summary: '', measure: '', source_url: '', archive_url: '' }); reload(); } catch (e) { setErr((e as Error).message); } };
  const propose = async (id: number) => { const r = rating[String(id)]; if (!r?.reason) return; await callFn('admin-action', { action: 'rating_propose', commitment_id: id, rating: r.rating, reason: r.reason }); reload(); };
  const second = async (ratingId: number) => { await callFn('admin-action', { action: 'rating_second', rating_id: ratingId }); reload(); };
  const publish = async (id: number, published: boolean) => { await callFn('admin-action', { action: 'commitment_publish', commitment_id: id, published }); reload(); };
  return (<>
    <Section title="Log a commitment" />
    <div className="card">
      <div className="grid cols-3">
        <label className="field"><span>Official</span><select className="input" value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })}>{members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select></label>
        <label className="field"><span>Origin</span><select className="input" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })}><option value="campaign">Campaign promise</option><option value="in_office">In office</option></select></label>
        {form.origin === 'campaign' ? <label className="field"><span>Election</span><select className="input" value={form.election_id} onChange={(e) => setForm({ ...form, election_id: e.target.value })}><option value="2026-general">2026 general</option><option value="2026-primary">2026 primary</option></select></label> : <label className="field"><span>Meeting</span><select className="input" value={form.meeting_id} onChange={(e) => setForm({ ...form, meeting_id: e.target.value })}><option value="">—</option>{meetings.map((m) => <option key={m.id} value={m.id}>{m.date_label}</option>)}</select></label>}
        <label className="field"><span>Date made</span><input className="input" type="date" value={form.made_on} onChange={(e) => setForm({ ...form, made_on: e.target.value })} /></label>
        <label className="field"><span>Wording</span><select className="input" value={form.wording_type} onChange={(e) => setForm({ ...form, wording_type: e.target.value })}><option value="outcome">Outcome ("X will happen")</option><option value="effort">Effort ("I will push for X")</option></select></label>
        <label className="field"><span>Deadline (optional)</span><input className="input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></label>
      </div>
      <label className="field"><span>Verbatim quote</span><textarea className="input" value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} /></label>
      <label className="field"><span>Plain summary (no adjectives)</span><input className="input" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></label>
      <div className="row" style={{ marginBottom: 10 }}><label className="small"><input type="checkbox" checked={form.scoreable} onChange={(e) => setForm({ ...form, scoreable: e.target.checked })} /> Specific and checkable (scored)</label><label className="small"><input type="checkbox" checked={form.within_authority} onChange={(e) => setForm({ ...form, within_authority: e.target.checked })} /> Within this office's authority</label></div>
      {form.scoreable && <label className="field"><span>Measure: what decides it (required before any rating)</span><input className="input" value={form.measure} onChange={(e) => setForm({ ...form, measure: e.target.value })} /></label>}
      {!form.within_authority && <label className="field"><span>Authority note</span><input className="input" value={form.authority_note} onChange={(e) => setForm({ ...form, authority_note: e.target.value })} /></label>}
      <div className="grid cols-4">
        <label className="field"><span>Source kind</span><select className="input" value={form.source_kind} onChange={(e) => setForm({ ...form, source_kind: e.target.value })}>{['website', 'mailer', 'forum_video', 'debate', 'social_post', 'news', 'questionnaire', 'minutes'].map((k) => <option key={k}>{k}</option>)}</select></label>
        <label className="field"><span>Source URL</span><input className="input" value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} /></label>
        <label className="field"><span>Archive URL (Wayback)</span><input className="input" value={form.archive_url} onChange={(e) => setForm({ ...form, archive_url: e.target.value })} /></label>
        <label className="field"><span>Timestamp in recording</span><input className="input" value={form.media_timestamp} onChange={(e) => setForm({ ...form, media_timestamp: e.target.value })} placeholder="00:41:12" /></label>
      </div>
      {err && <p className="small" style={{ color: 'var(--bad)' }}>{err}</p>}
      <button className="btn primary" onClick={create} disabled={!form.quote || !form.summary || !form.made_on || (form.scoreable && !form.measure)}>Save as draft</button>
    </div>
    <Section title={`All commitments (${data.length})`} />
    {loading ? <p className="muted">Loading…</p> : data.length === 0 ? <Empty>None yet.</Empty> : <div className="grid">{data.map((c) => { const ratings = (c.commitment_ratings as Record<string, unknown>[]) ?? []; const r = rating[String(c.id)] ?? { rating: 'in_the_works', reason: '' }; return (
      <div key={String(c.id)} className="card"><div className="row between"><strong>{memberById[String(c.member_id)]?.full_name}: {String(c.summary)}</strong><span className="row">{!c.published ? <span className="badge warn">draft</span> : <span className="badge ok">published</span>}<button className="btn small" onClick={() => publish(Number(c.id), !c.published)}>{c.published ? 'Unpublish' : 'Publish'}</button><button className="btn small" onClick={() => nav(`/leaders/commitments/${c.id}`)}>View</button></span></div>
        <p className="small muted">"{String(c.quote)}" · {String(c.origin)} · {String(c.made_on)} · measure: {String(c.measure ?? '—')}</p>
        <ul className="list-reset small">{ratings.map((x) => <li key={String(x.id)} className="row"><StatusBadge status={String(x.rating)} /> {String(x.state)} · {String(x.reason)}{x.state === 'proposed' && !x.second_reviewer && <button className="btn small" onClick={() => second(Number(x.id))}>Second-review</button>}</li>)}</ul>
        {c.scoreable && <div className="row" style={{ marginTop: 6 }}><select className="input" style={{ width: 'auto' }} value={r.rating} onChange={(e) => setRating({ ...rating, [String(c.id)]: { ...r, rating: e.target.value } })}>{['not_rated', 'in_the_works', 'stalled', 'kept', 'compromise', 'broken'].map((s) => <option key={s}>{s}</option>)}</select><input className="input" style={{ flex: 1 }} placeholder="Reason, with evidence (public)" value={r.reason} onChange={(e) => setRating({ ...rating, [String(c.id)]: { ...r, reason: e.target.value } })} /><button className="btn small" onClick={() => propose(Number(c.id))} disabled={!r.reason}>Propose rating (7-day review)</button></div>}
      </div>); })}</div>}
  </>);
}

type Summary = {
  since: string; totals: { views: number; visitors: number; visits: number }; today: { views: number; visitors: number };
  daily: { day: string; views: number; visitors: number }[]; pages: { path: string; views: number; visitors: number }[];
  sections: { section: string; views: number; visitors: number }[]; referrers: { referrer: string; visits: number }[];
  devices: { device: string; visitors: number }[]; searches: { term: string; times: number; results: number }[];
  no_result_searches: { term: string; times: number }[]; questions: { question: string; status: string; created_at: string }[];
};

/** Cookieless traffic counts from public.analytics_summary (editors only). */
export function AdminTraffic() {
  const [days, setDays] = useState(30);
  const { data: res, loading } = useAsync(async () => { const { data, error } = await supabase().rpc('analytics_summary', { p_days: days }); return error ? { error: error.message } : { summary: data as Summary }; }, [days], null as null | { error?: string; summary?: Summary });
  const data = res?.summary ?? null; const error = res?.error;
  const p = palette();
  const n = (v: number) => v.toLocaleString();
  const label = (path: string) => (path === '/' ? 'Home' : path);
  return (<>
    <div className="row" style={{ marginBottom: 12 }}>{[[7, '7 days'], [30, '30 days'], [90, '90 days'], [365, '12 months']].map(([d, l]) => <button key={d} className={`chip ${days === d ? 'active' : ''}`} aria-pressed={days === d} onClick={() => setDays(d as number)}>{l}</button>)}</div>
    {error ? <Empty>Couldn't load traffic: {error}</Empty> : loading || !data ? <p className="muted">Loading…</p> : (<>
      <div className="grid cols-4">
        <Stat label="Visitors today" value={n(data.today.visitors)} sub={`${n(data.today.views)} page views today`} />
        <Stat label={`Daily visitors, ${days} days`} value={n(data.totals.visitors)} sub="each person counted once per day" />
        <Stat label="Visits" value={n(data.totals.visits)} sub="a new visit after 30 minutes away" />
        <Stat label="Page views" value={n(data.totals.views)} sub={data.totals.visits ? `${(data.totals.views / data.totals.visits).toFixed(1)} pages per visit` : '—'} />
      </div>
      {data.daily.length > 1 && <div className="card" style={{ marginTop: 12 }}>
        <h3>Visitors and page views by day</h3>
        <div style={{ width: '100%', height: 240 }}><ResponsiveContainer><LineChart data={data.daily} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={p.line} vertical={false} /><XAxis dataKey="day" tick={{ fontSize: 11, fill: p.muted }} tickFormatter={(d: string) => d.slice(5)} /><YAxis tick={{ fontSize: 11, fill: p.muted }} allowDecimals={false} />
          <Tooltip {...tooltipStyle()} /><Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="visitors" name="Visitors" stroke={p.series[0]} strokeWidth={2.5} dot={false} /><Line type="monotone" dataKey="views" name="Page views" stroke={p.series[2]} strokeWidth={2} dot={false} />
        </LineChart></ResponsiveContainer></div>
      </div>}
      <div className="grid cols-2" style={{ marginTop: 12 }}>
        <TrafficTable title="Most viewed pages" head={['Page', 'Views', 'Visitors']} rows={data.pages.map((r) => [<a key="l" href={import.meta.env.BASE_URL.replace(/\/$/, '') + r.path} target="_blank" rel="noopener noreferrer">{label(r.path)}</a>, n(r.views), n(r.visitors)])} empty="No page views yet." />
        <div className="grid" style={{ alignContent: 'start' }}>
          <TrafficTable title="Sections" head={['Section', 'Views', 'Visitors']} rows={data.sections.map((r) => [r.section, n(r.views), n(r.visitors)])} empty="No page views yet." />
          <TrafficTable title="Where visits came from" head={['Site', 'Visits']} rows={data.referrers.map((r) => [r.referrer, n(r.visits)])} empty="No referring sites yet. Visits typed in directly or from apps that hide the referrer aren't listed." />
          <TrafficTable title="Devices" head={['Device', 'Visitors']} rows={data.devices.map((r) => [r.device, n(r.visitors)])} empty="No visitors yet." />
        </div>
        <TrafficTable title="What people searched for" head={['Search', 'Times', 'Results']} rows={data.searches.map((r) => [r.term, n(r.times), r.results === 0 ? <span key="z" className="badge warn">none</span> : n(r.results)])} empty="No searches yet." />
        <TrafficTable title="Searches with no results" head={['Search', 'Times']} rows={data.no_result_searches.map((r) => [r.term, n(r.times)])} empty="Every search found something." note="These show what residents look for that the hub doesn't cover yet." />
      </div>
      <TrafficTable title="Questions asked through Ask the records" head={['Question', 'Outcome', 'When']} rows={data.questions.map((r) => [r.question, r.status.replace(/_/g, ' '), relTime(r.created_at)])} empty="No questions asked yet." />
      <p className="tiny muted" style={{ marginTop: 10 }}>Counted without cookies. Visitors are a daily one-way code, so the same person on two days counts twice. Bots, link previews and readers with Do Not Track are not counted. Page counts are kept 400 days, searches 90 days, questions 30 days.</p>
    </>)}
  </>);
}

function TrafficTable({ title, head, rows, empty, note }: { title: string; head: string[]; rows: ReactNode[][]; empty: string; note?: string }) {
  return <div className="card" style={{ margin: 0 }}>
    <h3 style={{ marginBottom: 6 }}>{title}</h3>{note && <p className="small muted" style={{ marginTop: -2 }}>{note}</p>}
    {rows.length === 0 ? <p className="small muted" style={{ margin: 0 }}>{empty}</p> : <div className="table-wrap"><table className="data"><thead><tr>{head.map((h, i) => <th key={h} className={i ? 'num' : ''}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'num' : ''} style={j ? undefined : { wordBreak: 'break-word' }}>{c}</td>)}</tr>)}</tbody></table></div>}
  </div>;
}
