# StarsRemix_Codex

Stars Remix experiment developed with **Codex** (OpenAI).

This is one of two parallel experiments reimplementing Stars. See also [`StarsRemix_Claude`](../StarsRemix_Claude) for the Claude-assisted version.

## Run locally

Requires Node.js 22.18 or newer so the development server and tests can run
TypeScript files directly.

```sh
npm run dev
```

Then open <http://localhost:5173>. The game can also be opened directly from
`index.html`; its browser runtime intentionally uses classic scripts and has no
build step.

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

## Structure

The browser runtime is a set of classic scripts (no build step) loaded in order
by `index.html`. They share a global scope: the engine/hints files expose
`globalThis` namespaces, and the `app/*.js` files share top-level state and
functions as classic-script globals.

- `src/game/engine.js` is the single source of truth for the puzzle domain —
  board, rules, solver, and generation — shared by the app and the tests.
- `src/game/hints/*.js` is the hint and difficulty runtime, split into
  `core`, `strategies-basic`, `strategies-advanced`, `difficulty`, and
  `registry` (the technique table + `StarsRemixHints` export, loaded last).
- `src/app/*.js` is the browser UI, split into `app-state` (shared state),
  `app-view` and `app-cells` (rendering), `app-board` (mutation and history),
  and `app-actions` (controllers, input wiring, and the boot call, loaded last).
- `src/game/serialization.js` handles board-file save/load.
- `src/game/types.ts` and `src/game/puzzles.ts` hold shared types and the
  starter puzzle used by the tests.
- `scripts/dev-server.ts` serves the static application during development.
