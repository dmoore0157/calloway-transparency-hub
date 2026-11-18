// Offline tests for the "Ask the records" core: retrieval tools, figure checks, citation checks,
// and the tool loop driven by a scripted fake model. No API key or network needed.
//   node scripts/test-ask.mjs [path/to/ai-corpus.json]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

const corpusPath = process.argv[2] || path.join(os.tmpdir(), 'ai-corpus-test.json');
if (!process.argv[2]) execFileSync('node', ['scripts/build-ai-corpus.mjs', corpusPath], { stdio: 'inherit' });
const outfile = path.join(os.tmpdir(), `ask-core-${process.pid}.mjs`);
await build({ stdin: { contents: "export * from './agent.ts'; export * from './core.ts';", resolveDir: 'supabase/functions/ask', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile, alias: { 'npm:minisearch@7.2.0': 'minisearch' }, logLevel: 'warning' });
const mod = await import(outfile);
const core = mod;
const { ask } = mod; const { Index, runTool, unverifiedFigures, extractFigures, evalArithmetic, finalize } = core;

let pass = 0, failn = 0;
const t = (name, cond, extra = '') => { if (cond) { pass++; } else { failn++; console.log(`FAIL ${name} ${extra}`); } };

const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
const index = new Index(corpus);
const live = { commitments: async () => ({ records: [{ id: 'commitment:6', title: 'Commitment #6', type: 'commitment', url: '/leaders/commitments/6', source_url: null, source_label: 'tracker', date: '2026-10-28', text: 'Commitment #6 rating not_rated' }], summary: 'id: commitment:6\nCommitment #6 rating not_rated' }), roadRequests: async () => ({ records: [], summary: 'none' }) };
const newCtx = () => ({ index, live, registry: new Map(), evidence: [] });
const SITE = 'https://dmoore0157.github.io/calloway-transparency-hub';

// Tools
{
  const ctx = newCtx();
  const r = await runTool('search_records', { query: 'animal shelter', types: null, member: null, limit: 8 }, ctx);
  t('search finds shelter records', /shelter/i.test(r.text) && ctx.registry.size > 0);
  const r2 = await runTool('search_records', { query: 'purchase orders after the expense', types: ['audit_finding'], member: null, limit: 5 }, ctx);
  t('search audit findings by type', /finding:202[345]-00\d/.test(r2.text), r2.text.slice(0, 200));
  const q = await runTool('query_motions', { member: 'rister', role: 'moved', category: null, text_contains: null, date_from: null, date_to: null, outcome: null, include_routine: false, limit: 5 }, ctx);
  const sheet = corpus.records.find((x) => x.id === 'member:rister').text;
  const n = Number(/Matching motions: (\d+)/.exec(q.text)[1]); const sheetN = Number(/made (\d+) substantive motions/.exec(sheet)[1]);
  t('query_motions matches fact sheet count', n === sheetN, `${n} vs ${sheetN}`);
  const nay = await runTool('query_motions', { member: 'Crutcher', role: 'voted_nay', category: null, text_contains: null, date_from: null, date_to: null, outcome: null, include_routine: true, limit: 10 }, ctx);
  t('query_motions by name and nay', /Matching motions: [1-9]/.test(nay.text), nay.text.slice(0, 120));
  const unknown = await runTool('query_motions', { member: 'Smith', role: 'moved', category: null, text_contains: null, date_from: null, date_to: null, outcome: null, include_routine: false, limit: 5 }, ctx);
  t('unknown member reported', /Unknown member/.test(unknown.text));
  const c = await runTool('calculate', { expression: '37 / 70', label: 'share late' }, ctx);
  t('calculate', /0\.5286/.test(c.text) && /52\.86%/.test(c.text), c.text);
  t('arithmetic parser rejects code', evalArithmetic('process.exit()') === null && evalArithmetic('2*(3+4)') === 14);
  const g = await runTool('get_records', { ids: ['audit:2025', 'nope:1'] }, ctx);
  t('get_records full text and not found', /Findings \(1\)/.test(g.text) && /NOT FOUND/.test(g.text));
}

// Figure checks
{
  const ev = ['Thirty-seven of 70 disbursements, totaling $2,996,752, had purchase orders issued after the expense. Total 15,424,444. 61.49% of the vote.'];
  t('exact figure ok', unverifiedFigures('Late purchase orders covered $2,996,752 [1].', ev).length === 0);
  t('rounded million ok', unverifiedFigures('About $3.0 million [1] and $15.4 million [1].', ev).length === 0);
  t('rounded percent ok', unverifiedFigures('He won 61% [1] or 61.5% [1].', ev).length === 0);
  t('invented figure flagged', unverifiedFigures('The county spent $5,000,000 [1].', ev).join() === '$5,000,000');
  t('wrong rounding flagged', unverifiedFigures('About $3.2 million [1].', ev).length === 1);
  t('dates, ids, districts ignored', unverifiedFigures('On May 20, 2026, motion 2024-08-21-10 in District 4 under KRS 68.210 and finding 2024-001, Resolution 24-0821-B, FY2025 [1].', ev).length === 0, JSON.stringify(extractFigures('On May 20, 2026, motion 2024-08-21-10 in District 4 under KRS 68.210 and finding 2024-001, Resolution 24-0821-B, FY2025 [1].')));
}

// finalize: citations
{
  const ctx = newCtx();
  await runTool('get_records', { ids: ['audit:2025'] }, ctx);
  const ok = finalize({ status: 'answered', title: 'FY2025', answer_markdown: 'The FY2025 audit had 1 finding [1].', source_ids: ['audit:2025'], follow_up_questions: [] }, ctx, SITE, false);
  t('finalize ok', ok.problems.length === 0 && ok.answer.sources[0].url.startsWith(SITE), JSON.stringify(ok.problems));
  const badId = finalize({ status: 'answered', title: 'x', answer_markdown: 'Claim [1].', source_ids: ['audit:2019'], follow_up_questions: [] }, ctx, SITE, false);
  t('unretrieved source rejected', badId.problems.some((p) => /not retrieved/.test(p)));
  const noCite = finalize({ status: 'answered', title: 'x', answer_markdown: 'The audit had findings.', source_ids: ['audit:2025'], follow_up_questions: [] }, ctx, SITE, false);
  t('missing markers rejected', noCite.problems.some((p) => /no citation markers/.test(p)));
  const oos = finalize({ status: 'out_of_scope', title: 'Weather', answer_markdown: 'It will rain tomorrow.', source_ids: [], follow_up_questions: [] }, ctx, SITE, false);
  t('out of scope uses template only', !/rain/.test(oos.answer.answer));
  const link = finalize({ status: 'answered', title: 'x', answer_markdown: 'See [this](https://evil.example/x) and https://evil.example/y for the 1 finding [1].', source_ids: ['audit:2025'], follow_up_questions: [] }, ctx, SITE, false);
  t('external links stripped', !/evil\.example/.test(link.answer.answer));
}

// finalize: charts and headline numbers follow the same evidence rules as the text
{
  const ctx = newCtx();
  await runTool('calculate', { expression: '2996752 + 126749', label: 'total' }, ctx);
  const calcId = [...ctx.registry.keys()].find((k) => k.startsWith('calc:'));
  await runTool('get_records', { ids: ['audit:2025'] }, ctx);
  const base = { status: 'answered', title: 'x', answer_markdown: 'Totals below [1].', source_ids: ['audit:2025'], follow_up_questions: [], stats: [] };
  const chart = (values, ids = [calcId]) => ({ type: 'column', title: 'Totals', subtitle: '', unit: 'usd', categories: ['A', 'B', 'C'], series: [{ name: 'Amount', values }], highlight: 'C', source_ids: ids });
  const good = finalize({ ...base, charts: [chart([2996752, 126749, 3123501])] }, ctx, SITE, false);
  t('chart with record values accepted', good.problems.length === 0 && good.answer.charts.length === 1 && good.answer.charts[0].highlight === 'C', JSON.stringify(good.problems));
  t('chart source joins the numbered list', good.answer.sources.some((s) => s.id === calcId) && good.answer.charts[0].sources.length === 1);
  const invented = finalize({ ...base, charts: [chart([2996752, 126749, 9999999])] }, ctx, SITE, false);
  t('chart with invented value rejected', invented.problems.some((p) => /9999999/.test(p)));
  const uncited = finalize({ ...base, charts: [chart([2996752, 126749, 3123501], [])] }, ctx, SITE, false);
  t('chart without sources rejected', uncited.problems.some((p) => /must list the ids/.test(p)));
  const ragged = finalize({ ...base, charts: [{ ...chart([1, 2]), categories: ['A', 'B', 'C'] }] }, ctx, SITE, false);
  t('chart with missing values rejected', ragged.problems.some((p) => /one number per category/.test(p)));
  const stat = finalize({ ...base, charts: [], stats: [{ label: 'Total', value: '$3,123,501', note: '' }, { label: 'Made up', value: '$42,000,000', note: '' }] }, ctx, SITE, false);
  t('invented stat rejected, real one kept', stat.problems.some((p) => /Made up/.test(p)) && !stat.problems.some((p) => /"Total"/.test(p)));
  const ascii = finalize({ ...base, answer_markdown: 'Totals below [1].\n\n```\nFY2026 T ████████ $5,702,499.71\n```\n\nDone [1].', charts: [] }, ctx, SITE, false);
  t('text charts removed from the answer', !/```|█/.test(ascii.answer.answer) && /Done/.test(ascii.answer.answer));
  const oos = finalize({ ...base, status: 'out_of_scope', charts: [chart([1, 2, 3])] }, ctx, SITE, false);
  t('no charts outside answered', oos.answer.charts.length === 0);
}

// Tool loop with a scripted model
const script = (turns) => { let i = 0; const calls = []; return { calls, create: async (p) => { calls.push(p); const r = turns[Math.min(i, turns.length - 1)]; i++; return typeof r === 'function' ? r(p) : r; } }; };
const tu = (name, input, id = name + Math.random()) => ({ type: 'tool_use', id, name, input });
const resp = (...blocks) => ({ content: blocks, stop_reason: 'tool_use', usage: { input_tokens: 10, output_tokens: 5 } });
{
  const client = script([resp(tu('get_records', { ids: ['finding:2025-001'] })), resp(tu('respond', { status: 'answered', title: 'Finding', answer_markdown: 'In FY2025, 37 of 70 disbursements totaling $2,996,752 had late purchase orders [1].', source_ids: ['finding:2025-001'], follow_up_questions: ['What did the county say?'] }))]);
  const r = await ask({ question: 'What did the 2025 audit find?', mode: 'answer', history: [] }, { client, index, live, model: 'test', siteUrl: SITE });
  t('loop: grounded answer delivered', r.status === 'answered' && r.sources.length === 1 && !r.verification.repaired, JSON.stringify(r).slice(0, 300));
  t('loop: tools and auto tool_choice sent, no forced choice', client.calls[0].tool_choice.type === 'auto' && client.calls[0].tools.length === 8);
}
{
  const client = script([resp(tu('get_records', { ids: ['finding:2025-001'] })), resp(tu('respond', { status: 'answered', title: 'x', answer_markdown: 'The county wasted $9,999,999 [1].', source_ids: ['finding:2025-001'], follow_up_questions: [] })), resp(tu('respond', { status: 'answered', title: 'x', answer_markdown: 'Two invoices totaling $7,464 were paid late [1].', source_ids: ['finding:2025-001'], follow_up_questions: [] }))]);
  const r = await ask({ question: 'q', mode: 'answer', history: [] }, { client, index, live, model: 'test', siteUrl: SITE });
  const repairMsg = JSON.stringify(client.calls[2].messages);
  t('loop: invented figure sent back for repair', /Not delivered[^"]*9,999,999/.test(repairMsg) && r.status === 'answered' && r.verification.repaired, r.status);
}
{
  const bad = resp(tu('respond', { status: 'answered', title: 'x', answer_markdown: 'The county spent $123,456,789 [1].', source_ids: ['finding:2025-001'], follow_up_questions: [] }));
  const client = script([resp(tu('get_records', { ids: ['finding:2025-001'] })), bad, bad]);
  const r = await ask({ question: 'q', mode: 'answer', history: [] }, { client, index, live, model: 'test', siteUrl: SITE });
  t('loop: fails closed after second unverified answer', r.status === 'not_verified' && !/123,456,789/.test(r.answer));
}
{
  const client = script([resp(tu('respond', { status: 'answered', title: 'x', answer_markdown: 'Rister won 99% [1].', source_ids: ['member:rister'], follow_up_questions: [] })), resp(tu('respond', { status: 'answered', title: 'x', answer_markdown: 'Rister won 99% [1].', source_ids: ['member:rister'], follow_up_questions: [] }))]);
  const r = await ask({ question: 'q', mode: 'answer', history: [] }, { client, index, live, model: 'test', siteUrl: SITE });
  t('loop: answer from memory (no retrieval) withheld', r.status === 'not_verified');
}
{
  const client = script([resp(tu('respond', { status: 'opinion_declined', title: 'x', answer_markdown: 'Vote for Chambers.', source_ids: [], follow_up_questions: ['How did Rister vote on taxes?'] }))]);
  const r = await ask({ question: 'Who should I vote for?', mode: 'answer', history: [] }, { client, index, live, model: 'test', siteUrl: SITE });
  t('loop: opinion declined uses neutral template', r.status === 'opinion_declined' && !/Chambers/.test(r.answer));
}
{
  const client = script([{ content: [{ type: 'text', text: 'Here is a poem.' }], stop_reason: 'end_turn' }, { content: [{ type: 'text', text: 'Still a poem.' }], stop_reason: 'end_turn' }]);
  const r = await ask({ question: 'Write a poem', mode: 'answer', history: [] }, { client, index, live, model: 'test', siteUrl: SITE });
  t('loop: plain-text answers never pass through', r.status === 'not_verified' && !/poem/i.test(r.answer));
}
{
  const client = script([{ content: [], stop_reason: 'refusal' }]);
  const r = await ask({ question: 'x', mode: 'answer', history: [] }, { client, index, live, model: 'test', siteUrl: SITE });
  t('loop: refusal handled', r.status === 'error');
}
{
  const client = script([resp(tu('calculate', { expression: '2996752 + 126749', label: 'total' })), resp(tu('respond', { status: 'answered', title: 'x', answer_markdown: 'Together that is $3,123,501 [1].', source_ids: ['calc:' + core.hashKey('2996752 + 126749')], follow_up_questions: [] }))]);
  const r = await ask({ question: 'q', mode: 'report', history: [{ q: 'earlier', a: 'earlier answer' }] }, { client, index, live, model: 'test', siteUrl: SITE });
  t('loop: calculated figure accepted, report mode settings', r.status === 'answered' && client.calls[0].output_config.effort === 'high', r.status + JSON.stringify(r.verification));
  t('loop: history marked as unverified context', /re-checked with tools/.test(JSON.stringify(client.calls[0].messages[1])));
}
// Kentucky Revised Statutes tool. Uses an invented two-section fixture (not real statute text) so the test
// runs before data/krs.json exists and never depends on the network.
{
  const fx = JSON.parse(JSON.stringify(corpus));
  fx.meta.coverage.krs = { fetched: '2026-11-17', chapters: ['99 (TEST CHAPTER)'], sections: 2 };
  fx.records = fx.records.filter((r) => !r.type.startsWith('krs'));
  fx.records.push(
    { id: 'krs-chapter:99', type: 'krs_chapter', date: null, title: 'KRS Chapter 99: TEST CHAPTER', text: 'Kentucky Revised Statutes Chapter 99. Sections: KRS 99.010 Test budget section; KRS 99.020 Repealed, 1990.', url: 'https://example.test/c', source_url: 'https://example.test/c', source_label: 'KRS Chapter 99', members: [], tags: ['KRS'] },
    { id: 'krs:99.010', type: 'krs', date: null, title: 'KRS 99.010 Test budget section.', text: 'KRS 99.010 (Test budget section.). Official text: (1) The fiscal court shall adopt the zanzibar budget within 45 days.', url: 'https://example.test/s', source_url: 'https://example.test/s', source_label: 'KRS 99.010', members: [], tags: ['KRS', 'Fiscal Court'] },
    { id: 'krs:99.020', type: 'krs', date: null, title: 'KRS 99.020 Repealed, 1990.', text: 'KRS 99.020 (Repealed, 1990.) is no longer in force; the official list shows it as: Repealed, 1990.', url: 'https://example.test/r', source_url: 'https://example.test/r', source_label: 'KRS 99.020', members: [], tags: ['KRS'] });
  fx.meta.coverage.kar = { fetched: '2026-11-17', chapters: ['900 KAR 1 (TEST REGS)'], regulations: 1 };
  fx.records = fx.records.filter((r) => !r.type.startsWith('kar'));
  fx.records.push(
    { id: 'kar-chapter:900:1', type: 'kar_chapter', date: null, title: '900 KAR 1: TEST REGS', text: 'Kentucky Administrative Regulations 900 KAR 1. Regulations in force: 900 KAR 1:010 Test quarterly report.', url: 'https://example.test/kc', source_url: 'https://example.test/kc', source_label: '900 KAR 1', members: [], tags: ['KAR'] },
    { id: 'kar:900:1:010', type: 'kar', date: null, title: '900 KAR 1:010 Test quarterly report.', text: '900 KAR 1:010 (Test quarterly report.). Relates to: KRS 99.010. Section 1. The treasurer shall file the walrus report within 30 days after each quarter.', url: 'https://example.test/k', source_url: 'https://example.test/k', source_label: '900 KAR 1:010', members: [], tags: ['KAR'] });
  const kIndex = new Index(fx);
  const kctx = () => ({ index: kIndex, live, registry: new Map(), evidence: [] });
  t('normalizeCite', core.normalizeCite('KRS §61.810(1)(a)') === '61.810' && core.normalizeCite('krs 91a.080') === '91A.080' && core.normalizeCite('chapter 67') === null);
  let c = kctx(); let r = await runTool('lookup_law', { citation: 'KRS 99.010(1)', chapter: null, query: null, source: null, limit: null }, c);
  t('krs: citation returns section text and registers it', /zanzibar budget within 45 days/.test(r.text) && c.registry.has('krs:99.010'), r.text.slice(0, 120));
  c = kctx(); r = await runTool('lookup_law', { citation: '99.500', chapter: null, query: null, source: null, limit: null }, c);
  t('krs: missing section says not loaded, offers chapter', /is not among the statute sections/.test(r.text) && c.registry.has('krs-chapter:99'));
  c = kctx(); r = await runTool('lookup_law', { citation: null, chapter: 'Chapter 99', query: null, source: null, limit: null }, c);
  t('krs: chapter table of contents', /KRS 99.010/.test(r.text) && c.registry.has('krs-chapter:99'));
  c = kctx(); r = await runTool('lookup_law', { citation: null, chapter: null, query: 'zanzibar budget', source: null, limit: 5 }, c);
  t('krs: topic search finds in-force sections only', /krs:99.010/.test(r.text) && !/krs:99.020/.test(r.text));
  c = kctx(); r = await runTool('lookup_law', { citation: null, chapter: '400', query: null, source: null, limit: null }, c);
  t('krs: unloaded chapter reported', /not loaded/.test(r.text));
  const empty = new Index({ ...corpus, meta: { ...corpus.meta, coverage: { ...corpus.meta.coverage, krs: { fetched: null, chapters: [], sections: 0 }, kar: { fetched: null, chapters: [], regulations: 0 } } } });
  r = await runTool('lookup_law', { citation: '67.080', chapter: null, query: null, source: null, limit: null }, { index: empty, live, registry: new Map(), evidence: [] });
  t('krs: not loaded yet handled', /not loaded Kentucky statutes or regulations/.test(r.text));
  // An answer citing the statute and its figure passes the checks; an invented deadline does not.
  c = kctx(); await runTool('lookup_law', { citation: '99.010', chapter: null, query: null, source: null, limit: null }, c);
  const ok = finalize({ status: 'answered', title: 't', answer_markdown: 'Under KRS 99.010(1), the fiscal court must adopt the budget within 45 days [1].', source_ids: ['krs:99.010'], follow_up_questions: [] }, c, SITE, false);
  t('krs: cited statute figure verified', !ok.problems.length && ok.answer.sources[0].source_url === 'https://example.test/s', ok.problems.join('; '));
  const bad = finalize({ status: 'answered', title: 't', answer_markdown: 'The budget is due within 60 days [1].', source_ids: ['krs:99.010'], follow_up_questions: [] }, c, SITE, false);
  t('krs: invented deadline rejected', bad.problems.some((p) => /60/.test(p)));
  t('normalizeKar', core.normalizeKar('109 kar 15:20') === '109:15:020' && core.normalizeKar('KRS 68.240') === null);
  c = kctx(); r = await runTool('lookup_law', { citation: '900 KAR 1:010', chapter: null, query: null, source: null, limit: null }, c);
  t('kar: citation returns regulation', /walrus report within 30 days/.test(r.text) && c.registry.has('kar:900:1:010'), r.text.slice(0, 100));
  c = kctx(); r = await runTool('lookup_law', { citation: null, chapter: '900 KAR 1', query: null, source: null, limit: null }, c);
  t('kar: chapter contents', /900 KAR 1:010/.test(r.text) && c.registry.has('kar-chapter:900:1'));
  c = kctx(); r = await runTool('lookup_law', { citation: null, chapter: null, query: 'walrus report', source: 'regulations', limit: 5 }, c);
  const r2 = await runTool('lookup_law', { citation: null, chapter: null, query: 'walrus report', source: 'statutes', limit: 5 }, kctx());
  t('kar: source filter', /kar:900:1:010/.test(r.text) && !/kar:900/.test(r2.text));
  c = kctx(); await runTool('lookup_law', { citation: '900 KAR 1:010', chapter: null, query: null, source: null, limit: null }, c);
  const kok = finalize({ status: 'answered', title: 't', answer_markdown: 'Under 900 KAR 1:010, the treasurer files the report within 30 days after each quarter [1].', source_ids: ['kar:900:1:010'], follow_up_questions: [] }, c, SITE, false);
  t('kar: cited regulation passes figure check', !kok.problems.length, kok.problems.join('; '));
  t('krs: prompt covers statutes and no legal advice', /lookup_law/.test(core.systemPrompt(fx.meta, SITE)) && /never conclude that an official or the county broke the law/.test(core.systemPrompt(fx.meta, SITE)));
}
// KAR fetcher parsers, on an excerpt of a real regulation page.
{
  const k = await import(path.resolve('scripts/fetch-kar.mjs'));
  const reg = k.parseRegulation(fs.readFileSync('scripts/fixtures/kar-109-15-020.html', 'utf8'));
  t('kar fetch: regulation parse', /County Budget Preparation/.test(reg.heading) && /^KRS 42\.495/.test(reg.relates_to ?? '') && /^Section 1\. Applicability\.\n\(1\) Each county official shall follow/.test(reg.text) && /eff\. 6-25-2014/.test(reg.history ?? ''), JSON.stringify(reg).slice(0, 300));
  const ch = k.parseKarChapter('<h1 class="header">Title 109 | Chapter 015 - County Budget</h1><nav class="kar-nav-list"><ul><li><a href="https://apps.legislature.ky.gov/law/kar/titles/109/015/020/"><div><span class="kar-number">Regulation 020</span> <span class="kar-mdash">—</span> <span class="kar-name"><span class="citation-text">County Budget Preparation and State Local Finance Officer Policy Manual.</span></span></div><div class="kar-status current">Current</div></a></li><li><a href="https://apps.legislature.ky.gov/law/kar/titles/109/015/030/"><div><span class="kar-number">Regulation 030</span> <span class="kar-mdash">—</span> <span class="kar-name"><span class="citation-text">Not available.</span></span></div><div class="kar-status inactive">Inactive</div></a></li></ul></nav>');
  t('kar fetch: chapter parse', ch.name === 'County Budget' && ch.regs.length === 2 && ch.regs[0].reg === '020' && ch.regs[0].status === 'current' && ch.regs[1].status === 'inactive', JSON.stringify(ch));
  const ti = k.parseTitle('<a href="https://apps.legislature.ky.gov/law/kar/titles/109/012"><div><span class="kar-number">Chapter 012</span> <span class="kar-mdash">—</span> <span class="kar-name">Advancements to Sheriffs</span></div><div class="kar-status repealed">Repealed</div></a><a href="https://apps.legislature.ky.gov/law/kar/titles/109/015"><div><span class="kar-number">Chapter 015</span> <span class="kar-mdash">—</span> <span class="kar-name">County Budget</span></div><div class="kar-status current">Current</div></a>', '109');
  t('kar fetch: title parse skips repealed chapters', ti.length === 1 && ti[0].chapter === '15' && ti[0].name === 'County Budget', JSON.stringify(ti));
  const t31 = k.parseTitle('<a href="/law/kar/titles/031/003"><span class="kar-name">Election Procedures</span></a>', '31');
  t('kar fetch: padded title, relative links, no status markup', t31.length === 1 && t31[0].chapter === '3', JSON.stringify(t31));
}
// KRS fetcher parsers, on markup copied from the Legislative Research Commission site.
{
  const k = await import(path.resolve('scripts/fetch-krs.mjs'));
  const chap = k.parseChapter('<ul><li><p><a class="statute" href="https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=5473">.020  County road engineer or supervisor. </a></p>\n</li><li><p><a class="statute" href="https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=5474">.030  Repealed, 1944. </a></p></li></ul><div class="heading_text">Penalties </div>');
  t('krs fetch: chapter parse', chap.length === 2 && chap[0].id === '5473' && chap[0].suffix === '.020' && chap[0].title === 'County road engineer or supervisor.', JSON.stringify(chap));
  const idx = k.parseIndex('<a href="https://apps.legislature.ky.gov/law/statutes/chapter.aspx?id=37360">CHAPTER 67 COUNTY GOVERNMENT (FISCAL COURTS AND COUNTY COMMISSIONERS)</a><a href="chapter.aspx?id=1">CHAPTER 91A <span>FINANCE AND REVENUE OF CITIES AND COUNTIES</span></a>');
  t('krs fetch: index parse', idx['67']?.id === '37360' && /COUNTY GOVERNMENT/.test(idx['67'].title) && idx['91A']?.id === '1', JSON.stringify(idx));
  const cl = k.cleanSectionText('179.020 County road engineer or supervisor.\n(1) The county judge/executive, with the approval of the\nfiscal court, may employ a road engineer.\n(2) Second part.\nPage 1 of 1\nEffective: July 15, 1998\nHistory: Amended 1998 Ky. Acts ch. 418, sec. 1,\neffective July 15, 1998.\n');
  const lay = k.cleanSectionText('68.240 Proposed budget.\n   (1)   The county judge/executive shall annually\n         prepare a proposed budget.\n   (2)   Second subsection.\n');
  t('krs fetch: layout text keeps numbers with their text', /^68\.240 Proposed budget\.\n\(1\) The county judge\/executive shall annually prepare a proposed budget\.\n\(2\) Second subsection\.$/.test(lay.body) && k.strayMarkers(lay.body) === 0, JSON.stringify(lay.body));
  t('krs fetch: stray markers detected', k.strayMarkers('x\n(1)\n(2)\nThe text') === 2);
  t('krs fetch: section text cleaned', /approval of the fiscal court, may employ/.test(cl.body) && /\n\(2\) Second part/.test(cl.body) && !/Page 1/.test(cl.body) && cl.effective === 'July 15, 1998' && /^History: Amended 1998/.test(cl.history ?? ''), JSON.stringify(cl));
}
fs.rmSync(outfile, { force: true });
console.log(`ask tests: ${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
