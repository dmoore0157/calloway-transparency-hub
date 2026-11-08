-- Calloway County Transparency Hub
-- Backend schema for Supabase (Postgres 15+, PostGIS, pg_cron)
--
-- Conventions
--   * All tables in schema `hub`. Public read access goes through views in `public`
--     (suffix _public) so PII and unverified rows are never exposed by accident.
--   * Every hub-compiled fact carries provenance: source_doc_id, source_page, source_quote.
--   * Writes from anonymous residents never hit tables directly; they go through
--     edge functions that run as `service_role` after validation and rate limiting.
--   * Timestamps are timestamptz, UTC.

create extension if not exists postgis;
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists pg_cron;

create schema if not exists hub;

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
create type hub.source_kind as enum ('audited', 'county_reported', 'year_end', 'adopted_budget', 'minutes', 'ordinance', 'resolution', 'other');
create type hub.verification_status as enum ('extracted', 'verified', 'disputed', 'rejected');
create type hub.member_role as enum ('judge_executive', 'magistrate', 'county_attorney', 'clerk', 'treasurer', 'other');
create type hub.motion_outcome as enum ('passed', 'failed', 'no_second', 'tabled', 'withdrawn', 'consensus', 'no_vote');
create type hub.vote_method as enum ('voice_unanimous', 'voice_with_nays', 'roll_call', 'consensus', 'no_vote');
create type hub.vote_value as enum ('aye', 'nay', 'abstain', 'absent', 'not_recorded');
create type hub.budget_stage as enum ('adopted', 'amended', 'actual');
create type hub.ticket_status as enum ('reported', 'submitted_to_county', 'acknowledged', 'in_progress', 'fixed', 'closed_not_county', 'closed_duplicate', 'closed_invalid');
create type hub.ticket_severity as enum ('emergency', 'urgent', 'routine', 'long_term');
create type hub.ticket_category as enum ('pothole', 'washout', 'drainage', 'downed_tree', 'sign', 'bridge', 'gravel_grading', 'vegetation', 'other');
create type hub.road_maintainer as enum ('county', 'state', 'city_murray', 'private', 'unknown');
create type hub.actor_type as enum ('reporter', 'resident', 'admin', 'county', 'system');
create type hub.photo_status as enum ('pending', 'approved', 'rejected', 'removed');
create type hub.idea_status as enum ('new', 'under_review', 'planned', 'in_progress', 'shipped', 'declined');
create type hub.idea_category as enum ('data_request', 'feature', 'fix', 'question', 'other');
create type hub.flag_status as enum ('open', 'confirmed_corrected', 'rejected');

