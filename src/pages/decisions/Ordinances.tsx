import { useMemo, useState } from 'react';
import { enactments, enactmentsMeta, motions, forms, links } from '../../lib/data';
import { Section, SourceNote, Empty, Ext } from '../../components/ui';
import { Link } from 'react-router-dom';

export default function Ordinances() {
  const [q, setQ] = useState(''); const cats = Array.from(new Set(enactments.map((e) => e.category)));
  const rows = useMemo(() => enactments.filter((e) => !q || `${e.id} ${e.title} ${e.category}`.toLowerCase().includes(q.toLowerCase())), [q]);
  const related = (id: string) => motions.filter((m) => m.text.toLowerCase().includes(id.toLowerCase().replace(/^#/, '')));
  return (
    <>
      <p className="lede">{enactments.length} Calloway County ordinances by category, each linked to the county's own PDF. Search by number or topic. Where a tracked motion adopted or amended an ordinance, it is linked.</p>
      <input className="input" placeholder="Search ordinances (e.g. 23-0134, solar, cannabis, tax)…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search ordinances" />
      {rows.length === 0 && <Empty>No ordinances match.</Empty>}
      {cats.map((c) => { const items = rows.filter((e) => e.category === c); if (!items.length) return null; return (
        <div key={c}><Section title={c} />
          <div className="card"><table className="data"><thead><tr><th>Number</th><th>Subject</th><th>Status</th><th>Record</th></tr></thead>
            <tbody>{items.map((e) => { const rel = related(e.id); return <tr key={e.id} id={e.id}><td style={{ whiteSpace: 'nowrap' }}>{e.id}</td><td>{e.title}{rel.length > 0 && <div className="small">{rel.map((m) => <Link key={m.id} to={`/decisions/motions/${m.id}`}>Motion {m.date} ›</Link>)}</div>}</td><td className="small muted">{e.status ?? ''}</td><td><Ext href={e.url}>PDF</Ext></td></tr>; })}</tbody></table></div>
        </div>); })}
      <Section title="County forms and petitions" />
      <div className="card"><ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>{forms.map((f) => <li key={f.url}><Ext href={f.url}>{f.name}</Ext>{f.label && <span className="small muted"> · {f.label}</span>}{f.name.includes('Road Concern') && <> · <Link to="/roads/report">or use the hub's public road ticket</Link></>}</li>)}</ul></div>
      <SourceNote>Calloway County Fiscal Court ordinance records, <Ext href={enactmentsMeta.county_index ?? links.ordinances}>callowaycountyky.gov/ordinances</Ext>. Category labels are the hub's.</SourceNote>
    </>
  );
}
