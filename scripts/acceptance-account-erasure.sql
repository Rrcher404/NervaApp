-- Account-erasure carve-out acceptance certificate.
--
-- Proves the append-only guard survives the carve-out from BOTH sides:
--   (a) a normal brick DELETE / UPDATE for a CONTINUING user STILL fails
--       (DESIGN-PRINCIPLES §1 intact — no decrement path),
--   (b) public.delete_account() genuinely erases the account: the auth.users,
--       profiles and — crucially — the bricks rows are all gone afterwards,
--   (c) the guard is FULL-STRENGTH again after an erasure runs in the same
--       transaction (the flag is transaction-local and lowered immediately, so a
--       later brick DELETE for a different, continuing user still raises).
--
-- Seeds throwaway users, runs the checks, then RAISES a PROOF_OK_ROLLBACK
-- sentinel so the whole transaction rolls back and ZERO rows are left behind
-- (double-important here — bricks cannot be deleted afterwards on any normal path).
--
-- PASS = the error message is exactly "PROOF_OK_ROLLBACK: 6/6 ...".
-- FAIL = any other "FAIL: ..." message (an assertion tripped before the sentinel).
--
-- Run: Supabase SQL editor, psql, or the Supabase MCP execute_sql. Reproducible.
do $$
declare
  v_a uuid := gen_random_uuid();   -- the CONTINUING user
  v_b uuid := gen_random_uuid();   -- the user being ERASED
  v_normal_delete_blocked boolean := false;
  v_update_blocked        boolean := false;
  v_before int; v_after int; v_prof int; v_auth int;
  v_still_blocked boolean := false;
begin
  -- seed two throwaway users, each with one permanent brick
  insert into auth.users (id, email, aud, role, email_confirmed_at, created_at, updated_at,
      instance_id, raw_app_meta_data, raw_user_meta_data)
    values
      (v_a,'erase-a@thesieve.test','authenticated','authenticated',now(),now(),now(),
        '00000000-0000-0000-0000-000000000000','{}'::jsonb,'{}'::jsonb),
      (v_b,'erase-b@thesieve.test','authenticated','authenticated',now(),now(),now(),
        '00000000-0000-0000-0000-000000000000','{}'::jsonb,'{}'::jsonb);
  insert into public.bricks (user_id, source_action, source_id)
    values (v_a,'milestone',gen_random_uuid()), (v_b,'milestone',gen_random_uuid());

  -- (a) NORMAL DELETE STILL FAILS — a continuing user's brick cannot be deleted,
  --     even as postgres (belt-and-suspenders guard, no flag raised).
  begin
    delete from public.bricks where user_id = v_a;
    v_normal_delete_blocked := false;   -- reached only if the guard did NOT raise
  exception when others then
    v_normal_delete_blocked := true;
  end;

  -- (a') NORMAL UPDATE STILL FAILS — a brick's value can never change.
  begin
    update public.bricks set source_action = 'quest' where user_id = v_a;
    v_update_blocked := false;
  exception when others then
    v_update_blocked := true;
  end;

  -- (b) ACCOUNT ERASURE SUCCEEDS and removes the bricks.
  select count(*) into v_before from public.bricks where user_id = v_b;   -- expect 1
  perform public.delete_account(v_b);
  select count(*) into v_after from public.bricks where user_id = v_b;    -- expect 0
  select count(*) into v_prof  from public.profiles where id = v_b;       -- expect 0
  select count(*) into v_auth  from auth.users where id = v_b;            -- expect 0

  -- (c) GUARD RESTORED — after erasure the flag is down again, so the continuing
  --     user's brick is STILL undeletable (proves the carve-out did not leak).
  begin
    delete from public.bricks where user_id = v_a;
    v_still_blocked := false;
  exception when others then
    v_still_blocked := true;
  end;

  if not v_normal_delete_blocked then raise exception 'FAIL: normal brick DELETE was allowed (decrement path opened!)'; end if;
  if not v_update_blocked        then raise exception 'FAIL: normal brick UPDATE was allowed'; end if;
  if v_before <> 1               then raise exception 'FAIL: seed brick for erased user missing (before=%)', v_before; end if;
  if v_after  <> 0               then raise exception 'FAIL: bricks survived account erasure (after=%)', v_after; end if;
  if v_prof   <> 0               then raise exception 'FAIL: profile survived account erasure (prof=%)', v_prof; end if;
  if v_auth   <> 0               then raise exception 'FAIL: auth.users row survived account erasure (auth=%)', v_auth; end if;
  if not v_still_blocked         then raise exception 'FAIL: guard leaked — brick DELETE allowed after erasure ran'; end if;

  raise exception 'PROOF_OK_ROLLBACK: 6/6 — normal DELETE+UPDATE refused; delete_account erased auth+profile+bricks; guard restored after';
end $$;
