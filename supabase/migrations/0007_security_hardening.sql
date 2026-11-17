-- Security hardening (applied 2026-11-17 after a review).
--
-- Findings fixed here:
--  * The public.*_public views are SECURITY DEFINER views over RLS-protected hub tables. Ten of them are simple
--    enough for Postgres to treat as updatable, and the API roles held INSERT/UPDATE/DELETE on them through
--    Supabase's default privileges, so anyone holding the public anon key could change or delete rows.
--    Views are now read-only for anon and authenticated, now and for views created later.
--  * hub.set_ticket_status was executable by every role while the hub schema is exposed through the API, so any
--    signed-in account could change any ticket's status. It is now server-only (service_role).
--  * The GraphQL endpoint mirrored the same grants and nothing on the hub uses it; access is withdrawn.

revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;

revoke execute on function hub.set_ticket_status(text, hub.ticket_status, hub.actor_type, text) from public, anon, authenticated;
grant execute on function hub.set_ticket_status(text, hub.ticket_status, hub.actor_type, text) to service_role;
revoke execute on function hub.admin_role() from public, anon;

revoke usage on schema graphql_public from anon, authenticated;

-- The server role (service_role) was never granted the Ask tables created in 0005, so every answer and rating
-- was silently refused ("permission denied for table ai_answers") and sharing found nothing to share.
-- Grant them, and make it the default for tables added to the hub schema later.
grant select, insert, update, delete on hub.ai_answers, hub.ai_feedback to service_role;
grant usage, select on all sequences in schema hub to service_role;
alter default privileges for role postgres in schema hub grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema hub grant usage, select on sequences to service_role;