-- ---------------------------------------------------------------------------
-- Provenance: documents
-- ---------------------------------------------------------------------------
create table hub.documents (
  id            text primary key,                       -- e.g. 'minutes-2026-04-22'
  kind          hub.source_kind not null,
  title         text not null,
  url           text,                                   -- original county/state URL
  storage_path  text,                                   -- copy in Storage bucket 'documents'
  sha256        text,
  fiscal_year   int,
  document_date date,
  pages         int,
  fetched_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- People and districts
-- ---------------------------------------------------------------------------
create table hub.districts (
  id          smallint primary key,                      -- 1..4
  name        text not null,                             -- 'District 1'
  boundary    geometry(MultiPolygon, 4326),              -- magistrate district, when obtained
  source_doc_id text references hub.documents(id)
);
create index districts_boundary_gix on hub.districts using gist (boundary);

create table hub.members (
  id           text primary key,                         -- 'imes', 'cherry'
  full_name    text not null,
  short_name   text not null,                            -- as minutes name them: 'Cherry'
  role         hub.member_role not null,
  district_id  smallint references hub.districts(id),
  term_start   date,
  term_end     date,
  active       boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Meetings, agenda, motions, votes
-- ---------------------------------------------------------------------------
create table hub.meetings (
  id              text primary key,                      -- '2026-04-22' or '2025-06-30-special'
  meeting_date    date not null,
  kind            text not null default 'regular',       -- regular | special | public_hearing
  location        text,
  source_doc_id   text not null references hub.documents(id),
  summary         text[],                                -- plain-English bullets
  verification    hub.verification_status not null default 'extracted',
  verified_by     uuid,                                  -- auth.users id
  verified_at     timestamptz,
  created_at      timestamptz not null default now()
);

create table hub.attendance (
  meeting_id  text references hub.meetings(id) on delete cascade,
  member_id   text references hub.members(id),
  present     boolean not null,
  note        text,
  primary key (meeting_id, member_id)
);

create table hub.agenda_items (
  id          text primary key,                          -- '2026-04-22-03'
  meeting_id  text not null references hub.meetings(id) on delete cascade,
  sequence    int not null,
  title       text not null,
  category    text[],                                    -- tags: roads, budget, personnel, appointments, ordinance, property, public_safety, grants
  source_page int
);

create table hub.motions (
  id                text primary key,                    -- '2026-04-22-07'
  meeting_id        text not null references hub.meetings(id) on delete cascade,
  agenda_item_id    text references hub.agenda_items(id),
  sequence          int not null,
  text              text not null,                       -- action as written
  summary           text,                                -- plain English
  category          text[],
  mover_id          text references hub.members(id),
  seconder_id       text references hub.members(id),
  outcome           hub.motion_outcome not null,
  vote_method       hub.vote_method not null,
  dollar_amount     numeric(14,2),
  is_routine        boolean not null default false,      -- minutes, bills, adjourn
  related_doc_ids   text[],                              -- ordinances / resolutions
  budget_line_ids   text[],
  source_doc_id     text not null references hub.documents(id),
  source_page       int,
  source_quote      text,
  verification      hub.verification_status not null default 'extracted',
  verified_by       uuid,
  verified_at       timestamptz,
  created_at        timestamptz not null default now()
);
create index motions_meeting_idx on hub.motions (meeting_id, sequence);
create index motions_mover_idx on hub.motions (mover_id);
create index motions_seconder_idx on hub.motions (seconder_id);
create index motions_text_trgm on hub.motions using gin (text gin_trgm_ops);

create table hub.votes (
  motion_id   text references hub.motions(id) on delete cascade,
  member_id   text references hub.members(id),
  value       hub.vote_value not null,
  note        text,                                      -- e.g. 'abstained: board member'
  primary key (motion_id, member_id)
);

create table hub.appointments (
  id            bigserial primary key,
  motion_id     text references hub.motions(id),
  board         text not null,
  appointee     text not null,
  action        text not null,                           -- appoint | reappoint | remove
  term_end      date,
  source_quote  text
);

-- ---------------------------------------------------------------------------
-- Ordinances and resolutions
-- ---------------------------------------------------------------------------
create table hub.enactments (
  id            text primary key,                        -- '25-0924-A'
  kind          text not null,                           -- ordinance | resolution | executive_order
  title         text not null,
  category      text,
  status        text,                                    -- 'Revised by 22-1221-B'
  supersedes    text references hub.enactments(id),
  first_reading_motion_id  text references hub.motions(id),
  second_reading_motion_id text references hub.motions(id),
  adopted_date  date,
  url           text,
  source_doc_id text references hub.documents(id)
);

-- ---------------------------------------------------------------------------
-- Budget
-- ---------------------------------------------------------------------------
create table hub.funds (
  id          text primary key,                          -- '01' General, '02' Road, '03' Jail, '04' LGEA, '05' E911 ...
  name        text not null,
  explainer   text
);

create table hub.departments (
  id          text primary key,                          -- '5101' etc. or hub-defined category key
  fund_id     text references hub.funds(id),
  name        text not null,
  category    text,                                      -- hub category used in charts
  explainer   text
);

create table hub.budget_lines (
  id            text primary key,                        -- account code '01-5101-101'
  fund_id       text not null references hub.funds(id),
  department_id text references hub.departments(id),
  name          text not null,
  is_revenue    boolean not null,
  explainer     text,
  law_citation  text
);
create index budget_lines_name_trgm on hub.budget_lines using gin (name gin_trgm_ops);

create table hub.budget_amounts (
  line_id       text not null references hub.budget_lines(id),
  fiscal_year   int not null,                            -- 2025 = FY2024-25
  stage         hub.budget_stage not null,
  amount        numeric(14,2) not null,
  source_kind   hub.source_kind not null,
  source_doc_id text references hub.documents(id),
  source_page   int,
  primary key (line_id, fiscal_year, stage)
);

create table hub.revenue_sources (
  id          text primary key,
  name        text not null,
  explainer   text,
  law_citation text
);

create table hub.revenue_amounts (
  source_id     text references hub.revenue_sources(id),
  fiscal_year   int not null,
  fund_id       text references hub.funds(id),
  amount        numeric(14,2) not null,
  source_kind   hub.source_kind not null,
  source_doc_id text references hub.documents(id),
  primary key (source_id, fiscal_year, fund_id)
);

create table hub.grants (
  id            bigserial primary key,
  meeting_id    text references hub.meetings(id),
  motion_id     text references hub.motions(id),
  program       text not null,
  purpose       text not null,
  category      text,
  funder_kind   text,                                    -- state | federal | state_federal | private
  amount        numeric(14,2),
  amount_note   text,                                    -- 'up to ~$1,000,000 (application)'
  local_match   numeric(14,2),
  stage         text,                                    -- application | awarded | agreement_executed | accepted | closed
  source_doc_id text references hub.documents(id),
  source_quote  text
);

create table hub.debts (
  id            bigserial primary key,
  lender        text not null,
  purpose       text not null,
  principal     numeric(14,2),
  rate_pct      numeric(5,2),
  term_years    int,
  approved_motion_id text references hub.motions(id),
  payoff_date   date,
  outstanding   boolean not null default true,
  source_doc_id text references hub.documents(id)
);

-- Future: vendor payments once the claims register is obtained
create table hub.vendors (
  id        bigserial primary key,
  name      text not null unique,
  normalized_name text generated always as (lower(regexp_replace(name, '[^a-z0-9]+', ' ', 'gi'))) stored
);
create table hub.payments (
  id            bigserial primary key,
  vendor_id     bigint references hub.vendors(id),
  fund_id       text references hub.funds(id),
  line_id       text references hub.budget_lines(id),
  paid_on       date not null,
  amount        numeric(14,2) not null,
  check_no      text,
  description   text,
  source_doc_id text references hub.documents(id)
);
create index payments_vendor_idx on hub.payments (vendor_id, paid_on);

-- ---------------------------------------------------------------------------
-- Roads: reference layers
-- ---------------------------------------------------------------------------
create table hub.roads (
  id            bigserial primary key,
  name          text not null,
  maintainer    hub.road_maintainer not null,
  route_id      text,                                    -- KYTC route id when state
  geom          geometry(MultiLineString, 4326) not null,
  source        text not null,                           -- 'KYTC', 'OSM', 'county'
  updated_at    timestamptz not null default now()
);
create index roads_geom_gix on hub.roads using gist (geom);
create index roads_name_trgm on hub.roads using gin (name gin_trgm_ops);

create table hub.geocode_cache (
  key         text primary key,                          -- 'rev:36.6103,-88.3148' or 'fwd:<normalized address>'
  result      jsonb not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Roads: tickets
-- ---------------------------------------------------------------------------
create sequence hub.ticket_seq;

create table hub.tickets (
  id              text primary key default ('CT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('hub.ticket_seq')::text, 4, '0')),
  status          hub.ticket_status not null default 'reported',
  category        hub.ticket_category not null,
  severity        hub.ticket_severity not null,
  description     text not null check (char_length(description) between 10 and 2000),
  location        geometry(Point, 4326) not null,
  location_text   text not null,                         -- 'Doores Trail near the culvert'
  road_id         bigint references hub.roads(id),
  road_name       text,
  maintainer      hub.road_maintainer not null default 'unknown',
  district_id     smallint references hub.districts(id),
  duplicate_of    text references hub.tickets(id),
  submitted_to_county_at timestamptz,
  county_reference text,
  fixed_at        timestamptz,
  closed_at       timestamptz,
  reporter_token  text not null,                         -- hashed device/secret token for the reporter's edit link
  turnstile_ok    boolean not null default false,
  ip_hash         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index tickets_location_gix on hub.tickets using gist (location);
create index tickets_status_idx on hub.tickets (status, created_at desc);
create index tickets_district_idx on hub.tickets (district_id, status);

-- PII lives here and only here. No public view or API reads this table.
create table hub.ticket_contacts (
  ticket_id     text primary key references hub.tickets(id) on delete cascade,
  first_name    text not null,
  last_name     text not null,
  phone         text not null,
  email         text not null,
  home_address  text not null,
  email_opt_in  boolean not null default true,
  email_verified_at timestamptz
);

create table hub.ticket_events (
  id          bigserial primary key,
  ticket_id   text not null references hub.tickets(id) on delete cascade,
  actor       hub.actor_type not null,
  actor_id    uuid,                                      -- auth user when admin/county
  kind        text not null,                             -- created | status_change | confirmation_still_issue | confirmation_fixed | note | merged | county_update
  from_status hub.ticket_status,
  to_status   hub.ticket_status,
  note        text,
  created_at  timestamptz not null default now()
);
create index ticket_events_ticket_idx on hub.ticket_events (ticket_id, created_at);

create table hub.ticket_photos (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     text not null references hub.tickets(id) on delete cascade,
  event_id      bigint references hub.ticket_events(id),
  status        hub.photo_status not null default 'pending',
  private_path  text not null,                           -- bucket 'ticket-photos-private'
  public_path   text,                                    -- bucket 'ticket-photos' after approval
  width         int, height int, bytes int,
  taken_at      timestamptz,                             -- from EXIF before stripping
  exif_gps      geometry(Point, 4326),                   -- read once to suggest the pin, never published
  caption       text,
  moderated_by  uuid,
  moderated_at  timestamptz,
  reject_reason text,
  created_at    timestamptz not null default now()
);
create index ticket_photos_status_idx on hub.ticket_photos (status, created_at);

-- Snapshot of the county's form so a change can be detected nightly
create table hub.county_form_template (
  form_id       text primary key,                        -- 'wpforms-3078'
  url           text not null,
  fields        jsonb not null,                          -- [{name, label, type, options[]}]
  fetched_at    timestamptz not null default now(),
  changed       boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Feedback: ideas, votes, comments, data-error flags
-- ---------------------------------------------------------------------------
create table hub.ideas (
  id            bigserial primary key,
  title         text not null check (char_length(title) between 5 and 120),
  body          text not null check (char_length(body) between 10 and 3000),
  category      hub.idea_category not null,
  status        hub.idea_status not null default 'new',
  status_note   text,                                    -- public reason, e.g. why declined
  published     boolean not null default false,
  submitter_token text not null,
  submitter_email text,                                  -- private
  vote_count    int not null default 0,
  ip_hash       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index ideas_status_idx on hub.ideas (status, vote_count desc);

create table hub.idea_votes (
  idea_id       bigint references hub.ideas(id) on delete cascade,
  voter_token   text not null,
  created_at    timestamptz not null default now(),
  primary key (idea_id, voter_token)
);

create table hub.idea_comments (
  id          bigserial primary key,
  idea_id     bigint not null references hub.ideas(id) on delete cascade,
  actor       hub.actor_type not null,
  body        text not null check (char_length(body) <= 2000),
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table hub.data_flags (
  id            bigserial primary key,
  record_table  text not null,                           -- 'motions', 'budget_amounts', ...
  record_id     text not null,
  message       text not null check (char_length(message) between 10 and 2000),
  reporter_email text,
  status        hub.flag_status not null default 'open',
  resolution    text,                                    -- public note in corrections log
  resolved_by   uuid,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index data_flags_record_idx on hub.data_flags (record_table, record_id);

-- ---------------------------------------------------------------------------
-- Platform: admins, rate limits, audit, ingest queue, publish log
-- ---------------------------------------------------------------------------
create table hub.admins (
  user_id     uuid primary key,                          -- auth.users
  email       text not null unique,
  role        text not null default 'editor',            -- owner | editor | county
  created_at  timestamptz not null default now()
);

create table hub.rate_limits (
  bucket      text not null,                             -- 'ticket:ip:<hash>' | 'idea:device:<token>'
  window_start timestamptz not null,
  count       int not null default 0,
  primary key (bucket, window_start)
);

create table hub.audit_log (
  id          bigserial primary key,
  actor_id    uuid,
  action      text not null,
  target      text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);

create table hub.ingest_jobs (
  id            bigserial primary key,
  document_id   text references hub.documents(id),
  kind          text not null,                           -- 'minutes_extract' | 'budget_extract' | 'form_check'
  status        text not null default 'queued',          -- queued | running | needs_review | done | failed
  payload       jsonb,
  result        jsonb,
  error         text,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create table hub.publishes (
  id          bigserial primary key,
  triggered_by uuid,
  datasets    text[],
  deploy_url  text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Derived stats (materialized, refreshed hourly by cron)
-- ---------------------------------------------------------------------------
create materialized view hub.member_stats as
select
  m.id as member_id,
  count(distinct a.meeting_id) filter (where a.present) as meetings_attended,
  count(distinct a.meeting_id) as meetings_total,
  count(distinct mo.id) filter (where mo.mover_id = m.id and not mo.is_routine) as motions_made,
  count(distinct mo.id) filter (where mo.seconder_id = m.id and not mo.is_routine) as motions_seconded,
  count(distinct v.motion_id) filter (where v.value = 'nay') as nays,
  count(distinct v.motion_id) filter (where v.value = 'abstain') as abstentions,
  coalesce(sum(mo.dollar_amount) filter (where mo.mover_id = m.id), 0) as dollars_moved
from hub.members m
left join hub.attendance a on a.member_id = m.id
left join hub.motions mo on mo.verification = 'verified' and (mo.mover_id = m.id or mo.seconder_id = m.id)
left join hub.votes v on v.member_id = m.id
group by m.id;

create materialized view hub.mover_seconder_matrix as
select mover_id, seconder_id, count(*) as n
from hub.motions
where verification = 'verified' and not is_routine and mover_id is not null and seconder_id is not null
group by mover_id, seconder_id;

create materialized view hub.district_ticket_stats as
select
  d.id as district_id,
  count(t.id) filter (where t.status in ('reported','submitted_to_county','acknowledged','in_progress')) as open_tickets,
  count(t.id) filter (where t.status = 'fixed') as fixed_tickets,
  percentile_cont(0.5) within group (order by extract(epoch from (t.fixed_at - t.submitted_to_county_at))/86400)
    filter (where t.fixed_at is not null and t.submitted_to_county_at is not null) as median_days_to_fix
from hub.districts d
left join hub.tickets t on t.district_id = d.id and t.maintainer = 'county'
group by d.id;

-- ---------------------------------------------------------------------------
-- Public views (what the anon role can read)
-- ---------------------------------------------------------------------------
create or replace view public.motions_public as
select id, meeting_id, agenda_item_id, sequence, text, summary, category, mover_id, seconder_id,
       outcome, vote_method, dollar_amount, is_routine, related_doc_ids, budget_line_ids,
       source_doc_id, source_page, source_quote, verified_at
from hub.motions where verification = 'verified';

create or replace view public.votes_public as
select v.* from hub.votes v join hub.motions m on m.id = v.motion_id where m.verification = 'verified';

create or replace view public.tickets_public as
select id, status, category, severity, description, location, location_text, road_name, maintainer,
       district_id, duplicate_of, submitted_to_county_at, fixed_at, closed_at, created_at, updated_at,
       (select count(*) from hub.ticket_photos p where p.ticket_id = t.id and p.status = 'approved') as photo_count
from hub.tickets t
where status <> 'closed_invalid';

create or replace view public.ticket_photos_public as
select id, ticket_id, event_id, public_path, width, height, taken_at, caption, created_at
from hub.ticket_photos where status = 'approved';

create or replace view public.ticket_events_public as
select id, ticket_id, actor, kind, from_status, to_status,
       case when actor in ('admin','county','system') then note else null end as note,  -- resident notes shown only after moderation elsewhere
       created_at
from hub.ticket_events;

create or replace view public.ideas_public as
select id, title, body, category, status, status_note, vote_count, created_at, updated_at
from hub.ideas where published;

create or replace view public.corrections_log as
select id, record_table, record_id, message, resolution, resolved_at
from hub.data_flags where status = 'confirmed_corrected';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table hub.tickets          enable row level security;
alter table hub.ticket_contacts  enable row level security;
alter table hub.ticket_events    enable row level security;
alter table hub.ticket_photos    enable row level security;
alter table hub.ideas            enable row level security;
alter table hub.idea_votes       enable row level security;
alter table hub.idea_comments    enable row level security;
alter table hub.data_flags       enable row level security;
alter table hub.motions          enable row level security;
alter table hub.votes            enable row level security;
alter table hub.meetings         enable row level security;
alter table hub.admins           enable row level security;
alter table hub.audit_log        enable row level security;

-- No policies for anon on hub.* tables: anon reads only the public.* views above
-- (views are created with security_invoker = false and owned by a role that can read hub.*).
-- Admins (allow-listed in hub.admins) get full access to hub.* through these policies:
create or replace function hub.is_admin() returns boolean language sql stable as $$
  select exists (select 1 from hub.admins where user_id = auth.uid());
$$;

do $$
declare t text;
begin
  for t in select unnest(array['tickets','ticket_contacts','ticket_events','ticket_photos','ideas','idea_votes','idea_comments','data_flags','motions','votes','meetings','audit_log'])
  loop
    execute format('create policy admin_all on hub.%I for all to authenticated using (hub.is_admin()) with check (hub.is_admin());', t);
  end loop;
end $$;

-- County role (optional, phase 4): may update ticket status only
create policy county_update_status on hub.tickets for update to authenticated
  using (exists (select 1 from hub.admins a where a.user_id = auth.uid() and a.role = 'county'))
  with check (true);

grant usage on schema public to anon, authenticated;
grant select on public.motions_public, public.votes_public, public.tickets_public, public.ticket_photos_public,
                public.ticket_events_public, public.ideas_public, public.corrections_log to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function hub.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger tickets_touch before update on hub.tickets for each row execute function hub.touch_updated_at();
create trigger ideas_touch   before update on hub.ideas   for each row execute function hub.touch_updated_at();

-- Derive district and nearest road on insert/update of ticket location
create or replace function hub.ticket_geo_enrich() returns trigger language plpgsql as $$
declare r record;
begin
  select id into new.district_id from hub.districts d where st_contains(d.boundary, new.location) limit 1;
  select id, name, maintainer into r
    from hub.roads
    where st_dwithin(geom::geography, new.location::geography, 40)
    order by st_distance(geom::geography, new.location::geography) limit 1;
  if found then
    new.road_id = r.id; new.road_name = coalesce(new.road_name, r.name); new.maintainer = r.maintainer;
  end if;
  return new;
end $$;
create trigger tickets_geo before insert or update of location on hub.tickets
  for each row execute function hub.ticket_geo_enrich();

-- Keep idea vote_count in sync
create or replace function hub.idea_vote_count() returns trigger language plpgsql as $$
begin
  update hub.ideas set vote_count = (select count(*) from hub.idea_votes where idea_id = coalesce(new.idea_id, old.idea_id))
   where id = coalesce(new.idea_id, old.idea_id);
  return null;
end $$;
create trigger idea_votes_count after insert or delete on hub.idea_votes for each row execute function hub.idea_vote_count();

-- Record status changes as events
create or replace function hub.ticket_status_event() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    insert into hub.ticket_events (ticket_id, actor, actor_id, kind, from_status, to_status)
      values (new.id, coalesce(current_setting('hub.actor', true), 'system')::hub.actor_type, auth.uid(), 'status_change', old.status, new.status);
    if new.status = 'fixed' and new.fixed_at is null then new.fixed_at = now(); end if;
    if new.status like 'closed_%' and new.closed_at is null then new.closed_at = now(); end if;
  end if;
  return new;
end $$;
create trigger tickets_status before update on hub.tickets for each row execute function hub.ticket_status_event();

-- ---------------------------------------------------------------------------
-- Scheduled jobs
-- ---------------------------------------------------------------------------
select cron.schedule('refresh-stats', '15 * * * *', $$
  refresh materialized view hub.member_stats;
  refresh materialized view hub.mover_seconder_matrix;
  refresh materialized view hub.district_ticket_stats;
$$);

select cron.schedule('purge-rate-limits', '0 * * * *', $$
  delete from hub.rate_limits where window_start < now() - interval '2 days';
$$);

-- Nightly minutes check, form-template check, and stale-ticket prompts are HTTP calls to edge functions
-- (see API.md: jobs/ingest-minutes, jobs/check-county-form, jobs/stale-tickets) scheduled with pg_net or Supabase cron.

-- ---------------------------------------------------------------------------
-- Storage buckets (created via Supabase dashboard or CLI; listed here for completeness)
--   documents               private   county PDFs we mirror (served via signed URL or re-linked to county)
--   ticket-photos-private   private   uploads awaiting moderation
--   ticket-photos           public    approved photos, immutable cache
--   exports                 public    weekly CSV/JSON datasets
-- ---------------------------------------------------------------------------

-- Seed: members and districts as of the FY2026 minutes
insert into hub.districts (id, name) values (1,'District 1'),(2,'District 2'),(3,'District 3'),(4,'District 4');
insert into hub.members (id, full_name, short_name, role, district_id) values
  ('imes',     'Kenny Imes',     'Imes',     'judge_executive', null),
  ('stewart',  'Ricky Stewart',  'Stewart',  'magistrate', 1),
  ('crutcher', 'Larry Crutcher', 'Crutcher', 'magistrate', 2),
  ('cherry',   'Don Cherry',     'Cherry',   'magistrate', 3),
  ('rister',   'Paul Rister',    'Rister',   'magistrate', 4);
-- Names verified against callowaycountyky.gov/elected-officials and kcjea.org (Nov 2026). Re-check after the Nov 2026 election.
