# Linelight II — Design Document

*A sequel homage. Six worlds, six new mechanics, one rule: everything is made
of light, and everything lives on a line.*

---

## Pillars

1. **Anything made of light is physical.** Your body, your Length, your Echo,
   your minions — they all conduct current, press pads, carry weight, and burn.
   Every new mechanic obeys this one sentence, which is where the combinatorics
   come from.
2. **Solution sentences first.** Every level was designed backwards from one
   sentence (all listed below). If a level couldn't be whittled to its
   sentence, it was cut or rebuilt.
3. **State you can see.** Switch arcs point where they route. Wires glow when
   powered. Fuse lines are visibly consumed. Pans hang on visible rails.
4. **Deaths are cheap, knowledge is permanent.** Instant restart, small
   levels, no checkpoints needed.

---

## The six new mechanics

| # | World | Mechanic | One-line rule |
|---|-------|----------|---------------|
| 1 | Switchyard | **Relays** | A junction routes trunk → active branch (you get shunted along it); riding in from a branch always trails out the trunk. Pads flip every relay on their channel — and *anything* crossing a pad presses it. Turnstile variant: flips itself after every trunk passage. |
| 2 | Glasswork | **Glass** | A glass line shatters the moment your light has fully left it. Enemies are too light to break glass — but the floor you break under a patrol clips its leash, or removes the patrol entirely. |
| 3 | Livewire | **Current** | Wires carry power from sources; where a wire meets a walkable line there is a socket. One body covering two sockets bridges them — you, your Length, your Echo, an Obedient, a passing patrol. Gates open while powered; gold gates latch. |
| 4 | The Wick | **Fire** | Braziers ignite fuse lines; a flame front crawls at constant speed, consuming the line behind it. Flame melts waxlocks, kills anything it touches, obeys relay junctions, and shears off Length where it crosses your tail. Fuse lines are walkable — until they aren't. |
| 5 | Prism | **Twins** | A prism splits you into two dashes that both obey your keys. Walls hold one of you while the other keeps walking; touching your other self gathers you into one dash carrying *all* the light of its parts. |
| 6 | The Scales | **Weight** | Light has weight. Pans hang in complementary pairs; the side carrying more total body-length sinks and its partner rises. A seesaw cannot tip while any body lies across a docked seam — which is itself a tool. |

### Why these six

Each was chosen (and the rest cut) by the matrix below. The bar: at least five
"definitely explore" cells against the existing Linelight vocabulary, plus
strong pairings with the *other* new mechanics, since later worlds remix
earlier ones.

---

## The combination matrix

`0` don't explore · `1` perhaps · `2` definitely explore!! (cells marked ★
became shipped levels)

| | Enemy | Echo | Obedient | Lockstep | OneWay | Exclusive | Padkey | Coverup | Length | Relay | Glass | Current | Fire | Twins | Weight |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Relay** | 2★ (1-3) | 2 | 2★ (1-5) | 1 | 2★ (1-6) | 2★ (1-5) | 1★ (1-4) | 0 | 0 | 1 | 1 | 2★ (3-6 wires) | 2★ (4-4) | 2★ (5-4) | 2★ (6-4) |
| **Glass** | 2★ (2-4, 2-6) | 2 | 1 | 1 | 1 | 0 | 1 | 2★ (2-3, 2-6) | 2★ (2-5, 2-6) | 2 | 1 | 1 | 1 | 2 | 1 |
| **Current** | 2★ (3-5) | 2★ (3-4, 3-6) | 2★ (3-2, 3-6) | 2 | 1 | 0 | 0 | 0 | 2★ (3-3, 4-5) | 2★ (3-6) | 1 | 1 | 1 | 2★ (5-5) | 1 |
| **Fire** | 2★ (4-3, 4-6) | 2★ (4-6) | 1 | 1 | 1 | 1 | 1 | 1★ (4-2) | 2★ (4-5) | 2★ (4-4) | 1 | 2★ (4-5, 4-6) | 1 | 2 | 1 |
| **Twins** | 1 | 1 | 0 | 1 | 2★ (5-4) | 0 | 1 | 0 | 2★ (5-5, 5-6) | 2★ (5-4) | 2 | 2★ (5-5) | 2 | 1 | 2★ (6-5) |
| **Weight** | 1 | 2† | 2★ (6-2, 6-4, 6-6) | 1 | 0 | 1★ (6-4, 6-6) | 0 | 0 | 2★ (6-3, 6-6) | 2★ (6-4) | 1 | 1 | 1 | 2★ (6-5) | 1 |

