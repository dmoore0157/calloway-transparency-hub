import membersJson from '../../data/members.json';
import meetingsJson from '../../data/meetings.json';
import motionsJson from '../../data/motions.json';
import overviewJson from '../../data/budget/overview.json';
import fy2027Json from '../../data/budget/fy2027.json';
import yearendJson from '../../data/budget/yearend_fy2025.json';
import grantsJson from '../../data/grants.json';
import debtJson from '../../data/debt.json';
import enactmentsJson from '../../data/enactments.json';
import formsJson from '../../data/forms.json';
import glossaryJson from '../../data/glossary.json';
import lawJson from '../../data/law.json';
import roadmapJson from '../../data/roadmap.json';
import auditsJson from '../../data/audits.json';

export type Member = { id: string; full_name: string; short_name: string; title: string; role: 'judge_executive' | 'magistrate'; district: number | null; term_start?: string | null; term_end?: string | null; active?: boolean };
export type Meeting = { id: string; date: string; kind: 'regular' | 'special'; date_label: string; minutes_url: string; absent: string[]; absent_other: string[]; summary: string[]; vote_notes: string[]; source_doc_id: string; extraction?: string };
export type VoteValue = 'aye' | 'nay' | 'abstain' | 'absent' | 'not_recorded';
export type Motion = {
  id: string; meeting_id: string; date: string; seq: number; text: string; mover: string | null; seconder: string | null;
  outcome: 'passed' | 'failed' | 'no_second' | 'tabled' | 'withdrawn'; vote_method: string; result_label: string; note: string | null;
  is_routine: boolean; category: string[]; dollar_amount: number | null; votes: Record<string, VoteValue>; source_doc_id: string; minutes_url: string; fragment?: boolean; text_note?: string | null; extraction?: string;
};
export type BudgetLine = { fund: string; kind: 'revenue' | 'appropriation'; account: string; name: string; amount: number };
export type Grant = { mk: string; cat: string; prog: string; purpose: string; amt: string; match: string; kind: string; stage: string; meeting_id: string | null; minutes_url: string | null };
export type Enactment = { id: string; title: string; category: string; status: string | null; url: string };
export type Term = { badge: string; what: string; why: string };
export type AuditFinding = { id: string; title: string; area: string; kind: string[]; repeat_of: string | null; summary: string; details: string[]; dollars: { label: string; amount: number | null }[]; cause: string; recommendation: string; response: string; response_by: string; auditor_reply: string | null; questioned_costs: number | null; next_status: string | null };
export type Audit = { fy: number; year_end: string; report_url: string; press_url: string | null; report_date: string; released: string | null; auditor: string; judge_executive: string; judge_executive_note?: string; treasurer: string | null; opinions: { regulatory: string; gaap: string; federal_compliance?: string }; single_audit: boolean; major_program?: string; material_weakness: boolean; noncompliance: boolean; totals: { receipts: number; disbursements: number; financing: number; net_change: number; balance_begin: number; balance_end: number }; debt_end: number; findings: AuditFinding[]; prior_findings?: { id: string; status: string }[] };
export type AuditChain = { key: string; label: string; ids: string[]; outcome: string };

export const members = membersJson.members as Member[];
export const currentMembers = members.filter((m) => m.active !== false);
export const rosterOn = (date: string) => members.filter((m) => (!m.term_start || m.term_start <= date) && (!m.term_end || m.term_end >= date));
export const memberById = Object.fromEntries(members.map((m) => [m.id, m])) as Record<string, Member>;
export const meetings = meetingsJson.meetings as unknown as Meeting[];
export const meetingById = Object.fromEntries(meetings.map((m) => [m.id, m])) as Record<string, Meeting>;
export const meetingsMeta = { minutes_index_url: meetingsJson.minutes_index_url, regular_schedule: meetingsJson.regular_schedule };
export const motions = motionsJson.motions as unknown as Motion[];
export const motionNotes = motionsJson.notes;
export const overview = overviewJson;
export const fy2027 = fy2027Json as typeof fy2027Json & { lines: BudgetLine[] };
export const yearend = yearendJson;
export const grants = grantsJson.grants as Grant[];
export const debt = debtJson;
export const enactments = enactmentsJson.enactments as Enactment[];
export const enactmentsMeta = { county_index: enactmentsJson.county_ordinance_index };
export const forms = formsJson.forms as { name: string; label: string | null; url: string }[];
export const links = formsJson.links as Record<string, string>;
export const glossary = glossaryJson.terms as Record<string, Term>;
export const glossaryAliases = glossaryJson.aliases as [string, string][];
export const law = lawJson as Record<string, { law: string; url: string; detail: string }>;
export const audits = (auditsJson.audits as unknown as Audit[]).slice().sort((a, b) => b.fy - a.fy);
export const auditsMeta = { source: auditsJson.source, index_url: auditsJson.index_url, compiled: auditsJson.compiled, how_compiled: auditsJson.how_compiled, gaps: auditsJson.gaps as { fy: number; note: string }[], chains: auditsJson.chains as AuditChain[] };
export const auditByFy = Object.fromEntries(audits.map((a) => [String(a.fy), a])) as Record<string, Audit>;
export const findingById = Object.fromEntries(audits.flatMap((a) => a.findings.map((f) => [f.id, { ...f, fy: a.fy }]))) as Record<string, AuditFinding & { fy: number }>;
export const roadmap = roadmapJson as Record<string, { see: string; how: string; why: string; needs: string }>;

export const CATEGORY_ORDER = [
  'Roads & bridges', 'Budget & finance', 'Ordinances & resolutions', 'Appointments & boards', 'Personnel', 'Contracts & bids',
  'Property & surplus', 'Public safety', 'Grants & outside funding', 'Meetings & procedure', 'Other',
];

export function findTerm(name: string): Term | undefined {
  if (glossary[name]) return glossary[name];
  const lower = name.toLowerCase();
  for (const [alias, key] of glossaryAliases) if (lower.includes(alias) && glossary[key]) return glossary[key];
  return undefined;
}

export const fundLawKey: Record<string, string> = { 'General Fund': 'generalFund', 'Road Fund': 'roadFund', 'Jail Fund': 'jailFund' };
