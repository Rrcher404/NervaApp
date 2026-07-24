-- Merge-proposal scan (correct operator: <=> is DISTANCE, similarity = 1 - dist).
create or replace function public.propose_merges(p_user_id uuid, p_threshold real default 0.80)
returns int language plpgsql security definer set search_path = public, extensions as $$
declare v_written int := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 1));
  with pairs as (
    select a.id ta, b.id tb, (1 - (a.centroid <=> b.centroid))::real sim
    from public.threads a join public.threads b
      on a.user_id = b.user_id and a.embedding_model = b.embedding_model and a.id < b.id
    where a.user_id = p_user_id and a.centroid is not null and b.centroid is not null
      and a.size >= 1 and b.size >= 1 and (1 - (a.centroid <=> b.centroid)) >= p_threshold
  )
  insert into public.merge_proposals (user_id, thread_a, thread_b, similarity, status)
  select p_user_id, ta, tb, sim, 'pending' from pairs
  on conflict (thread_a, thread_b) do nothing;
  get diagnostics v_written = row_count;
  return v_written;
end $$;
revoke execute on function public.propose_merges(uuid, real) from anon, authenticated, public;
grant execute on function public.propose_merges(uuid, real) to service_role;

create extension if not exists pg_net with schema extensions;

-- Nightly audit + dead-man's-switch. URL + secret live in Vault (audit_url,
-- audit_secret) — set once out of band, never committed:
--   select vault.create_secret('<url>','audit_url');
--   select vault.create_secret('<secret>','audit_secret');
select cron.schedule('sieve-nightly-audit', '10 4 * * *', $CRON$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='audit_url'),
    headers := jsonb_build_object('Content-Type','application/json',
      'x-audit-secret', (select decrypted_secret from vault.decrypted_secrets where name='audit_secret')),
    body := jsonb_build_object('at', now()), timeout_milliseconds := 55000);
$CRON$);
select cron.schedule('sieve-audit-deadman', '0 */6 * * *', $CRON$
  do $inner$ begin
    if not exists (select 1 from public.audit_runs
      where completed_at is not null and error is null and started_at > now() - interval '26 hours')
    then raise warning 'sieve audit dead-man: no successful audit run in 26h'; end if;
  end $inner$;
$CRON$);

-- (added later) server-side drain every 2 min — decouples embed+thread from an
-- open tab. Scheduled out of band (uses the same Vault audit_url/audit_secret):
--   select cron.schedule('sieve-drain','*/2 * * * *', $$ select net.http_post(
--     url := replace((select decrypted_secret from vault.decrypted_secrets where name='audit_url'),'/api/audit','/api/sieve-drain'),
--     headers := jsonb_build_object('Content-Type','application/json','x-audit-secret',(select decrypted_secret from vault.decrypted_secrets where name='audit_secret')),
--     body := jsonb_build_object('at',now()), timeout_milliseconds := 55000); $$);
