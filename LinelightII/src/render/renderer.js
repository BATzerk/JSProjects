// Canvas renderer. Dark sky, thin luminous lines, small bright things that
// matter. Everything is drawn, nothing is an image.

import { posOnEdge } from '../core/parse.js';
import { trailPoints } from '../core/graph.js';

const TAU = Math.PI * 2;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.cam = { scale: 60, cx: 0, cy: 0 };
    this.stars = [];
    let seed = 12345;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 140; i++) {
      this.stars.push({ x: rnd(), y: rnd(), r: 0.4 + rnd() * 1.1, tw: rnd() * TAU, sp: 0.3 + rnd() * 0.8, par: 0.2 + rnd() * 0.5 });
    }
    this.resize();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(innerWidth * dpr);
    this.canvas.height = Math.floor(innerHeight * dpr);
    this.canvas.style.width = innerWidth + 'px';
    this.canvas.style.height = innerHeight + 'px';
    this.dpr = dpr;
    this.W = this.canvas.width;
    this.H = this.canvas.height;
  }

  // fit camera to a bbox in world units
  fitCamera(bbox, pad = 1.6) {
    const w = bbox.x1 - bbox.x0 + pad * 2;
    const h = bbox.y1 - bbox.y0 + pad * 2;
    const scale = Math.min(this.W / w, this.H / h, 90 * this.dpr);
    this.cam = {
      scale,
      cx: (bbox.x0 + bbox.x1) / 2,
      cy: (bbox.y0 + bbox.y1) / 2,
    };
  }

  sx(x) { return this.W / 2 + (x - this.cam.cx) * this.cam.scale + this.shakeX; }
  sy(y) { return this.H / 2 + (y - this.cam.cy) * this.cam.scale + this.shakeY; }
  s(v) { return v * this.cam.scale; }

  background(t, tint = '#0d1b2e') {
    const { ctx, W, H } = this;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a1220');
    g.addColorStop(0.55, tint);
    g.addColorStop(1, '#0a1424');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (const st of this.stars) {
      const a = 0.06 + 0.1 * (0.5 + 0.5 * Math.sin(t * st.sp + st.tw));
      ctx.fillStyle = `rgba(220,235,255,${a})`;
      ctx.beginPath();
      ctx.arc(st.x * W, st.y * H, st.r * this.dpr, 0, TAU);
      ctx.fill();
    }
  }

  glowLine(pts, color, width, glow, alpha = 1) {
    const { ctx } = this;
    if (pts.length < 2) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [w, a] of [[glow, 0.13 * alpha], [width, alpha]]) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = a;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(this.sx(pts[0].x), this.sy(pts[0].y));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(this.sx(pts[i].x), this.sy(pts[i].y));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  dot(x, y, r, color, glowR = 0) {
    const { ctx } = this;
    if (glowR > 0) {
      const g = ctx.createRadialGradient(this.sx(x), this.sy(y), 0, this.sx(x), this.sy(y), this.s(glowR));
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.sx(x), this.sy(y), this.s(glowR), 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(this.sx(x), this.sy(y), this.s(r), 0, TAU);
    ctx.fill();
  }

  diamond(x, y, r, color, rot = Math.PI / 4, fill = true, lw = 2) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(this.sx(x), this.sy(y));
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.rect(-this.s(r), -this.s(r), this.s(r * 2), this.s(r * 2));
    if (fill) { ctx.fillStyle = color; ctx.fill(); }
    else { ctx.strokeStyle = color; ctx.lineWidth = lw * this.dpr; ctx.stroke(); }
    ctx.restore();
  }

  text(x, y, str, size = 0.34, color = 'rgba(190,205,228,0.55)', align = 'center') {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.font = `italic ${this.s(size)}px system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, this.sx(x), this.sy(y));
  }

  // ---------------- level ----------------

  drawSim(sim, t, tint) {
    this.shakeX = (Math.random() - 0.5) * this.shake * this.dpr * 14;
    this.shakeY = (Math.random() - 0.5) * this.shake * this.dpr * 14;
    this.shake = Math.max(0, this.shake - 0.04);

    this.background(t, tint);
    const lw = Math.max(1.6, this.s(0.045));
    const glw = this.s(0.24);

    // scale shafts (guide rails) behind everything
    for (const sc of sim.scales) {
      for (const side of [sc.a, sc.b]) {
        for (const x of [side.def.x0, side.def.x1]) {
          this.dashedLine([{ x, y: side.def.ys[0] }, { x, y: side.def.ys[1] }], 'rgba(216,169,90,0.22)', lw * 0.6, [2, 6]);
        }
      }
    }

    // edges
    for (const e of sim.level.edges) {
      const pts = [{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }];
      if (e.kind === 'line') {
        if (!e.alive) continue;
        let col = 'rgba(168,190,214,0.75)';
        if (e.excl === 'enemy') col = 'rgba(255,120,120,0.5)';
        if (e.excl === 'player') col = 'rgba(230,244,255,0.9)';
        this.glowLine(pts, col, lw, glw);
        if (e.ow) this.chevrons(e, col, t);
      } else if (e.kind === 'glass') {
        if (!e.alive) { this.brokenGlass(e, t); continue; }
        this.glowLine(pts, 'rgba(185,230,255,0.9)', lw * 0.8, glw);
        this.ticks(e, 'rgba(220,245,255,0.6)');
      } else if (e.kind === 'fuse') {
        this.fuseEdge(e, lw, t);
      } else if (e.kind === 'wire') {
        const on = !!e.powered;
        this.glowLine(pts, on ? 'rgba(120,225,255,0.95)' : 'rgba(80,140,170,0.4)', lw * 0.55, on ? glw : 0);
        if (on) this.currentDots(e, t);
      } else if (e.kind === 'ice') {
        if (!e.alive) continue;
        this.glowLine(pts, 'rgba(200,235,255,0.85)', lw * 1.15, glw * 0.7);
        this.glowLine(pts, 'rgba(255,255,255,0.5)', lw * 0.35, 0);
      }
    }

    // pans
    for (const sc of sim.scales) {
      for (const side of [sc.a, sc.b]) {
        const e = side.e;
        this.glowLine([{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }], '#d8a95a', lw * 1.5, glw);
        for (const x of [e.x1, e.x2]) {
          this.glowLine([{ x, y: e.y1 - 0.12 }, { x, y: e.y1 + 0.12 }], '#d8a95a', lw, 0);
        }
      }
    }

    // node objects
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    for (const g of sim.level.diamonds) {
      if (g.taken) continue;
      const r = 0.16 + 0.03 * pulse;
      this.diamond(g.node.x, g.node.y, r + 0.1, 'rgba(255,215,94,0.85)', t * 0.8, false, 1.6);
      this.diamond(g.node.x, g.node.y, r, '#ffd75e', Math.PI / 4);
      this.dot(g.node.x, g.node.y, 0.02, '#fff', 0.7);
    }
    for (const k of sim.keys) {
      if (k.taken && !k.heldBy) continue;
      let x = k.x, y = k.y;
      if (k.heldBy) {
        x = k.heldBy.x + Math.cos(t * 2.4) * 0.32;
        y = k.heldBy.y + Math.sin(t * 2.4) * 0.32;
      }
      this.diamond(x, y, 0.1, '#ffd75e', t * 1.5, false, 2);
      this.dot(x, y, 0.045, '#ffd75e', 0.3);
    }
    for (const l of sim.locks) {
      if (l.opened) continue;
      this.diamond(l.x, l.y, 0.18, '#ffd75e', Math.PI / 4, false, 2.2);
      this.diamond(l.x, l.y, 0.07, '#ffd75e', Math.PI / 4, true);
    }
    for (const c of sim.covers) {
      if (c.taken) continue;
      this.diamond(c.x, c.y, 0.12, 'rgba(180,240,210,0.9)', Math.PI / 4, false, 2);
    }
    for (const cl of sim.coverlocks) {
      if (cl.opened) continue;
      this.diamond(cl.x, cl.y, 0.2, 'rgba(180,240,210,0.9)', Math.PI / 4, false, 2.2);
      this.glowLine([{ x: cl.x - 0.1, y: cl.y }, { x: cl.x + 0.1, y: cl.y }], 'rgba(180,240,210,0.9)', lw, 0);
    }
    for (const p of sim.pads) {
      const c = p.covered ? '#a5e88a' : '#79c66d';
      this.diamond(p.x, p.y, 0.14 + 0.02 * pulse, c, Math.PI / 4, false, 2.2);
      this.dot(p.x, p.y, 0.04, c, p.covered ? 0.5 : 0);
    }
    for (const sw of sim.switches) {
      this.switchArc(sw, t);
    }
    for (const s of sim.sockets) {
      const hot = s.hot;
      this.socketCup(s.x, s.y, hot ? '#9be9ff' : 'rgba(120,190,215,0.8)', hot);
    }
    for (const z of sim.sources) {
      this.dot(z.x, z.y, 0.09, '#9be9ff', 0.8);
      for (let i = 0; i < 6; i++) {
        const a = t * 0.7 + (i * TAU) / 6;
        this.glowLine([
          { x: z.x + Math.cos(a) * 0.16, y: z.y + Math.sin(a) * 0.16 },
          { x: z.x + Math.cos(a) * 0.27, y: z.y + Math.sin(a) * 0.27 },
        ], '#9be9ff', lw * 0.6, 0);
      }
    }
    for (const g of sim.gates) this.gateBars(g, lw, t);
    for (const b of sim.braziers) {
      this.diamond(b.x, b.y, 0.12, b.lit ? '#ffb066' : '#c46a2e', Math.PI / 4, false, 2.2);
      const fl = b.lit ? 0.14 : 0.07;
      this.dot(b.x, b.y - 0.14, fl * (0.8 + 0.3 * Math.sin(t * 9 + b.x)), '#ffab4d', b.lit ? 0.6 : 0.25);
    }
    for (const w of sim.waxes) {
      if (!w.node.block) continue;
      this.dot(w.x, w.y, 0.15, '#e8d9b0', 0.2);
      this.dot(w.x, w.y + 0.13, 0.06, '#e8d9b0');
    }
    for (const sp of sim.spawners) {
      const rec = sp.state === 'recording';
      this.ring(sp.x, sp.y, 0.16, rec ? '#ffffff' : 'rgba(220,230,255,0.7)', 2);
      this.ring(sp.x, sp.y, 0.26, 'rgba(220,230,255,0.35)', 1.4);
      if (rec) {
        const frac = sp.timer / sp.dur;
        this.arc(sp.x, sp.y, 0.26, -Math.PI / 2, -Math.PI / 2 + frac * TAU, '#ffffff', 2.4);
      }
    }
    for (const pr of sim.prisms) {
      if (pr.used) continue;
      this.triangle(pr.x, pr.y, 0.17, '#c9a2ff', t);
    }
    for (const L of sim.lengthers) {
      this.lengtherGlyph(L, t);
    }
    for (const pl of sim.plates) {
      const c = pl.pressed ? '#e6c9ff' : 'rgba(201,162,255,0.7)';
      this.glowLine([{ x: pl.x - 0.16, y: pl.y + 0.14 }, { x: pl.x - 0.16, y: pl.y - 0.14 }], c, lw, pl.pressed ? glw : 0);
      this.glowLine([{ x: pl.x + 0.16, y: pl.y + 0.14 }, { x: pl.x + 0.16, y: pl.y - 0.14 }], c, lw, pl.pressed ? glw : 0);
    }
    for (const m of sim.magnets) {
      this.ring(m.x, m.y, 0.14, '#d0a5f0', 2.4);
      this.ring(m.x, m.y, 0.14 + ((t * 0.5) % 1) * 0.5, `rgba(208,165,240,${0.5 - 0.5 * ((t * 0.5) % 1)})`, 1.4);
    }

    // texts
    for (const tx of sim.level.texts) this.text(tx.x, tx.y, tx.str, tx.size || 0.34);

    // entities
    for (const en of sim.enemies) {
      if (!en.alive) continue;
      this.body(sim.enemyBody(en), '#ff5a5a', lw * 1.7, glw);
    }
    for (const ls of sim.locksteps) {
      if (!ls.alive) continue;
      const b = sim.lockstepBody(ls);
      this.body(b, '#e06666', lw * 1.7, glw);
      this.ring(ls.x, ls.y, 0.2, 'rgba(224,102,102,0.6)', 1.6);
    }
    for (const ob of sim.obedients) {
      if (!ob.alive) continue;
      this.body(trailPoints(ob.trail), '#ff8a3c', lw * 1.7, glw);
      this.ring(ob.x, ob.y, 0.2, 'rgba(255,138,60,0.7)', 1.6);
    }
    if (sim.echo) {
      this.body(trailPoints(sim.echo.trail), 'rgba(240,245,255,0.5)', lw * 1.6, glw * 0.7);
    }
    for (const d of sim.dashes) {
      const pts = trailPoints(d.trail);
      this.body(pts, '#ffffff', lw * 1.8, glw * 1.3);
      this.dot(d.x, d.y, 0.05, '#ffffff', 0.9);
    }
    for (const f of sim.flames || []) {
      const r = 0.09 + 0.03 * Math.sin(t * 14 + f.t * 9);
      this.dot(f.x, f.y, r, '#ffab4d', 0.8);
      this.dot(f.x, f.y, r * 0.5, '#fff1c9', 0);
    }

    this.drawParticles();
  }

  body(pts, color, w, glow) {
    if (!pts.length) return;
    if (pts.length === 1) { this.dot(pts[0].x, pts[0].y, 0.08, color, 0.4); return; }
    this.glowLine(pts, color, w, glow);
  }

  dashedLine(pts, color, w, dash) {
    const { ctx } = this;
    ctx.save();
    ctx.setLineDash(dash.map((d) => d * this.dpr));
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(this.sx(pts[0].x), this.sy(pts[0].y));
    for (let i = 1; i < pts.length; i++) ctx.lineTo(this.sx(pts[i].x), this.sy(pts[i].y));
    ctx.stroke();
    ctx.restore();
  }

  chevrons(e, color, t) {
    const n = Math.max(1, Math.round(e.len));
    for (let i = 0; i < n; i++) {
      const tt = ((i + 0.5) / n) * e.len;
      const p = posOnEdge(e, tt);
      const dx = e.ux * e.ow, dy = e.uy * e.ow;
      const s = 0.09;
      this.glowLine([
        { x: p.x - dx * s - dy * s, y: p.y - dy * s + dx * s },
        { x: p.x + dx * s, y: p.y + dy * s },
        { x: p.x - dx * s + dy * s, y: p.y - dy * s - dx * s },
      ], color, Math.max(1.4, this.s(0.035)), 0, 0.9);
    }
  }

  ticks(e, color) {
    const n = Math.max(1, Math.round(e.len * 2));
    for (let i = 1; i < n; i++) {
      const p = posOnEdge(e, (i / n) * e.len);
      const px = -e.uy, py = e.ux;
      this.glowLine([
        { x: p.x - px * 0.06, y: p.y - py * 0.06 },
        { x: p.x + px * 0.06, y: p.y + py * 0.06 },
      ], color, Math.max(1, this.s(0.02)), 0, 0.8);
    }
  }

  brokenGlass(e, t) {
    const mid = posOnEdge(e, e.len / 2);
    for (const end of [{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }]) {
      const dx = (mid.x - end.x) * 0.22, dy = (mid.y - end.y) * 0.22;
      this.glowLine([end, { x: end.x + dx, y: end.y + dy }], 'rgba(185,230,255,0.3)', Math.max(1.2, this.s(0.03)), 0);
    }
  }

  fuseEdge(e, lw, t) {
    const a = e.burnA || 0, b = e.burnB || 0;
    const lo = a, hi = e.len - b;
    // burnt parts: ember stubs
    if (a > 0.02) this.glowLine([posOnEdge(e, 0), posOnEdge(e, Math.min(a, e.len))], 'rgba(120,60,30,0.5)', lw * 0.5, 0);
    if (b > 0.02) this.glowLine([posOnEdge(e, Math.max(0, e.len - b)), posOnEdge(e, e.len)], 'rgba(120,60,30,0.5)', lw * 0.5, 0);
    if (hi - lo > 0.03 && e.alive) {
      const p1 = posOnEdge(e, lo), p2 = posOnEdge(e, hi);
      this.dashedLine([p1, p2], 'rgba(255,154,77,0.9)', lw * 0.8, [3, 5]);
    }
  }

  currentDots(e, t) {
    const n = Math.max(1, Math.round(e.len * 2));
    for (let i = 0; i < n; i++) {
      const tt = ((i + ((t * 1.6) % 1)) / n) * e.len;
      if (tt > e.len) continue;
      const p = posOnEdge(e, tt);
      this.dot(p.x, p.y, 0.028, '#d8f6ff');
    }
  }

  switchArc(sw, t) {
    const n = sw.node;
    const dirOf = (e) => {
      const s = e.a === n ? 1 : -1;
      return { x: e.ux * s, y: e.uy * s };
    };
    const td = dirOf(sw.trunk);
    const bd = dirOf(sw.branches[sw.idx]);
    const r = 0.3;
    const steps = 7;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const x = td.x * (1 - f) + bd.x * f;
      const y = td.y * (1 - f) + bd.y * f;
      const L = Math.hypot(x, y) || 1;
      pts.push({ x: n.x + (x / L) * r, y: n.y + (y / L) * r });
    }
    const col = sw.turnstile ? '#e8d06a' : '#79c66d';
    this.glowLine(pts, col, Math.max(1.6, this.s(0.05)), this.s(0.16));
    // dim the inactive branches near the node
    for (let i = 0; i < sw.branches.length; i++) {
      if (i === sw.idx) continue;
      const d = dirOf(sw.branches[i]);
      this.glowLine([
        { x: n.x + d.x * 0.14, y: n.y + d.y * 0.14 },
        { x: n.x + d.x * 0.3, y: n.y + d.y * 0.3 },
      ], 'rgba(10,18,32,0.85)', Math.max(2, this.s(0.075)), 0);
    }
  }

  socketCup(x, y, color, hot) {
    this.ring(x, y, 0.12, color, 2.2);
    if (hot) this.dot(x, y, 0.05, '#d8f6ff', 0.6);
  }

  gateBars(g, lw, t) {
    const n = g.node;
    // orientation: perpendicular to the first walkable edge
    const e = n.edges.find((ed) => ed.kind !== 'wire') || n.edges[0];
    if (!e) return;
    const px = -e.uy, py = e.ux;
    const open = g.open;
    const off = open ? 0.34 : 0.12;
    const col = g.latch ? (g.latched ? 'rgba(255,215,94,0.8)' : '#ffd75e') : '#59d8ff';
    for (const s of [-1, 1]) {
      this.glowLine([
        { x: n.x + px * off * s - e.ux * 0.14, y: n.y + py * off * s - e.uy * 0.14 },
        { x: n.x + px * off * s + e.ux * 0.14, y: n.y + py * off * s + e.uy * 0.14 },
      ], col, Math.max(2, this.s(0.06)), open ? 0 : this.s(0.14));
    }
  }

  lengtherGlyph(L, t) {
    const filled = L.amount > 0.01;
    this.ring(L.x, L.y, 0.15, filled ? '#a5e2ff' : 'rgba(150,190,215,0.55)', 2.2);
    if (filled) {
      const bars = Math.min(5, Math.max(1, Math.round(L.amount)));
      for (let i = 0; i < bars; i++) {
        const yy = L.y + 0.07 - (i * 0.05);
        this.glowLine([{ x: L.x - 0.07, y: yy }, { x: L.x + 0.07, y: yy }], '#a5e2ff', Math.max(1.4, this.s(0.03)), 0);
      }
    }
  }

  ring(x, y, r, color, lwPx) {
    const { ctx } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = lwPx * this.dpr;
    ctx.beginPath();
    ctx.arc(this.sx(x), this.sy(y), this.s(r), 0, TAU);
    ctx.stroke();
  }

  arc(x, y, r, a0, a1, color, lwPx) {
    const { ctx } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = lwPx * this.dpr;
    ctx.beginPath();
    ctx.arc(this.sx(x), this.sy(y), this.s(r), a0, a1);
    ctx.stroke();
  }

  triangle(x, y, r, color, t) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(this.sx(x), this.sy(y));
    ctx.rotate(Math.sin(t * 0.8) * 0.15);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2 * this.dpr;
    ctx.beginPath();
    for (let i = 0; i <= 3; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 3;
      const px = Math.cos(a) * this.s(r), py = Math.sin(a) * this.s(r);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ---------------- particles ----------------

  burst(x, y, color, n = 14, speed = 2.2, life = 0.6, size = 0.05) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life, maxLife: life, size: size * (0.6 + Math.random() * 0.8), color,
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  drawParticles() {
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      this.ctx.globalAlpha = a;
      this.dot(p.x, p.y, p.size * (0.5 + a * 0.5), p.color);
      this.ctx.globalAlpha = 1;
    }
  }

  handleEvent(ev) {
    switch (ev.type) {
      case 'diamond': this.burst(ev.x, ev.y, '#ffd75e', 18, 2.6); break;
      case 'death': this.burst(ev.x, ev.y, '#ffffff', 26, 3.4, 0.8); this.shake = 0.6; break;
      case 'shatter': this.burst(ev.x, ev.y, '#b9e6ff', 12, 1.8); break;
      case 'burnt': this.burst(ev.x, ev.y, '#ff9a4d', 6, 1.2, 0.4, 0.035); break;
      case 'poof': this.burst(ev.x, ev.y, '#ff5a5a', 16, 2.4); break;
      case 'ignite': this.burst(ev.x, ev.y, '#ffab4d', 10, 1.6, 0.5); break;
      case 'melt': this.burst(ev.x, ev.y, '#e8d9b0', 12, 1.4); break;
      case 'trim': this.burst(ev.x, ev.y, '#ffab4d', 10, 2.0, 0.5); break;
      case 'merge': this.burst(ev.x, ev.y, '#ffffff', 16, 1.8); break;
      case 'prism': this.burst(ev.x, ev.y, '#c9a2ff', 16, 2.2); break;
      case 'echo-born': this.burst(ev.x, ev.y, '#dfe6ff', 12, 1.6); break;
      case 'unlock': case 'coverlock': this.burst(ev.x, ev.y, '#ffd75e', 10, 1.6); break;
      case 'length+': case 'length-': this.burst(ev.x, ev.y, '#a5e2ff', 10, 1.6); break;
      case 'complete': break;
      default: break;
    }
  }
}
