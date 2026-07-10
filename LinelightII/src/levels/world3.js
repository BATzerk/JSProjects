// World 3 — LIVEWIRE. New mechanic: current. Wires carry power from sources;
// where a wire meets a walkable line there is a socket. Anything made of
// light conducts — bridge two sockets with any body and current flows.
// Gates open while powered (gold-trimmed gates latch open forever).
// Length returns here: a longer body is a longer wire.

export default {
  id: 3,
  name: 'Livewire',
  tint: '#ffd75e',
  levels: [
    {
      id: '3-1',
      name: 'Socket',
      // Solution sentence: "Stand across the gap in the wire — you are the
      // missing piece."
      map: `
  z*+ +*-*+
    * *   *
P---+-+---g-G
`,
      defs: {
        z: { type: 'source' },
        g: { type: 'gate', latch: true },
      },
      texts: [{ x: 2.5, y: 1.9, str: 'you are a conductor' }],
      solution: [['R', 2.75], ['wait', 0.4], ['R', 4.2]],
    },
    {
      id: '3-2',
      name: 'Hold the Door',
      // Solution sentence: "This gate only holds while current flows — park
      // the brute across the wires and it will hold the door for you."
      map: `
  z*+ +*-*+*+
    * *     *
o---+-+---+ |
          | *
P---------+-g-G
`,
      defs: {
        z: { type: 'source' },
        g: { type: 'gate' },
        o: { type: 'obedient' },
      },
      texts: [{ x: 1.5, y: 2.9, str: 'what you pull, stays' }],
      solution: [
        ['R', 4.9],
        ['RU', 1.5],
        ['untilHold', 's', (s) => s.byAnchor.o.x > 2.72, 10],
        ['D', 1.2],
        ['R', 2.7],
      ],
    },
    {
      id: '3-3',
      name: 'Grow to Fit',
      // Solution sentence: "Leave your tail lying across the wires and walk
      // through the gate with your head."
      map: `
    z   +*+
    *   * *
P-n-+---+-g-G
`,
      defs: {
        z: { type: 'source' },
        n: { type: 'lengther', amount: 3 },
        g: { type: 'gate' },
      },
      texts: [{ x: 1, y: 1.9, str: 'a longer you is a longer wire' }],
      solution: [['R', 6.8]],
    },
    {
      id: '3-4',
      name: 'Ghost Conductor',
      // Solution sentence: "Teach your ghost to stand on the wires, then walk
      // through the door it holds open for you."
      map: `
      z +*-*-*-*+
      * *       *
P---e-+-+-------g-G
`,
      defs: {
        e: { type: 'echo', dur: 4 },
        z: { type: 'source' },
        g: { type: 'gate' },
      },
      texts: [{ x: 1, y: -0.9, str: 'your echo is made of light too' }],
      solution: [
        ['R', 3.75],
        ['until', (s) => s.echo, 6],
        ['R', 5.5],
      ],
    },
    {
      id: '3-5',
      name: 'Live Rail',
      // Solution sentence: "Bridge your half of the circuit and hold it while
      // the patrol completes its own — one shared instant is enough."
      map: `
  z
  *
P-+-+---------------g-G
    *               *
    +*-*-*-*+ f-+-+-+
            *   * * *
            +*-*+ +*+
`,
      defs: {
        z: { type: 'source' },
        g: { type: 'gate', latch: true },
        f: { type: 'enemy', path: 'R3', mode: 'bounce', speed: 2.2 },
      },
      texts: [{ x: 5.5, y: -0.9, str: 'a pulse is enough — if every gap is closed' }],
      solution: [
        ['R', 1.75],
        ['until', (s) => s.byAnchor.g.open, 12],
        ['R', 9.7],
      ],
    },
    {
      id: '3-6',
      name: 'Grand Junction',
      // Solution sentence: "Park the brute on one gap, teach your ghost the
      // other, then walk through while all three of you hold the line."
      map: `
      z +*-*+ +*-*+
      * *   * *   *
      | | o-+-+-+ |
      * *       | *
P-----+-+-------+-g-G
|
E
`,
      defs: {
        z: { type: 'source' },
        g: { type: 'gate' },
        o: { type: 'obedient' },
        E: { type: 'echo', dur: 4 },
      },
      texts: [{ x: 3, y: 3.4, str: 'three of you, three pieces of one wire' }],
      solution: [
        ['R', 7.9],
        ['untilHold', 's', (s) => s.byAnchor.o.x > 6.72, 12],
        ['L', 8.2],
        ['D', 1.2], ['U', 1.2],
        ['R', 3.75],
        ['until', (s) => s.echo, 6],
        ['wait', 0.4],
        ['R', 6.6],
      ],
    },
  ],
};
