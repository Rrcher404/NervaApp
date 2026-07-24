-- Account erasure carve-out for the append-only bricks guard.
--
-- DESIGN-PRINCIPLES §1: "No decrement path may exist in code. Lifetime records
-- only go up. A bad Tuesday cannot erase them." The bricks_no_* triggers enforce
-- this by raising on ANY update/delete/truncate. Correct for the product law —
-- but the SAME trigger fires on the CASCADE delete when a user row leaves
-- auth.users (auth.users -> profiles -> bricks, all ON DELETE CASCADE). So the
-- cascade aborts and account deletion / GDPR erasure is impossible. Found while
-- deleting a test user during item 4: "bricks are append-only".
--
-- The distinction the law actually cares about:
--   * a CONTINUING user shrinking their own lifetime record  -> stays banned forever
--   * the WHOLE account (user + every one of their rows) going away in one
--     transaction                                            -> must be allowed
--
-- These are not the same act. Erasure is not a decrement — there is no "after"
-- state for the user to feel a loss in. We encode exactly that difference: a
-- single sanctioned path (public.delete_account) raises a transaction-local flag
-- immediately around the erasing statement, and the guard permits a brick DELETE
-- only while that flag is up. Everything else — every UPDATE, every TRUNCATE,
-- every DELETE for a user who is staying — still raises, unchanged.

-- ============ the sanctioned erasure path ============
-- SECURITY DEFINER so it can delete from auth.users (cascading through profiles
-- and every user-owned table, bricks included). Self-scoped: an authenticated
-- caller may only erase THEIR OWN account; a null-uid caller (service_role /
-- server-side admin, e.g. an /api/account/delete route or a support tool) may
-- erase any id. This is the ONLY code that ever sets sieve.account_erasure.
create or replace function public.delete_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if p_user_id is null then
    raise exception 'delete_account: user id is required';
  end if;

  -- A logged-in user can only erase themselves. service_role / server code has no
  -- jwt sub, so auth.uid() is null and the check is skipped for the admin path.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'delete_account: you can only delete your own account';
  end if;

  -- Raise the flag ONLY around the erasing statement. Transaction-local, so it
  -- cannot leak to a later statement or another session; lowered again the moment
  -- the cascade returns, so the guard is back to full strength for the rest of the
  -- transaction. The bypass window is exactly one delete.
  perform set_config('sieve.account_erasure', 'on', true);
  delete from auth.users where id = p_user_id;
  perform set_config('sieve.account_erasure', 'off', true);
end $$;

-- Not a REST-callable surface for anon; self-service erasure for a logged-in user,
-- admin erasure for server code. (The self-check inside makes 'authenticated' safe:
-- the arg is ignored in favour of auth.uid() ownership.)
revoke execute on function public.delete_account(uuid) from anon, public;
grant execute on function public.delete_account(uuid) to authenticated, service_role;

-- ============ the guard, now with the ONE carve-out ============
-- Belt AND suspenders: even service-role / definer code cannot mutate or delete a
-- brick — EXCEPT a whole-account erasure routed through delete_account(), which is
-- the only thing that raises the flag. This is not a decrement path for a
-- continuing user: no user-facing role can reach a brick DELETE at all (bricks has
-- SELECT + INSERT policies only, no DELETE/UPDATE policy, so RLS denies it before
-- this trigger is even consulted). The flag only widens what the privileged erasure
-- path can do, and only for genuine erasure. UPDATE and TRUNCATE are never carved
-- out — a brick's value can never change, and the table can never be wiped.
-- search_path pinned (advisor remediation carried forward from 20260723201811).
create or replace function public.bricks_are_append_only()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and current_setting('sieve.account_erasure', true) = 'on' then
    return old;
  end if;
  raise exception 'bricks are append-only (DESIGN-PRINCIPLES §1: lifetime records only go up)';
end $$;
