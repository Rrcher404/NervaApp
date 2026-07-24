-- Item 4 fast-follow (committee dim-3): close the brick over-mint + forge-schedule holes.
-- DUE-GATE gives idempotency for double-submit/replay WITHOUT breaking legitimate
-- spaced replays: a card just answered is pushed to the future, so an immediate
-- re-call finds it not-due and mints no second brick; a genuine re-answer on a
-- LATER Return (due_at back in the past) is allowed — "replays mint bricks".
-- Plus a schedule sanity-bound so a direct PostgREST call can't forge a
-- never-resurface due_at. Row lock (FOR UPDATE) serialises concurrent submits.
create or replace function public.answer_card(
  p_card_id uuid,
  p_user_answer text,
  p_fsrs_state jsonb,
  p_due_at timestamptz
) returns uuid
language plpgsql security invoker set search_path to 'public'
as $$
declare v_uid uuid; v_brick uuid; v_due timestamptz;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_user_answer is null or length(btrim(p_user_answer)) = 0 then
    raise exception 'an answer in your own words is required';
  end if;
  if p_due_at is null or p_due_at <= now() or p_due_at > now() + interval '10 years' then
    raise exception 'invalid schedule';
  end if;

  select due_at into v_due from public.question_cards
    where id = p_card_id and user_id = v_uid for update;
  if not found then raise exception 'card not found'; end if;
  if v_due is not null and v_due > now() then
    raise exception 'card not due yet';
  end if;

  update public.question_cards
    set user_answer = p_user_answer,
        answer_history = answer_history
          || jsonb_build_object('answer', p_user_answer, 'at', now(), 'due_at', p_due_at),
        fsrs_state = p_fsrs_state,
        due_at = p_due_at
    where id = p_card_id and user_id = v_uid;

  insert into public.bricks (user_id, source_action, source_id)
    values (v_uid, 'answered_card', p_card_id)
    returning id into v_brick;

  return v_brick;
end $$;
revoke execute on function public.answer_card(uuid, text, jsonb, timestamptz) from anon, public;
grant execute on function public.answer_card(uuid, text, jsonb, timestamptz) to authenticated;
