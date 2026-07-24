-- Collections: custom puzzle storage on Neon.
-- Provision an unauthenticated Neon Data API first, then run this once in the
-- Neon SQL Editor. The Data API creates the `anonymous` database role.

create table if not exists public.puzzles (
  id text primary key,
  title text not null check (char_length(title) between 1 and 80),
  author text check (author is null or char_length(author) <= 40),
  groups jsonb not null check (
    jsonb_typeof(groups) = 'array' and jsonb_array_length(groups) = 4
  ),
  board jsonb not null check (
    jsonb_typeof(board) = 'array' and jsonb_array_length(board) = 16
  ),
  created_at timestamptz not null default now(),
  constraint puzzles_id_format check (id ~ '^[a-z0-9]{4,24}$')
);

alter table public.puzzles enable row level security;

grant usage on schema public to anonymous;
grant select, insert on table public.puzzles to anonymous;

drop policy if exists "Anyone can read puzzles" on public.puzzles;
drop policy if exists "Anyone can create puzzles" on public.puzzles;

-- Public puzzle links and the puzzle browser need anonymous reads.
create policy "Anyone can read puzzles"
  on public.puzzles for select
  to anonymous
  using (true);

-- The creator publishes without accounts. Updates and deletes are deliberately
-- not granted, matching the old Supabase behavior.
create policy "Anyone can create puzzles"
  on public.puzzles for insert
  to anonymous
  with check (true);
