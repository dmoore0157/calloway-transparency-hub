-- Site analytics: cookieless page-view and search counts, owned by the hub.
-- No cookies, no IP addresses and no user agents are stored. A visitor is counted with a hash of
-- (IP + user agent + a random salt for that day); each salt is deleted after the day ends, so a visitor
-- cannot be followed from one day to the next and the hash cannot be traced back to anyone.
-- Bots, crawlers, headless browsers and link-preview fetchers are dropped. Raw rows are kept 400 days,
-- search terms 90 days. Only editors (hub.is_admin()) can read anything back.

create table if not exists hub.analytics_salts (
  day date primary key,
  salt bytea not null default extensions.gen_random_bytes(32)
);
alter table hub.analytics_salts enable row level security; -- no policies: only security-definer functions touch it

create table if not exists hub.page_views (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  day date not null default (now() at time zone 'America/Chicago')::date,
  path text not null check (char_length(path) between 1 and 200),
  section text not null,
  referrer text check (referrer is null or char_length(referrer) <= 120),
  device text not null check (device in ('phone', 'tablet', 'desktop')),
  visitor text not null,   -- daily hash, see above
  new_visit boolean not null default false
);
create index if not exists page_views_day on hub.page_views (day);
create index if not exists page_views_path on hub.page_views (path, day);
-- the same visitor reloading the same page within a minute counts once
create unique index if not exists page_views_dedupe on hub.page_views (visitor, path, date_trunc('minute', ts at time zone 'UTC'));
alter table hub.page_views enable row level security;
create policy page_views_admin on hub.page_views for select to authenticated using (hub.is_admin());

create table if not exists hub.site_searches (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  day date not null default (now() at time zone 'America/Chicago')::date,
  term text not null check (char_length(term) between 2 and 80),
  results int not null check (results >= 0),
  visitor text not null
);
create index if not exists site_searches_day on hub.site_searches (day);
create unique index if not exists site_searches_dedupe on hub.site_searches (visitor, term, day);
alter table hub.site_searches enable row level security;
create policy site_searches_admin on hub.site_searches for select to authenticated using (hub.is_admin());

-- daily visitor hash from the request headers; returns null for bots
create or replace function hub.visitor_hash() returns text
language plpgsql security definer set search_path = hub, extensions, public as $$
declare
  h json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  ua text := coalesce(h->>'user-agent', '');
  ip text := coalesce(nullif(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1), ''), h->>'cf-connecting-ip', h->>'x-real-ip', '');
  d date := (now() at time zone 'America/Chicago')::date;
  s bytea;
begin
  if ua = '' or ua ~* '(bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly|whatsapp|curl|wget|python|node-fetch|axios|go-http|java/|okhttp|monitor|uptime|pingdom|scan)' then
    return null;
  end if;
  insert into hub.analytics_salts (day) values (d) on conflict (day) do nothing;
  select salt into s from hub.analytics_salts where day = d;
  return encode(extensions.digest(s || convert_to(ip || '|' || ua, 'UTF8'), 'sha256'), 'hex');
end $$;
revoke all on function hub.visitor_hash() from public, anon, authenticated;

create or replace function public.track_view(p_path text, p_referrer text default null, p_device text default 'desktop')
returns void language plpgsql security definer set search_path = hub, public as $$
declare v text := hub.visitor_hash(); clean text; sec text; ref text; dev text;
begin
  if v is null then return; end if;
  clean := left(regexp_replace(coalesce(p_path, '/'), '[?#].*$', ''), 200);
  if clean = '' or clean !~ '^/' then clean := '/' || clean; end if;
  if clean ~ '^/admin' then return; end if;
  sec := coalesce(nullif(split_part(clean, '/', 2), ''), 'home');
  ref := nullif(left(lower(regexp_replace(coalesce(p_referrer, ''), '^www\.', '')), 120), '');
  dev := case when p_device in ('phone', 'tablet', 'desktop') then p_device else 'desktop' end;
  insert into hub.page_views (path, section, referrer, device, visitor, new_visit)
  values (clean, sec, ref, dev, v, not exists (select 1 from hub.page_views pv where pv.visitor = v and pv.ts > now() - interval '30 minutes'))
  on conflict do nothing;
