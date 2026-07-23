-- The Sieve — core schema (MASTER-PLAN §9)
-- Laws encoded here:
--   * capture is sacred: catches.status defaults to 'raw'; enrichment is async via sieve_queue
--   * threads never shuffle: no batch re-clustering; merge_suggestions is proposals only
--   * bricks are append-only: INSERT-only grants + trigger guard; no decrement path exists
--   * embedding model versioned in schema
--   * events is append-only analytics

create extension if not exists vector;
create extension if not exists pg_cron;

-- ============ profiles (mirrors auth.users) ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  settings jsonb not null default '{}'::jsonb,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile - select" on public.profiles for select using (auth.uid() = id);
create policy "own profile - insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile - update" on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ projects ============
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  real_deadline date,
  focus_sentence text,
  isp_stage_signal text,
  created_at timestamptz not null default now()
);
alter table public.projects enable row level security;
create policy "own projects" on public.projects for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index projects_user_idx on public.projects(user_id);

-- ============ threads ============
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  name text,
  centroid vector(1536),
  embedding_model text not null default 'text-embedding-3-small',
  size int not null default 0,
  last_activity timestamptz not null default now(),
  merge_suggestions jsonb not null default '[]'::jsonb,  -- proposals ONLY; human confirms
  created_at timestamptz not null default now()
);
alter table public.threads enable row level security;
create policy "own threads" on public.threads for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index threads_user_idx on public.threads(user_id);
create index threads_project_idx on public.threads(project_id);

-- ============ catches — capture NEVER fails ============
create table public.catches (
  id uuid primary key default gen_random_uuid(),          -- client-generated for offline-first
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  thread_id uuid references public.threads(id) on delete set null,
  type text not null check (type in ('voice','link','text','image')),
  raw_content text not null,                              -- persists synchronously, always
  transcript text,
  source_url text,
  source_meta jsonb not null default '{}'::jsonb,
  claim_extract text,
  embedding vector(1536),
  embedding_model text,                                    -- versioned: model swap can't scramble history
  status text not null default 'raw' check (status in ('raw','sieving','sieved','failed_extract')),
  created_at timestamptz not null default now(),
  captured_at timestamptz not null default now()           -- client timestamp (offline capture time)
);
alter table public.catches enable row level security;
create policy "own catches" on public.catches for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index catches_user_idx on public.catches(user_id);
create index catches_thread_idx on public.catches(thread_id);
create index catches_status_idx on public.catches(status);

-- ============ question_cards ============
create table public.question_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  catch_id uuid references public.catches(id) on delete cascade,
  thread_id uuid references public.threads(id) on delete cascade,
  question text not null,
  user_answer text,
  answer_history jsonb not null default '[]'::jsonb,
  fsrs_state jsonb not null default '{}'::jsonb,
  due_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.question_cards enable row level security;
create policy "own cards" on public.question_cards for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index cards_user_due_idx on public.question_cards(user_id, due_at);

-- ============ bricks — APPEND-ONLY. No decrement path exists. ============
create table public.bricks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_action text not null check (source_action in
    ('catch','answered_card','quest','harvest','milestone')),
  source_id uuid,
  created_at timestamptz not null default now()
);
alter table public.bricks enable row level security;
-- SELECT + INSERT only. There is deliberately no UPDATE or DELETE policy:
-- with RLS enabled and no policy, those operations are denied for all users.
create policy "own bricks - select" on public.bricks for select using (auth.uid() = user_id);
create policy "own bricks - insert" on public.bricks for insert with check (auth.uid() = user_id);
create index bricks_user_idx on public.bricks(user_id, created_at);

-- Belt AND suspenders: even service-role/definer code cannot mutate or delete bricks.
create or replace function public.bricks_are_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'bricks are append-only (DESIGN-PRINCIPLES §1: lifetime records only go up)';
end $$;
create trigger bricks_no_update before update on public.bricks
  for each row execute function public.bricks_are_append_only();
create trigger bricks_no_delete before delete on public.bricks
  for each row execute function public.bricks_are_append_only();
create trigger bricks_no_truncate before truncate on public.bricks
  for each statement execute function public.bricks_are_append_only();

-- ============ quests — deterministic, date-seeded; vanish without residue ============
create table public.quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  generated_from jsonb not null default '{}'::jsonb,
  prompt text not null,
  expires_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.quests enable row level security;
create policy "own quests" on public.quests for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ sessions — hyperfocus harvest ============
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  harvest jsonb not null default '{}'::jsonb
);
alter table public.sessions enable row level security;
create policy "own sessions" on public.sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ events — append-only analytics ============
create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;
create policy "own events - select" on public.events for select using (auth.uid() = user_id);
create policy "own events - insert" on public.events for insert with check (auth.uid() = user_id);

-- ============ sieve_queue — jobs chunked + idempotent FROM COMMIT ONE ============
create table public.sieve_queue (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  catch_id uuid references public.catches(id) on delete cascade,
  job_kind text not null check (job_kind in
    ('scrape','transcribe','embed','thread_assign','question_gen','thread_audit')),
  dedupe_key text not null,                -- idempotency: same job never runs twice
  status text not null default 'pending' check (status in
    ('pending','claimed','done','failed')),
  attempts int not null default 0,
  max_attempts int not null default 5,
  claimed_at timestamptz,
  last_error text,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (dedupe_key)
);
alter table public.sieve_queue enable row level security;
create policy "own queue - select" on public.sieve_queue for select using (auth.uid() = user_id);
create policy "own queue - insert" on public.sieve_queue for insert with check (auth.uid() = user_id);
create index queue_pending_idx on public.sieve_queue(status, run_after) where status = 'pending';
