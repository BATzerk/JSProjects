# Collections

A fanmade spinoff of the NYT's game Connections, plus a creator page for
building and sharing Brett's custom boards.

## Pages

- **`index.html`** — the game. Plays the built-in sample puzzle by default,
  a published custom puzzle with `?p=<id>`, or an unpublished preview via
  `#preview=<data>` links from the creator.
- **`create.html`** — the puzzle creator. Enter four groups of four, drag the
  cards to set the exact starting board layout, preview it, then publish to
  Neon to get a shareable link.

## Running locally

You can open `index.html` or `create.html` directly in a browser for local play,
creation, drag-arranging, autosaved drafts, and preview links.

Any static file server also works:

```sh
npx serve Collections
```

Or use the `Collections` entry in `.claude/launch.json`.

## Neon setup

Publishing and playing shared puzzles needs a free Neon project:

1. Create a project at [neon.com](https://neon.com).
2. Enable **Managed Better Auth** and provision the branch's **Data API** with
   Neon Auth. The app uses short-lived anonymous tokens; players do not log in.
3. Open the **SQL Editor** and run [`neon/schema.sql`](neon/schema.sql).
4. Copy the branch's **Data API URL** and **Auth URL** into
   [`src/config.js`](src/config.js).

Until then everything else still works: the sample puzzle, building puzzles,
drag-arranging the board, and preview links (which encode the whole puzzle in
the URL — no database involved).

Neon publishing works from either a hosted copy of these files or a local copy
on your computer, including pages opened directly as `file://...`. The browser
sends PostgREST-compatible HTTPS requests to Neon's Data API using short-lived
anonymous tokens from Neon Auth; hosting is not required for inserts or reads.

The public Data API is intentionally limited by Postgres grants and row-level
security to reading and inserting puzzles. It cannot update or delete them.

### Import the existing puzzles

The Supabase export is retained at
[`supabase/puzzles-export.json`](supabase/puzzles-export.json). After applying
the Neon schema, import it with:

```sh
node neon/import-puzzles.mjs 'https://your-data-api-url' 'https://your-auth-url'
```

The import is repeatable: existing puzzle IDs are left unchanged.

## Current game rules

- 16 cards, four hidden groups of four, colored by difficulty:
  yellow (easiest), green, blue, purple (trickiest).
- Select four or more cards and submit. The first four selected are guessed;
  after a correct guess, any extras stay selected as the start of the next guess.
  Correct groups collapse into a colored banner. Wrong guesses deselect every
  card and cost one of four mistakes, with a "One away…" hint when three of four
  were right.
- Repeating a guess shows "Already guessed!" and costs nothing.
- Run out of mistakes and the remaining groups reveal themselves.
- Results modal shows the emoji grid of your guesses with one-tap copy to share.

## Structure

```
index.html / create.html    pages
styles/                     base + per-page CSS
src/
  config.js                 Neon Data API and Auth URLs (the only file you edit)
  db.js                     Neon Data API calls (fetch, no SDK dependency)
  game.js / create.js       page controllers
  builtin.js                the built-in sample puzzle
  flip.js                   FLIP animation helper
  toast.js / util.js        shared helpers
neon/schema.sql             database schema + row-level security
neon/import-puzzles.mjs     one-time data importer
supabase/puzzles-export.json historical source-data backup
```
