-- Advisor remediations (all four warnings from get_advisors on the initial schema)

-- 1. pin search_path on the bricks guard
create or replace function public.bricks_are_append_only()
returns trigger language plpgsql
set search_path = public
as $$
begin
  raise exception 'bricks are append-only (DESIGN-PRINCIPLES §1: lifetime records only go up)';
end $$;

-- 2. handle_new_user must not be callable via the API surface
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- 3. move vector extension out of public
create schema if not exists extensions;
alter extension vector set schema extensions;
grant usage on schema extensions to anon, authenticated;
