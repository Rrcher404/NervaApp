-- resolve_merge re-points question_cards before deleting thread B
-- (faithful export of the live remote migration).
-- Previously question_cards.thread_id CASCADE-deleted with thread B, silently
-- destroying spaced-repetition state on an accepted merge. Now the cards move to
-- thread A alongside the catches. SECURITY INVOKER — RLS enforces ownership.

create or replace function public.resolve_merge(p_proposal_id uuid, p_accept boolean)
  returns void language plpgsql set search_path to 'public', 'extensions'
as $$
declare v_a uuid; v_b uuid;
begin
  select thread_a, thread_b into v_a, v_b from public.merge_proposals
    where id = p_proposal_id and status = 'pending';
  if v_a is null then return; end if;
  if p_accept then
    update public.catches set thread_id = v_a where thread_id = v_b;
    update public.question_cards set thread_id = v_a where thread_id = v_b;
    update public.merge_proposals set status = 'applied', updated_at = now() where id = p_proposal_id;
    perform public.recompute_thread(v_a);
    delete from public.threads where id = v_b;
  else
    update public.merge_proposals set status = 'dismissed', updated_at = now() where id = p_proposal_id;
  end if;
end $$;
