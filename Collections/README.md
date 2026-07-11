# Collections

A fanmade spinoff of the NYT's game Connections, plus a creator page for
building and sharing Brett's custom boards.

## Pages

- **`index.html`** — the game. Plays the built-in sample puzzle by default,
  a published custom puzzle with `?p=<id>`, or an unpublished preview via
  `#preview=<data>` links from the creator.
- **`create.html`** — the puzzle creator. Enter four groups of four, drag the
  cards to set the exact starting board layout, preview it, then publish to
  Supabase to get a shareable link.

## Running locally

You can open `index.html` or `create.html` directly in a browser for local play,
creation, drag-arranging, autosaved drafts, and preview links.

Any static file server also works:

```sh
npx serve Collections
```

Or use the `Collections` entry in `.claude/launch.json`.

## Supabase setup (~2 minutes)

Publishing and playing shared puzzles needs a free Supabase project:

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** and run the contents of [`supabase/schema.sql`](supabase/schema.sql).
3. In **Project Settings → API**, copy the **Project URL** and **publishable key**
   into [`src/config.js`](src/config.js).

Until then everything else still works: the sample puzzle, building puzzles,
drag-arranging the board, and preview links (which encode the whole puzzle in
the URL — no database involved).

Supabase publishing works from either a hosted copy of these files or a local
copy on your computer, including pages opened directly as `file://...`. The
browser sends the same REST requests using the public anon key in `src/config.js`;
hosting is not required for inserts or reads.

The publishable key only allows reading and inserting puzzles; row-level security in
the schema blocks updates and deletes.

## Current game rules

- 16 cards, four hidden groups of four, colored by difficulty:
  yellow (easiest), green, blue, purple (trickiest).
- Select four cards and submit. Correct groups collapse into a colored banner;
  wrong guesses cost one of four mistakes, with a "One away…" hint when three
  of four were right.
- Repeating a guess shows "Already guessed!" and costs nothing.
- Run out of mistakes and the remaining groups reveal themselves.
- Results modal shows the emoji grid of your guesses with one-tap copy to share.

## Structure

```
index.html / create.html    pages
styles/                     base + per-page CSS
src/
  config.js                 Supabase credentials (the only file you edit)
  db.js                     Supabase REST calls (fetch, no SDK dependency)
  game.js / create.js       page controllers
  builtin.js                the built-in sample puzzle
  flip.js                   FLIP animation helper
  toast.js / util.js        shared helpers
supabase/schema.sql         database schema + row-level security
```
