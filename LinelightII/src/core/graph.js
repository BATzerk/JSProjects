// Traveler movement along the line network, plus body-trail bookkeeping.
// A traveler is { edge, t } with t in [0, edge.len]. Every mover that walks the
// graph (player dashes, obedients) shares moverStep; patrol enemies ride
// precomputed polylines instead.

import { DIRV, posOnEdge } from './parse.js';

export const EPS = 1e-6;
export const SNAP = 0.06;      // corner assist: this close to a node counts as on it
export const BLOCK_GAP = 0.16; // how far short of a blocked node a body stops

export function travelerPos(m) {
  return posOnEdge(m.edge, m.t);
}

function otherNode(e, n) {
  return e.a === n ? e.b : e.a;
}

export function dirFromNode(e, n) {
  const s = e.a === n ? 1 : -1;
  return { x: e.ux * s, y: e.uy * s };
}

// rules: {
//   walkable(edge) -> bool
//   canEnter(edge, sign) -> bool          (one-way / exclusive checks)
//   canPass(node, fromEdge, toEdge) -> bool  (switch junctions)
//   blocked(node) -> bool                 (locks/gates/wax/coverlocks)
//   onPass(node, fromEdge, toEdge) -> void   (turnstiles)
// }
export function moverStep(m, dirs, dist, rules) {
  let moved = 0;
  let guard = 96;
  while (dist > EPS && guard-- > 0) {
    const e = m.edge;
    const atA = m.t <= EPS, atB = m.t >= e.len - EPS;
    // choose a sign along the current edge from held dirs (most recent first)
    let sign = 0, chosenVia = null;
    for (const d of dirs) {
      const dv = DIRV[d];
      const dot = dv.x * e.ux + dv.y * e.uy;
      if (Math.abs(dot) > 0.5) {
        const s = Math.sign(dot);
        // leaving through a node? handled below; mid-edge one-way check:
        if (e.ow && s !== e.ow) continue; // committed street
        sign = s; chosenVia = d;
        break;
      }
      // perpendicular input: maybe a branch exists at a nearby node
      // (snap assist: within SNAP of a node counts as being there)
      const nearA = m.t <= SNAP, nearB = m.t >= e.len - SNAP;
      if (nearA || nearB) {
        const n = nearA ? e.a : e.b;
        const exit = pickExit(n, e, [d], rules);
        if (exit) { m.t = nearA ? 0 : e.len; takeExit(m, exit); sign = null; break; }
      }
    }
    if (sign === null) continue; // switched edges via perpendicular branch
    if (sign === 0) break; // no propulsion

    // heading toward which node?
    const targetNode = sign > 0 ? e.b : e.a;
    const nodeT = sign > 0 ? e.len : 0;
    // stop short of blocked nodes
    let boundT = nodeT;
    if (rules.blocked(targetNode)) boundT = sign > 0 ? e.len - BLOCK_GAP : BLOCK_GAP;
    const room = (boundT - m.t) * sign;
    if (room <= EPS) {
      // already at the bound; if it's an open node, try to exit through it
      if (!rules.blocked(targetNode) && Math.abs(m.t - nodeT) <= EPS) {
        const exit = pickExit(targetNode, e, dirs, rules);
        if (!exit) break;
        takeExit(m, exit);
        continue;
      }
      break;
    }
    const step = Math.min(room, dist);
    m.t += step * sign;
    dist -= step;
    moved += step;
  }
  return moved;
}

function takeExit(m, exit) {
  m.edge = exit.edge;
  m.t = exit.fromA ? 0 : exit.edge.len;
}

// Choose an exit edge from node n (arriving via fromEdge, may be null) for the
// highest-priority dir that has a matching branch.
export function pickExit(n, fromEdge, dirs, rules) {
  // Switch junctions route traffic themselves: trunk -> active branch,
  // any branch -> trunk. You are shunted along as long as no held key
  // directly opposes the exit.
  if (n.sw && fromEdge) {
    const sw = n.sw;
    let exit = null;
    if (fromEdge === sw.trunk) exit = sw.branches[sw.idx];
    else if (sw.branches.includes(fromEdge)) exit = sw.trunk;
    if (!exit || !exit.alive || !rules.walkable(exit)) return null;
    const dir = dirFromNode(exit, n);
    for (const d of dirs) {
      const dv = DIRV[d];
      if (dv.x * dir.x + dv.y * dir.y < -0.5) return null; // opposing: refuse
      const fromA = exit.a === n;
      const sign = fromA ? 1 : -1;
      if (exit.ow && sign !== exit.ow) return null;
      if (!rules.canEnter(exit, sign)) return null;
      if (rules.onPass) rules.onPass(n, fromEdge, exit);
      return { edge: exit, fromA };
    }
    return null;
  }
  for (const d of dirs) {
    const dv = DIRV[d];
    for (const e of n.edges) {
      if (!e.alive || e === fromEdge) continue;
      if (!rules.walkable(e)) continue;
      const dir = dirFromNode(e, n);
      if (dv.x * dir.x + dv.y * dir.y < 0.5) continue;
      const fromA = e.a === n;
      const sign = fromA ? 1 : -1;
      if (e.ow && sign !== e.ow) continue;
      if (!rules.canEnter(e, sign)) continue;
      if (fromEdge && !rules.canPass(n, fromEdge, e)) continue;
      if (fromEdge && rules.onPass) rules.onPass(n, fromEdge, e);
      return { edge: e, fromA };
    }
  }
  return null;
}

