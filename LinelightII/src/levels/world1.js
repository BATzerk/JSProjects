// World 1 — SWITCHYARD. New mechanic: Relays (switch junctions + pads).
// A relay routes trunk -> active branch; riding in from a branch always lets
// you trail out the trunk. Pads flip every relay on their channel, and
// *anything made of light* can press a pad: you, enemies, obedients, echoes.

export default {
  id: 1,
  name: 'Switchyard',
  tint: '#79c66d',
  levels: [
    {
      id: '1-1',
      name: 'Points',
      // Solution sentence: "Cross the pad so the way back becomes the way down."
      map: `
P---a---d
    |
    G
`,
      defs: {
        a: { type: 'switch', trunk: 'L', branches: ['R', 'D'], start: 0, ch: 1 },
        d: { type: 'pad', ch: 1 },
      },
      texts: [{ x: 4, y: -0.8, str: 'pads throw switches' }],
      solution: [['R', 4.4], ['L', 2.6], ['R', 1.0], ['D', 1.6]],
    },
    {
      id: '1-2',
      name: 'Loop Line',
      // Solution sentence: "Ride the default branch around the loop; the pad
      // you pass on the way makes the second visit go somewhere new."
      map: `
  +---------+
  |         |
P-+---a-d---+
      |
      G
`,
      defs: {
        a: { type: 'switch', trunk: 'L', branches: ['R', 'D'], start: 0, ch: 1 },
        d: { type: 'pad', ch: 1 },
      },
      solution: [['R', 6.4], ['U', 1.3], ['L', 5.4], ['D', 1.3], ['R', 2.4], ['D', 1.6]],
    },
    {
      id: '1-3',
      name: 'Ferryman',
      // Solution sentence: "The patrol throws the switch for you — cross while
      // it is walking away."
      map: `
  e
  |
P-w---G
  |
  |
  |
  d
`,
      defs: {
        e: { type: 'enemy', path: 'D3', mode: 'bounce', speed: 2.2 },
        w: { type: 'switch', trunk: 'L', branches: ['R', 'D'], start: 1, ch: 1 },
        d: { type: 'pad', ch: 1 },
      },
      texts: [{ x: 0, y: 2.2, str: 'wait for an opening' }],
      solution: [
        ['until', (s) => s.byAnchor.w.idx === 0 && s.byAnchor.e.dir === -1 && s.byAnchor.e.s < 0.8, 12],
        ['R', 3.6],
      ],
    },
    {
      id: '1-4',
      name: 'Turnstile',
      // Solution sentence: "The junction flips itself every time you ride
      // through — take the lap, take the key, take the plunge."
      map: `
  +---k---+
  |       |
P-+-t-----+
    |
    l
    |
    G
`,
      defs: {
        t: { type: 'switch', trunk: 'L', branches: ['R', 'D'], start: 0, turnstile: true },
        k: { type: 'key', ch: 1 },
        l: { type: 'lock', ch: 1 },
      },
      solution: [['R', 5.4], ['U', 1.3], ['L', 4.4], ['D', 1.3], ['R', 1.4], ['D', 2.8]],
    },
    {
      id: '1-5',
      name: 'Roundhouse',
      // Solution sentence: "Only the brute can walk the red rail — pull it
      // across the pad it alone can reach, then take the branch it opened."
      map: `
  +x-xoxdx+
  |       |
P-+-------+-w-G
            |
            +
`,
      defs: {
        o: { type: 'obedient' },
        d: { type: 'pad', ch: 1 },
        w: { type: 'switch', trunk: 'L', branches: ['D', 'R'], start: 0, ch: 1 },
      },
      texts: [{ x: 1.2, y: 2.0, str: 'hold space: it comes to you' }],
      solution: [
        ['R', 4.9],
        ['untilHold', 's', (s) => s.byAnchor.w.idx === 1, 8],
        ['R', 4.0],
      ],
    },
    {
      id: '1-6',
      name: 'Signal Box',
      // Solution sentence: "Every pocket's exit stamps your ticket — each lap
      // out of a siding is exactly the flip the next siding needs."
      map: `
+<-<-<-<-<-<-<-<-<-<-<-<-<+
v                         ^
P---a---+-b---+-c---+-d-+-+
    |   ^ |   ^ |   ^ |
    +-G-q +-G-r +-G-t G-u
`,
      defs: {
        a: { type: 'switch', trunk: 'L', branches: ['D', 'R'], start: 0, ch: 1 },
        b: { type: 'switch', trunk: 'L', branches: ['R', 'D'], start: 0, ch: 1 },
        c: { type: 'switch', trunk: 'L', branches: ['D', 'R'], start: 0, ch: 1 },
        d: { type: 'switch', trunk: 'L', branches: ['R', 'D'], start: 0, ch: 1 },
        q: { type: 'pad', ch: 1 },
        r: { type: 'pad', ch: 1 },
        t: { type: 'pad', ch: 1 },
        u: { type: 'pad', ch: 1 },
      },
      solution: [
        ['R', 2.2], ['D', 1.2], ['R', 2.2], ['U', 1.2],
        ['R', 1.2], ['D', 1.2], ['R', 2.2], ['U', 1.2],
        ['R', 1.2], ['D', 1.2], ['R', 2.2], ['U', 1.2],
        ['R', 1.2], ['D', 1.4],
      ],
    },
  ],
};
