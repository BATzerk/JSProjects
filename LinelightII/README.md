# Linelight II

A from-scratch sequel homage to Linelight: 6 worlds, 6 new mechanics,
36 levels + a bonus Cutting Room of rejected prototypes. Vanilla JS + canvas,
no build step, no dependencies.

## Run

Any static file server from this folder, e.g.:

```sh
npx serve -p 8123 .
# or: python3 -m http.server 8123
```

Then open http://localhost:8123.

Jump straight to a level while poking around: `?level=3-3` (ids `1-1`…`6-6`,
`X-1`…`X-4`).

## Controls

| Key | Action |
|---|---|
| arrows / WASD | move (hold two keys to flow around corners) |
| space | pull Obedients · confirm in menus |
| R | restart level |
| Esc | back to map |
| M | mute |

## The worlds

1. **Switchyard** — relay junctions & pads (anything made of light presses a pad)
2. **Glasswork** — lines that shatter once your light leaves them
3. **Livewire** — current; any body bridges a gap in a wire
4. **The Wick** — fuse lines, flame fronts, and aimed arson
5. **Prism** — two of you, one set of keys
6. **The Scales** — light has weight; seesaw elevators
7. **★ The Cutting Room** — cut mechanics, playable, with verdicts

See [DESIGN.md](DESIGN.md) for the mechanic-combination matrix, every level's
solution sentence, and the cutting-room rationale.

## Verify

Every level ships with a machine-checked solution script, run against the same
deterministic 120 Hz sim the browser uses:

```sh
node tests/run.mjs           # all 40 levels
node tests/run.mjs 4-6       # just one
```

## Layout

```
index.html, styles.css      shell page
src/core/                   headless deterministic sim (parse, graph, sim)
src/render/renderer.js      canvas glow renderer
src/shell/                  game loop, menus, audio
src/levels/                 world1..6 + bonus (ASCII maps + defs + solutions)
tests/run.mjs               solution verifier
```
