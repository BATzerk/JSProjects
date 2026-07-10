// BONUS WORLD — THE CUTTING ROOM. Mechanics that didn't make it, playable
// where possible, with notes on why they were cut. Process, preserved.

export default {
  id: 7,
  name: 'The Cutting Room',
  tint: '#9aa3ad',
  bonus: true,
  levels: [
    {
      id: 'X-1',
      name: 'Glide (cut)',
      // CUT REASON: momentum fights the flow. Linelight movement is about
      // gentle continuous control; ice takes the stick out of your hand.
      map: `
P~-~-~+
      |
G~-~-~+
`,
      defs: {},
      texts: [
        { x: 3, y: -0.9, str: 'CUT MECHANIC: glide — ice locks your steering' },
        { x: 3, y: 2.1, str: 'verdict: momentum fought the flow of the line' },
      ],
      solution: [['R', 3.5], ['D', 1.2], ['L', 3.6]],
    },
    {
      id: 'X-2',
      name: 'Glide II (cut)',
      // CUT REASON: the interesting branches are exactly the ones the glide
      // forbids you from taking. Every good moment was a locked door.
      map: `
P~-~-~-~+
    |   |
    G---+
`,
      defs: {},
      texts: [
        { x: 4.5, y: -0.9, str: 'the branch you want is the one you slide past' },
        { x: 4.5, y: 2.1, str: 'four levels in, every idea was this one' },
      ],
      solution: [['R', 4.5], ['D', 1.2], ['L', 2.6]],
    },
    {
      id: 'X-3',
      name: 'Magnet (cut)',
      // CUT REASON: the magnet acts when you DON'T. Letting go of the keys is
      // a poor verb — waiting isn't playing.
      map: `
P---a---G
`,
      defs: {
        a: { type: 'magnet', r: 3 },
      },
      texts: [
        { x: 2, y: -0.9, str: 'CUT MECHANIC: magnet — it pulls you while you idle' },
        { x: 2, y: 1.1, str: 'verdict: waiting is not playing' },
      ],
      solution: [['R', 0.5], ['wait', 2.0], ['R', 2.6]],
    },
    {
      id: 'X-4',
      name: 'Ghost Weight (cut)',
      // CUT REASON: the dream — "your echo remembers how heavy you were" —
      // died on the seesaw's own honesty. To record a heavy ghost on the top
      // pan you need perfect counterbalance during the recording, and every
      // way of arranging that either pinned the pan forever (the ghost's own
      // body froze the dock), moved the elevator before you could board it,
      // or made the ghost redundant. Complementary pans punish any plan that
      // banks weight "for later" — the seesaw settles its accounts instantly.
      map: `
P---------------G
`,
      defs: {},
      texts: [
        { x: 4, y: -1.4, str: 'CUT LEVEL: ghost weight' },
        { x: 4, y: -0.7, str: '"your echo remembers how heavy you were"' },
        { x: 6, y: 0.9, str: 'the seesaw settles its accounts instantly —' },
        { x: 6, y: 1.5, str: 'every heavy ghost pinned the pan or missed the boat' },
        { x: 11, y: -0.7, str: 'kept instead: the ballast twin (6-5)' },
      ],
      solution: [['R', 8.5]],
    },
  ],
};
