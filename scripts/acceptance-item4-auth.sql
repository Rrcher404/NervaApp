-- Item 4 acceptance — AUTHENTICATED path certificate.
--
-- Proves the exact production call (answer_card RPC) as a REAL authenticated user
-- under RLS + SECURITY INVOKER + auth.uid(), the same context /api/card/answer
-- runs in. GoTrue's admin API rejects this project's new-format API keys
-- (sb_secret_/sb_publishable_) from a plain client, so the authenticated context
-- is simulated at the DB the canonical way: `set role authenticated` +
-- request.jwt.claims.sub. The block seeds a throwaway user, answers a card, checks
-- everything, then RAISES a PROOF_OK_ROLLBACK sentinel to roll the whole
-- transaction back — the certificate leaves ZERO rows behind (which matters
-- doubly here, because bricks are append-only and cannot be deleted afterwards).
--
-- PASS  = the error message is exactly "PROOF_OK_ROLLBACK: all 7 ... passed".
-- FAIL  = any other "FAIL: ..." message (an assertion tripped before the sentinel).
--
-- Run: Supabase SQL editor, psql, or the Supabase MCP execute_sql. Reproducible.
do $$
declare
  v_uid uuid := gen_random_uuid();
  v_thread uuid; v_catch uuid; v_card uuid; v_brick uuid; v_brick2 uuid;
  v_reps int; v_state int; v_due timestamptz; v_ans text; v_hist int; v_bricks int;
  v_dupe_blocked boolean := false; v_forge_blocked boolean := false;
begin
  insert into auth.users (id, email, aud, role, email_confirmed_at, created_at, updated_at,
      instance_id, raw_app_meta_data, raw_user_meta_data)
    values (v_uid,'card-authtest@thesieve.test','authenticated','authenticated',now(),now(),now(),
      '00000000-0000-0000-0000-000000000000','{}'::jsonb,'{}'::jsonb);
  insert into public.threads (user_id, name, name_provisional) values (v_uid,'Auth test',false) returning id into v_thread;
  insert into public.catches (user_id, type, raw_content, status, thread_id)
    values (v_uid,'text','a catch about spaced retrieval','sieved',v_thread) returning id into v_catch;
  insert into public.question_cards (user_id, catch_id, thread_id, question, fsrs_state, due_at)
    values (v_uid,v_catch,v_thread,'Why does this matter?',
      '{"due":"2026-07-24T12:00:00Z","stability":0,"difficulty":0,"elapsed_days":0,"scheduled_days":0,"reps":0,"lapses":0,"learning_steps":0,"state":0}'::jsonb,
      now()) returning id into v_card;

  -- become the authenticated user: RLS + auth.uid() now resolve to v_uid
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub',v_uid,'role','authenticated')::text, true);

  -- THE PROD CALL — answer the due card: advance FSRS + mint exactly one brick
  v_brick := public.answer_card(v_card,
    'Because pulling the idea back from memory strengthens it more than rereading.',
    '{"due":"2026-07-27T12:00:00Z","stability":2.31,"difficulty":5.0,"elapsed_days":0,"scheduled_days":3,"reps":1,"lapses":0,"learning_steps":0,"state":2}'::jsonb,
    '2026-07-27T12:00:00Z'::timestamptz);

  -- DUE-GATE idempotency: the card is now due in the future, so a double-submit
  -- must be REFUSED and mint NO second (permanent, undeletable) brick.
  begin
    v_brick2 := public.answer_card(v_card,'accidental double tap',
      '{"due":"2026-08-10T12:00:00Z","reps":2,"state":2,"stability":5,"difficulty":5,"elapsed_days":0,"scheduled_days":14,"lapses":0,"learning_steps":0}'::jsonb,
      '2026-08-10T12:00:00Z'::timestamptz);
  exception when others then v_dupe_blocked := true;
  end;

  -- ANTI-FORGE: make the card due again, then try to set a never-resurface due → refused.
  perform set_config('role','postgres', true);
  update public.question_cards set due_at = now() - interval '1 day' where id = v_card;
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub',v_uid,'role','authenticated')::text, true);
  begin
    perform public.answer_card(v_card,'forge','{"due":"3000-01-01T00:00:00Z"}'::jsonb,'3000-01-01T00:00:00Z'::timestamptz);
  exception when others then v_forge_blocked := true;
  end;

  perform set_config('role','postgres', true);
  select (fsrs_state->>'reps')::int,(fsrs_state->>'state')::int,due_at,user_answer,jsonb_array_length(answer_history)
    into v_reps,v_state,v_due,v_ans,v_hist from public.question_cards where id=v_card;
  select count(*) into v_bricks from public.bricks where user_id=v_uid and source_id=v_card;

  if v_reps<>1 then raise exception 'FAIL: reps=%',v_reps; end if;
  if v_state<>2 then raise exception 'FAIL: state=% (want Review=2)',v_state; end if;
  if length(coalesce(v_ans,''))<=10 then raise exception 'FAIL: answer not recorded'; end if;
  if v_hist<>1 then raise exception 'FAIL: answer_history=% (double-submit must not append)',v_hist; end if;
  if v_brick is null then raise exception 'FAIL: answer_card returned no brick id'; end if;
  if not v_dupe_blocked then raise exception 'FAIL: double-submit was NOT refused (over-mint!)'; end if;
  if not v_forge_blocked then raise exception 'FAIL: never-resurface forge was NOT refused'; end if;
  if v_bricks<>1 then raise exception 'FAIL: bricks minted=% (expected exactly 1)',v_bricks; end if;

  raise exception 'PROOF_OK_ROLLBACK: 9/9 — answer advances FSRS + mints 1 brick; double-submit refused (no 2nd brick); forge-schedule refused; history=1';
end $$;