† Echo × Weight rated 2 and then **failed in production** — see The Cutting
Room. The matrix proposes; the geometry disposes.

Unshipped 2s (Echo × Relay, Glass × Echo, Glass × Twins, Fire × Twins,
Lockstep × Current…) are the sequel's DLC shelf. There are more than enough.

---

## Level list & solution sentences

### World 1 — Switchyard (Relays)
| Lvl | Name | Solution sentence |
|---|---|---|
| 1-1 | Points | Cross the pad so the way back becomes the way down. |
| 1-2 | Loop Line | Ride the default branch around the loop; the pad you pass makes the second visit go somewhere new. |
| 1-3 | Ferryman | The patrol throws the switch for you — cross while it is walking away. |
| 1-4 | Turnstile | The junction flips itself every ride — take the lap, take the key, take the plunge. |
| 1-5 | Roundhouse | Only the brute can walk the red rail — pull it across the pad it alone can reach. |
| 1-6 | Signal Box | Every siding's exit stamps your ticket — each lap out is exactly the flip the next siding needs. |

### World 2 — Glasswork (Glass)
| Lvl | Name | Solution sentence |
|---|---|---|
| 2-1 | Thin Ice | Glass carries you exactly once. |
| 2-2 | Two Sips | Drink the near one first — the far one is a one-way trip. |
| 2-3 | Waltz | Three glass roads, one dancer: out, back, out — parity lands you at the exit. |
| 2-4 | Loose Leash | Shatter the patrol's road while it walks the far half — its leash never grows back. |
| 2-5 | Foot in the Door | A bridge cannot fall while any of you is still on it — grow long enough to keep a foot on the glass. |
| 2-6 | Clean Sweep | Waltz the triple glass, drop the floor from under the watchman, and keep a foot in the last door. |

### World 3 — Livewire (Current)
| Lvl | Name | Solution sentence |
|---|---|---|
| 3-1 | Socket | Stand across the gap in the wire — you are the missing piece. |
| 3-2 | Hold the Door | Park the brute across the wires and it will hold the door for you. |
| 3-3 | Grow to Fit | Leave your tail lying across the wires and walk through the gate with your head. |
| 3-4 | Ghost Conductor | Teach your ghost to stand on the wires, then walk through the door it holds open. |
| 3-5 | Live Rail | Bridge your half of the circuit and hold it while the patrol completes its own — one shared instant is enough. |
| 3-6 | Grand Junction | Park the brute on one gap, teach your ghost the other, then walk through while all three of you hold the line. |

### World 4 — The Wick (Fire)
| Lvl | Name | Solution sentence |
|---|---|---|
| 4-1 | Strike | Light the loop and let the flame run your errand — wax cannot argue with fire. |
| 4-2 | Outrun | Light the long way round, then beat your own fire across the bridge. |
| 4-3 | Assassin | The fuse is a delay — light it for where the guard *will* be, not where it stands. |
| 4-4 | Splitter | The junction aims the fire — point it away from your own bridge before you strike the match. |
| 4-5 | Haircut | The wires needed your length; the fan does not — lay your tail across the fuse and let the fire barber you. |
| 4-6 | Backdraft | Your ghost holds the gate, you hold the match: one aimed spark melts the wax, fells the guard, and lights the road home behind your heels. |

