-- Nightly cleanup for the site analytics (the last piece of migration 0006).
-- Run once in the Supabase Dashboard: project calloway-transparency-hub > SQL Editor > New query > paste > Run.
-- Deletes page views older than 400 days and search terms older than 90 days, and drops each day's random
-- salt once the day is over so visitor codes can never be re-derived. Safe to run again: it replaces the job.
select cron.unschedule('analytics-purge') where exists (select 1 from cron.job where jobname = 'analytics-purge');
select cron.schedule('analytics-purge', '23 5 * * *', $$
  delete from hub.page_views where ts < now() - interval '400 days';
  delete from hub.site_searches where ts < now() - interval '90 days';
  delete from hub.analytics_salts where day < (now() at time zone 'America/Chicago')::date;
$$);
