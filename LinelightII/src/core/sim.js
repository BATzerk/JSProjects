// The whole game, headless. Fixed 120Hz steps; identical in browser and Node.
// (Echoes taught us: replayed physics wants a fixed timestep.)

import { parseLevel, posOnEdge, DIRV, movesToPolyline } from './parse.js';
import {
  moverStep, travelerPos, dirFromNode, mkTrail, trailAdvance, trailPoints,
  trailOnEdge, trailOverlapOnEdge, trailDistToPoint, polylineDist,
  segPointDist, EPS, BLOCK_GAP,
} from './graph.js';

export const DT = 1 / 120;
export const BODY = 0.5;            // default dash body length
const SPEED = { player: 3.4, enemy: 2.2, obedient: 2.55, flame: 2.0, echo: 0, pan: 1.35, magnet: 2.2 };
const KILL_D = 0.155;
const PICKUP_D = 0.24;
const COVER_D = 0.19;               // pads / plates
const SOCKET_D = 0.4;               // sockets cradle the line; a body within this reach touches them
const LOCK_REACH = 0.4;

const WALKABLE = new Set(['line', 'glass', 'fuse', 'ice', 'pan']);

export class Sim {
  constructor(def) {
    const lv = parseLevel(def);
    this.def = def;
    this.level = lv;
    this.time = 0;
    this.frame = 0;
    this.complete = false;
    this.dead = false;
    this.deathCause = null;
    this.events = [];               // {type,x,y,...} drained by shell for fx/sfx
    this.ghost = false;
    this.byAnchor = {};

    this.buildEdgeCells();

    // --- objects -> systems ---
    this.pads = []; this.plates = []; this.gates = []; this.sources = [];
    this.keys = []; this.locks = []; this.covers = []; this.coverlocks = [];
    this.lengthers = []; this.spawners = []; this.braziers = []; this.prisms = [];
    this.magnets = []; this.enemies = []; this.obedients = []; this.locksteps = [];
    this.switches = []; this.waxes = []; this.flames = [];
    const spawnPoints = {};

    for (const o of lv.objects) {
      const reg = (live) => { this.byAnchor[o.anchor] = live; return live; };
      this.byAnchor[o.anchor] = o;
      switch (o.type) {
        case 'switch': this.installSwitch(o); break;
        case 'pad': this.pads.push(reg({ ...o, covered: false })); break;
        case 'plate': this.plates.push(reg({ ...o, pressed: false })); break;
        case 'source': this.sources.push(o); break;
        case 'gate': {
          const g = { ...o, open: false, latched: false };
          o.node.block = { type: 'gate', g };
          this.gates.push(g); this.byAnchor[o.anchor] = g; break;
        }
        case 'key': this.keys.push(reg({ ...o, heldBy: null, taken: false })); break;
        case 'lock': o.node.block = { type: 'lock', ch: o.ch }; this.locks.push(o); break;
        case 'cover': this.covers.push(reg({ ...o, taken: false })); break;
        case 'coverlock': o.node.block = { type: 'coverlock', ch: o.ch }; this.coverlocks.push(o); break;
        case 'wax': o.node.block = { type: 'wax' }; this.waxes.push(o); break;
        case 'lengther': {
          const L = { ...o, cooldown: false };
          this.lengthers.push(L); this.byAnchor[o.anchor] = L; break;
        }
        case 'echo': this.spawners.push(reg({ ...o, state: 'idle', rec: [], timer: 0, recDash: null })); break;
        case 'brazier': this.braziers.push(reg({ ...o, lit: false })); break;
        case 'prism': this.prisms.push(reg({ ...o, used: false })); break;
        case 'spawn': spawnPoints[o.anchor] = o.node; break;
        case 'magnet': this.magnets.push(o); break;
        case 'enemy': this.enemies.push(reg(this.mkEnemy(o))); break;
        case 'obedient': this.obedients.push(reg(this.mkObedient(o))); break;
        case 'lockstep': this.locksteps.push(reg(this.mkLockstep(o))); break;
        default: throw new Error(`unknown object type ${o.type}`);
      }
    }
    for (const p of this.prisms) p.spawnNode = spawnPoints[p.spawn];
    for (const s of this.switches) this.byAnchor[s.anchor] = s;
    for (const sp of this.spawners) this.byAnchor[sp.anchor] = sp;
    this.spawnersActiveEcho = null;

    // --- scales ---
    this.scales = lv.scales.map((s, i) => this.mkScale(s, i));
    for (const sc of this.scales) this.updatePanGeometry(sc); // sync pan riders

    // --- player dashes ---
    if (!lv.starts.length) throw new Error(`level ${def.id}: no player start`);
    this.dashes = lv.starts.map((n, i) => this.mkDash(n, i));
    this.echo = null;

    this.rebuildDijkstra = 0;
    this.updateWires();
    this.updateGates();
  }

  // ---------- construction helpers ----------

  buildEdgeCells() {
    this.cells = new Map(); // half-unit midpoint -> edge, for polyline->edge lookup
    for (const e of this.level.edges) this.registerEdgeCells(e);
  }
  registerEdgeCells(e) {
    const units = Math.max(1, Math.round(e.len));
    for (let i = 0; i < units; i++) {
      const t = (i + 0.5) * (e.len / units);
      const p = posOnEdge(e, t);
      this.cells.set(`${Math.round(p.x * 2)},${Math.round(p.y * 2)}`, e);
    }
  }
  edgeAt(x, y) {
    return this.cells.get(`${Math.round(x * 2)},${Math.round(y * 2)}`) || null;
  }

