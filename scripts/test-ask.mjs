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

// Tool loop with a scripted model
const script = (turns) => { let i = 0; const calls = []; return { calls, create: async (p) => { calls.push(p); const r = turns[Math.min(i, turns.length - 1)]; i++; return typeof r === 'function' ? r(p) : r; } }; };
const tu = (name, input, id = name + Math.random()) => ({ type: 'tool_use', id, name, input });
const resp = (...blocks) => ({ content: blocks, stop_reason: 'tool_use', usage: { input_tokens: 10, output_tokens: 5 } });
{
  const client = script([resp(tu('get_records', { ids: ['finding:2025-001'] })), resp(tu('respond', { status: 'answered', title: 'Finding', answer_markdown: 'In FY2025, 37 of 70 disbursements totaling $2,996,752 had late purchase orders [1].', source_ids: ['finding:2025-001'], follow_up_questions: ['What did the county say?'] }))]);
  const r = await ask({ question: 'What did the 2025 audit find?', mode: 'answer', history: [] }, { client, index, live, model: 'test', siteUrl: SITE });
  t('loop: grounded answer delivered', r.status === 'answered' && r.sources.length === 1 && !r.verification.repaired, JSON.stringify(r).slice(0, 300));
  t('loop: tools and auto tool_choice sent, no forced choice', client.calls[0].tool_choice.type === 'auto' && client.calls[0].tools.length === 7);
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
fs.rmSync(outfile, { force: true });
console.log(`ask tests: ${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
