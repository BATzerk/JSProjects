// Level parser: ASCII lattice -> graph.
// Points live at (even col, even row); horizontal edge glyphs at (odd col, even row);
// vertical edge glyphs at (even col, odd row). One glyph = one unit-length edge.
// World coords: (col/2, row/2), y grows downward.
//
// Edge glyphs (orientation comes from slot parity):
//   - |   line          =  glass        *  wire (not walkable)
//   .     fuse          ~  ice (glide)  >  <  ^  v  one-way line
//   x     enemy-only    !  player-only
// Point glyphs:
//   space  nothing        +  junction (connects all incident edges)
//   - |    pass-through   P  player start (several = twins)
//   G      goal diamond   anything else = anchor: looked up in defs
//
// Anchored object types (defs):
//   enemy{path,mode,speed,phase} obedient{} lockstep{rail,map} echo{dur}
//   key{ch} lock{ch} cover{ch} coverlock{ch} lengther{amount}
//   switch{trunk,branches,start,ch,turnstile} pad{ch}
//   source{} gate{src:'wire'|'plate',ch,latch,invert} brazier{} wax{}
//   prism{spawn} spawn{} plate{ch} magnet{r} scale (in meta.scales, not anchored)

const H_EDGE = {
  '-': {}, '=': { kind: 'glass' }, '*': { kind: 'wire' }, '.': { kind: 'fuse' },
  '~': { kind: 'ice' }, '>': { ow: 1 }, '<': { ow: -1 },
  x: { excl: 'enemy' }, '!': { excl: 'player' },
};
const V_EDGE = {
  '|': {}, '=': { kind: 'glass' }, '*': { kind: 'wire' }, '.': { kind: 'fuse' },
  '~': { kind: 'ice' }, v: { ow: 1 }, '^': { ow: -1 },
  x: { excl: 'enemy' }, '!': { excl: 'player' },
};

export const DIRV = {
  R: { x: 1, y: 0 }, L: { x: -1, y: 0 }, U: { x: 0, y: -1 }, D: { x: 0, y: 1 },
};

