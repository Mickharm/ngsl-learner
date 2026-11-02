-- 家人聯絡簿 (v4) — one line per learner, visible to every signed-in member.
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- What is shared: display name, today's finished periods, minutes, streak and
-- word power. Nothing about individual words or answers.
create table if not exists public.family_board (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  day         date not null,
  done_steps  integer not null default 0,
  total_steps integer not null default 0,
  minutes     integer not null default 0,
  streak      integer not null default 0,
  xp          integer not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.family_board enable row level security;

drop policy if exists "family: members read" on public.family_board;
create policy "family: members read" on public.family_board
  for select using (auth.role() = 'authenticated');

drop policy if exists "family: own insert" on public.family_board;
create policy "family: own insert" on public.family_board
  for insert with check (auth.uid() = user_id);

drop policy if exists "family: own update" on public.family_board;
create policy "family: own update" on public.family_board
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