### World 5 — Prism (Twins)
| Lvl | Name | Solution sentence |
|---|---|---|
| 5-1 | Two of You | Walk together. |
| 5-2 | Comb | Let the wall hold one of you back while the other finishes the walk. |
| 5-3 | Chord | Two plates, one instant — park one of you on the first note and strike the second in passing. |
| 5-4 | Switchman | One of you throws the switch the other rides — and the one-way keeps your second thoughts off the pad. |
| 5-5 | Split Circuit | Be both bridges: each of you lies down on your own gap, and the current crosses the two of you in series. |
| 5-6 | Gather Yourself | Hold the door for yourself, walk your two roads down to one, and go on whole — only your gathered light spans the last two plates. |

### World 6 — The Scales (Weight)
| Lvl | Name | Solution sentence |
|---|---|---|
| 6-1 | Seesaw | You are heavy enough — step aboard and let yourself down. |
| 6-2 | Counterweight | You cannot lift yourself — make the brutes weigh in on the other side, and sink them as you rise. |
| 6-3 | Even Keel | A seesaw cannot tip while you hold both its hands — grow long enough to lie across the whole bridge. |
| 6-4 | Down Together | Share the elevator with the thing that kills you — then walk it across the pad only its kind can reach. |
| 6-5 | Ballast | One of you is the weight — take on the length, sink, and lift your other self to the light. |
| 6-6 | Tare | Lie across the first scale, bank what you carried, then let the brutes weigh you up to the door. |

### ★ The Cutting Room (bonus)
Playable rejects with their verdicts in-level:

| Lvl | Cut mechanic / level | Why it died |
|---|---|---|
| X-1, X-2 | **Glide** (ice you can't steer on) | Momentum fought the flow. Linelight movement is continuous gentle control; ice takes the stick out of your hand, and the interesting branches were exactly the ones the slide forbade. Four sketches in, every puzzle was the same puzzle. |
| X-3 | **Magnet** (pulls you while idle) | Its verb is *letting go of the keys*. Waiting is not playing. |
| X-4 | **Ghost Weight** (echo remembers how heavy you were) | The best sentence I never shipped. To record a heavy ghost on the *top* pan you need perfect counterbalance during the recording — and every arrangement either froze the pan on the ghost's own straddling body, moved the elevator before you could board it, or made the ghost redundant. Complementary pans settle their accounts instantly; they punish any plan that banks weight "for later." The salvage: the **Ballast** twin (6-5) and the echo counterweight spirit lives on in 3-4/3-6's ghost conductor. |

Also considered and cut before prototyping: **portals** (well-trodden, weak
line-identity), **player-drawn line segments** (too free-form for tight
puzzles), **railroad-switch flipping by trailing passage** (folded into
turnstiles), **time-freeze zones** (no combinatorics), **escort spark**
(it's Length with extra steps).

---

## Engine notes (the FixedUpdate homage)

- The whole game is a **deterministic 120 Hz fixed-timestep sim** with zero
  DOM/canvas dependencies. Echoes replay recorded `(edge, t)` frames exactly —
  the lesson of Linelight 1's FixedUpdate echoes, taken as a foundation.
- Because the sim runs headless, **every level ships with a scripted solution**
  (`solution:` in each level def) executed by `node tests/run.mjs`. 40/40 pass.
  The scripts are the solution sentences made mechanical; several engine bugs
  (trail folding, flame propagation, obedient cornering) were found by levels
  refusing to pass their own sentences.
- Levels are authored as **ASCII lattice maps** (points on even columns/rows,
  edge glyphs between them): `-|` line, `=` glass, `*` wire, `.` fuse,
  `~` ice, `><^v` one-ways, `x` enemy-only. Letters are anchors bound to a
  `defs` table. A level is its own diagram.
- The body is a **trail of (edge, param) segments** — one representation feeds
  Length, glass occupancy, socket bridging, pad pressing, pan weight, flame
  trimming, and the fold logic when you reverse over yourself.
