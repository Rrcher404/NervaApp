revoke execute on function public.assert_thread_owner() from anon, authenticated, public;
create policy "audit_runs service-only" on public.audit_runs
  for all to anon, authenticated using (false) with check (false);
