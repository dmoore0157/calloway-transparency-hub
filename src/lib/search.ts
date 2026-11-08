import MiniSearch from 'minisearch';
import { motions, meetings, fy2027, enactments, grants, glossary, memberById } from './data';
import { dateShort } from './format';

export type SearchDoc = { id: string; type: 'Motion' | 'Meeting' | 'Budget line' | 'Ordinance' | 'Grant' | 'Glossary' | 'Page'; title: string; body: string; href: string; meta?: string };

const PAGES: SearchDoc[] = [
  { id: 'p-money', type: 'Page', title: 'County Budget overview', body: 'budget spending revenue funds general road jail', href: '/money' },
  { id: 'p-sources', type: 'Page', title: 'Where the money comes from', body: 'revenue property tax intergovernmental fees', href: '/money/sources' },
  { id: 'p-goes', type: 'Page', title: 'Where the money goes', body: 'spending treemap departments categories', href: '/money/where-it-goes' },
  { id: 'p-bva', type: 'Page', title: 'Budget vs. actual', body: 'planned spent variance', href: '/money/budget-vs-actual' },
  { id: 'p-lines', type: 'Page', title: 'Budget line items', body: 'account codes FY2026-27 adopted budget explorer', href: '/money/lines' },
  { id: 'p-grants', type: 'Page', title: 'Grants and outside funding', body: 'state federal bridge grants', href: '/money/grants' },
  { id: 'p-debt', type: 'Page', title: 'Debt and obligations', body: 'loans bonds owed', href: '/money/debt' },
  { id: 'p-votes', type: 'Page', title: 'Vote tracker', body: 'motions seconds roll call', href: '/decisions/votes' },
  { id: 'p-members', type: 'Page', title: 'Fiscal Court members and scorecards', body: 'judge executive magistrates district', href: '/decisions/members' },
  { id: 'p-roads', type: 'Page', title: 'Report a road problem', body: 'pothole washout drainage ticket', href: '/roads/report' },
  { id: 'p-tickets', type: 'Page', title: 'Road tickets map', body: 'open road requests map', href: '/roads' },
  { id: 'p-ideas', type: 'Page', title: 'Suggest an improvement to the hub', body: 'feedback ideas requests', href: '/feedback' },
  { id: 'p-acc', type: 'Page', title: 'Commitments tracker', body: 'promises kept broken accountability', href: '/accountability' },
  { id: 'p-records', type: 'Page', title: 'Reports, audits and sources', body: 'DLG audit documents', href: '/records' },
];

let index: MiniSearch<SearchDoc> | null = null;
export function getIndex() {
  if (index) return index;
  const docs: SearchDoc[] = [...PAGES];
  for (const m of motions) docs.push({ id: 'm-' + m.id, type: 'Motion', title: m.text.replace(/^to /, 'To '), body: `${m.category.join(' ')} ${m.mover ? memberById[m.mover]?.full_name : ''} ${m.seconder ? memberById[m.seconder]?.full_name : ''} ${m.result_label} ${m.note ?? ''}`, href: `/decisions/motions/${m.id}`, meta: dateShort(m.date) });
  for (const mt of meetings) docs.push({ id: 'mt-' + mt.id, type: 'Meeting', title: `Fiscal Court meeting, ${mt.date_label}`, body: mt.summary.join(' '), href: `/decisions/meetings/${mt.id}`, meta: mt.kind });
  for (const l of fy2027.lines) docs.push({ id: 'l-' + l.account + l.fund, type: 'Budget line', title: l.name, body: `${l.fund} ${l.account} ${l.kind}`, href: `/money/lines/${encodeURIComponent(l.account)}`, meta: l.fund });
  for (const e of enactments) docs.push({ id: 'e-' + e.id, type: 'Ordinance', title: `${e.id} ${e.title}`, body: `${e.category} ${e.status ?? ''}`, href: `/decisions/ordinances#${e.id}`, meta: e.category });
  grants.forEach((g, i) => docs.push({ id: 'g-' + i, type: 'Grant', title: g.purpose, body: `${g.prog} ${g.cat} ${g.amt} ${g.stage}`, href: '/money/grants', meta: g.amt }));
  for (const [k, t] of Object.entries(glossary)) docs.push({ id: 'gl-' + k, type: 'Glossary', title: k, body: t.what, href: `/records/glossary#${encodeURIComponent(k)}` });
  index = new MiniSearch<SearchDoc>({ fields: ['title', 'body'], storeFields: ['type', 'title', 'href', 'meta'], searchOptions: { prefix: true, fuzzy: 0.2, boost: { title: 2 } } });
  index.addAll(docs);
  return index;
}
