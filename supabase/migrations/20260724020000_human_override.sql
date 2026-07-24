-- The epistemic-control layer (§5 "you keep the judgment"): SECURITY INVOKER so
-- RLS ("own rows only") enforces ownership natively. The human overrides the
-- machine's filing — moves a mis-threaded catch, resolves a merge the audit
-- only proposed. A HUMAN move is not the banned machine reshuffle.
create or replace function public.recompute_thread(p_thread uuid)
returns void language plpgsql security invoker set search_path = public, extensions as $$
declare v_n int;
begin
  if p_thread is null then return; end if;
  select count(*) into v_n from public.catches where thread_id = p_thread;
  if v_n = 0 then delete from public.threads where id = p_thread; return; end if;
  update public.threads t set size = sub.n, centroid = sub.c, last_activity = now()
  from (select count(*)::int n, avg(embedding)::vector(1536) c
        from public.catches where thread_id = p_thread and embedding is not null) sub
  where t.id = p_thread;
end $$;
create or replace function public.move_catch(p_catch_id uuid, p_to_thread uuid)
returns void language plpgsql security invoker set search_path = public, extensions as $$
declare v_old uuid;
begin
  select thread_id into v_old from public.catches where id = p_catch_id;
  update public.catches set thread_id = p_to_thread where id = p_catch_id;
  perform public.recompute_thread(v_old);
  perform public.recompute_thread(p_to_thread);
end $$;
create or replace function public.resolve_merge(p_proposal_id uuid, p_accept boolean)
returns void language plpgsql security invoker set search_path = public, extensions as $$
declare v_a uuid; v_b uuid;
begin
  select thread_a, thread_b into v_a, v_b from public.merge_proposals
    where id = p_proposal_id and status = 'pending';
  if v_a is null then return; end if;
  if p_accept then
    update public.catches set thread_id = v_a where thread_id = v_b;
    update public.merge_proposals set status='applied', updated_at=now() where id = p_proposal_id;
    perform public.recompute_thread(v_a);
    delete from public.threads where id = v_b;
  else
    update public.merge_proposals set status='dismissed', updated_at=now() where id = p_proposal_id;
  end if;
end $$;
grant execute on function public.recompute_thread(uuid) to authenticated;
grant execute on function public.move_catch(uuid, uuid) to authenticated;
grant execute on function public.resolve_merge(uuid, boolean) to authenticated;