  installSwitch(o) {
    const n = o.node;
    const find = (letter) => {
      const dv = DIRV[letter];
      for (const e of n.edges) {
        const d = dirFromNode(e, n);
        if (d.x * dv.x + d.y * dv.y > 0.5) return e;
      }
      throw new Error(`switch ${o.anchor}: no edge ${letter} at (${n.x},${n.y})`);
    };
    n.sw = {
      trunk: find(o.trunk),
      branches: o.branches.map(find),
      idx: o.start || 0,
      turnstile: !!o.turnstile,
      ch: o.ch, anchor: o.anchor, node: n,
    };
    this.switches.push(n.sw);
  }

  mkDash(node, i) {
    const e = node.edges.find((ed) => WALKABLE.has(ed.kind));
    if (!e) throw new Error(`player start at (${node.x},${node.y}) touches no walkable edge`);
    const m = { edge: e, t: e.a === node ? 0 : e.len };
    const d = {
      id: i, edge: m.edge, t: m.t, bodyLen: BODY,
      trail: null, keys: [], lastDir: null, glide: null, movedThisFrame: 0, moveVec: { x: 0, y: 0 },
    };
    d.trail = mkTrail(d, BODY);
    return d;
  }

  mkEnemy(o) {
    const pts = movesToPolyline(o.x, o.y, o.path);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    const L = cum[cum.length - 1];
    // map each unit of the path to an edge (validates the patrol rides real lines)
    const spanEdges = [];
    for (let s = 0.5; s < L; s += 1) {
      const p = polyPoint(pts, cum, s, o.mode === 'loop');
      const e = this.edgeAt(p.x, p.y);
      if (!e) throw new Error(`enemy ${o.anchor}: patrol leaves the lines near (${p.x},${p.y})`);
      spanEdges.push(e);
    }
    const en = {
      ...o, pts, cum, L, spanEdges,
      s: (o.phase || 0) * L, dir: 1, half: 0.18, alive: true,
      speed: o.speed || SPEED.enemy, mode: o.mode || 'bounce',
      lo: 0, hi: L,
    };
    const p0 = polyPoint(pts, cum, en.s, en.mode === 'loop');
    en.x = p0.x; en.y = p0.y;
    return en;
  }

  mkObedient(o) {
    const e = o.node.edges.find((ed) => WALKABLE.has(ed.kind));
    if (!e) throw new Error(`obedient ${o.anchor} touches no walkable edge`);
    const ob = {
      ...o, edge: e, t: e.a === o.node ? 0 : e.len,
      alive: true, trail: null, speed: o.speed || SPEED.obedient,
    };
    ob.trail = mkTrail(ob, BODY);
    ob.x = o.node.x; ob.y = o.node.y;
    return ob;
  }

