// Builds the retrieval corpus the "Ask the records" assistant searches (dist/data/ai-corpus.json).
// Every record carries the hub page it comes from and, where one exists, the original public document.
// The assistant may only state what these records (or its exact-count tools over them) contain.
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'dist/data/ai-corpus.json';
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const members = read('data/members.json').members;
const meetings = read('data/meetings.json').meetings;
const motions = read('data/motions.json').motions;
const overview = read('data/budget/overview.json');
const fy2027 = read('data/budget/fy2027.json');
const yearend = read('data/budget/yearend_fy2025.json');
const grants = read('data/grants.json').grants;
const debt = read('data/debt.json');
const enactments = read('data/enactments.json');
const glossary = read('data/glossary.json').terms;
const law = read('data/law.json');
const audits = read('data/audits.json');
const elections = read('data/elections.json').elections;
const officials = read('data/officials.json');
const checks = read('data/record_checks.json');
const issues = read('data/issues.json').issues;

const byId = Object.fromEntries(members.map((m) => [m.id, m]));
const name = (id) => (id ? byId[id]?.full_name ?? id : 'not named');
const usd = (n) => (n == null ? '' : '$' + Math.round(n).toLocaleString('en-US'));
const usd2 = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rosterOn = (date) => members.filter((m) => !m.incoming && (!m.term_start || m.term_start <= date) && (!m.term_end || m.term_end >= date));
const voteWord = { aye: 'aye', nay: 'nay', abstain: 'abstained', absent: 'absent', not_recorded: 'vote not recorded' };
const records = [];
const add = (r) => records.push({ tags: [], members: [], ...r });

// Motions
for (const m of motions) {
  const votes = Object.entries(m.votes).map(([id, v]) => `${name(id)}: ${voteWord[v] ?? v}`).join('; ');
  add({
    id: `motion:${m.id}`, type: 'motion', date: m.date,
    title: `Motion ${m.date}: ${m.text}`,
    text: `Fiscal Court motion at the meeting of ${m.date}: "${m.text}". Moved by ${name(m.mover)}${m.seconder ? `, seconded by ${name(m.seconder)}` : ', no second recorded'}. Result: ${m.result_label} (${m.outcome}). Votes: ${votes}.${m.note ? ` Note: ${m.note}.` : ''}${m.dollar_amount ? ` Dollar amount named: ${usd(m.dollar_amount)}.` : ''} Topics: ${m.category.join(', ')}.${m.is_routine ? ' Routine item.' : ''}${m.fragment ? ' The motion text in the minutes is incomplete.' : ''}${m.extraction === 'hub-2026-11' ? ' Transcribed by the hub in November 2026 and not yet independently reviewed.' : ''}`,
    url: `/decisions/motions/${m.id}`, source_url: m.minutes_url, source_label: `Fiscal Court minutes, ${m.date}`,
    members: [m.mover, m.seconder].filter(Boolean), tags: m.category,
  });
}

// Meetings
for (const mt of meetings) {
  const present = rosterOn(mt.date).filter((x) => !mt.absent.includes(x.id)).map((x) => x.full_name);
  add({
    id: `meeting:${mt.id}`, type: 'meeting', date: mt.date,
    title: `Fiscal Court ${mt.kind} meeting, ${mt.date_label}`,
    text: `Fiscal Court ${mt.kind} meeting on ${mt.date_label}. Present: ${present.join(', ') || 'not recorded'}. Absent: ${mt.absent.map(name).join(', ') || 'none'}. Summary: ${mt.summary.join(' ')} ${mt.vote_notes?.length ? 'Vote notes: ' + mt.vote_notes.join(' ') : ''} Motions at this meeting: ${motions.filter((x) => x.meeting_id === mt.id).length}.`,
    url: `/decisions/meetings/${mt.id}`, source_url: mt.minutes_url, source_label: `Fiscal Court minutes, ${mt.date_label}`,
  });
}

