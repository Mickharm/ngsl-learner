-- ============================================================================
--  NGSL Learner — Supabase schema
--  Run once in: Supabase Dashboard → SQL Editor → New query → Run
--  Safe to re-run: every statement is idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles — one row per auth user
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles: upsert own" on public.profiles;
create policy "profiles: upsert own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------------
-- 2. word_data — SHARED enriched dictionary cache
--    Deliberately not per-user: enriching a word costs a Gemini call, so when
--    one account pays for it every account benefits. Read is open to any
--    signed-in user; writes are insert/update-only (no deletes) so a bad
--    client can't wipe the cache.
-- ---------------------------------------------------------------------------
create table if not exists public.word_data (
  id           integer primary key,          -- NGSL rank, 1..2801
  headword     text    not null,
  band         text    not null,
  ipa          text,
  meanings     jsonb   not null default '[]'::jsonb,
  examples     jsonb   not null default '[]'::jsonb,
  confusables  jsonb   not null default '[]'::jsonb,
  mnemonic     text,
  family       jsonb   not null default '[]'::jsonb,
  source       text    not null default 'gemini',
  updated_at   timestamptz not null default now()
);

create index if not exists word_data_headword_idx on public.word_data (headword);
create index if not exists word_data_band_idx on public.word_data (band);

alter table public.word_data enable row level security;

drop policy if exists "word_data: read for authenticated" on public.word_data;
create policy "word_data: read for authenticated" on public.word_data
  for select to authenticated using (true);

drop policy if exists "word_data: insert for authenticated" on public.word_data;
create policy "word_data: insert for authenticated" on public.word_data
  for insert to authenticated with check (true);

drop policy if exists "word_data: update for authenticated" on public.word_data;
create policy "word_data: update for authenticated" on public.word_data
  for update to authenticated using (true) with check (true);


-- ---------------------------------------------------------------------------
-- 3. card_progress — per-user SRS state, one row per word
-- ---------------------------------------------------------------------------
create table if not exists public.card_progress (
  user_id           uuid    not null references auth.users(id) on delete cascade,
  word_id           integer not null,
  state             text    not null default 'new',
  ease              real    not null default 2.5,
  interval_days     real    not null default 0,
  step_index        smallint not null default 0,
  due_at            timestamptz not null default now(),
  reps              integer not null default 0,
  lapses            integer not null default 0,
  streak            integer not null default 0,
  last_grade        smallint,
  last_reviewed_at  timestamptz,
  introduced_at     timestamptz,
  updated_at        timestamptz not null default now(),
  primary key (user_id, word_id)
);

create index if not exists card_progress_due_idx on public.card_progress (user_id, due_at);
create index if not exists card_progress_state_idx on public.card_progress (user_id, state);

alter table public.card_progress enable row level security;

drop policy if exists "cards: own rows" on public.card_progress;
create policy "cards: own rows" on public.card_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 4. review_log — append-only event stream, the basis of every statistic
-- ---------------------------------------------------------------------------
create table if not exists public.review_log (
  id           bigserial primary key,
  user_id      uuid    not null references auth.users(id) on delete cascade,
  word_id      integer not null,
  grade        smallint not null,
  mode         text    not null default 'card',   -- card | cloze | listening
  elapsed_ms   integer,
  reviewed_at  timestamptz not null default now()
);

create index if not exists review_log_user_time_idx on public.review_log (user_id, reviewed_at desc);

alter table public.review_log enable row level security;

drop policy if exists "review_log: own rows" on public.review_log;
create policy "review_log: own rows" on public.review_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 5. grammar_progress — same SRS treatment, applied to grammar points
-- ---------------------------------------------------------------------------
create table if not exists public.grammar_progress (
  user_id      uuid not null references auth.users(id) on delete cascade,
  grammar_id   text not null,
  state        text not null default 'new',
  ease         real not null default 2.5,
  interval_days real not null default 0,
  step_index   smallint not null default 0,
  due_at       timestamptz not null default now(),
  reps         integer not null default 0,
  lapses       integer not null default 0,
  streak       integer not null default 0,
  correct      integer not null default 0,
  attempts     integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (user_id, grammar_id)
);

alter table public.grammar_progress enable row level security;

drop policy if exists "grammar: own rows" on public.grammar_progress;
create policy "grammar: own rows" on public.grammar_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 6. user_settings — one jsonb blob per user (includes the Gemini key)
-- ---------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  payload    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "settings: own row" on public.user_settings;
create policy "settings: own row" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 7. daily_log — one row per user per calendar day (local date, text yyyy-mm-dd)
-- ---------------------------------------------------------------------------
create table if not exists public.daily_log (
  user_id          uuid not null references auth.users(id) on delete cascade,
  day              date not null,
  new_count        integer not null default 0,
  review_count     integer not null default 0,
  correct_count    integer not null default 0,
  total_count      integer not null default 0,
  grammar_correct  integer not null default 0,
  grammar_total    integer not null default 0,
  article_done     boolean not null default false,
  article_correct  integer not null default 0,
  article_total    integer not null default 0,
  seconds          integer not null default 0,
  completed        boolean not null default false,
  updated_at       timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.daily_log enable row level security;

drop policy if exists "daily_log: own rows" on public.daily_log;
create policy "daily_log: own rows" on public.daily_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 8. error_log — the mistake notebook
-- ---------------------------------------------------------------------------
create table if not exists public.error_log (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,               -- word | cloze | grammar | article
  ref_id      text not null,               -- word id, grammar id, or article key
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists error_log_user_idx on public.error_log (user_id, created_at desc);
create index if not exists error_log_open_idx on public.error_log (user_id) where resolved_at is null;

alter table public.error_log enable row level security;

drop policy if exists "error_log: own rows" on public.error_log;
create policy "error_log: own rows" on public.error_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 9. articles — generated reading, cached per user per day
-- ---------------------------------------------------------------------------
create table if not exists public.articles (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  day         date not null,
  topic       text not null default 'daily',
  title       text,
  title_zh    text,
  body        text not null,
  body_zh     text,
  word_ids    integer[] not null default '{}',
  questions   jsonb not null default '[]'::jsonb,
  answers     jsonb not null default '[]'::jsonb,
  score       integer,
  created_at  timestamptz not null default now(),
  unique (user_id, day, topic)
);

create index if not exists articles_user_day_idx on public.articles (user_id, day desc);

alter table public.articles enable row level security;

drop policy if exists "articles: own rows" on public.articles;
create policy "articles: own rows" on public.articles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 10. dialogues — generated travel roleplay, cached per user per scene
-- ---------------------------------------------------------------------------
create table if not exists public.dialogues (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  scene_key   text not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  unique (user_id, scene_key)
);

alter table public.dialogues enable row level security;

drop policy if exists "dialogues: own rows" on public.dialogues;
create policy "dialogues: own rows" on public.dialogues
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 11. keep updated_at honest
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['card_progress','grammar_progress','user_settings','daily_log','word_data']
  loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 12. stats helper — daily accuracy series without shipping every row
-- ---------------------------------------------------------------------------
create or replace function public.review_heatmap(days integer default 120)
returns table (day date, reviews bigint, correct bigint)
language sql stable security invoker as $$
  select
    (reviewed_at at time zone 'Asia/Taipei')::date as day,
    count(*)                                        as reviews,
    count(*) filter (where grade >= 2)              as correct
  from public.review_log
  where user_id = auth.uid()
    and reviewed_at >= now() - (days || ' days')::interval
  group by 1
  order by 1;
$$;

-- ============================================================================
--  Done. Verify with:  select count(*) from public.word_data;
-- ============================================================================