  mkLockstep(o) {
    const pts = movesToPolyline(o.x, o.y, o.rail);
    const L = pts.reduce((acc, p, i) => (i ? acc + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    return { ...o, pts, cum, L, s: 0, half: 0.18, alive: true, map: o.map || 'same' };
  }

  mkScale(s, i) {
    const mk = (pan, which) => {
      const y = pan.ys[0];
      const aN = { id: `scale${i}${which}a`, x: pan.x0, y, edges: [] };
      const bN = { id: `scale${i}${which}b`, x: pan.x1, y, edges: [] };
      const e = {
        id: `pan-${i}-${which}`, a: aN, b: bN, kind: 'pan', ow: 0, excl: null,
        alive: true, x1: pan.x0, y1: y, x2: pan.x1, y2: y,
        len: pan.x1 - pan.x0, ux: 1, uy: 0, pan: true,
      };
      aN.edges.push(e); bN.edges.push(e);
      return { def: pan, e, dummyA: aN, dummyB: bN, dockA: null, dockB: null, y };
    };
    const sc = { a: mk(s.a, 'A'), b: mk(s.b, 'B'), p: s.p ?? 0, speed: s.speed || SPEED.pan, id: i };
    if (s.anchor) this.byAnchor[s.anchor] = sc;
    this.updatePanGeometry(sc);
    return sc;
  }

  // ---------- per-frame ----------

  step(input) {
    if (this.dead || this.complete) return;
    this.frame++;
    this.time += DT;
    const dirs = input.dirs || [];
    const space = !!input.space;

    // 1. player dashes
    for (const d of this.dashes) this.stepDash(d, dirs);
    this.checkMerges();
    this.checkPickups();

    // 2. echo record/replay
    this.stepEchoes();

    // 3. minions
    this.stepObedients(space);
    this.stepEnemies();
    this.stepLocksteps();

    // 4. flame
    this.stepFlames();

    // 5. glass
    this.stepGlass();

    // 6. circuits, pads, plates, gates
    this.updateWires();
    this.updatePads();
    this.updateGates();

    // 7. scales
    this.stepScales();

    // 8. hazards
    if (!this.ghost) this.checkDeaths();

    // 9. done?
    if (!this.dead && this.level.diamonds.every((g) => g.taken)) {
      this.complete = true;
      this.events.push({ type: 'complete' });
    }
  }

  moverRules(who) {
    // who: 'player' | 'enemy'
    return {
      walkable: (e) => e.alive && WALKABLE.has(e.kind) && !(e.excl === 'player' && who !== 'player') && !(e.excl === 'enemy' && who === 'player'),
      canEnter: (e, sign) => (!e.ow || sign === e.ow) && !burntAt(e, sign > 0 ? 0 : e.len),
      canPass: (n, from, to) => canPassSwitch(n, from, to),
      blocked: (n) => this.nodeBlocked(n),
      onPass: (n, from, to) => {
        if (n.sw && n.sw.turnstile && from === n.sw.trunk) {
          n.sw.idx = (n.sw.idx + 1) % n.sw.branches.length;
          this.events.push({ type: 'switch', x: n.x, y: n.y });
        }
      },
    };
  }

  nodeBlocked(n) {
    const b = n.block;
    if (!b) return false;
    if (b.type === 'gate') return !b.g.open;
    return true; // lock / coverlock / wax
  }

  stepDash(d, dirs) {
    const before = travelerPos(d);
    let useDirs = dirs;
    // ice: while on an ice edge you keep sliding; steering is ignored
    if (d.edge.kind === 'ice' && d.glide) useDirs = [d.glide];
    const rules = this.moverRules('player');
    let moved = moverStep(d, useDirs, SPEED.player * DT, rules);
    if (moved <= EPS && d.edge.kind === 'ice' && d.glide) {
      d.glide = null; // slid into a dead end; return control
      moved = moverStep(d, dirs, SPEED.player * DT, rules);
    }
    // magnet drift when idle
    if (moved <= EPS && !dirs.length) {
      for (const m of this.magnets) {
        const p = travelerPos(d);
        const dist = Math.hypot(p.x - m.x, p.y - m.y);
        if (dist < m.r && dist > 0.05) {
          const pull = [];
          if (Math.abs(m.x - p.x) > 0.01) pull.push(m.x > p.x ? 'R' : 'L');
          if (Math.abs(m.y - p.y) > 0.01) pull.push(m.y > p.y ? 'D' : 'U');
          moved = moverStep(d, pull, SPEED.magnet * DT, rules);
          break;
        }
      }
    }
    // capture glide direction when we ride onto ice
    if (d.edge.kind === 'ice') {
      const after0 = travelerPos(d);
      const vx = after0.x - before.x, vy = after0.y - before.y;
      if (Math.abs(vx) + Math.abs(vy) > EPS) {
        d.glide = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'R' : 'L') : (vy > 0 ? 'D' : 'U');
      }
    } else d.glide = null;

    d.trail.bodyLen = d.bodyLen;
    trailAdvance(d.trail, d, moved);
    const after = travelerPos(d);
    d.movedThisFrame = moved;
    d.moveVec = { x: after.x - before.x, y: after.y - before.y };
    d.x = after.x; d.y = after.y;
  }

  checkMerges() {
    for (let i = 0; i < this.dashes.length; i++) {
      for (let j = i + 1; j < this.dashes.length; j++) {
        const a = this.dashes[i], b = this.dashes[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < 0.14) {
          a.bodyLen += b.bodyLen; // all your light, gathered
          a.trail.bodyLen = a.bodyLen;
          a.keys.push(...b.keys);
          this.dashes.splice(j, 1);
          this.events.push({ type: 'merge', x: a.x, y: a.y });
          return this.checkMerges();
        }
      }
    }
  }

  checkPickups() {
    for (const d of this.dashes) {
      const p = { x: d.x, y: d.y };
      for (const g of this.level.diamonds) {
        if (!g.taken && near(p, g.node, PICKUP_D)) {
          g.taken = true;
          this.events.push({ type: 'diamond', x: g.node.x, y: g.node.y });
        }
      }
      for (const k of this.keys) {
        if (!k.taken && near(p, k, PICKUP_D)) {
          k.taken = true; k.heldBy = d;
          d.keys.push(k);
          this.events.push({ type: 'key', x: k.x, y: k.y });
        }
      }
      for (const l of this.locks) {
        if (l.node.block && near(p, l, LOCK_REACH)) {
          const ki = d.keys.findIndex((k) => k.ch === l.ch);
          if (ki >= 0) {
            d.keys.splice(ki, 1);
            l.node.block = null; l.opened = true;
            this.events.push({ type: 'unlock', x: l.x, y: l.y });
          }
        }
      }
      for (const c of this.covers) {
        if (!c.taken && near(p, c, PICKUP_D)) {
          c.taken = true;
          this.events.push({ type: 'cover', x: c.x, y: c.y });
          const ch = c.ch;
          if (this.covers.filter((cc) => cc.ch === ch).every((cc) => cc.taken)) {
            for (const cl of this.coverlocks) {
              if (cl.ch === ch && cl.node.block) {
                cl.node.block = null; cl.opened = true;
                this.events.push({ type: 'coverlock', x: cl.x, y: cl.y });
              }
            }
          }
        }
      }
      // (lengthers handled per-lengther below, so twins don't fight over cooldowns)
      for (const pr of this.prisms) {
        if (!pr.used && near(p, pr, 0.18) && pr.spawnNode) {
          pr.used = true;
          this.dashes.push(this.mkDash(pr.spawnNode, this.dashes.length));
          this.events.push({ type: 'prism', x: pr.x, y: pr.y });
        }
      }
      for (const sp of this.spawners) {
        if (sp.state === 'idle' && near(p, sp, PICKUP_D) && !this.echo) {
          sp.state = 'recording';
          sp.timer = 0; sp.rec = []; sp.recDash = d;
          this.events.push({ type: 'echo-rec', x: sp.x, y: sp.y });
        }
      }
      for (const b of this.braziers) {
        if (near(p, b, PICKUP_D)) this.ignite(b.node, b);
      }
    }
    // lengthers: one give/take per approach, no matter how many dashes exist
    for (const L of this.lengthers) {
      const dIn = this.dashes.find((d) => near({ x: d.x, y: d.y }, L, PICKUP_D));
      if (dIn && !L.cooldown) {
        if (L.amount > 0) {
          dIn.bodyLen += L.amount; L.amount = 0; L.cooldown = true;
          this.events.push({ type: 'length+', x: L.x, y: L.y });
        } else if (dIn.bodyLen > BODY + 0.01) {
          L.amount = dIn.bodyLen - BODY; dIn.bodyLen = BODY; L.cooldown = true;
          dIn.trail.bodyLen = BODY;
          this.events.push({ type: 'length-', x: L.x, y: L.y });
        }
      } else if (!dIn) L.cooldown = false;
    }
  }

  // ---------- echoes ----------

  stepEchoes() {
    for (const sp of this.spawners) {
      if (sp.state === 'recording') {
        const d = sp.recDash;
        if (!this.dashes.includes(d)) { sp.state = 'idle'; continue; } // merged away
        sp.rec.push({ edge: d.edge, t: d.t, bodyLen: d.bodyLen });
        sp.timer += DT;
        if (sp.timer >= sp.dur) {
          sp.state = 'playing';
          this.echo = {
            frames: sp.rec, i: 0, sp,
            edge: sp.rec[0].edge, t: sp.rec[0].t,
            trail: null, alive: true,
          };
          this.echo.trail = mkTrail(this.echo, sp.rec[0].bodyLen);
          this.events.push({ type: 'echo-born', x: sp.x, y: sp.y });
        }
      }
    }
    const ec = this.echo;
    if (!ec) return;
    if (ec.i >= ec.frames.length) return this.killEcho('faded');
    const f = ec.frames[ec.i++];
    if (!f.edge.alive || burntAt(f.edge, f.t)) return this.killEcho('ground gone');
    ec.edge = f.edge; ec.t = f.t;
    ec.trail.bodyLen = f.bodyLen;
    trailAdvance(ec.trail, ec, 0);
    const p = travelerPos(ec);
    ec.x = p.x; ec.y = p.y;
  }

  killEcho(why) {
    if (!this.echo) return;
    this.events.push({ type: 'echo-gone', x: this.echo.x || 0, y: this.echo.y || 0, why });
    this.echo.sp.state = 'idle';
    this.echo = null;
  }

  // ---------- minions ----------

  stepObedients(space) {
    if (!this.obedients.length) return;
    if (space) this.rebuildDijkstra -= 1;
    for (const ob of this.obedients) {
      if (!ob.alive) continue;
      if (!ob.edge.alive) { this.poof(ob); continue; }
      if (space && this.dashes.length) {
        const target = this.dashes[0];
        const dirsToPlayer = this.obedientDirs(ob, target);
        if (dirsToPlayer && !this.obedientBlockedAhead(ob, dirsToPlayer)) {
          moverStep(ob, dirsToPlayer, ob.speed * DT, this.moverRules('enemy'));
        }
      }
      trailAdvance(ob.trail, ob, 0);
      const p = travelerPos(ob);
      ob.x = p.x; ob.y = p.y;
    }
  }

  obedientDirs(ob, target) {
    // Dijkstra from player over reversed enemy-traversable graph, cached briefly
    if (!this.distMap || this.rebuildDijkstra <= 0) {
      this.distMap = this.dijkstraToPlayer(target);
      this.rebuildDijkstra = 12; // recompute ~10x/sec while pulling
    }
    const dm = this.distMap;
    const e = ob.edge;
    // same edge as player: walk straight at them
    if (target.edge === e) {
      const s = Math.sign(target.t - ob.t);
      return s ? [letterFor(e.ux * s, e.uy * s)] : null;
    }
    // at (or nearly at) a node: pick the cheapest exit edge, corners included
    const atA = ob.t <= 0.05, atB = ob.t >= e.len - 0.05;
    if (atA || atB) {
      const n = atA ? e.a : e.b;
      let best = null;
      for (const e2 of n.edges) {
        if (!e2.alive || !WALKABLE.has(e2.kind) || e2.excl === 'player') continue;
        const other = e2.a === n ? e2.b : e2.a;
        const sign = e2.a === n ? 1 : -1;
        if (e2.ow && sign !== e2.ow) continue;
        const cost = (dm.get(other.id) ?? Infinity) + e2.len;
        if (best === null || cost < best.cost) best = { cost, d: dirFromNode(e2, n) };
      }
      if (!best || best.cost === Infinity) return null;
      return [letterFor(best.d.x, best.d.y)];
    }
    const dA = (dm.get(e.a.id) ?? Infinity) + ob.t;
    const dB = (dm.get(e.b.id) ?? Infinity) + (e.len - ob.t);
    if (dA === Infinity && dB === Infinity) return null;
    const s = dA < dB ? -1 : 1;
    return [letterFor(e.ux * s, e.uy * s)];
  }

  dijkstraToPlayer(target) {
    const dist = new Map();
    const pq = [];
    const push = (id, dv) => {
      if ((dist.get(id) ?? Infinity) <= dv) return;
      dist.set(id, dv); pq.push([dv, id]);
    };
    push(target.edge.a.id, target.t);
    push(target.edge.b.id, target.edge.len - target.t);
    const nodeById = this.nodeById || (this.nodeById = new Map(this.allNodes().map((n) => [n.id, n])));
    while (pq.length) {
      pq.sort((x, y) => x[0] - y[0]);
      const [dv, id] = pq.shift();
      if ((dist.get(id) ?? Infinity) < dv) continue;
      const n = nodeById.get(id);
      if (!n || this.nodeBlocked(n)) continue;
      for (const e of n.edges) {
        if (!e.alive || !WALKABLE.has(e.kind) || e.excl === 'player') continue;
        // travelling from `other` toward n: sign must satisfy one-way
        const other = e.a === n ? e.b : e.a;
        const sign = e.a === n ? -1 : 1; // direction other -> n along a->b axis... see below
        const travelSign = e.b === n ? 1 : -1;
        if (e.ow && travelSign !== e.ow) continue;
        if (!canPassSwitchInto(n, e)) continue;
        push(other.id, dv + e.len);
      }
    }
    return dist;
  }

  allNodes() {
    const set = new Set(this.level.nodes);
    for (const sc of this.scales) {
      for (const side of [sc.a, sc.b]) {
        set.add(side.e.a); set.add(side.e.b);
      }
    }
    return [...set];
  }

  obedientBlockedAhead(ob, dirs) {
    const dv = DIRV[dirs[0]];
    const ahead = { x: ob.x + dv.x * 0.3, y: ob.y + dv.y * 0.3 };
    if (this.echo && trailDistToPoint(this.echo.trail, ahead) < 0.2) return true;
    for (const en of this.enemies) {
      if (en.alive && polyDistToPoint(this.enemyBody(en), ahead) < 0.2) return true;
    }
    for (const ls of this.locksteps) {
      if (ls.alive && polyDistToPoint(this.lockstepBody(ls), ahead) < 0.2) return true;
    }
    return false;
  }

  stepEnemies() {
    for (const en of this.enemies) {
      if (!en.alive) continue;
      en.s += en.dir * en.speed * DT;
      if (en.mode === 'loop' && en.lo === 0 && en.hi === en.L) {
        en.s = ((en.s % en.L) + en.L) % en.L;
      } else {
        const lo = en.lo + en.half, hi = en.hi - en.half;
        if (en.s > hi) { en.s = hi; en.dir = -1; }
        if (en.s < lo) { en.s = lo; en.dir = 1; }
      }
      const p = polyPoint(en.pts, en.cum, en.s, en.mode === 'loop');
      en.x = p.x; en.y = p.y;
    }
  }

  stepLocksteps() {
    const d0 = this.dashes[0];
    if (!d0) return;
    const { x: dx, y: dy } = d0.moveVec;
    if (Math.abs(dx) + Math.abs(dy) < EPS) return;
    for (const ls of this.locksteps) {
      if (!ls.alive) continue;
      let mx = dx, my = dy;
      if (ls.map === 'reverse') { mx = -dx; my = -dy; }
      if (ls.map === 'mirrorX') mx = -dx;
      if (ls.map === 'mirrorY') my = -dy;
      // advance along rail by the mapped displacement's tangential component
      let rem = Math.hypot(mx, my);
      const seg = railSegAt(ls);
      if (!seg) continue;
      const adv = mx * seg.ux + my * seg.uy;
      ls.s = Math.max(ls.half, Math.min(ls.L - ls.half, ls.s + adv));
      const p = polyPoint(ls.pts, ls.cum, ls.s, false);
      ls.x = p.x; ls.y = p.y;
    }
  }

  // ---------- flame ----------

  ignite(node, brazier) {
    let any = false;
    for (const e of node.edges) {
      if (e.kind !== 'fuse' || !e.alive) continue;
      const fromA = e.a === node;
      const start = fromA ? (e.burnA || 0) : (e.burnB || 0);
      if (start >= e.len) continue;
      // already burning from this side?
      this.flames = this.flames || [];
      if (this.flames.some((f) => f.e === e && f.fromA === fromA)) continue;
      this.flames.push({ e, fromA, t: start });
      any = true;
    }
    if (any) {
      this.events.push({ type: 'ignite', x: node.x, y: node.y });
      if (brazier) brazier.lit = true;
    }
    return any;
  }

  stepFlames() {
    if (!this.flames || !this.flames.length) return;
    const arrivals = [];
    for (const f of this.flames) {
      f.t += SPEED.flame * DT;
      const e = f.e;
      if (f.fromA) e.burnA = Math.max(e.burnA || 0, Math.min(f.t, e.len));
      else e.burnB = Math.max(e.burnB || 0, Math.min(f.t, e.len));
      const pos = f.fromA ? f.t : e.len - f.t;
      const p = posOnEdge(e, Math.max(0, Math.min(e.len, pos)));
      f.x = p.x; f.y = p.y;
      if (f.t >= e.len) {
        f.deadFront = true;
        arrivals.push({ node: f.fromA ? e.b : e.a, via: e });
      }
      if ((e.burnA || 0) + (e.burnB || 0) >= e.len - EPS) {
        this.killEdge(e, 'burnt');
        f.deadFront = true;
      }
    }
    // kill/trim checks run on every front, including ones finishing this frame
    for (const f of this.flames) {
      const fp = { x: f.x, y: f.y };
      for (const en of this.enemies) {
        if (en.alive && polyDistToPoint(this.enemyBody(en), fp) < KILL_D) this.poof(en);
      }
      for (const ob of this.obedients) {
        if (ob.alive && trailDistToPoint(ob.trail, fp) < KILL_D) this.poof(ob);
      }
      for (const ls of this.locksteps) {
        if (ls.alive && polyDistToPoint(this.lockstepBody(ls), fp) < KILL_D) this.poof(ls);
      }
      if (this.echo && trailDistToPoint(this.echo.trail, fp) < KILL_D) this.killEcho('burnt');
      for (const d of this.dashes) this.flameVsDash(f, d);
    }
    this.flames = this.flames.filter((f) => !f.deadFront && f.e.alive);
    for (const a of arrivals) {
      const n = a.node;
      if (n.block) {
        if (n.block.type === 'wax') {
          n.block = null;
          this.events.push({ type: 'melt', x: n.x, y: n.y });
        } else continue; // gates & locks stop fire
      }
      const br = this.braziers.find((b) => b.node === n);
      for (const e2 of n.edges) {
        if (e2.kind !== 'fuse' || !e2.alive || e2 === a.via) continue;
        if (!canPassSwitch(n, a.via, e2)) continue;
        const fromA = e2.a === n;
        if (this.flames.some((f) => f.e === e2 && f.fromA === fromA)) continue;
        this.flames.push({ e: e2, fromA, t: fromA ? (e2.burnA || 0) : (e2.burnB || 0) });
      }
      if (br) this.ignite(n, br);
    }
  }

  flameVsDash(f, d) {
    // find the flame's touch point with the smallest true arc from the head;
    // a fold can cross the flame twice — the nearer crossing is the cut
    const segs = d.trail.segs;
    let arc = 0;
    let hit = null;
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i];
      if (!s.e) continue;
      const p1 = posOnEdge(s.e, s.a), p2 = posOnEdge(s.e, s.b); // a older, b newer
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const L2 = dx * dx + dy * dy;
      const segLen = Math.sqrt(L2);
      let t = L2 ? ((f.x - p1.x) * dx + (f.y - p1.y) * dy) / L2 : 0;
      t = Math.max(0, Math.min(1, t));
      const dd = Math.hypot(p1.x + dx * t - f.x, p1.y + dy * t - f.y);
      if (dd < KILL_D) {
        const arcAt = arc + (1 - t) * segLen;
        if (hit === null || arcAt < hit) hit = arcAt;
      }
      arc += segLen;
    }
    if (hit === null) return;
    if (hit < 0.4) {
      if (!this.ghost) this.die('flame', f);
    } else if (d.bodyLen > hit) {
      d.bodyLen = Math.max(BODY, hit - 0.06);
      d.trail.bodyLen = d.bodyLen;
      this.events.push({ type: 'trim', x: f.x, y: f.y });
    }
  }

  // ---------- glass ----------

  stepGlass() {
    for (const e of this.level.edges) {
      if (e.kind !== 'glass' || !e.alive) continue;
      let occ = false;
      for (const d of this.dashes) if (trailOnEdge(d.trail, e)) { occ = true; break; }
      if (!occ && this.echo && trailOnEdge(this.echo.trail, e)) occ = true;
      if (e.wasOccupied && !occ) {
        this.killEdge(e, 'shatter');
      }
      e.wasOccupied = occ;
    }
  }

  killEdge(e, how) {
    if (!e.alive) return;
    e.alive = false;
    const mid = posOnEdge(e, e.len / 2);
    this.events.push({ type: how, x: mid.x, y: mid.y, edge: e });
    // anyone standing on it?
    for (const d of this.dashes) {
      if (d.edge === e && !this.ghost) this.die(how, mid);
    }
    for (const ob of this.obedients) if (ob.alive && ob.edge === e) this.poof(ob);
    if (this.echo && this.echo.edge === e) this.killEcho(how);
    // patrols: shrink windows / poof
    for (const en of this.enemies) {
      if (!en.alive) continue;
      let onDead = false;
      let lo = 0, hi = en.L;
      for (let i = 0; i < en.spanEdges.length; i++) {
        const sMid = 0.5 + i;
        if (!en.spanEdges[i].alive) {
          if (Math.abs(sMid - en.s) < 0.55) onDead = true;
          if (sMid < en.s) lo = Math.max(lo, sMid + 0.5);
          else hi = Math.min(hi, sMid - 0.5);
        }
      }
      if (onDead) this.poof(en);
      else { en.lo = lo; en.hi = hi; if (en.mode === 'loop') en.mode = 'bounce'; }
    }
  }

  poof(x) {
    x.alive = false;
    this.events.push({ type: 'poof', x: x.x, y: x.y });
  }

  // ---------- circuits ----------

  updateWires() {
    const wires = this.level.edges.filter((e) => e.kind === 'wire');
    if (!wires.length) { this.sockets = []; return; }
    const uf = new Map();
    const find = (k) => { let r = k; while (uf.get(r) !== r) r = uf.get(r); uf.set(k, r); return r; };
    const union = (a, b) => { uf.set(find(a), find(b)); };
    for (const e of wires) uf.set(`w${e.id}`, `w${e.id}`);
    // static joins at nodes
    const byNode = new Map();
    for (const e of wires) {
      for (const n of [e.a, e.b]) {
        if (!byNode.has(n)) byNode.set(n, []);
        byNode.get(n).push(e);
      }
    }
    for (const [n, es] of byNode) {
      for (let i = 0; i < es.length; i++) {
        for (let j = i + 1; j < es.length; j++) {
          if (canWireJoin(n, es[i], es[j])) union(`w${es[i].id}`, `w${es[j].id}`);
        }
      }
    }
    // sockets: wire meets walkable line
    this.sockets = [];
    for (const [n, es] of byNode) {
      if (n.edges.some((e) => WALKABLE.has(e.kind) && e.kind !== 'pan')) {
        this.sockets.push({ node: n, x: n.x, y: n.y, wireEdges: es, bridged: false });
      }
    }
    // dynamic bridges: one body covering >=2 sockets joins their nets
    const conductors = this.conductorBodies();
    for (const body of conductors) {
      const touched = this.sockets.filter((s) => polyDistToPoint(body, s) < SOCKET_D);
      for (const s of touched) s.bridged = true;
      for (let i = 1; i < touched.length; i++) {
        union(`w${touched[0].wireEdges[0].id}`, `w${touched[i].wireEdges[0].id}`);
      }
      if (touched.length === 1) touched[0].bridged = false;
    }
    // powered = component contains a source
    const powered = new Set();
    for (const src of this.sources) {
      for (const e of src.node.edges) if (e.kind === 'wire') powered.add(find(`w${e.id}`));
    }
    for (const e of wires) e.powered = powered.has(find(`w${e.id}`));
    // mark truly-bridging sockets (both sides now powered counts as visual spark)
    for (const s of this.sockets) s.hot = s.wireEdges.some((e) => e.powered);
  }

  conductorBodies() {
    const bodies = [];
    for (const d of this.dashes) bodies.push(trailPoints(d.trail));
    if (this.echo) bodies.push(trailPoints(this.echo.trail));
    for (const ob of this.obedients) if (ob.alive) bodies.push(trailPoints(ob.trail));
    for (const en of this.enemies) if (en.alive) bodies.push(this.enemyBody(en));
    for (const ls of this.locksteps) if (ls.alive) bodies.push(this.lockstepBody(ls));
    return bodies;
  }

  updatePads() {
    const bodies = this.conductorBodies();
    for (const pad of this.pads) {
      const cov = bodies.some((b) => polyDistToPoint(b, pad) < COVER_D);
      if (cov && !pad.covered) {
        for (const sw of this.switches) {
          if (sw.ch === pad.ch) sw.idx = (sw.idx + 1) % sw.branches.length;
        }
        this.events.push({ type: 'pad', x: pad.x, y: pad.y });
      }
      pad.covered = cov;
    }
    for (const pl of this.plates) {
      pl.pressed = bodies.some((b) => polyDistToPoint(b, pl) < COVER_D);
    }
  }

  updateGates() {
    for (const g of this.gates) {
      let p = false;
      if (g.src === 'plate') {
        const mine = this.plates.filter((pl) => pl.ch === g.ch);
        p = mine.length > 0 && mine.every((pl) => pl.pressed);
      } else {
        p = g.node.edges.some((e) => e.kind === 'wire' && e.powered);
      }
      if (g.invert) p = !p;
      if (g.latch) { g.latched = g.latched || p; p = g.latched; }
      if (p !== g.open) this.events.push({ type: p ? 'gate-open' : 'gate-close', x: g.x, y: g.y });
      g.open = p;
    }
  }

  // ---------- scales ----------

  panWeight(sc, side) {
    const pan = side.e;
    let w = 0;
    for (const d of this.dashes) w += trailOverlapOnEdge(d.trail, pan) + (d.edge === pan ? 0.001 : 0);
    if (this.echo) {
      // the echo weighs what the player weighed when recorded, if its body lies on the pan
      w += trailOverlapOnEdge(this.echo.trail, pan) + (this.echo.edge === pan ? 0.001 : 0);
    }
    for (const ob of this.obedients) if (ob.alive) w += trailOverlapOnEdge(ob.trail, pan) + (ob.edge === pan ? 0.001 : 0);
    for (const L of this.lengthers) {
      if (L.onPan && this.scales[L.onPan.scale] === sc && L.onPan.side === (side === sc.a ? 'a' : 'b')) w += L.amount;
    }
    return w;
  }

  stepScales() {
    for (const sc of this.scales) {
      const wA = this.panWeight(sc, sc.a);
      const wB = this.panWeight(sc, sc.b);
      const dW = wA - wB;
      if (Math.abs(dW) < 0.02) continue;
      // A heavier -> A descends. p=0: A at ys[0]; p=1: A at ys[1] (author: ys[1] is the "down" end for A)
      const dir = dW > 0 ? 1 : -1;
      const range = Math.abs(sc.a.def.ys[1] - sc.a.def.ys[0]) || 1;
      let np = sc.p + (dir * sc.speed * DT) / range;
      np = Math.max(0, Math.min(1, np));
      if (np === sc.p) continue;
      if (this.panDockObstructed(sc)) continue;
      sc.p = np;
      this.updatePanGeometry(sc);
    }
  }

  panDockObstructed(sc) {
    // a seesaw cannot tip while any body lies across a docked seam
    const bodies = this.conductorBodies();
    for (const side of [sc.a, sc.b]) {
      for (const [nd, tEnd] of [[side.dockA, 0], [side.dockB, side.e.len]]) {
        if (!nd) continue;
        const pt = posOnEdge(side.e, tEnd);
        for (const body of bodies) {
          if (polyDistToPoint(body, pt) < 0.12) return true;
        }
      }
    }
    return false;
  }

  updatePanGeometry(sc) {
    const place = (side, p) => {
      const y = side.def.ys[0] + (side.def.ys[1] - side.def.ys[0]) * p;
      side.y = y;
      const e = side.e;
      // undock
      for (const dockKey of ['dockA', 'dockB']) {
        const n = side[dockKey];
        if (n && Math.abs(n.y - y) > 0.051) {
          n.edges = n.edges.filter((x) => x !== e);
          side[dockKey] = null;
          if (dockKey === 'dockA') { e.a = side.dummyA; } else { e.b = side.dummyB; }
        }
      }
      side.dummyA.y = y; side.dummyB.y = y;
      e.y1 = y; e.y2 = y;
      // dock to any static node sitting at a pan end
      for (const [dockKey, x] of [['dockA', side.def.x0], ['dockB', side.def.x1]]) {
        if (side[dockKey]) continue;
        for (const n of this.level.nodes) {
          if (Math.abs(n.x - x) < 0.01 && Math.abs(n.y - y) < 0.05) {
            side[dockKey] = n;
            if (!n.edges.includes(e)) n.edges.push(e);
            if (dockKey === 'dockA') e.a = n; else e.b = n;
            e.y1 = n.y; e.y2 = n.y;
            break;
          }
        }
      }
    };
    place(sc.a, sc.p);
    place(sc.b, 1 - sc.p);
    // lengthers riding a pan move with it (banked weight)
    for (const L of this.lengthers || []) {
      if (!L.onPan || !this.scales || this.scales[L.onPan.scale] !== sc) continue;
      const side = L.onPan.side === 'a' ? sc.a : sc.b;
      L.x = side.e.x1 + (L.onPan.t ?? side.e.len / 2);
      L.y = side.e.y1;
    }
  }

  // ---------- death ----------

  checkDeaths() {
    for (const d of this.dashes) {
      const body = trailPoints(d.trail);
      for (const en of this.enemies) {
        if (en.alive && polylineDist(body, this.enemyBody(en)) < KILL_D) return this.die('enemy', en);
      }
      for (const ob of this.obedients) {
        if (ob.alive && polylineDist(body, trailPoints(ob.trail)) < KILL_D) return this.die('obedient', ob);
      }
      for (const ls of this.locksteps) {
        if (ls.alive && polylineDist(body, this.lockstepBody(ls)) < KILL_D) return this.die('lockstep', ls);
      }
      if (this.echo && polylineDist(body, trailPoints(this.echo.trail)) < KILL_D) {
        return this.die('echo', this.echo);
      }
    }
  }

  die(cause, at) {
    if (this.dead || this.ghost) return;
    this.dead = true;
    this.deathCause = cause;
    const d = this.dashes[0];
    this.events.push({ type: 'death', x: at?.x ?? d.x, y: at?.y ?? d.y, cause });
  }

  enemyBody(en) {
    return polySub(en.pts, en.cum, en.s - en.half, en.s + en.half, en.mode === 'loop');
  }
  lockstepBody(ls) {
    return polySub(ls.pts, ls.cum, ls.s - ls.half, ls.s + ls.half, false);
  }
}