// Member fact sheets and issue records
function rx(issue) { return issue.pattern ? new RegExp(issue.pattern, 'i') : null; }
const matchesIssue = (iss, m) => (iss.category && m.category.includes(iss.category)) || (rx(iss) && (rx(iss).test(m.text) || rx(iss).test(m.note ?? '')));
for (const mem of members) {
  const office = officials.offices.find((o) => o.current.member_id === mem.id || o.incoming?.member_id === mem.id);
  const held = motions.filter((m) => rosterOn(m.date).some((r) => r.id === mem.id));
  const sub = held.filter((m) => !m.is_routine);
  const attended = meetings.filter((mt) => rosterOn(mt.date).some((r) => r.id === mem.id));
  const missed = attended.filter((mt) => mt.absent.includes(mem.id));
  const nays = held.filter((m) => m.votes[mem.id] === 'nay'); const abst = held.filter((m) => m.votes[mem.id] === 'abstain');
  const ran = elections.flatMap((e) => e.races.flatMap((r) => r.candidates.filter((c) => c.member_id === mem.id).map((c) => `${e.label}: ${r.office}${r.district ? ` District ${r.district}` : ''}, ${c.party}, ${c.result}${c.votes != null ? `, ${c.votes.toLocaleString('en-US')} votes` : ''}${c.pct != null ? ` (${c.pct}%)` : ''}`)));
  add({
    id: `member:${mem.id}`, type: 'member', date: null,
    title: `${mem.full_name}, ${mem.title}`,
    text: mem.incoming
      ? `${mem.full_name} is ${mem.title}${mem.party ? ` (${mem.party})` : ''}. ${mem.status_note ?? ''} Has no Fiscal Court voting record in the hub because the term starts ${mem.term_start}. Elections: ${ran.join('; ') || 'none on file'}.`
      : `${mem.full_name}, ${mem.title}${mem.party ? `, ${mem.party}` : ''}${mem.active === false ? ' (former member)' : ''}. ${mem.status_note ?? ''} In the minutes the hub tracks (November 17, 2021 to September 16, 2026): attended ${attended.length - missed.length} of ${attended.length} meetings held during the term${missed.length ? `, missed ${missed.map((x) => x.date).join(', ')}` : ''}; made ${sub.filter((m) => m.mover === mem.id).length} substantive motions and seconded ${sub.filter((m) => m.seconder === mem.id).length}; recorded nay votes: ${nays.length}${nays.length ? ` (${nays.map((m) => `${m.date} "${m.text}"`).join('; ')})` : ''}; abstentions: ${abst.length}${abst.length ? ` (${abst.map((m) => `${m.date} "${m.text}"`).join('; ')})` : ''}. Elections: ${ran.join('; ') || 'none on file'}.${office?.current?.phone && office.current.member_id === mem.id ? ` Office phone: ${office.current.phone}.` : ''} Minutes before November 2021 are not posted by the county, so earlier service cannot be checked.`,
    url: `/leaders/${mem.id}`, source_url: null, source_label: 'Hub profile compiled from Fiscal Court minutes and election results', members: [mem.id],
  });
  if (mem.incoming) continue;
  for (const iss of issues) {
    const ms = held.filter((m) => matchesIssue(iss, m));
    const c = (f) => ms.filter(f).length;
    add({
      id: `issue:${mem.id}:${iss.id}`, type: 'issue_record', date: null,
      title: `${mem.full_name}'s record on ${iss.label.toLowerCase()}`,
      text: `${mem.full_name}'s record on "${iss.label}" in the Fiscal Court minutes (November 2021 to September 2026, during the member's term): ${ms.length} motions on this issue; moved ${c((m) => m.mover === mem.id)}, seconded ${c((m) => m.seconder === mem.id)}, voted aye ${c((m) => m.votes[mem.id] === 'aye')}, nay ${c((m) => m.votes[mem.id] === 'nay')}, abstained ${c((m) => m.votes[mem.id] === 'abstain')}, absent ${c((m) => m.votes[mem.id] === 'absent')}. Why it matters: ${iss.why} Motions moved or seconded: ${ms.filter((m) => m.mover === mem.id || m.seconder === mem.id).slice(0, 15).map((m) => `${m.id} "${m.text}"`).join('; ') || 'none'}.`,
      url: `/leaders/${mem.id}`, source_url: null, source_label: 'Hub issue record compiled from Fiscal Court minutes', members: [mem.id], tags: [iss.label],
    });
  }
}

