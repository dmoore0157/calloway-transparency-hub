-- "Ask the records" assistant: stored answers (for shareable links and audit), reader feedback, cleanup.
create table if not exists hub.ai_answers (
  id            text primary key,                       -- short random id used in /ask/a/:id
  question      text not null,
  mode          text not null check (mode in ('answer', 'report')),
  status        text not null,                          -- answered | not_found | out_of_scope | opinion_declined | needs_clarification | not_verified | error
  title         text not null,
  answer        text not null,
  sources       jsonb not null default '[]',
  follow_ups    jsonb not null default '[]',
  verification  jsonb not null default '{}',
  steps         jsonb not null default '[]',
  model         text,
  usage         jsonb,
  corpus_built  text,
  device_hash   text not null,                          -- salted hash; no IP or personal data stored
  shared        boolean not null default false,
  shared_at     timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists ai_answers_device_idx on hub.ai_answers (device_hash, created_at desc);
create index if not exists ai_answers_created_idx on hub.ai_answers (created_at desc);

create table if not exists hub.ai_feedback (
  id           bigserial primary key,
  answer_id    text references hub.ai_answers(id) on delete cascade,
  helpful      boolean not null,
  comment      text,
  device_hash  text not null,
  created_at   timestamptz not null default now()
);
create index if not exists ai_feedback_answer_idx on hub.ai_feedback (answer_id);

alter table hub.ai_answers  enable row level security;
alter table hub.ai_feedback enable row level security;
-- Writes come only from the edge function (service role). Editors can read everything.
create policy ai_answers_admin on hub.ai_answers for all using (hub.is_admin()) with check (hub.is_admin());
create policy ai_feedback_admin on hub.ai_feedback for all using (hub.is_admin()) with check (hub.is_admin());

-- Only answers a reader chose to share are public, and without the device hash or usage data.
create or replace view public.ai_answers_shared as
select id, question, mode, status, title, answer, sources, follow_ups, verification, corpus_built, created_at, shared_at
from hub.ai_answers where shared;
grant select on public.ai_answers_shared to anon, authenticated;

-- Unshared answers are kept 30 days for quality review, then deleted.
select cron.schedule('ai-answers-purge', '17 4 * * *', $$
  delete from hub.ai_answers where not shared and created_at < now() - interval '30 days';
$$);
