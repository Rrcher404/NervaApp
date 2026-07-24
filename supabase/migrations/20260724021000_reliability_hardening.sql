-- Rework cycle 2: close the error-swallowing disposition the committee named.
-- Drain heartbeat (a dead pg_net drain otherwise reads green forever).
create table public.drain_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(), completed_at timestamptz,
  users int not null default 0, batches int not null default 0, error text
);
alter table public.drain_runs enable row level security;
create policy "drain_runs service-only" on public.drain_runs for all to anon, authenticated using (false) with check (false);
-- Real annunciation: the dead-man writes a pollable row, not just a log warning.
create table public.ops_alerts (
  id bigint generated always as identity primary key,
  kind text not null, detail text, created_at timestamptz not null default now(), resolved_at timestamptz
);
alter table public.ops_alerts enable row level security;
create policy "ops_alerts service-only" on public.ops_alerts for all to anon, authenticated using (false) with check (false);
-- Distinct-user discovery: dedupe server-side so the ~1000-row cap is on users, not rows.
create or replace function public.users_with_threads() returns setof uuid
  language sql security definer set search_path=public as $$ select distinct user_id from public.threads; $$;
create or replace function public.users_with_pending_catches() returns setof uuid
  language sql security definer set search_path=public as $$
  select distinct user_id from public.catches where status <> 'failed_extract' and (embedding is null or thread_id is null); $$;
revoke execute on function public.users_with_threads() from anon, authenticated, public;
revoke execute on function public.users_with_pending_catches() from anon, authenticated, public;
grant execute on function public.users_with_threads() to service_role;
grant execute on function public.users_with_pending_catches() to service_role;
-- move_catch validates target ownership; resolve_merge moves question_cards before deleting B.
-- (see 20260724020000_human_override.sql for the base; redefined here with guards)
