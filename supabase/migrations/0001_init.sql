-- Calloway County Transparency Hub: initial schema (Supabase project calloway-transparency-hub)
create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

create schema if not exists hub;

create type hub.source_kind as enum ('audited','county_reported','year_end','adopted_budget','minutes','ordinance','resolution','other');
create type hub.verification_status as enum ('extracted','verified','disputed','rejected');
create type hub.member_role as enum ('judge_executive','magistrate','county_attorney','clerk','treasurer','candidate','other');
create type hub.motion_outcome as enum ('passed','failed','no_second','tabled','withdrawn','consensus','no_vote');
create type hub.vote_method as enum ('voice_unanimous','voice_with_nays','voice_with_abstention','roll_call','consensus','no_vote');
create type hub.vote_value as enum ('aye','nay','abstain','absent','not_recorded');
create type hub.ticket_status as enum ('reported','submitted_to_county','acknowledged','in_progress','fixed','closed_not_county','closed_duplicate','closed_invalid');
create type hub.ticket_severity as enum ('emergency','urgent','routine','long_term');
create type hub.ticket_category as enum ('pothole','washout','drainage','downed_tree','sign','bridge','gravel_grading','vegetation','other');
create type hub.road_maintainer as enum ('county','state','city_murray','private','unknown');
create type hub.actor_type as enum ('reporter','resident','admin','county','system');
create type hub.photo_status as enum ('pending','approved','rejected','removed');
create type hub.idea_status as enum ('new','under_review','planned','in_progress','shipped','declined');
create type hub.idea_category as enum ('data_request','feature','fix','question','other');
create type hub.flag_status as enum ('open','confirmed_corrected','rejected');
create type hub.commitment_origin as enum ('campaign','in_office');
create type hub.commitment_rating as enum ('not_rated','in_the_works','stalled','kept','compromise','broken');
create type hub.rating_state as enum ('proposed','final','withdrawn');

create table hub.documents (id text primary key, kind hub.source_kind not null, title text not null, url text, storage_path text, sha256 text, fiscal_year int, document_date date, pages int, fetched_at timestamptz, created_at timestamptz not null default now());
create table hub.districts (id smallint primary key, name text not null, boundary extensions.geometry(MultiPolygon,4326), source_doc_id text references hub.documents(id));
create index districts_boundary_gix on hub.districts using gist (boundary);
create table hub.members (id text primary key, full_name text not null, short_name text not null, role hub.member_role not null, district_id smallint references hub.districts(id), term_start date, term_end date, active boolean not null default true);
create table hub.meetings (id text primary key, meeting_date date not null, kind text not null default 'regular', location text, source_doc_id text not null references hub.documents(id), summary text[], vote_notes text[], verification hub.verification_status not null default 'verified', verified_by uuid, verified_at timestamptz, created_at timestamptz not null default now());
create table hub.attendance (meeting_id text references hub.meetings(id) on delete cascade, member_id text references hub.members(id), present boolean not null, note text, primary key (meeting_id, member_id));
create table hub.motions (id text primary key, meeting_id text not null references hub.meetings(id) on delete cascade, sequence int not null, text text not null, summary text, category text[], mover_id text references hub.members(id), seconder_id text references hub.members(id), outcome hub.motion_outcome not null, vote_method hub.vote_method not null, result_label text, note text, dollar_amount numeric(14,2), is_routine boolean not null default false, related_doc_ids text[], budget_line_ids text[], source_doc_id text not null references hub.documents(id), source_page int, source_quote text, verification hub.verification_status not null default 'verified', verified_by uuid, verified_at timestamptz, created_at timestamptz not null default now());
create index motions_meeting_idx on hub.motions (meeting_id, sequence);
create index motions_text_trgm on hub.motions using gin (text extensions.gin_trgm_ops);
create table hub.votes (motion_id text references hub.motions(id) on delete cascade, member_id text references hub.members(id), value hub.vote_value not null, note text, primary key (motion_id, member_id));