// Record checks
for (const c of checks.checks) {
  add({
    id: `check:${c.id}`, type: 'record_check', date: c.statement.said_on,
    title: `${name(c.member_id)}: ${c.topic} (statement checked against the minutes)`,
    text: `${name(c.member_id)} said on ${c.statement.said_on} (${c.statement.source_label}): "${c.statement.quote}" The hub's finding: ${c.label} (label: ${checks.labels[c.record]}). What the minutes show: ${c.what_minutes_show.join(' ')} Related motions: ${c.motion_ids.join(', ') || 'none'}. ${checks.period}`,
    url: `/leaders/${c.member_id}#${c.id}`, source_url: c.statement.source_url, source_label: c.statement.source_label, members: [c.member_id],
  });
}

// Audits
for (const a of audits.audits) {
  add({
    id: `audit:${a.fy}`, type: 'audit', date: a.report_date,
    title: `State audit of the Fiscal Court, fiscal year ${a.fy}`,
    text: `Kentucky Auditor of Public Accounts audit of the Calloway County Fiscal Court for the year ended ${a.year_end}. Report dated ${a.report_date}${a.released ? `, released ${a.released}` : ''}; auditor ${a.auditor}; Judge/Executive ${a.judge_executive}${a.treasurer ? `; Treasurer ${a.treasurer}` : ''}. Opinion on the regulatory (cash) basis: ${a.opinions.regulatory}; opinion on GAAP: ${a.opinions.gaap}${a.opinions.federal_compliance ? `; federal compliance opinion: ${a.opinions.federal_compliance}` : ''}. Material weakness reported: ${a.material_weakness ? 'yes' : 'no'}; material noncompliance: ${a.noncompliance ? 'yes' : 'no'}. All-funds receipts ${usd(a.totals.receipts)}, disbursements ${usd(a.totals.disbursements)}, loan proceeds ${usd(a.totals.financing)}, change in fund balances ${usd(a.totals.net_change)}, fund balances June 30 ${usd(a.totals.balance_end)}, long-term debt June 30 ${usd(a.debt_end)}. Findings (${a.findings.length}): ${a.findings.map((f) => `${f.id} ${f.title}${f.repeat_of ? ` (repeat of ${f.repeat_of})` : ''}`).join('; ') || 'none'}.`,
    url: `/records/audits/${a.fy}`, source_url: a.report_url, source_label: `Report of the Audit of the Calloway County Fiscal Court, FY${a.fy}`,
  });
  for (const f of a.findings) {
    add({
      id: `finding:${f.id}`, type: 'audit_finding', date: a.report_date,
      title: `Audit finding ${f.id}: ${f.title}`,
      text: `State audit finding ${f.id} (fiscal year ${a.fy}), area: ${f.area}; classified as ${f.kind.join(' and ')}${f.repeat_of ? `; repeat of ${f.repeat_of}` : ''}. ${f.summary} Details: ${f.details.join(' ')} Dollar figures: ${f.dollars.filter((d) => d.amount != null).map((d) => `${d.label} ${usd(d.amount)}`).join('; ') || 'none'}. Cause per the report: ${f.cause} Recommendation: ${f.recommendation} County response (${f.response_by}): "${f.response}"${f.auditor_reply ? ` Auditor's reply: ${f.auditor_reply}` : ''}${f.questioned_costs != null ? ` Questioned federal costs: ${usd(f.questioned_costs)}.` : ''} What happened next: ${f.next_status ?? 'not stated'}.`,
      url: `/records/audits/${a.fy}#${f.id}`, source_url: a.report_url, source_label: `FY${a.fy} audit report, Schedule of Findings`,
    });
  }
}
for (const c of audits.chains) add({ id: `audit-chain:${c.key}`, type: 'audit', date: null, title: `Repeat audit problem: ${c.label}`, text: `Audit findings that repeated across years on "${c.label}": ${c.ids.join(', ')}. Outcome: ${c.outcome}`, url: '/records/audits', source_url: audits.index_url, source_label: 'Kentucky Auditor of Public Accounts' });
for (const g of audits.gaps) add({ id: `audit-gap:${g.fy}`, type: 'audit', date: null, title: `No audit available for FY${g.fy}`, text: g.note, url: '/records/audits', source_url: audits.index_url, source_label: 'Kentucky Auditor of Public Accounts released-audits list' });

