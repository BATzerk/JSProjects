// World 6 — THE SCALES. New mechanic: light has weight. Pans hang in pairs;
// whichever side carries more light sinks, and its partner rises. Your body,
// your Length, your minions — all of it weighs. A seesaw cannot tip while any
// body lies across a docked seam.

export default {
  id: 6,
  name: 'The Scales',
  tint: '#7fd8c8',
  levels: [
    {
      id: '6-1',
      name: 'Seesaw',
      // Solution sentence: "You are heavy enough — step aboard and let
      // yourself down."
      map: `
P---+



        +---G
`,
      defs: {},
      scales: [
        { a: { x0: 2, x1: 4, ys: [0, 2] }, b: { x0: 7, x1: 9, ys: [0, 2] }, p: 0 },
      ],
      texts: [{ x: 1, y: -0.9, str: 'your light has weight' }],
      solution: [
        ['R', 3.3],
        ['until', (s) => s.scales[0].p > 0.98, 6],
        ['R', 3.2],
      ],
    },
    {
      id: '6-2',
      name: 'Counterweight',
      // Solution sentence: "You cannot lift yourself — make the brutes weigh
      // in on the other side, and sink them as you rise."
      map: `
G---+   u-o-+   +-+
                  |
                  |
                  |
P---+   +---------+
`,
      defs: {
        o: { type: 'obedient' },
        u: { type: 'obedient' },
      },
      scales: [
        { a: { x0: 2, x1: 4, ys: [0, 2] }, b: { x0: 6, x1: 8, ys: [0, 2] }, p: 1 },
      ],
      texts: [{ x: 1, y: 2.9, str: 'two of them outweigh one of you' }],
      solution: [
        ['R', 3.4],
        ['untilHold', 's', (s) => s.scales[0].p < 0.06, 16],
        ['L', 3.9],
      ],
    },
    {
      id: '6-3',
      name: 'Even Keel',
      // Solution sentence: "A seesaw cannot tip while you hold both its
      // hands — grow long enough to lie across the whole bridge."
      map: `
P-m---+   +---G
|
|
|
|         +
|         |
+---------+
`,
      defs: {
        m: { type: 'lengther', amount: 2 },
      },
      objects: [
        { anchor: 'w', type: 'lengther', amount: 0.3, onPan: { scale: 0, side: 'b', t: 1 } },
      ],
      scales: [
        { a: { x0: 3, x1: 5, ys: [0, 2] }, b: { x0: 8, x1: 10, ys: [0, 2] }, p: 0 },
      ],
      texts: [{ x: 5.5, y: -0.9, str: 'keep a hand on each shore' }],
      solution: [['R', 7.6]],
    },
    {
      id: '6-4',
      name: 'Down Together',
      // Solution sentence: "Share the elevator with the thing that kills you —
      // then walk it across the pad only its kind can reach."
      map: `
P-----+-+     +
      |
      o

              +---+xdx+-v-G
                  |   | |
                  +---+ +
`,
      defs: {
        o: { type: 'obedient' },
        d: { type: 'pad', ch: 1 },
        v: { type: 'switch', trunk: 'L', branches: ['D', 'R'], start: 0, ch: 1 },
      },
      objects: [
        { anchor: 'w', type: 'lengther', amount: 0.5, onPan: { scale: 0, side: 'b', t: 1 } },
      ],
      scales: [
        { a: { x0: 4, x1: 7, ys: [0, 2] }, b: { x0: 16, x1: 18, ys: [0, 2] }, p: 0 },
      ],
      texts: [{ x: 0, y: 1.1, str: 'it rides with you or not at all' }],
      solution: [
        ['R', 7.4],
        ['untilHold', 's', (s) => s.byAnchor.o.x > 4.65, 12],
        ['L', 0.9],
        ['until', (s) => s.scales[0].p > 0.94, 8],
        ['R', 4.2],
        ['D', 1.2], ['R', 2.4], ['U', 1.4],
        ['R', 0.4],
        ['untilHold', 's', (s) => s.byAnchor.o.x > 10.25, 14],
        ['R', 2.6],
      ],
    },
    {
      id: '6-5',
      name: 'Ballast',
      // Solution sentence: "One of you is the weight — take on the length,
      // sink, and lift your other self to the light."
      map: `
  P-m-+-+         +-G
      |
      n

  q-----+     +
        |     |
        +-----+
`,
      defs: {
        m: { type: 'prism', spawn: 'q' },
        q: { type: 'spawn' },
        n: { type: 'lengther', amount: 1 },
      },
      scales: [
        { a: { x0: 4, x1: 6, ys: [0, 2] }, b: { x0: 7, x1: 9, ys: [0, 2] }, p: 0 },
      ],
      texts: [{ x: 1, y: 3.9, str: 'one of you is the weight' }],
      solution: [
        ['R', 2.0],
        ['D', 1.2],
        ['RD', 6.0],
        ['RU', 4.0],
        ['until', (s) => s.scales[0].p > 0.94, 8],
        ['R', 2.8],
      ],
    },
    {
      id: '6-6',
      name: 'Tare',
      // Solution sentence: "Lie across the first scale, bank what you carried,
      // then let the brutes weigh you up to the door — everything you learned,
      // weighed at once."
      map: `
P-m---+   +-n-+---+   +-G-+   +-o-u
              |       x
              |       |
              |       x
              +---+   +
`,
      defs: {
        m: { type: 'lengther', amount: 2 },
        n: { type: 'lengther', amount: 0 },
        o: { type: 'obedient' },
        u: { type: 'obedient' },
      },
      scales: [
        { a: { x0: 3, x1: 5, ys: [0, 2] }, b: { x0: 19, x1: 21, ys: [0, 2] }, p: 0 },
        { a: { x0: 9, x1: 11, ys: [0, 2] }, b: { x0: 13, x1: 15, ys: [0, 2] }, p: 1 },
      ],
      texts: [{ x: 3, y: -0.9, str: 'weighed at once' }],
      solution: [
        ['R', 7.0],
        ['RD', 2.6],
        ['R', 3.0],
        ['untilHold', 's', (s) => s.scales[1].p < 0.06, 18],
        ['R', 2.7],
      ],
    },
  ],
};
