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

- `src/app.js` contains the browser UI, game state, and runtime puzzle generator.
- `src/game/hints.js` exposes the hint and difficulty runtime shared by the app
  and its tests.
- `src/game/*.ts` contains tested puzzle-domain code used as the modular
  reference implementation.
- `src/game/generation/*.ts` contains the tested modular puzzle generator.
- `scripts/dev-server.ts` serves the static application during development.