// Budget: multi-year overview, budget vs actual per year, FY2027 funds and lines, FY2025 year-end lines
const yrs = overview.years;
add({ id: 'budget:revenue-history', type: 'budget', date: null, title: 'County revenue by source, FY2018 to FY2025', text: `General Fund revenue by source by fiscal year (${yrs.join(', ')}). Record type by year: ${yrs.map((y, i) => `FY${y} ${overview.source_labels[overview.source_by_year[i]]}`).join('; ')}. ${overview.revenue_sources.map((s) => `${s.name}: ${s.values.map((v, i) => `FY${yrs[i]} ${usd(v)}`).join(', ')}`).join('. ')}. Total revenue: ${overview.revenue_total_by_year.map((v, i) => `FY${yrs[i]} ${usd(v)}`).join(', ')}.`, url: '/money/sources', source_url: null, source_label: 'State audits (FY2018-21) and county filings to the Department for Local Government (FY2022-25)' });
add({ id: 'budget:fund-spending', type: 'budget', date: null, title: 'Spending by fund, FY2018 to FY2025', text: `Actual spending by fund: ${Object.entries(overview.funds).map(([f, v]) => `${f}: ${v.map((x, i) => `FY${yrs[i]} ${usd(x)}`).join(', ')}`).join('. ')}. General Fund spending record type: ${overview.general_fund_spending.map((r) => `${r.y} ${r.src}`).join(', ')}. Population used for per-resident figures: ${overview.population.toLocaleString('en-US')}. Latest General Fund spending FY${overview.stats.latestFY}: ${usd(overview.stats.latestSpend)}, ${overview.stats.latestYoY}% over the prior year, ${usd(overview.stats.latestPerRes)} per resident; 8-year average ${usd(overview.stats.avgSpend)}; growth over the period ${overview.stats.growth}%.`, url: '/money', source_url: null, source_label: 'State audits and county filings' });
for (const [fy, cats] of Object.entries(overview.budget_vs_actual.by_year)) {
  const b = Object.values(cats).reduce((s, v) => s + v.b, 0); const a = Object.values(cats).reduce((s, v) => s + v.a, 0);
  add({ id: `budget:bva:${fy}`, type: 'budget', date: null, title: `General Fund budget vs. actual, ${fy}`, text: `General Fund ${fy}, budgeted versus actually spent (${overview.budget_vs_actual.source_by_year[fy]} record): total budgeted ${usd(b)}, actual ${usd(a)}, ${Math.round((a / b) * 100)}% of plan used. By category: ${Object.entries(cats).map(([k, v]) => `${overview.budget_vs_actual.labels[k] ?? k} budgeted ${usd(v.b)}, actual ${usd(v.a)}`).join('; ')}.`, url: '/money/budget-vs-actual', source_url: null, source_label: `${overview.budget_vs_actual.source_by_year[fy] === 'audited' ? 'State audit' : 'County filing'}, ${fy}` });
}
add({ id: 'budget:fy2027', type: 'budget', date: null, title: `Adopted budget ${fy2027.label}`, text: `Calloway County adopted budget for ${fy2027.summary.period}: total ${usd2(fy2027.summary.total)} across all funds. ${fy2027.summary.funds.map((f) => `${f.name}: ${usd2(f.total)} (${f.pct}) - ${f.note} Appropriations: ${f.app.map(([k, v]) => `${k} ${usd2(v)}`).join(', ')}. Revenue: ${f.rev.map(([k, v]) => `${k} ${usd2(v)}`).join(', ')}.`).join(' ')}`, url: '/money/lines', source_url: null, source_label: 'Adopted budget, uniform DLG form' });
for (const l of fy2027.lines) add({ id: `line:${l.fund}:${l.account}`, type: 'budget_line', date: null, title: `${l.name} (${l.fund} Fund, ${l.account})`, text: `FY2026-27 adopted budget line ${l.account} "${l.name}" in the ${l.fund} Fund, ${l.kind}: ${usd2(l.amount)}.`, url: `/money/lines/${encodeURIComponent(l.account)}`, source_url: null, source_label: 'FY2026-27 adopted budget' });
const yeCats = {}; for (const l of yearend.lines) (yeCats[l.c] ??= []).push(l);
for (const [cat, ls] of Object.entries(yeCats)) add({ id: `yearend:${cat}`, type: 'budget', date: null, title: `FY2024-25 General Fund spending: ${cat}`, text: `County year-end report, FY2024-25 General Fund spending in "${cat}": total ${usd2(ls.reduce((s, l) => s + l.a, 0))}. Lines: ${ls.map((l) => `${l.n} ${usd2(l.a)}`).join('; ')}.`, url: '/money/where-it-goes', source_url: null, source_label: 'County year-end General Fund report, FY2024-25' });

