// World 4 — THE WICK. New mechanic: fire. Braziers ignite fuse lines; a flame
// front crawls along them at constant speed, consuming the line behind it.
// Flame melts waxlocks, kills anything it touches, obeys switch junctions,
// and shears off any Length it crosses. Fuse lines are walkable — until they
// aren't.

// predict a bouncing patroller's param `dt` seconds from now
const lead = (e, dt) => {
  const lo = e.half, hi = e.L - e.half, span = hi - lo;
  let u = (e.s + e.dir * e.speed * dt - lo) % (2 * span);
  if (u < 0) u += 2 * span;
  return lo + (u <= span ? u : 2 * span - u);
};

export default {
  id: 4,
  name: 'The Wick',
  tint: '#ff9a4d',
  levels: [
    {
      id: '4-1',
      name: 'Strike',
      // Solution sentence: "Light the loop and let the flame run your errand —
      // wax cannot argue with fire."
      map: `
  +.-.-.+
  .     .
P-b-----w-G
`,
      defs: {
        b: { type: 'brazier' },
        w: { type: 'wax' },
      },
      texts: [{ x: 2.5, y: 1.9, str: 'fire keeps its own pace' }],
      solution: [['R', 0.8], ['wait', 2.9], ['R', 4.8]],
    },
    {
      id: '4-2',
      name: 'Outrun',
      // Solution sentence: "Light the long way round, then beat your own fire
      // across the bridge — and don't linger in the pocket."
      map: `
+.+
. .
b |
| .
P-+.-.-.-.+.-.-.-.c-G
          |
          u
`,
      defs: {
        b: { type: 'brazier' },
        u: { type: 'cover', ch: 1 },
        c: { type: 'coverlock', ch: 1 },
      },
      texts: [{ x: 3, y: 3.1, str: 'the road only burns once' }],
      solution: [
        ['U', 0.85], ['D', 0.9],
        ['R', 5.0], ['D', 1.2], ['U', 1.2],
        ['R', 5.5],
      ],
    },
    {
      id: '4-3',
      name: 'Assassin',
      // Solution sentence: "The fuse is a delay — light it when the guard's
      // patrol will meet the flame, not where it stands now."
      map: `
  b.-.-.-.+
  |       .
P-+-f-----+-----G
`,
      defs: {
        b: { type: 'brazier' },
        f: { type: 'enemy', path: 'R5', mode: 'bounce', speed: 2.2 },
      },
      texts: [{ x: 4.5, y: -0.9, str: 'lead the target' }],
      solution: [
        ['R', 1.05], ['U', 0.65],
        ['until', (s) => Math.abs(lead(s.byAnchor.f, 2.48) - 3) < 0.25, 12],
        ['U', 0.15],
        ['until', (s) => !s.byAnchor.f.alive, 5],
        ['D', 0.75],
        ['R', 7.6],
      ],
    },
    {
      id: '4-4',
      name: 'Splitter',
      // Solution sentence: "The junction aims the fire — point it away from
      // your own bridge before you strike the match."
      map: `
  b.-.a.-.-.+
  |   .     .
P-+---+.-.+-w-G
          |
          d
`,
      defs: {
        b: { type: 'brazier' },
        a: { type: 'switch', trunk: 'L', branches: ['D', 'R'], start: 0, ch: 1 },
        d: { type: 'pad', ch: 1 },
        w: { type: 'wax' },
      },
      texts: [{ x: 3, y: 2.9, str: 'where is it pointed?' }],
      solution: [
        ['R', 5.0], ['D', 1.2], ['U', 1.2],
        ['L', 4.0], ['U', 0.78], ['D', 0.8],
        ['wait', 3.4],
        ['R', 6.4],
      ],
    },
    {
      id: '4-5',
      name: 'Haircut',
      // Solution sentence: "The wires needed your length; the fan does not —
      // lay your tail across the fuse and let the fire barber you."
      map: `
      z   +*+   +.-.-.-.-.b-+   f
      *   * *   .           |   |
P-n---+---+-g---+-----------+---+---G
                .               |
                +               |
                                |
                                +
`,
      defs: {
        z: { type: 'source' },
        n: { type: 'lengther', amount: 3 },
        g: { type: 'gate', latch: true },
        b: { type: 'brazier' },
        f: { type: 'enemy', path: 'D3', mode: 'bounce', speed: 3.4 },
      },
      texts: [{ x: 1, y: 1.9, str: 'length opens the gate. length cannot pass the fan.' }],
      solution: [
        ['R', 13.9], ['RU', 1.4],
        ['L', 0.78], ['R', 0.8], ['D', 1.1],
        ['L', 6.6], ['R', 1.2],
        ['until', (s) => s.dashes[0].bodyLen < 1, 5],
        ['until', (s) => s.byAnchor.f.dir === 1 && s.byAnchor.f.s > 1.2 && s.byAnchor.f.s < 1.5, 8],
        ['R', 9.9],
      ],
    },
    {
      id: '4-6',
      name: 'Backdraft',
      // Solution sentence: "Your ghost holds the gate, you hold the match:
      // one aimed spark melts the wax, fells the guard, and lights the road
      // home behind your heels."
      map: `
      z +*+   +.-.+.-.-.+.-.-.-.-.-.+
      * * *   .   .     .           .
P-e---+-+-g---b---w-f---+-----------+.-.-.-.-.-.+-G
`,
      defs: {
        e: { type: 'echo', dur: 4 },
        z: { type: 'source' },
        g: { type: 'gate', latch: true },
        b: { type: 'brazier' },
        w: { type: 'wax' },
        f: { type: 'enemy', path: 'R4', mode: 'bounce', speed: 2.2 },
      },
      texts: [{ x: 1, y: -0.9, str: 'one spark, four dominoes' }],
      solution: [
        ['R', 3.75],
        ['until', (s) => s.echo, 6],
        ['R', 1.2],
        ['until', (s) => s.byAnchor.g.open, 4],
        ['R', 1.7],
        ['until', (s) => Math.abs(10 + lead(s.byAnchor.f, 3.5) - 12) < 0.25, 14],
        ['R', 0.15],
        ['wait', 0.35],
        ['R', 2.0],
        ['wait', 1.5],
        ['R', 0.7],
        ['until', (s) => !s.byAnchor.f.alive, 6],
        ['R', 16.5],
      ],
    },
  ],
};