export function parseLevel(def) {
  const lines = def.map.replace(/\t/g, '  ').split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const nodes = new Map(); // key "x,y" or "x,y#v" for pass-through overlays
  const edges = [];
  const objects = [];
  const starts = [];
  const diamonds = [];

  const nodeKey = (x, y, layer) => `${x},${y}${layer || ''}`;
  function getNode(x, y, layer) {
    const k = nodeKey(x, y, layer);
    let n = nodes.get(k);
    if (!n) {
      n = { id: k, x, y, edges: [], anchor: null, block: null, sw: null };
      nodes.set(k, n);
    }
    return n;
  }

  // Which layer an edge should attach to at a given point (for '-'/'|' pass-throughs).
  const pointChar = (c, r) => (lines[r] && lines[r][c]) || ' ';
  function layerFor(c, r, axis) {
    const ch = pointChar(c, r);
    if (ch === '-') return axis === 'h' ? '' : '#v';
    if (ch === '|') return axis === 'v' ? '' : '#v';
    return '';
  }

  for (let r = 0; r < lines.length; r++) {
    const line = lines[r];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === ' ') continue;
      const hSlot = c % 2 === 1 && r % 2 === 0;
      const vSlot = c % 2 === 0 && r % 2 === 1;
      if (hSlot && H_EDGE[ch]) {
        const a = getNode((c - 1) / 2, r / 2, layerFor(c - 1, r, 'h'));
        const b = getNode((c + 1) / 2, r / 2, layerFor(c + 1, r, 'h'));
        edges.push(mkEdge(a, b, H_EDGE[ch]));
      } else if (vSlot && V_EDGE[ch]) {
        const a = getNode(c / 2, (r - 1) / 2, layerFor(c, r - 1, 'v'));
        const b = getNode(c / 2, (r + 1) / 2, layerFor(c, r + 1, 'v'));
        edges.push(mkEdge(a, b, V_EDGE[ch]));
      } else if (c % 2 === 0 && r % 2 === 0) {
        // point glyphs
        if (ch === '+' || ch === '-' || ch === '|') continue; // structural only
        const n = getNode(c / 2, r / 2);
        n.anchor = ch;
        if (ch === 'P') starts.push(n);
        else if (ch === 'G') diamonds.push({ node: n, taken: false });
        else {
          const d = (def.defs || {})[ch];
          if (!d) throw new Error(`level ${def.id}: no def for anchor '${ch}' at (${c / 2},${r / 2})`);
          objects.push({ ...d, anchor: ch, node: n, x: n.x, y: n.y });
        }
      } else if (hSlot || vSlot) {
        throw new Error(`level ${def.id}: bad edge glyph '${ch}' at col ${c}, row ${r}`);
      }
    }
  }

  function mkEdge(a, b, props) {
    const e = {
      id: edges.length, a, b,
      kind: props.kind || 'line', ow: props.ow || 0, excl: props.excl || null,
      alive: true, burn: null, // burn: {from:0|1, t:0..len} while burning
    };
    finalizeEdgeGeom(e);
    a.edges.push(e); b.edges.push(e);
    return e;
  }

  // Compact plain degree-2 nodes into longer edges (keeps specials unit-length).
  let merged = true;
  while (merged) {
    merged = false;
    for (const n of nodes.values()) {
      if (n.anchor || n.edges.length !== 2) continue;
      const [e1, e2] = n.edges;
      if (e1.kind !== 'line' || e2.kind !== 'line' || e1.ow || e2.ow) continue;
      if (e1.excl !== e2.excl) continue;
      const dir1 = edgeAxis(e1), dir2 = edgeAxis(e2);
      if (dir1 !== dir2) continue;
      // splice: new endpoints are the far nodes
      const f1 = e1.a === n ? e1.b : e1.a;
      const f2 = e2.a === n ? e2.b : e2.a;
      e1.a = f1; e1.b = f2;
      finalizeEdgeGeom(e1);
      f1.edges = f1.edges.filter((e) => e !== e1);
      f1.edges.push(e1);
      f2.edges = f2.edges.filter((e) => e !== e2);
      f2.edges.push(e1);
      nodes.delete(n.id);
      const i = edges.indexOf(e2);
      edges.splice(i, 1);
      merged = true;
      break;
    }
  }
  edges.forEach((e, i) => (e.id = i));

  // objects with no map anchor (e.g. lengthers riding a pan)
  for (const o of def.objects || []) {
    objects.push({ node: null, x: 0, y: 0, ...o });
  }

  return {
    def,
    nodes: [...nodes.values()],
    edges,
    objects,
    starts,
    diamonds,
    texts: def.texts || [],
    scales: def.scales || [],
  };
}

export function edgeAxis(e) {
  return Math.abs(e.b.x - e.a.x) > Math.abs(e.b.y - e.a.y) ? 'h' : 'v';
}

export function finalizeEdgeGeom(e) {
  e.x1 = e.a.x; e.y1 = e.a.y; e.x2 = e.b.x; e.y2 = e.b.y;
  const dx = e.x2 - e.x1, dy = e.y2 - e.y1;
  e.len = Math.hypot(dx, dy);
  e.ux = dx / e.len; e.uy = dy / e.len;
}

export function posOnEdge(e, t) {
  return { x: e.x1 + e.ux * t, y: e.y1 + e.uy * t };
}

// Parse a move-string like "R3 U2 L1" from a start point into a polyline.
export function movesToPolyline(x, y, str) {
  const pts = [{ x, y }];
  const re = /([RLUD])(\d+(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(str))) {
    const d = DIRV[m[1]], n = parseFloat(m[2]);
    x += d.x * n; y += d.y * n;
    pts.push({ x, y });
  }
  return pts;
}
