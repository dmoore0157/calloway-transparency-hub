// The tool loop for one question. The model must gather records with tools and finish with respond();
// the answer is then checked (citations resolve, every figure appears in a retrieved record) and,
// if a check fails, the model gets one chance to repair it before the answer is withheld.
import { TOOLS, runTool, finalize, systemPrompt, TEMPLATES, type Index, type LiveData, type ToolCtx, type FinalAnswer, type Source } from './core.ts';

// Minimal shape of the Anthropic client this file uses (the real SDK client satisfies it).
export type Block = { type: string; id?: string; name?: string; input?: unknown; text?: string; [k: string]: unknown };
export type ModelResponse = { content: Block[]; stop_reason: string | null; usage?: Record<string, unknown>; model?: string };
export type ModelClient = { create: (params: Record<string, unknown>) => Promise<ModelResponse> };

export type AskInput = { question: string; mode: 'answer' | 'report'; history: { q: string; a: string }[] };
export type AskResult = FinalAnswer & { model: string; usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; turns: number }; steps: string[] };

export async function ask(input: AskInput, deps: { client: ModelClient; index: Index; live: LiveData; model: string; siteUrl: string; onStep?: (s: string) => void; deadlineMs?: number }): Promise<AskResult> {
  const { client, index, live, model, siteUrl, onStep } = deps;
  const ctx: ToolCtx = { index, live, registry: new Map<string, Source>(), evidence: [] };
  const steps: string[] = [];
  const step = (s: string) => { steps.push(s); onStep?.(s); };
  const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, turns: 0 };
  const started = Date.now(); const deadline = deps.deadlineMs ?? 110_000;
  const maxTurns = input.mode === 'report' ? 14 : 9;

  const messages: Record<string, unknown>[] = [];
  for (const h of input.history.slice(-3)) {
    messages.push({ role: 'user', content: h.q.slice(0, 600) });
    messages.push({ role: 'assistant', content: `(Earlier answer, for context only; its facts must be re-checked with tools before reuse.) ${h.a.slice(0, 2500)}` });
  }
  messages.push({ role: 'user', content: `${input.mode === 'report' ? 'Mode: report. Write a structured report document.' : 'Mode: answer. Be concise.'}\n\nQuestion: ${input.question}` });

  const system = [{ type: 'text', text: systemPrompt(index.corpus.meta, siteUrl), cache_control: { type: 'ephemeral' } }];
  let repairsLeft = 1; let nudged = false; let repaired = false;

  for (let turn = 0; turn < maxTurns; turn++) {
    const lastTurn = turn === maxTurns - 1 || Date.now() - started > deadline;
    if (lastTurn && turn > 0) messages.push({ role: 'user', content: 'Time is up. Call respond now using only the records you already retrieved; use status not_found if they do not answer the question.' });
    const res = await client.create({
      model, max_tokens: input.mode === 'report' ? 24000 : 12000,
      system, tools: TOOLS, tool_choice: { type: 'auto' }, messages,
      output_config: { effort: input.mode === 'report' ? 'high' : 'medium' },
      cache_control: { type: 'ephemeral' },
    });
    usage.turns++;
    const u = res.usage ?? {};
    usage.input_tokens += Number(u.input_tokens ?? 0); usage.output_tokens += Number(u.output_tokens ?? 0); usage.cache_read_input_tokens += Number(u.cache_read_input_tokens ?? 0);

    if (res.stop_reason === 'refusal') return withheld('error', 'The assistant could not answer this question.', ctx, siteUrl, model, usage, steps);
    messages.push({ role: 'assistant', content: res.content });
    const calls = res.content.filter((b) => b.type === 'tool_use');

    if (!calls.length) {
      if (res.stop_reason === 'max_tokens') return withheld('error', 'The answer ran too long. Try a narrower question.', ctx, siteUrl, model, usage, steps);
      if (nudged) return withheld('not_verified', TEMPLATES.not_verified, ctx, siteUrl, model, usage, steps);
      nudged = true;
      messages.push({ role: 'user', content: 'Finish by calling the respond tool (not plain text), with source_ids for every [n] marker.' });
      continue;
    }

    const results: Record<string, unknown>[] = [];
    let final: FinalAnswer | null = null;
    for (const c of calls) {
      const inputObj = (c.input ?? {}) as Record<string, unknown>;
      if (c.name === 'respond') {
        const { answer, problems } = finalize(inputObj as never, ctx, siteUrl, repaired);
        if (!problems.length) { final = answer; results.push({ type: 'tool_result', tool_use_id: c.id, content: 'Delivered.' }); continue; }
        if (repairsLeft > 0 && !lastTurn) {
          repairsLeft--; repaired = true; step('Double-checking figures against the records');
          results.push({ type: 'tool_result', tool_use_id: c.id, is_error: true, content: `Not delivered. Fix these problems, then call respond again: ${problems.join('; ')}. Retrieve or calculate any figure you keep, or remove it. Cite only ids returned by tools.` });
          continue;
        }
        return { ...withheld('not_verified', TEMPLATES.not_verified, ctx, siteUrl, model, usage, steps), verification: { ...answer.verification, repaired } };
      }
      try {
        const r = await runTool(String(c.name), inputObj, ctx);
        step(r.step);
        results.push({ type: 'tool_result', tool_use_id: c.id, content: r.text.slice(0, 30000) });
      } catch (e) {
        results.push({ type: 'tool_result', tool_use_id: c.id, is_error: true, content: `Tool failed: ${(e as Error).message}` });
      }
    }
    if (final) return { ...final, model: res.model ?? model, usage, steps };
    messages.push({ role: 'user', content: results });
  }
  return withheld('not_verified', TEMPLATES.not_verified, ctx, siteUrl, model, usage, steps);
}

function withheld(status: 'not_verified' | 'error', text: string, ctx: ToolCtx, siteUrl: string, model: string, usage: AskResult['usage'], steps: string[]): AskResult {
  const abs = (u: string) => (u && u.startsWith('/') ? siteUrl.replace(/\/$/, '') + u : u);
  const consulted = [...ctx.registry.values()].filter((s) => s.url).slice(0, 12).map((s, i) => ({ n: i + 1, id: s.id, title: s.title, type: s.type, url: abs(s.url), source_url: s.source_url, source_label: s.source_label, date: s.date }));
  return { status, title: status === 'error' ? 'Something went wrong' : 'Answer withheld: could not verify', answer: text, sources: status === 'not_verified' ? consulted : [], follow_ups: [], verification: { sources_checked: consulted.length, figures_checked: 0, unverified: [], repaired: false }, model, usage, steps };
}