end $$;

create or replace function public.track_search(p_term text, p_results int)
returns void language plpgsql security definer set search_path = hub, public as $$
declare v text := hub.visitor_hash(); t text := left(lower(btrim(regexp_replace(coalesce(p_term, ''), '\s+', ' ', 'g'))), 80);
begin
  if v is null or char_length(t) < 2 then return; end if;
  -- keep the longest term a visitor typed for the same search (typing "brid", "bridg", "bridge" counts once)
  delete from hub.site_searches s where s.visitor = v and s.day = (now() at time zone 'America/Chicago')::date and t like s.term || '%' and s.term <> t;
  if exists (select 1 from hub.site_searches s where s.visitor = v and s.day = (now() at time zone 'America/Chicago')::date and s.term like t || '%') then return; end if;
  insert into hub.site_searches (term, results, visitor) values (t, greatest(coalesce(p_results, 0), 0), v) on conflict do nothing;
end $$;
grant execute on function public.track_view(text, text, text) to anon, authenticated;
grant execute on function public.track_search(text, int) to anon, authenticated;

-- one call returns the whole dashboard; editors only
create or replace function public.analytics_summary(p_days int default 30)
returns json language plpgsql stable security definer set search_path = hub, public as $$
declare since date := (now() at time zone 'America/Chicago')::date - greatest(least(coalesce(p_days, 30), 400), 1) + 1; out json;
begin
  if not hub.is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  select json_build_object(
    'since', since,
    'totals', (select json_build_object('views', count(*), 'visitors', count(distinct (visitor, day)), 'visits', count(*) filter (where new_visit)) from page_views where day >= since),
    'today', (select json_build_object('views', count(*), 'visitors', count(distinct visitor)) from page_views where day = (now() at time zone 'America/Chicago')::date),
    'daily', (select coalesce(json_agg(r order by r.day), '[]') from (select day, count(*) as views, count(distinct visitor) as visitors from page_views where day >= since group by day) r),
    'pages', (select coalesce(json_agg(r), '[]') from (select path, count(*) as views, count(distinct (visitor, day)) as visitors from page_views where day >= since group by path order by 2 desc limit 40) r),
    'sections', (select coalesce(json_agg(r), '[]') from (select section, count(*) as views, count(distinct (visitor, day)) as visitors from page_views where day >= since group by section order by 2 desc) r),
    'referrers', (select coalesce(json_agg(r), '[]') from (select referrer, count(*) filter (where new_visit) as visits from page_views where day >= since and referrer is not null group by referrer order by 2 desc limit 20) r),
    'devices', (select coalesce(json_agg(r), '[]') from (select device, count(distinct (visitor, day)) as visitors from page_views where day >= since group by device order by 2 desc) r),
    'searches', (select coalesce(json_agg(r), '[]') from (select term, count(*) as times, min(results) as results from site_searches where day >= since group by term order by 2 desc, 1 limit 40) r),
    'no_result_searches', (select coalesce(json_agg(r), '[]') from (select term, count(*) as times from site_searches where day >= since and results = 0 group by term order by 2 desc, 1 limit 20) r),
    'questions', (select coalesce(json_agg(r), '[]') from (select left(question, 200) as question, status, created_at from ai_answers where created_at >= since order by created_at desc limit 40) r)
  ) into out;
  return out;
end $$;
revoke all on function public.analytics_summary(int) from public, anon;
grant execute on function public.analytics_summary(int) to authenticated;

-- retention; salts are dropped once their day is over so daily hashes can't be re-derived
select cron.schedule('analytics-purge', '23 5 * * *', $$
  delete from hub.page_views where ts < now() - interval '400 days';
  delete from hub.site_searches where ts < now() - interval '90 days';
  delete from hub.analytics_salts where day < (now() at time zone 'America/Chicago')::date;
$$);
