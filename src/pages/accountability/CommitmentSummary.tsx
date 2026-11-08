import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAsync } from '../../lib/useAsync';
import { backendReady } from '../../lib/supabase';
import { Section, StatusBadge } from '../../components/ui';

/** Compact promise-keeping summary used on member scorecards. */
export function CommitmentSummary({ memberId }: { memberId: string }) {
  const { data: scores } = useAsync(() => api.scores(), [memberId], []);
  const { data: list } = useAsync(() => api.commitments(memberId), [memberId], []);
  if (!backendReady) return null;
  const s = scores.find((x) => x.member_id === memberId);
  return (
    <>
      <Section title="Commitments and promises" action={<Link to={`/accountability/${memberId}`} className="small">All commitments ›</Link>} />
      <div className="card">
        {!s || s.scoreable_total === 0 ? <p className="small muted" style={{ margin: 0 }}>No scoreable commitments have been logged for this official yet. Campaign and in-office commitments are added with their source and the test that will decide them, before any rating. <Link to="/accountability/methodology">How this works ›</Link></p> : (
          <>
            <div className="row" style={{ gap: 14 }}>
              <div><div className="small muted">Kept</div><strong style={{ fontSize: 20, color: 'var(--ok)' }}>{s.kept}</strong></div>
              <div><div className="small muted">Compromise</div><strong style={{ fontSize: 20 }}>{s.compromise}</strong></div>
              <div><div className="small muted">Broken</div><strong style={{ fontSize: 20, color: 'var(--bad)' }}>{s.broken}</strong></div>
              <div><div className="small muted">Pending</div><strong style={{ fontSize: 20 }}>{s.pending}</strong></div>
              <div style={{ marginLeft: 'auto' }}><div className="small muted">Promise-keeping score</div><strong style={{ fontSize: 20 }}>{s.ranked && s.score != null ? `${Math.round(s.score * 100)}%` : 'Not yet ranked'}</strong><div className="tiny muted">{s.ranked ? `${s.resolved} resolved` : `needs 5 resolved, has ${s.resolved}`}</div></div>
            </div>
            <ul className="list-reset" style={{ marginTop: 10 }}>{list.slice(0, 3).map((c) => <li key={c.id} className="row between small" style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}><Link to={`/accountability/commitments/${c.id}`}>{c.summary}</Link><StatusBadge status={c.current_rating ?? 'not_rated'} /></li>)}</ul>
          </>
        )}
      </div>
    </>
  );
}
