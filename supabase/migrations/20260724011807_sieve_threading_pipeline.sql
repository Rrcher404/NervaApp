-- Item 3: the Sieve pipeline — embeddings, single-linkage threading, merge audit.
-- Design: memory sieve-item3-threading-design. Adversarial-review-hardened.

alter table public.threads alter column embedding_model set default 'gemini-embedding-001';
alter table public.threads add column if not exists name_provisional boolean not null default true;

-- B3 backstop: a catch's thread must have the same owner (loud on cross-user bug).
create or replace function public.assert_thread_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if new.thread_id is null then return new; end if;
  select user_id into v_owner from public.threads where id = new.thread_id;
  if v_owner is null or v_owner <> new.user_id then
    raise exception 'cross-user thread assignment refused (catch % user % thread owner %)',
      new.id, new.user_id, v_owner;
  end if;
  return new;
end $$;
create trigger catches_thread_owner_guard
  before insert or update of thread_id on public.catches
  for each row execute function public.assert_thread_owner();

-- H5: merge proposals as pair-keyed rows with a status. Dismissed never resurface.
create table public.merge_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  thread_a uuid not null references public.threads(id) on delete cascade,
  thread_b uuid not null references public.threads(id) on delete cascade,
  similarity real not null,
  status text not null default 'pending' check (status in ('pending','dismissed','applied')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint merge_pair_ordered check (thread_a < thread_b),
  unique (thread_a, thread_b)
);
alter table public.merge_proposals enable row level security;
create policy "own merge proposals" on public.merge_proposals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index merge_proposals_user_idx on public.merge_proposals(user_id, status);

-- H6: cron dead-man's-switch heartbeat.
create table public.audit_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  threads_scanned int not null default 0,
  proposals_written int not null default 0,
  threads_named int not null default 0,
  error text
);
alter table public.audit_runs enable row level security;

-- B2 + single-linkage: the serialized threading critical section, one transaction
-- under a per-user advisory lock. Assignment = nearest already-sieved catch
-- (single-linkage — centroid collapses); centroid recomputed for the audit only.
create or replace function public.assign_catch_to_thread(
  p_catch_id uuid, p_user_id uuid, p_embedding vector(1536),
  p_model text, p_threshold real default 0.72
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_nearest_catch uuid; v_nearest_thread uuid; v_sim real; v_thread uuid; v_already uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select thread_id into v_already from public.catches
    where id = p_catch_id and user_id = p_user_id;
  if v_already is not null then return v_already; end if;

  select c.id, c.thread_id, 1 - (c.embedding <=> p_embedding)
    into v_nearest_catch, v_nearest_thread, v_sim
  from public.catches c
  where c.user_id = p_user_id and c.id <> p_catch_id
    and c.embedding is not null and c.embedding_model = p_model
  order by c.embedding <=> p_embedding limit 1;

  if v_nearest_catch is not null and v_sim >= p_threshold then
    if v_nearest_thread is not null then
      v_thread := v_nearest_thread;
    else
      insert into public.threads (user_id, embedding_model, size)
        values (p_user_id, p_model, 0) returning id into v_thread;
      update public.catches set thread_id = v_thread
        where id = v_nearest_catch and user_id = p_user_id;
    end if;
    update public.catches set thread_id = v_thread
      where id = p_catch_id and user_id = p_user_id and thread_id is null;
  else
    v_thread := null;
  end if;

  if v_thread is not null then
    update public.threads t set size = sub.n, centroid = sub.c, last_activity = now()
    from (select count(*)::int n, avg(embedding)::vector(1536) c
          from public.catches
          where thread_id = v_thread and user_id = p_user_id and embedding is not null) sub
    where t.id = v_thread;
  end if;
  return v_thread;
end $$;

revoke execute on function public.assign_catch_to_thread(uuid, uuid, vector, text, real)
  from anon, authenticated, public;
