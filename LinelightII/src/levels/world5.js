// World 5 — PRISM. New mechanic: you, twice. A prism splits your light into
// two dashes that both obey your keys. Walls hold one of you while the other
// keeps walking; touching your other self gathers you back into one — and a
// gathered dash carries ALL the light of its parts.

export default {
  id: 5,
  name: 'Prism',
  tint: '#c9a2ff',
  levels: [
    {
      id: '5-1',
      name: 'Two of You',
      // Solution sentence: "Walk together."
      map: `
P-m-------G

  q-------G
`,
      defs: {
        m: { type: 'prism', spawn: 'q' },
        q: { type: 'spawn' },
      },
      texts: [{ x: 1, y: -0.9, str: 'both of you hear every key' }],
      solution: [['R', 5.5]],
    },
    {
      id: '5-2',
      name: 'Comb',
      // Solution sentence: "Let the wall hold one of you back while the other
      // finishes the walk."
      map: `
G-P-m---+

  q-----------G
`,
      defs: {
        m: { type: 'prism', spawn: 'q' },
        q: { type: 'spawn' },
      },
      texts: [{ x: 4, y: -0.9, str: 'walls only stop one of you' }],
      solution: [['R', 7.0], ['L', 7.6]],
    },
    {
      id: '5-3',
      name: 'Chord',
      // Solution sentence: "Two plates, one instant — park one of you on the
      // first note and strike the second in passing."
      map: `
G-P-m---h

  q-------i-g-G
`,
      defs: {
        m: { type: 'prism', spawn: 'q' },
        q: { type: 'spawn' },
        h: { type: 'plate', ch: 1 },
        i: { type: 'plate', ch: 1 },
        g: { type: 'gate', src: 'plate', ch: 1, latch: true },
      },
      texts: [{ x: 4, y: 2.9, str: 'both notes at once' }],
      solution: [['R', 7.4], ['L', 7.6]],
    },
    {
      id: '5-4',
      name: 'Switchman',
      // Solution sentence: "One of you throws the switch the other rides —
      // and the one-way keeps your second thoughts off the pad."
      map: `
+-P-m-w-+
      |
      G

  q---------d>--G
`,
      defs: {
        m: { type: 'prism', spawn: 'q' },
        q: { type: 'spawn' },
        w: { type: 'switch', trunk: 'L', branches: ['R', 'D'], start: 0, ch: 1 },
        d: { type: 'pad', ch: 1 },
      },
      solution: [['R', 7.4], ['L', 4.5], ['R', 3.4], ['D', 1.5]],
    },
    {
      id: '5-5',
      name: 'Split Circuit',
      // Solution sentence: "Be both bridges: each of you lies down on your own
      // gap, and the current crosses the two of you in series."
      map: `
        z +*-*+
        * *   *
G-P-m-n-+-+   |
              *
G-g-q-o-----+-+
  *         *
  +*-*-*-*-*+
`,
      defs: {
        z: { type: 'source' },
        m: { type: 'prism', spawn: 'q' },
        q: { type: 'spawn' },
        n: { type: 'lengther', amount: 1 },
        o: { type: 'lengther', amount: 1 },
        g: { type: 'gate', latch: true },
      },
      texts: [{ x: 4, y: 3.9, str: 'the current needs all of you' }],
      solution: [['R', 6.7], ['L', 8.0]],
    },
    {
      id: '5-6',
      name: 'Gather Yourself',
      // Solution sentence: "Hold the door for yourself, walk your two roads
      // down to one, and go on whole — only your gathered light spans the
      // last two plates."
      map: `
  P-m---g-----+
              |
  q-------h   |
  |           |
n-+-------j---k-y-G
`,
      defs: {
        m: { type: 'prism', spawn: 'q' },
        q: { type: 'spawn' },
        n: { type: 'lengther', amount: 0.8 },
        g: { type: 'gate', src: 'plate', ch: 1 },
        h: { type: 'plate', ch: 1 },
        j: { type: 'plate', ch: 2 },
        k: { type: 'plate', ch: 2 },
        y: { type: 'gate', src: 'plate', ch: 2, latch: true },
      },
      texts: [{ x: 5, y: 4.9, str: 'go on whole' }],
      solution: [
        ['R', 8.8],
        ['D', 2.4],
        ['L', 6.4],
        ['D', 1.2],
        ['L', 1.4],
        ['R', 10.0],
      ],
    },
  ],
};