create table hub.roads (id bigserial primary key, name text not null, maintainer hub.road_maintainer not null, route_id text, geom extensions.geometry(MultiLineString,4326) not null, source text not null, updated_at timestamptz not null default now());
create index roads_geom_gix on hub.roads using gist (geom);
create table hub.geocode_cache (key text primary key, result jsonb not null, created_at timestamptz not null default now());

create sequence hub.ticket_seq;
create table hub.tickets (
  id text primary key default ('CT-' || to_char(now(),'YYYY') || '-' || lpad(nextval('hub.ticket_seq')::text, 4, '0')),
  status hub.ticket_status not null default 'reported', category hub.ticket_category not null, severity hub.ticket_severity not null,
  description text not null check (char_length(description) between 10 and 2000),
  location extensions.geometry(Point,4326) not null, location_text text not null, road_id bigint references hub.roads(id), road_name text,
  maintainer hub.road_maintainer not null default 'unknown', district_id smallint references hub.districts(id), duplicate_of text references hub.tickets(id),
  submitted_to_county_at timestamptz, county_reference text, fixed_at timestamptz, closed_at timestamptz,
  reporter_token_hash text not null, ip_hash text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index tickets_location_gix on hub.tickets using gist (location);
create index tickets_status_idx on hub.tickets (status, created_at desc);
create table hub.ticket_contacts (ticket_id text primary key references hub.tickets(id) on delete cascade, first_name text not null, last_name text not null, phone text not null, email text not null, home_address text not null, email_opt_in boolean not null default true);
create table hub.ticket_events (id bigserial primary key, ticket_id text not null references hub.tickets(id) on delete cascade, actor hub.actor_type not null, actor_id uuid, kind text not null, from_status hub.ticket_status, to_status hub.ticket_status, note text, published boolean not null default true, created_at timestamptz not null default now());
create index ticket_events_ticket_idx on hub.ticket_events (ticket_id, created_at);
create table hub.ticket_photos (id uuid primary key default gen_random_uuid(), ticket_id text references hub.tickets(id) on delete cascade, event_id bigint references hub.ticket_events(id), status hub.photo_status not null default 'pending', private_path text not null, public_path text, width int, height int, bytes int, taken_at timestamptz, caption text, moderated_by uuid, moderated_at timestamptz, reject_reason text, created_at timestamptz not null default now());
create index ticket_photos_status_idx on hub.ticket_photos (status, created_at);
create table hub.county_form_template (form_id text primary key, url text not null, fields jsonb not null, fetched_at timestamptz not null default now(), changed boolean not null default false);

create table hub.ideas (id bigserial primary key, title text not null check (char_length(title) between 5 and 120), body text not null check (char_length(body) between 10 and 3000), category hub.idea_category not null, status hub.idea_status not null default 'new', status_note text, published boolean not null default false, submitter_token_hash text not null, submitter_email text, vote_count int not null default 0, ip_hash text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index ideas_status_idx on hub.ideas (status, vote_count desc);
create table hub.idea_votes (idea_id bigint references hub.ideas(id) on delete cascade, voter_token_hash text not null, created_at timestamptz not null default now(), primary key (idea_id, voter_token_hash));
create table hub.idea_comments (id bigserial primary key, idea_id bigint not null references hub.ideas(id) on delete cascade, actor hub.actor_type not null, body text not null check (char_length(body) <= 2000), published boolean not null default false, created_at timestamptz not null default now());
create table hub.data_flags (id bigserial primary key, record_table text not null, record_id text not null, message text not null check (char_length(message) between 10 and 2000), reporter_email text, status hub.flag_status not null default 'open', resolution text, resolved_by uuid, resolved_at timestamptz, created_at timestamptz not null default now());
create index data_flags_record_idx on hub.data_flags (record_table, record_id);
create table hub.contact_messages (id bigserial primary key, name text, email text, body text not null check (char_length(body) between 10 and 4000), ip_hash text, created_at timestamptz not null default now());

create table hub.elections (id text primary key, election_date date not null, kind text not null);
create table hub.candidacies (election_id text references hub.elections(id), member_id text references hub.members(id), office text not null, district_id smallint references hub.districts(id), party text, result text not null default 'pending', primary key (election_id, member_id, office));
create table hub.commitments (id bigserial primary key, member_id text not null references hub.members(id), origin hub.commitment_origin not null, election_id text references hub.elections(id), meeting_id text references hub.meetings(id), made_on date not null, quote text not null, summary text not null, category text[], scoreable boolean not null, wording_type text not null check (wording_type in ('effort','outcome')), measure text, deadline date, within_authority boolean not null default true, authority_note text, published boolean not null default false, created_by uuid, created_at timestamptz not null default now(), check (not scoreable or measure is not null), check ((origin = 'campaign' and election_id is not null) or origin = 'in_office'));
create index commitments_member_idx on hub.commitments (member_id);
create table hub.commitment_sources (id bigserial primary key, commitment_id bigint not null references hub.commitments(id) on delete cascade, kind text not null, url text, archive_url text, snapshot_path text, media_timestamp text, captured_at timestamptz not null default now());
create table hub.commitment_ratings (id bigserial primary key, commitment_id bigint not null references hub.commitments(id) on delete cascade, rating hub.commitment_rating not null, state hub.rating_state not null default 'proposed', reason text not null, proposed_by uuid, second_reviewer uuid, proposed_at timestamptz not null default now(), effective_at timestamptz not null default (now() + interval '7 days'), check (second_reviewer is null or second_reviewer <> proposed_by));
create index commitment_ratings_idx on hub.commitment_ratings (commitment_id, state, effective_at desc);
create table hub.commitment_evidence (id bigserial primary key, commitment_id bigint not null references hub.commitments(id) on delete cascade, rating_id bigint references hub.commitment_ratings(id), motion_id text references hub.motions(id), budget_line_id text, document_id text references hub.documents(id), source_page int, note text, suggested boolean not null default false, accepted boolean);
create table hub.response_invites (token_hash text primary key, member_id text not null references hub.members(id), sent_to text not null, expires_at timestamptz not null, used_at timestamptz);
create table hub.official_responses (id bigserial primary key, commitment_id bigint not null references hub.commitments(id) on delete cascade, member_id text not null references hub.members(id), body text not null check (char_length(body) <= 2500), received_via text not null, published boolean not null default false, withheld_reason text, created_at timestamptz not null default now());

create table hub.admins (email text primary key, role text not null default 'editor', display_name text, created_at timestamptz not null default now());
create table hub.rate_limits (bucket text not null, window_start timestamptz not null, count int not null default 0, primary key (bucket, window_start));
create table hub.audit_log (id bigserial primary key, actor_email text, action text not null, target text, before jsonb, after jsonb, created_at timestamptz not null default now());
create table hub.publishes (id bigserial primary key, triggered_by text, datasets text[], workflow_run_url text, commit_sha text, created_at timestamptz not null default now());

-- admin check: allow-listed email on the JWT
create or replace function hub.is_admin() returns boolean language sql stable security definer set search_path = hub, public as $$
  select exists (select 1 from hub.admins a where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
create or replace function hub.admin_role() returns text language sql stable security definer set search_path = hub, public as $$
  select a.role from hub.admins a where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1;
$$;

-- triggers
create or replace function hub.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger tickets_touch before update on hub.tickets for each row execute function hub.touch_updated_at();
create trigger ideas_touch before update on hub.ideas for each row execute function hub.touch_updated_at();

create or replace function hub.ticket_geo_enrich() returns trigger language plpgsql set search_path = hub, extensions, public as $$
declare r record;
begin
  select id into new.district_id from hub.districts d where d.boundary is not null and st_contains(d.boundary, new.location) limit 1;
  select id, name, maintainer into r from hub.roads where st_dwithin(geom::geography, new.location::geography, 40) order by st_distance(geom::geography, new.location::geography) limit 1;
  if found then new.road_id = r.id; new.road_name = coalesce(new.road_name, r.name); if new.maintainer = 'unknown' then new.maintainer = r.maintainer; end if; end if;
  return new;
end $$;
create trigger tickets_geo before insert or update of location on hub.tickets for each row execute function hub.ticket_geo_enrich();

create or replace function hub.idea_vote_count() returns trigger language plpgsql as $$
begin update hub.ideas set vote_count = (select count(*) from hub.idea_votes where idea_id = coalesce(new.idea_id, old.idea_id)) where id = coalesce(new.idea_id, old.idea_id); return null; end $$;
create trigger idea_votes_count after insert or delete on hub.idea_votes for each row execute function hub.idea_vote_count();

create or replace function hub.ticket_status_event() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    insert into hub.ticket_events (ticket_id, actor, kind, from_status, to_status, note)
      values (new.id, coalesce(nullif(current_setting('hub.actor', true), ''), 'system')::hub.actor_type, 'status_change', old.status, new.status, nullif(current_setting('hub.note', true), ''));
    if new.status = 'fixed' and new.fixed_at is null then new.fixed_at = now(); end if;
    if new.status::text like 'closed_%' and new.closed_at is null then new.closed_at = now(); end if;
  end if;
  return new;
end $$;
create trigger tickets_status before update on hub.tickets for each row execute function hub.ticket_status_event();

-- public views (owner = postgres, so anon sees only these columns and rows)
create or replace view public.members_public as select id, full_name, short_name, role, district_id, active from hub.members;
create or replace view public.tickets_public as
  select t.id, t.status, t.category, t.severity, t.description, extensions.st_y(t.location) as lat, extensions.st_x(t.location) as lng, t.location_text, t.road_name, t.maintainer, t.district_id, t.duplicate_of, t.submitted_to_county_at, t.county_reference, t.fixed_at, t.closed_at, t.created_at, t.updated_at,
    (select count(*) from hub.ticket_photos p where p.ticket_id = t.id and p.status = 'approved') as photo_count
  from hub.tickets t where t.status <> 'closed_invalid';
create or replace view public.ticket_photos_public as select id, ticket_id, event_id, public_path, width, height, taken_at, caption, created_at from hub.ticket_photos where status = 'approved';
create or replace view public.ticket_events_public as select id, ticket_id, actor, kind, from_status, to_status, case when published then note end as note, created_at from hub.ticket_events;
create or replace view public.ideas_public as select id, title, body, category, status, status_note, vote_count, created_at, updated_at from hub.ideas where published;
create or replace view public.idea_comments_public as select id, idea_id, actor, body, created_at from hub.idea_comments where published;
create or replace view public.corrections_log as select id, record_table, record_id, message, resolution, resolved_at, created_at from hub.data_flags where status = 'confirmed_corrected';
create or replace view public.commitments_public as
  select c.id, c.member_id, c.origin, c.election_id, c.meeting_id, c.made_on, c.quote, c.summary, c.category, c.scoreable, c.wording_type, c.measure, c.deadline, c.within_authority, c.authority_note, c.created_at,
    (select r.rating from hub.commitment_ratings r where r.commitment_id = c.id and r.state = 'final' order by r.effective_at desc limit 1) as current_rating,
    (select r.rating from hub.commitment_ratings r where r.commitment_id = c.id and r.state = 'proposed' order by r.proposed_at desc limit 1) as proposed_rating
  from hub.commitments c where c.published;
create or replace view public.commitment_ratings_public as select r.id, r.commitment_id, r.rating, r.state, r.reason, r.proposed_at, r.effective_at, (r.second_reviewer is not null) as second_reviewed from hub.commitment_ratings r join hub.commitments c on c.id = r.commitment_id where c.published and r.state <> 'withdrawn';
create or replace view public.commitment_sources_public as select s.id, s.commitment_id, s.kind, s.url, s.archive_url, s.snapshot_path, s.media_timestamp, s.captured_at from hub.commitment_sources s join hub.commitments c on c.id = s.commitment_id where c.published;
create or replace view public.commitment_evidence_public as select e.id, e.commitment_id, e.rating_id, e.motion_id, e.budget_line_id, e.document_id, e.source_page, e.note from hub.commitment_evidence e join hub.commitments c on c.id = e.commitment_id where c.published and e.accepted;
create or replace view public.official_responses_public as select id, commitment_id, member_id, body, received_via, created_at from hub.official_responses where published;
create or replace view public.commitment_scores as
with current_rating as (select distinct on (commitment_id) commitment_id, rating from hub.commitment_ratings where state = 'final' order by commitment_id, effective_at desc),
tallies as (
  select m.id as member_id, m.full_name, m.role, m.district_id,
    count(c.id) as scoreable_total,
    count(*) filter (where cr.rating = 'kept') as kept, count(*) filter (where cr.rating = 'compromise') as compromise, count(*) filter (where cr.rating = 'broken') as broken,
    count(c.id) filter (where cr.rating is null or cr.rating in ('in_the_works','stalled','not_rated')) as pending
  from hub.members m left join hub.commitments c on c.member_id = m.id and c.scoreable and c.published left join current_rating cr on cr.commitment_id = c.id
  where m.active and m.role in ('judge_executive','magistrate') group by m.id, m.full_name, m.role, m.district_id)
select t.*, (t.kept + t.compromise + t.broken) as resolved,
  case when (t.kept + t.compromise + t.broken) >= 5 then round((t.kept + 0.5 * t.compromise)::numeric / (t.kept + t.compromise + t.broken), 3) end as score,
  ((t.kept + t.compromise + t.broken) >= 5) as ranked from tallies t;
create or replace view public.district_ticket_stats as
  select d.id as district_id, d.name,
    count(t.id) filter (where t.status in ('reported','submitted_to_county','acknowledged','in_progress')) as open_tickets,
    count(t.id) filter (where t.status = 'fixed') as fixed_tickets, count(t.id) as total_tickets,
    percentile_cont(0.5) within group (order by extract(epoch from (t.fixed_at - coalesce(t.submitted_to_county_at, t.created_at)))/86400) filter (where t.fixed_at is not null) as median_days_to_fix
  from hub.districts d left join hub.tickets t on t.district_id = d.id and t.status <> 'closed_invalid' group by d.id, d.name;
create or replace view public.hub_status as
  select (select count(*) from hub.tickets) as tickets, (select count(*) from hub.ticket_photos where status = 'pending') as photos_pending,
    (select count(*) from hub.ideas where published) as ideas, (select count(*) from hub.data_flags where status = 'open') as flags_open,
    (select count(*) from hub.commitments where published) as commitments, (select max(created_at) from hub.publishes) as last_publish;

create or replace function public.tickets_geojson(statuses text[] default null) returns jsonb language sql stable security definer set search_path = public, hub, extensions as $$
  select coalesce(jsonb_build_object('type','FeatureCollection','features', jsonb_agg(jsonb_build_object('type','Feature','geometry', st_asgeojson(t.location)::jsonb,
    'properties', jsonb_build_object('id',t.id,'status',t.status,'category',t.category,'severity',t.severity,'road_name',t.road_name,'location_text',t.location_text,'created_at',t.created_at,'district_id',t.district_id,'maintainer',t.maintainer,
      'photo_count',(select count(*) from hub.ticket_photos p where p.ticket_id = t.id and p.status = 'approved'))))), jsonb_build_object('type','FeatureCollection','features','[]'::jsonb))
  from hub.tickets t where t.status <> 'closed_invalid' and (statuses is null or t.status::text = any(statuses));
$$;
create or replace function public.nearby_tickets(lat double precision, lng double precision, meters double precision default 75, days int default 90) returns setof public.tickets_public language sql stable security definer set search_path = public, hub, extensions as $$
  select tp.* from public.tickets_public tp join hub.tickets t on t.id = tp.id
  where st_dwithin(t.location::geography, st_setsrid(st_makepoint(lng, lat), 4326)::geography, meters) and t.created_at > now() - make_interval(days => days) order by t.created_at desc limit 10;
$$;

-- RLS: every hub table locked; admins get everything; anon reads only public views
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'hub' loop
    execute format('alter table hub.%I enable row level security', t);
    execute format('create policy admin_all on hub.%I for all to authenticated using (hub.is_admin()) with check (hub.is_admin())', t);
  end loop; end $$;
grant usage on schema hub to authenticated, service_role;
grant all on all tables in schema hub to authenticated, service_role;
grant all on all sequences in schema hub to authenticated, service_role;
grant execute on all functions in schema hub to authenticated, service_role;
grant select on public.members_public, public.tickets_public, public.ticket_photos_public, public.ticket_events_public, public.ideas_public, public.idea_comments_public, public.corrections_log,
  public.commitments_public, public.commitment_ratings_public, public.commitment_sources_public, public.commitment_evidence_public, public.official_responses_public, public.commitment_scores, public.district_ticket_stats, public.hub_status to anon, authenticated;
grant execute on function public.tickets_geojson(text[]) to anon, authenticated;
grant execute on function public.nearby_tickets(double precision, double precision, double precision, int) to anon, authenticated;

-- expose hub schema to the API for admins (RLS protects it)
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, hub';
notify pgrst, 'reload config';

-- storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('ticket-photos-private', 'ticket-photos-private', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('ticket-photos', 'ticket-photos', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('commitment-archive', 'commitment-archive', true, 20971520, null),
  ('exports', 'exports', true, 52428800, null)
on conflict (id) do nothing;

-- scheduled jobs
select cron.schedule('finalize-ratings', '30 6 * * *', $$
  update hub.commitment_ratings r set state = 'final' where r.state = 'proposed' and r.effective_at <= now()
    and not exists (select 1 from hub.data_flags f where f.record_table = 'commitment_ratings' and f.record_id = r.id::text and f.status = 'open')
    and (r.rating <> 'broken' or r.second_reviewer is not null or (select count(*) from hub.admins a where a.role in ('owner','editor')) < 2);
$$);
select cron.schedule('purge-rate-limits', '0 * * * *', $$ delete from hub.rate_limits where window_start < now() - interval '2 days'; $$);
select cron.schedule('purge-unattached-photos', '15 * * * *', $$ delete from hub.ticket_photos where ticket_id is null and created_at < now() - interval '24 hours'; $$);

-- seed reference data
insert into hub.districts (id, name) values (1,'District 1'),(2,'District 2'),(3,'District 3'),(4,'District 4');
insert into hub.members (id, full_name, short_name, role, district_id) values
  ('imes','Kenny Imes','Imes','judge_executive',null),('stewart','Ricky Stewart','Stewart','magistrate',1),('crutcher','Larry Crutcher','Crutcher','magistrate',2),('cherry','Don Cherry','Cherry','magistrate',3),('rister','Paul Rister','Rister','magistrate',4);
insert into hub.elections (id, election_date, kind) values ('2026-primary','2026-05-19','primary'),('2026-general','2026-11-03','general');
insert into hub.admins (email, role, display_name) values ('david@citeddigital.com','owner','Hub owner');
insert into hub.county_form_template (form_id, url, fields) values ('wpforms-3078','https://callowaycountyky.gov/calloway-county-road-concern/',
 '[{"name":"wpforms[fields][3][first]","label":"Resident Information - First","type":"text"},{"name":"wpforms[fields][3][last]","label":"Resident Information - Last","type":"text"},{"name":"wpforms[fields][12]","label":"Your Street Address, City, State, Zip","type":"text"},{"name":"wpforms[fields][14]","label":"Phone Number","type":"text"},{"name":"wpforms[fields][6]","label":"Email","type":"email"},{"name":"wpforms[fields][7]","label":"Magistrate (if known)","type":"select","options":["District 1 - Ricky Stewart","District 2 - Larry Crutcher","District 3 - Don Cherry","District 4 - Paul Rister","Unknown/Not Sure"]},{"name":"wpforms[fields][8]","label":"Exact location of the issue","type":"textarea"},{"name":"wpforms[fields][9]","label":"Description of the concern","type":"textarea"},{"name":"wpforms[fields][10]","label":"Severity Level","type":"radio","options":["Emergency (e.g., downed trees, flooding)","Urgent (e.g., safety hazards)","Routine (e.g., potholes, grading requests)","Long-term (e.g., drainage redesign)"]}]'::jsonb);
