-- The Return (build item 4): card discovery for generation + atomic answer→brick.

-- Catches that are sieved (embedded + threaded) but have no question card yet.
-- SECURITY DEFINER: the drain (service_role) calls it; deduped/bounded server-side.
create or replace function public.catches_needing_cards(p_user_id uuid, p_limit int)
returns table(id uuid, raw_content text, transcript text, thread_id uuid, source_meta jsonb)
language sql security definer set search_path to 'public'
as $$
  select c.id, c.raw_content, c.transcript, c.thread_id, c.source_meta
  from public.catches c
  where c.user_id = p_user_id
    and c.status = 'sieved'
    and c.thread_id is not null
    and not exists (select 1 from public.question_cards q where q.catch_id = c.id)
  order by c.captured_at asc
  limit p_limit;
$$;
revoke execute on function public.catches_needing_cards(uuid, int) from anon, authenticated, public;
grant execute on function public.catches_needing_cards(uuid, int) to service_role;

-- Answer a card: append to history, advance FSRS state (computed via ts-fsrs),
-- and MINT A BRICK — atomically, so the brick law (append-only, one answered card
-- = one brick) can never half-apply. SECURITY INVOKER: RLS enforces ownership.
create or replace function public.answer_card(
  p_card_id uuid,
  p_user_answer text,
  p_fsrs_state jsonb,
  p_due_at timestamptz
) returns uuid
language plpgsql security invoker set search_path to 'public'
as $$
declare v_uid uuid; v_brick uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_user_answer is null or length(btrim(p_user_answer)) = 0 then
    raise exception 'an answer in your own words is required';
  end if;

  update public.question_cards
    set user_answer = p_user_answer,
        answer_history = answer_history
          || jsonb_build_object('answer', p_user_answer, 'at', now(), 'due_at', p_due_at),
        fsrs_state = p_fsrs_state,
        due_at = p_due_at
    where id = p_card_id and user_id = v_uid;
  if not found then raise exception 'card not found'; end if;

  insert into public.bricks (user_id, source_action, source_id)
    values (v_uid, 'answered_card', p_card_id)
    returning id into v_brick;

  return v_brick;
end $$;
revoke execute on function public.answer_card(uuid, text, jsonb, timestamptz) from anon, public;
grant execute on function public.answer_card(uuid, text, jsonb, timestamptz) to authenticated;
