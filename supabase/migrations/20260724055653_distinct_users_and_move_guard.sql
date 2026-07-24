-- Distinct-user work-discovery + move_catch ownership guard
-- (faithful export of the live remote migration).

-- Deduped server-side so the ~1000-row PostgREST cap is on USERS, not rows.
create or replace function public.users_with_threads()
  returns setof uuid language sql security definer set search_path to 'public'
as $$ select distinct user_id from public.threads; $$;

create or replace function public.users_with_pending_catches()
  returns setof uuid language sql security definer set search_path to 'public'
as $$
  select distinct user_id from public.catches
  where status <> 'failed_extract' and (embedding is null or thread_id is null);
$$;

revoke execute on function public.users_with_threads() from anon, authenticated, public;
revoke execute on function public.users_with_pending_catches() from anon, authenticated, public;
grant execute on function public.users_with_threads() to service_role;
grant execute on function public.users_with_pending_catches() to service_role;

-- move_catch validates the TARGET thread exists (a mis-targeted move raises, never
-- silently drops the catch into a non-existent thread). recompute_thread on both ends.
create or replace function public.move_catch(p_catch_id uuid, p_to_thread uuid)
  returns void language plpgsql set search_path to 'public', 'extensions'
as $$
declare v_old uuid; v_moved int;
begin
  if p_to_thread is not null and not exists (
    select 1 from public.threads where id = p_to_thread
  ) then raise exception 'target thread not found'; end if;
  select thread_id into v_old from public.catches where id = p_catch_id;
  update public.catches set thread_id = p_to_thread where id = p_catch_id;
  get diagnostics v_moved = row_count;
  if v_moved = 0 then raise exception 'catch not found'; end if;
  perform public.recompute_thread(v_old);
  perform public.recompute_thread(p_to_thread);
end $$;