// ---- body trails -----------------------------------------------------------
// A trail records where a mover's body lies: newest at the front.
// segs: [{e, a, b, x1,y1,x2,y2}] (a..b are params on e, a is the *older* end)

export function mkTrail(m, bodyLen) {
  return { segs: [{ e: m.edge, a: m.t, b: m.t }], len: 0, bodyLen };
}

export function trailAdvance(trail, m) {
  const head = trail.segs[trail.segs.length - 1];
  if (head.e === m.edge) {
    const prevDir = Math.sign(head.b - head.a);
    const newDir = Math.sign(m.t - head.b);
    if (prevDir !== 0 && newDir !== 0 && newDir !== prevDir) {
      // reversal: fold the trail rather than rubber-banding the segment
      trail.segs.push({ e: m.edge, a: head.b, b: m.t });
    } else {
      head.b = m.t;
    }
  } else {
    trail.segs.push({ e: m.edge, a: m.t, b: m.t });
  }
  // recompute length exactly (segments are short lists; cheap and safe)
  trail.len = trail.segs.reduce((acc, s) => acc + Math.abs(s.b - s.a), 0);
  trimTrail(trail);
}

export function trailJumpTo(trail, m) {
  trail.segs = [{ e: m.edge, a: m.t, b: m.t }];
  trail.len = 0;
}

function trimTrail(trail) {
  let excess = trail.len - trail.bodyLen;
  while (excess > EPS && trail.segs.length) {
    const tail = trail.segs[0];
    const segLen = Math.abs(tail.b - tail.a);
    if (segLen <= excess + EPS) {
      trail.segs.shift();
      trail.len -= segLen;
      excess -= segLen;
    } else {
      const s = Math.sign(tail.b - tail.a);
      tail.a += s * excess;
      trail.len -= excess;
      excess = 0;
    }
  }
  if (!trail.segs.length) trail.segs.push({ e: null, a: 0, b: 0 });
}

// Trail as world-space polyline (tail-first).
export function trailPoints(trail) {
  const pts = [];
  for (const s of trail.segs) {
    if (!s.e) continue;
    const p1 = posOnEdge(s.e, s.a), p2 = posOnEdge(s.e, s.b);
    if (!pts.length) pts.push(p1);
    pts.push(p2);
  }
  return pts;
}

// Does the body lie on edge e (any portion)?
export function trailOnEdge(trail, e) {
  for (const s of trail.segs) if (s.e === e && Math.abs(s.b - s.a) > 1e-4) return true;
  const head = trail.segs[trail.segs.length - 1];
  return head.e === e; // zero-length head still counts as touching
}

// Length of body overlapping edge e between params [t0, t1].
export function trailOverlapOnEdge(trail, e, t0 = 0, t1 = e ? e.len : 0) {
  let sum = 0;
  const lo = Math.min(t0, t1), hi = Math.max(t0, t1);
  for (const s of trail.segs) {
    if (s.e !== e) continue;
    const a = Math.min(s.a, s.b), b = Math.max(s.a, s.b);
    sum += Math.max(0, Math.min(b, hi) - Math.max(a, lo));
  }
  return sum;
}

// min distance from point p to the trail polyline
export function trailDistToPoint(trail, p) {
  const pts = trailPoints(trail);
  if (!pts.length) return Infinity;
  if (pts.length === 1) return Math.hypot(pts[0].x - p.x, pts[0].y - p.y);
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    best = Math.min(best, segPointDist(pts[i], pts[i + 1], p));
  }
  return best;
}

export function segPointDist(a, b, p) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L2 = dx * dx + dy * dy;
  let t = L2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = a.x + dx * t, y = a.y + dy * t;
  return Math.hypot(p.x - x, p.y - y);
}

// min distance between two polylines
export function polylineDist(p1, p2) {
  if (p1.length === 0 || p2.length === 0) return Infinity;
  let best = Infinity;
  const segs1 = p1.length > 1 ? p1.length - 1 : 1;
  for (let i = 0; i < segs1; i++) {
    const a = p1[i], b = p1[Math.min(i + 1, p1.length - 1)];
    const segs2 = p2.length > 1 ? p2.length - 1 : 1;
    for (let j = 0; j < segs2; j++) {
      const c = p2[j], d = p2[Math.min(j + 1, p2.length - 1)];
      best = Math.min(best, segSegDist(a, b, c, d));
      if (best < 1e-9) return 0;
    }
  }
  return best;
}

function segSegDist(a, b, c, d) {
  if (segsIntersect(a, b, c, d)) return 0;
  return Math.min(
    segPointDist(a, b, c), segPointDist(a, b, d),
    segPointDist(c, d, a), segPointDist(c, d, b),
  );
}

function segsIntersect(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
}
