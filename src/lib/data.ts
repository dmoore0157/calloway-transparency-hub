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
import electionsJson from '../../data/elections.json';
import officialsJson from '../../data/officials.json';

export type Member = { id: string; full_name: string; short_name: string; title: string; role: 'judge_executive' | 'magistrate'; district: number | null; term_start?: string | null; term_end?: string | null; active?: boolean; incoming?: boolean; party?: string | null; status_note?: string; next_role?: { title: string; from_date: string } };
export type CandidateLink = { label: string; url: string; kind: string };
export type Candidate = { name: string; party: string; votes: number | null; pct: number | null; result: 'won' | 'lost' | 'withdrew' | 'pending'; member_id: string | null; incumbent: boolean; filed: string | null; links: CandidateLink[]; note: string | null; statement: string | null };
export type Race = { office: string; district: number | null; open_seat?: boolean; nonpartisan?: boolean; note?: string; candidates: Candidate[] };
export type Election = { id: string; date: string; kind: 'general' | 'primary' | 'special'; label: string; status: string; ballots: number | null; ballots_note?: string; sources: CandidateLink[]; notes: string[]; races: Race[] };
export type Officeholder = { member_id: string | null; name: string; party: string | null; since?: string | null; term_end?: string | null; takes_office?: string; phone?: string; address?: string; url?: string; note?: string };
export type Office = { id: string; office: string; body: string; what: string; current: Officeholder; incoming: Officeholder | null; audits?: { year?: number; report?: string; label?: string; href?: string }[] };
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

export const people = membersJson.members as Member[];
/** Members who have sat on the court (incoming members-elect are excluded until they take office). */
export const members = people.filter((m) => !m.incoming);
export const incomingMembers = people.filter((m) => m.incoming);
export const currentMembers = members.filter((m) => m.active !== false);
export const rosterOn = (date: string) => members.filter((m) => (!m.term_start || m.term_start <= date) && (!m.term_end || m.term_end >= date));
export const memberById = Object.fromEntries(people.map((m) => [m.id, m])) as Record<string, Member>;
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
export const elections = (electionsJson.elections as unknown as Election[]).slice().sort((a, b) => b.date.localeCompare(a.date));
export const electionsMeta = { compiled: electionsJson.compiled, how_compiled: electionsJson.how_compiled };
export const electionById = Object.fromEntries(elections.map((e) => [e.id, e])) as Record<string, Election>;
export const offices = officialsJson.offices as unknown as Office[];
export const officialsMeta = { source: officialsJson.source, officials_url: officialsJson.officials_url, compiled: officialsJson.compiled, term_note: officialsJson.term_note };
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