// Grants, debt, ordinances, glossary, law
grants.forEach((g, i) => add({ id: `grant:${i}`, type: 'grant', date: g.meeting_id, title: `Grant: ${g.purpose}`, text: `Grant or outside funding: ${g.purpose}. Program: ${g.prog}. Category: ${g.cat}. Amount: ${g.amt}${g.match ? `; match ${g.match}` : ''}. Source type: ${g.kind}. Stage: ${g.stage}.${g.meeting_id ? ` Recorded at the meeting of ${g.meeting_id}.` : ''}`, url: '/money/grants', source_url: g.minutes_url, source_label: g.minutes_url ? 'Fiscal Court minutes' : 'Hub grants list' }));
add({ id: 'debt:summary', type: 'debt', date: null, title: 'County debt', text: `Current debt: ${debt.current.purpose}, ${usd(debt.current.orig)} at ${debt.current.rate}, ${debt.current.term}, lender ${debt.current.lender}, approved ${debt.current.date}. At the June 30, 2021 audit: total owed ${usd(debt.total)}; items: ${debt.items.map((d) => `${d.n} original ${usd(d.orig)}, balance ${usd(d.bal)}, ${d.rate}, matures ${d.matures}`).join('; ')}. ${debt.retired.note} Long-term debt at each audit: ${audits.audits.map((a) => `June 30, ${a.fy} ${usd(a.debt_end)}`).join('; ')}.`, url: '/money/debt', source_url: debt.current.u, source_label: 'Fiscal Court minutes and state audits' });
for (const e of enactments.enactments) add({ id: `ordinance:${e.id}`, type: 'ordinance', date: null, title: `Ordinance ${e.id}: ${e.title}`, text: `County ordinance ${e.id} "${e.title}", category ${e.category}${e.status ? `, status: ${e.status}` : ''}.`, url: `/decisions/ordinances#${e.id}`, source_url: e.url, source_label: `Ordinance ${e.id} (county PDF)` });
for (const [k, t] of Object.entries(glossary)) add({ id: `glossary:${k}`, type: 'glossary', date: null, title: `Glossary: ${k}`, text: `${k}: ${t.what} Why it matters: ${t.why}`, url: `/records/glossary#${encodeURIComponent(k)}`, source_url: null, source_label: 'Hub glossary' });
for (const [k, l] of Object.entries(law)) add({ id: `law:${k}`, type: 'law', date: null, title: `Law: ${l.law}`, text: `${l.law}: ${l.detail}`, url: '/records', source_url: l.url, source_label: l.law });

