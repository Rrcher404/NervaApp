-- Reliability: heartbeats + dead-men (faithful export of the live remote migration).
-- A pg_net drain/audit reports the SQL succeeded even on an HTTP 404/500, so a dead
-- background job is otherwise indistinguishable from a healthy one. These tables are
-- the honest record; the dead-man crons annunciate a stall into a POLLABLE row.
-- Idempotent so `supabase db push` reproduces live exactly.

create table if not exists public.drain_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  users int not null default 0,
  batches int not null default 0,
  error text
);
alter table public.drain_runs enable row level security;
drop policy if exists "drain_runs service-only" on public.drain_runs;
create policy "drain_runs service-only" on public.drain_runs
  for all to anon, authenticated using (false) with check (false);

create table if not exists public.ops_alerts (
  id bigint generated always as identity primary key,
  kind text not null,
  detail text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.ops_alerts enable row level security;
drop policy if exists "ops_alerts service-only" on public.ops_alerts;
create policy "ops_alerts service-only" on public.ops_alerts
  for all to anon, authenticated using (false) with check (false);

-- Dead-men: independent schedules so scheduler-death can't silence watcher and
-- watched together. Each inserts a pollable ops_alerts row (not just raise warning).
-- NOTE (punch list): nothing OUTSIDE this project reads ops_alerts yet — a project
-- pause silences the crons that write them. An external probe is still required.
select cron.unschedule('sieve-drain-deadman')
  where exists (select 1 from cron.job where jobname = 'sieve-drain-deadman');
select cron.schedule('sieve-drain-deadman', '15 * * * *', $$
  insert into public.ops_alerts (kind, detail)
  select 'drain_dead', 'no successful drain in 30m'
  where not exists (
    select 1 from public.drain_runs
    where completed_at is not null and error is null
      and started_at > now() - interval '30 minutes'
  );
$$);

select cron.unschedule('sieve-audit-deadman')
  where exists (select 1 from cron.job where jobname = 'sieve-audit-deadman');
select cron.schedule('sieve-audit-deadman', '0 */6 * * *', $$
  insert into public.ops_alerts (kind, detail)
  select 'audit_dead', 'no successful audit run in 26h'
  where not exists (
    select 1 from public.audit_runs
    where completed_at is not null and error is null
      and started_at > now() - interval '26 hours'
  );
$$);
