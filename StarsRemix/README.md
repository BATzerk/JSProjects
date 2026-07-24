# StarsRemix

A fan-made recreation of Inkwell's puzzle game [Stars](https://inkwellgames.com/games/stars).

## Run locally

Requires Node.js 22.18 or newer so the development server and tests can run
TypeScript files directly.

```sh
npm run dev
```

Then open <http://localhost:5173>. The game can also be opened directly from
`index.html`; its browser runtime intentionally uses classic scripts and has no
build step.

### Board editor

Open `editor.html` directly to use the Board Workshop; its export flow does not
require the local development server. Paint any finished house shapes with left-click and drag;
number keys 1–9 (and 0 for house 10) choose a house color. Right-click or
Command/Ctrl-click and drag erases tiles. **Finish & test board** preserves every
painted house exactly, generates the remaining houses, verifies a unique
solution, and calculates difficulty. A successful board can then be published
directly to the Community library.

Developer-only JSON export remains available under **Debug tools**. To import
one of those files into the built-in catalog:

```sh
npm run import:board -- ~/Downloads/handmade-your-board-....json
```

The import revalidates the board, saves its permanent source under
`boards/handmade/`, and rebuilds both gameplay catalog files. Reload `index.html`,
open **Boards**, and select the board under its calculated difficulty.

### Community publishing with Google

The workshop can also publish directly to a Neon-backed community library.
Players build anonymously, then choose **Sign in to publish** only after their
board has been completed. Neon Auth handles Google sign-in; StarsRemix never
receives or stores a Google password. The static browser client talks directly
to the Neon Data API with a short-lived Neon Auth token; no application server
is required.

To connect a deployment:

1. Create or link a Neon project and enable Neon Auth.
2. Under **Auth → Configuration → OAuth providers**, enable Google. Neon's
   shared Google credentials are the simplest starting option.
3. Allow `http://localhost:5173`, `http://127.0.0.1:5173`, and the production
   site origin as trusted Auth domains.
4. Enable the Data API for the `starsremix` database with Neon Auth as its
   authentication provider. Restrict CORS to the production origin,
   `http://localhost:5173`, and `http://127.0.0.1:5173`; do not enable broad
   default table grants.
5. Run `neon env pull --file .env.local` so the local build has
   `DATABASE_URL`, `NEON_DATA_API_URL`, and `NEON_AUTH_BASE_URL`.
6. Run `npm run db:migrate` once. The migration enables row-level security:
   boards are publicly readable, publishing requires a signed-in Neon user,
   and only the owner can delete a board. Updates are not granted.
7. Start the app with `npm run dev`.

Without these environment variables, the workshop remains fully usable and
offers JSON download while clearly marking community publishing as unconnected.
Only the public Data API and Auth service URLs are compiled into the browser
bundle. `DATABASE_URL` remains local and must never be uploaded.

Before a board is published, the browser solves and rates it again. Postgres
also checks its dimensions, complete solution, payload sizes, ownership,
duplicate layout fingerprint, and the 25-board-per-user limit. These database
checks protect access and reject ordinary malformed submissions; uniqueness
and difficulty analysis remain browser-side because there is intentionally no
custom application server.

## DreamHost deployment

Build the upload folder locally:

```sh
npm run build
```

Upload the **contents of `dist/`** to the site's web directory. The output is a
small static site and intentionally excludes `node_modules`, environment files,
tests, migrations, and developer scripts.

On this Mac, the **Board Workshop** app on the Desktop starts the local webpage
and opens it in the default browser automatically, so no Terminal command is
required.

## Controls

- Left click cycles a cell through X, star, and empty.
- Left-click and drag paints X marks.
- Middle click toggles a star.
- Right click clears a cell.
- `G` advances through a soft hint.

## Checks

```sh
npm run check
```

The tests cover puzzle rules and generation, hints and difficulty analysis, and
the classic-script browser loading contract.

## Board library

The built-in board catalog lives in `src/game/board-library-data.json`; its
classic-script browser copy is `src/game/board-library.js`. To retain the
existing catalog and fill each calculable difficulty to a larger total, run:

```sh
npm run generate:library -- --count=40
```

To rebuild the two catalog files from the existing generated catalog plus all
individual handmade board sources, run:

```sh
npm run build:library
```

Generation is resumable and writes after every accepted board. Incalculable
boards are discarded. Player progress is stored separately in local storage by
stable board ID, so adding catalog boards does not reset existing games.

## Structure

The browser runtime is a set of classic scripts (no build step) loaded in order
by `index.html`. They share a global scope: the engine/hints files expose
`globalThis` namespaces, and the `app/*.js` files share top-level state and
functions as classic-script globals.

- `src/game/engine.js` is the single source of truth for the puzzle domain —
  board, rules, solver, and generation — shared by the app and the tests.
- `src/game/state.js` owns the authoritative durable game state and its focused
  transitions. Puzzle replacement, board progress, and analysis updates flow
  through these operations instead of maintaining parallel globals.
- `src/game/hints/*.js` is the hint and difficulty runtime, split into
  `core`, `strategies-basic`, `strategies-advanced`, `difficulty`, and
  `registry` (the technique table + `StarsRemixHints` export, loaded last).
- `src/app/*.js` is the browser UI, split into `app-state` (shared state),
  `persistence` (the durable-state boundary), `app-view` and `app-cells`
  (rendering), `app-board` (mutation and history), and `app-actions`
  (controllers, input wiring, and the boot call, loaded last).
- `src/game/snapshot.js` defines and validates the canonical durable game state.
  File downloads and local storage both pass through this same snapshot shape;
  transient UI state is deliberately excluded.
- `src/game/serialization.js` dispatches saved formats and migrates legacy JSON.
  `serialization-sr2.js` owns the frozen SR2 compact codec. Incompatible saved
  state changes should get a new format rather than changing SR2 in place.
- `src/game/types.ts` and `src/game/puzzles.ts` hold shared types and the
  starter puzzle used by the tests.
- `scripts/dev-server.ts` serves the static application during development.