// ---------- switch helpers ----------

function canPassSwitch(n, from, to) {
  if (!n.sw) return true;
  const { trunk, branches, idx } = n.sw;
  if (from === trunk) return to === branches[idx];
  if (branches.includes(from)) return to === trunk; // trailing through is always allowed
  return true;
}

function canPassSwitchInto(n, viaEdge) {
  if (!n.sw) return true;
  return viaEdge === n.sw.trunk || n.sw.branches.includes(viaEdge);
}

function canWireJoin(n, e1, e2) {
  if (!n.sw) return true;
  const { trunk, branches, idx } = n.sw;
  const active = branches[idx];
  return (e1 === trunk && e2 === active) || (e2 === trunk && e1 === active);
}

// ---------- small geometry ----------

function near(p, q, r) {
  return Math.hypot(p.x - q.x, p.y - q.y) < r;
}

function burntAt(e, t) {
  if (e.kind !== 'fuse') return false;
  const a = e.burnA || 0, b = e.burnB || 0;
  return t < a - EPS || t > e.len - b + EPS;
}

export function polyPoint(pts, cum, s, wrap) {
  const L = cum[cum.length - 1];
  if (wrap) s = ((s % L) + L) % L;
  s = Math.max(0, Math.min(L, s));
  for (let i = 1; i < cum.length; i++) {
    if (s <= cum[i] + EPS) {
      const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
      };
    }
  }
  return pts[pts.length - 1];
}

function polySub(pts, cum, s0, s1, wrap) {
  const L = cum[cum.length - 1];
  const out = [];
  const N = 7;
  for (let i = 0; i <= N; i++) {
    out.push(polyPoint(pts, cum, s0 + ((s1 - s0) * i) / N, wrap));
  }
  return out;
}

function polyDistToPoint(poly, p) {
  if (!poly.length) return Infinity;
  if (poly.length === 1) return Math.hypot(poly[0].x - p.x, poly[0].y - p.y);
  let best = Infinity;
  for (let i = 0; i < poly.length - 1; i++) best = Math.min(best, segPointDist(poly[i], poly[i + 1], p));
  return best;
}

function railSegAt(ls) {
  const { pts, cum, s } = ls;
  for (let i = 1; i < cum.length; i++) {
    if (s <= cum[i] + EPS) {
      const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
      const len = Math.hypot(dx, dy) || 1;
      return { ux: dx / len, uy: dy / len };
    }
  }
  return null;
}

function letterFor(x, y) {
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'R' : 'L';
  return y > 0 ? 'D' : 'U';
}
