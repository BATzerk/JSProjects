-- Collections: custom puzzle storage.
-- Run this once in your Supabase project's SQL Editor.

create table if not exists public.puzzles (
  id text primary key,
  title text not null check (char_length(title) between 1 and 80),
  author text check (author is null or char_length(author) <= 40),
  groups jsonb not null check (jsonb_array_length(groups) = 4),
  board jsonb not null check (jsonb_array_length(board) = 16),
  created_at timestamptz not null default now(),
  constraint puzzles_id_format check (id ~ '^[a-z0-9]{4,24}$')
);

alter table public.puzzles enable row level security;

-- Anyone with the anon key may read puzzles (players following a link)
-- and create new ones (the puzzle creator page). Nobody can update or
-- delete through the anon key.
create policy "Anyone can read puzzles"
  on public.puzzles for select
  using (true);

create policy "Anyone can create puzzles"
  on public.puzzles for insert
  with check (true);
