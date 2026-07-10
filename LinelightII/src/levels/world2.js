// World 2 — GLASSWORK. New mechanic: glass lines shatter once your light has
// fully left them. Enemies are too light to break glass — but the floor you
// break under a patrol changes its leash, or removes it entirely.

export default {
  id: 2,
  name: 'Glasswork',
  tint: '#a8dcef',
  levels: [
    {
      id: '2-1',
      name: 'Thin Ice',
      // Solution sentence: "Glass carries you exactly once."
      map: `
P-+=-=-=+-G
`,
      defs: {},
      texts: [{ x: 2.5, y: -0.9, str: 'glass breaks behind you' }],
      solution: [['R', 5.6]],
    },
    {
      id: '2-2',
      name: 'Two Sips',
      // Solution sentence: "Drink the near one first — the far one is a
      // one-way trip."
      map: `
G---P=-=G
`,
      defs: {},
      texts: [{ x: 2, y: -0.9, str: 'R restarts' }],
      solution: [['L', 2.3], ['R', 4.6]],
    },
    {
      id: '2-3',
      name: 'Waltz',
      // Solution sentence: "Three glass roads, one dancer: out, back, out —
      // parity lands you at the exit."
      map: `
+=-=i=-=+
|       |
P=-=j=-=+-c-G
|       |
+=-=q=-=+
`,
      defs: {
        i: { type: 'cover', ch: 1 },
        j: { type: 'cover', ch: 1 },
        q: { type: 'cover', ch: 1 },
        c: { type: 'coverlock', ch: 1 },
      },
      solution: [
        ['U', 1.2], ['R', 4.4], ['D', 1.0], ['L', 4.3],
        ['D', 1.0], ['R', 4.3], ['U', 1.0], ['R', 2.7],
      ],
    },
    {
      id: '2-4',
      name: 'Loose Leash',
      // Solution sentence: "Shatter the patrol's road while it walks the far
      // half — its leash never grows back."
      map: `
      P
      |
      G
      |
G-----+-+=+---------e
`,
      defs: {
        e: { type: 'enemy', path: 'L10', mode: 'bounce', speed: 2.2 },
      },
      texts: [{ x: 7.5, y: 0.8, str: 'it cannot break glass. you can.' }],
      solution: [
        ['until', (s) => s.byAnchor.e.dir === -1 && s.byAnchor.e.x > 7.2, 15],
        ['D', 2.3],
        ['R', 1.7],
        ['until', (s) => s.byAnchor.e.dir === 1 && s.byAnchor.e.x < 7.5, 10],
        ['L', 2.0],
        ['L', 3.4],
      ],
    },
    {
      id: '2-5',
      name: 'Foot in the Door',
      // Solution sentence: "A bridge cannot fall while any of you is still on
      // it — grow long enough to keep a foot on the glass."
      map: `
G-c-P-+=+-u
    |
    n
`,
      defs: {
        n: { type: 'lengther', amount: 3 },
        u: { type: 'cover', ch: 1 },
        c: { type: 'coverlock', ch: 1 },
      },
      texts: [{ x: 2, y: 1.9, str: 'length is yours to spend' }],
      solution: [['D', 1.2], ['U', 1.2], ['R', 3.3], ['L', 5.2]],
    },
    {
      id: '2-6',
      name: 'Clean Sweep',
      // Solution sentence: "Waltz the triple glass, drop the floor out from
      // under the watchman, and keep a foot in the last door."
      map: `
              +-----+-----+
              |     |     |
  +=-=i=-=+   |     |     |
  |       |   |     |     |
P-+=-=j=-=+-c-+-f---+=----+-n-+=--u
  |       |               |
  +=-=q=-=+               z
                          |
                          G
`,
      defs: {
        i: { type: 'cover', ch: 1 },
        j: { type: 'cover', ch: 1 },
        q: { type: 'cover', ch: 1 },
        c: { type: 'coverlock', ch: 1 },
        f: { type: 'enemy', path: 'R5', mode: 'bounce', speed: 2.2 },
        n: { type: 'lengther', amount: 3 },
        u: { type: 'cover', ch: 2 },
        z: { type: 'coverlock', ch: 2 },
      },
      solution: [
        ['RU', 1.3], ['U', 0.9], ['R', 4.4],
        ['D', 1.0], ['L', 4.3],
        ['RD', 1.4], ['R', 4.2],
        ['U', 1.0], ['R', 1.5], ['RU', 1.1], ['U', 2.0],
        ['R', 3.2], ['LD', 0.5], ['D', 1.2],
        ['until', (s) => s.byAnchor.f.dir === -1 && s.byAnchor.f.s > 1.2 && s.byAnchor.f.s < 1.7, 12],
        ['D', 0.8], ['R', 0.25],
        ['until', (s) => s.byAnchor.f.dir === 1 && s.byAnchor.f.s > 0.8, 8],
        ['LU', 1.2], ['U', 1.2],
        ['R', 3.4], ['DR', 2.6], ['R', 0.8], ['R', 2.8],
        ['L', 4.15], ['RD', 0.5], ['D', 2.2],
      ],
    },
  ],
};