// Elections, offices
for (const e of elections) {
  add({ id: `election:${e.id}`, type: 'election', date: e.date, title: e.label, text: `${e.label} in Calloway County. Status: ${e.status}.${e.ballots ? ` Ballots cast: ${e.ballots.toLocaleString('en-US')}.` : ''} ${e.ballots_note ?? ''} ${e.notes.join(' ')} Races: ${e.races.map((r) => `${r.office}${r.district ? ` District ${r.district}` : ''}`).join('; ')}.`, url: `/leaders/elections/${e.id}`, source_url: e.sources[0]?.url ?? null, source_label: e.sources[0]?.label ?? 'Election results' });
  for (const r of e.races) {
    const label = `${r.office}${r.district ? `, District ${r.district}` : ''}`;
    add({ id: `race:${e.id}:${label}`.replace(/\s+/g, '-').toLowerCase(), type: 'election_race', date: e.date, title: `${e.label}: ${label}`, text: `${e.label}, race for ${label}.${r.open_seat ? ' Open seat.' : ''} ${r.note ?? ''} Candidates: ${r.candidates.map((c) => `${c.name} (${c.party}${c.incumbent ? ', incumbent' : ''}): ${c.result}${c.votes != null ? `, ${c.votes.toLocaleString('en-US')} votes` : ''}${c.pct != null ? `, ${c.pct}%` : ''}${c.filed ? `, filed ${c.filed}` : ''}${c.note ? `. ${c.note}` : ''}${c.links.length ? `. Published statements and campaign pages: ${c.links.map((l) => `${l.label} ${l.url}`).join('; ')}` : ''}`).join(' | ') || 'No candidate filed.'} Status: ${e.status}.`, url: `/leaders/elections/${e.id}`, source_url: e.sources[0]?.url ?? null, source_label: e.sources[0]?.label ?? 'Election results', members: r.candidates.map((c) => c.member_id).filter(Boolean) });
  }
}
for (const o of officials.offices) add({ id: `office:${o.id}`, type: 'office', date: null, title: `${o.office}: ${o.current.name}`, text: `${o.office} (${o.body}). What the office does: ${o.what} Current holder: ${o.current.name}${o.current.party ? ` (${o.current.party})` : ''}${o.current.since ? `, in office since ${o.current.since}` : ''}${o.current.term_end ? `, term ends ${o.current.term_end}` : ''}. ${o.current.note ?? ''}${o.current.phone ? ` Phone ${o.current.phone}.` : ''}${o.current.address ? ` Address ${o.current.address}.` : ''}${o.incoming ? ` Incoming: ${o.incoming.name}${o.incoming.party ? ` (${o.incoming.party})` : ''} takes office ${o.incoming.takes_office}.` : ''}${o.audits?.length ? ` State audits of this office: ${o.audits.filter((x) => x.report).map((x) => `${x.label} ${x.report}`).join('; ')}.` : ''}`, url: o.current.member_id ? `/leaders/${o.current.member_id}` : `/leaders/office/${o.id}`, source_url: officials.officials_url, source_label: 'County elected officials page' });

// About the hub itself, so "how does this site work" questions are answerable from records too
add({ id: 'hub:about', type: 'hub', date: null, title: 'About the Calloway County Transparency Hub', text: 'The Calloway County Transparency Hub is an independent, nonpartisan public-records project, not affiliated with county government or any candidate. It publishes budgets, state audits, Fiscal Court meetings, motions and votes, official profiles, election results, promise tracking, and resident road requests. Figures are labeled as audited (state audits) or county-reported (filings to the Department for Local Government) and never blended. Motions and votes are compiled from the official minutes, which the county has posted from November 17, 2021; earlier minutes are not posted. When minutes say "all voted aye", every present member is recorded as aye. Residents can report a road problem at /roads/report and flag any error on any page.', url: '/records/about', source_url: null, source_label: 'Hub methodology' });

const meta = { built: new Date().toISOString().slice(0, 10), count: records.length, coverage: { minutes: `${meetings.at(-1)?.date ?? ''} to ${meetings[0]?.date ?? ''}`, meetings: meetings.length, motions: motions.length, audits: audits.audits.map((a) => a.fy), elections: elections.map((e) => e.id) }, members: members.map((m) => ({ id: m.id, name: m.full_name, short: m.short_name, title: m.title, incoming: Boolean(m.incoming), term_start: m.term_start ?? null, term_end: m.term_end ?? null })), categories: [...new Set(motions.flatMap((m) => m.category))] };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ meta, records, motions: motions.map((m) => ({ id: m.id, date: m.date, meeting_id: m.meeting_id, text: m.text, mover: m.mover, seconder: m.seconder, outcome: m.outcome, result: m.result_label, votes: m.votes, category: m.category, routine: m.is_routine, dollars: m.dollar_amount, note: m.note, url: m.minutes_url })) }));
console.log(`ai corpus: ${records.length} records, ${motions.length} motions -> ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
