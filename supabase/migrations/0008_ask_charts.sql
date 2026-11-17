-- Ask the records: charts and headline-number tiles returned with an answer (checked against the records server-side).
alter table hub.ai_answers
  add column if not exists charts jsonb not null default '[]',
  add column if not exists stats jsonb not null default '[]';

create or replace view public.ai_answers_shared as
  select id, question, mode, status, title, answer, sources, follow_ups, verification, corpus_built, created_at, shared_at, charts, stats
  from hub.ai_answers where shared;

grant select on public.ai_answers_shared to anon, authenticated;
