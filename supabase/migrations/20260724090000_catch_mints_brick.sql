-- §1: "Smallest unit of 'did research' = one catch or one answered card = one
-- permanent brick." Item 4 wired answered_card→brick; this wires catch→brick.
-- Catches carry a CLIENT-STABLE uuid, so a catch is inserted exactly once and
-- this fires exactly once — one brick per catch. A partial unique index is the
-- backstop (ON CONFLICT DO NOTHING) so no path can double-mint a catch brick;
-- it is scoped to source_action='catch' ONLY, so answered_card/quest bricks
-- (which legitimately repeat — "replays mint bricks") are untouched.
create unique index if not exists one_brick_per_catch
  on public.bricks (source_id) where source_action = 'catch';

-- Capture is sacred: a brick-mint failure must NEVER abort the catch write. The
-- inner block contains ANY failure (not only unique-violations) so a future
-- constraint on bricks can't propagate out of this AFTER-INSERT trigger and roll
-- back the catch. A missed brick is recoverable; a lost catch is not.
create or replace function public.mint_catch_brick()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.bricks (user_id, source_action, source_id)
      values (NEW.user_id, 'catch', NEW.id)
      on conflict do nothing;
  exception when others then
    null;
  end;
  return NEW;
end $$;

drop trigger if exists catch_mints_brick on public.catches;
create trigger catch_mints_brick after insert on public.catches
  for each row execute function public.mint_catch_brick();

-- A trigger function must not be callable as a REST RPC (it still fires on the
-- trigger regardless); revoking EXECUTE closes the /rpc/ exposure the advisor flags.
revoke execute on function public.mint_catch_brick() from anon, authenticated, public;
