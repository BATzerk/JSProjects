// Shell: title -> world line -> level line -> play. The menus are themselves
// lines, because in this game everything worth doing happens on a line.

import { Sim, DT } from '../core/sim.js';
import { WORLDS, findLevel } from '../levels/index.js';
import { Renderer } from '../render/renderer.js';
import { AudioEngine } from './audio.js';

const canvas = document.getElementById('game');
const R = new Renderer(canvas);
const AU = new AudioEngine();
addEventListener('resize', () => R.resize());

// ---------------- save ----------------
const SAVE_KEY = 'linelight2-save';
let save = { done: {} };
try { save = JSON.parse(localStorage.getItem(SAVE_KEY)) || save; } catch { /* fresh */ }
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ } };

// ---------------- input ----------------
const DIR_KEYS = {
  ArrowRight: 'R', ArrowLeft: 'L', ArrowUp: 'U', ArrowDown: 'D',
  d: 'R', a: 'L', w: 'U', s: 'D', D: 'R', A: 'L', W: 'U', S: 'D',
};
let heldDirs = []; // most recent first
let space = false;
let started = false;

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  AU.ensure();
  const dir = DIR_KEYS[e.key];
  if (dir) {
    heldDirs = [dir, ...heldDirs.filter((d) => d !== dir)];
    e.preventDefault();
  }
  if (e.key === ' ') { space = true; e.preventDefault(); }
  handleKey(e.key);
});
addEventListener('keyup', (e) => {
  const dir = DIR_KEYS[e.key];
  if (dir) heldDirs = heldDirs.filter((d) => d !== dir);
  if (e.key === ' ') space = false;
});

// ---------------- state machine ----------------
let state = 'title'; // title | worlds | levels | play
let worldIdx = 0;
let levelIdx = 0;
let sim = null;
let simTint = '#0d1b2e';
let deathTimer = 0;
let completeTimer = 0;
let menuPos = 0;       // animated dash position along menu lines
let fade = 1;          // screen fade (1 = black)
let levelNameTimer = 0;

function currentWorld() { return WORLDS[worldIdx]; }
function currentLevelDef() { return currentWorld().levels[levelIdx]; }

function startLevel() {
  const def = currentLevelDef();
  sim = new Sim(def);
  simTint = tintFor(currentWorld().tint);
  deathTimer = 0;
  completeTimer = 0;
  levelNameTimer = 2.2;
  AU.setWorld(currentWorld().id);
  fitToLevel();
  state = 'play';
  fade = 1;
}

function tintFor(hex) {
  // world accent, dimmed way down for the sky
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgb(${Math.round(10 + r * 0.07)},${Math.round(18 + g * 0.07)},${Math.round(30 + b * 0.09)})`;
}

function fitToLevel() {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (x, y) => {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  };
  for (const n of sim.level.nodes) take(n.x, n.y);
  for (const sc of sim.scales) {
    for (const side of [sc.a, sc.b]) {
      take(side.def.x0, side.def.ys[0]); take(side.def.x1, side.def.ys[1]);
    }
  }
  for (const t of sim.level.texts) take(t.x, t.y);
  R.fitCamera({ x0, y0, x1, y1 });
}

function completeLevel() {
  save.done[currentLevelDef().id] = true;
  persist();
  AU.event('complete');
  completeTimer = 1.3;
}

function nextLevel() {
  if (levelIdx + 1 < currentWorld().levels.length) {
    levelIdx++;
    startLevel();
  } else {
    state = 'worlds';
    menuPos = worldIdx;
    fade = 1;
  }
}

function handleKey(key) {
  if (state === 'title') {
    if (key === 'm' || key === 'M') { AU.setMuted(!AU.muted); return; }
    started = true;
    state = 'worlds';
    fade = 1;
    AU.event('select');
    return;
  }
  if (key === 'm' || key === 'M') { AU.setMuted(!AU.muted); return; }

  if (state === 'worlds') {
    if (key === 'ArrowRight' || key === 'd') worldIdx = Math.min(WORLDS.length - 1, worldIdx + 1), AU.event('menu');
    if (key === 'ArrowLeft' || key === 'a') worldIdx = Math.max(0, worldIdx - 1), AU.event('menu');
    if (key === 'Enter' || key === ' ') {
      levelIdx = 0;
      state = 'levels';
      menuPos = 0;
      AU.event('select');
    }
    if (key === 'Escape') state = 'title';
  } else if (state === 'levels') {
    const n = currentWorld().levels.length;
    if (key === 'ArrowRight' || key === 'd') levelIdx = Math.min(n - 1, levelIdx + 1), AU.event('menu');
    if (key === 'ArrowLeft' || key === 'a') levelIdx = Math.max(0, levelIdx - 1), AU.event('menu');
    if (key === 'Enter' || key === ' ') { AU.event('select'); startLevel(); }
    if (key === 'Escape') { state = 'worlds'; menuPos = worldIdx; }
  } else if (state === 'play') {
    if (key === 'r' || key === 'R') startLevel();
    if (key === 'Escape') { state = 'levels'; menuPos = levelIdx; sim = null; }
  }
}

// dev: jump straight to a level with ?level=3-2
const jump = new URLSearchParams(location.search).get('level');
if (jump) {
  const found = findLevel(jump);
  if (found) {
    worldIdx = WORLDS.indexOf(found.world);
    levelIdx = found.world.levels.indexOf(found.level);
    startLevel();
  }
}

// ---------------- loop ----------------
let last = performance.now();
let acc = 0;
let t = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;
  t += dtReal;
  fade = Math.max(0, fade - dtReal * 2.2);
  AU.tick(t);

  if (state === 'play' && sim) {
    if (!sim.dead && !sim.complete) {
      acc += dtReal;
      while (acc >= DT) {
        sim.step({ dirs: heldDirs, space });
        acc -= DT;
        for (const ev of sim.events) { R.handleEvent(ev); AU.event(ev.type); }
        if (sim.events.some((e) => e.type === 'complete')) completeLevel();
        if (sim.dead) { deathTimer = 0.9; AU.event('death'); }
        sim.events.length = 0;
      }
    } else if (sim.dead) {
      deathTimer -= dtReal;
      if (deathTimer <= 0) startLevel();
    } else if (sim.complete) {
      completeTimer -= dtReal;
      if (completeTimer <= 0) nextLevel();
    }
    levelNameTimer -= dtReal;
    R.updateParticles(dtReal);
    R.drawSim(sim, t, simTint);
    drawHud();
  } else if (state === 'title') {
    drawTitle();
  } else if (state === 'worlds') {
    drawWorlds();
  } else if (state === 'levels') {
    drawLevels();
  }

  if (fade > 0) {
    R.ctx.fillStyle = `rgba(6,10,18,${fade})`;
    R.ctx.fillRect(0, 0, R.W, R.H);
  }
}
requestAnimationFrame(frame);

// ---------------- screens ----------------

function uiText(xFrac, yFrac, str, sizePx, color, align = 'center', letterSpacing = 0) {
  const ctx = R.ctx;
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${sizePx * R.dpr}px system-ui, sans-serif`;
  if (letterSpacing) ctx.letterSpacing = `${letterSpacing * R.dpr}px`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, xFrac * R.W, yFrac * R.H);
  ctx.restore();
}

function drawTitle() {
  R.cam = { scale: 60 * R.dpr, cx: 0, cy: 0 };
  R.background(t, '#0d1b2e');
  // a wandering line behind the wordmark
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const x = -7 + (14 * i) / 60;
    pts.push({ x, y: 0.9 + Math.sin(x * 0.9 + t * 0.6) * 0.35 });
  }
  R.glowLine(pts, 'rgba(168,190,214,0.5)', Math.max(1.6, R.s(0.045)), R.s(0.24));
  const dashX = -7 + ((t * 0.9) % 14);
  R.dot(dashX, 0.9 + Math.sin(dashX * 0.9 + t * 0.6) * 0.35, 0.07, '#ffffff', 0.8);

  uiText(0.5, 0.36, 'L I N E L I G H T', 64, 'rgba(240,246,255,0.96)', 'center', 6);
  uiText(0.5, 0.46, 'I I', 40, '#ffd75e', 'center', 10);
  uiText(0.5, 0.62, started ? '' : 'press any key', 16, `rgba(190,205,228,${0.4 + 0.3 * Math.sin(t * 2.4)})`);
  uiText(0.5, 0.94, 'arrows / wasd move · space pulls & confirms · R restarts · M mute', 12, 'rgba(150,165,190,0.5)');
}

function drawWorlds() {
  R.cam = { scale: 60 * R.dpr, cx: 0, cy: 0 };
  R.background(t, '#0d1b2e');
  menuPos += (worldIdx - menuPos) * 0.18;
  const n = WORLDS.length;
  const span = Math.min(12, n * 1.9);
  const xAt = (i) => -span / 2 + (span * i) / (n - 1);
  R.glowLine([{ x: xAt(0) - 0.8, y: 0 }, { x: xAt(n - 1) + 0.8, y: 0 }], 'rgba(168,190,214,0.6)', Math.max(1.6, R.s(0.045)), R.s(0.24));
  for (let i = 0; i < n; i++) {
    const w = WORLDS[i];
    const doneCount = w.levels.filter((l) => save.done[l.id]).length;
    const all = doneCount === w.levels.length;
    R.diamond(xAt(i), 0, i === worldIdx ? 0.16 : 0.11, all ? '#ffd75e' : w.tint, Math.PI / 4, all);
    const cx = R.sx(xAt(i)) / R.W;
    uiText(cx, 0.5 + 0.075, w.bonus ? '★' : String(w.id), 14, 'rgba(190,205,228,0.7)');
  }
  {
    const w = WORLDS[worldIdx];
    const doneCount = w.levels.filter((l) => save.done[l.id]).length;
    uiText(0.5, 0.5 - 0.16, w.name, 28, 'rgba(240,246,255,0.95)');
    uiText(0.5, 0.5 - 0.105, `${doneCount} / ${w.levels.length}`, 13, 'rgba(190,205,228,0.6)');
  }
  R.dot(menuPos === worldIdx ? xAt(worldIdx) : xAt(0) + (xAt(n - 1) - xAt(0)) * (menuPos / (n - 1)), 0, 0.07, '#ffffff', 0.8);
  uiText(0.5, 0.9, 'enter to board · esc back', 13, 'rgba(150,165,190,0.5)');
}

function drawLevels() {
  const w = currentWorld();
  R.cam = { scale: 60 * R.dpr, cx: 0, cy: 0 };
  R.background(t, tintFor(w.tint));
  menuPos += (levelIdx - menuPos) * 0.18;
  const n = w.levels.length;
  const span = Math.min(12, Math.max(4, n * 1.6));
  const xAt = (i) => -span / 2 + (span * i) / Math.max(1, n - 1);
  R.glowLine([{ x: xAt(0) - 0.8, y: 0 }, { x: xAt(n - 1) + 0.8, y: 0 }], 'rgba(168,190,214,0.6)', Math.max(1.6, R.s(0.045)), R.s(0.24));
  for (let i = 0; i < n; i++) {
    const lv = w.levels[i];
    const done = !!save.done[lv.id];
    R.diamond(xAt(i), 0, i === levelIdx ? 0.15 : 0.1, done ? '#ffd75e' : 'rgba(200,215,235,0.8)', Math.PI / 4, done);
  }
  R.dot(xAt(0) + (xAt(Math.max(1, n - 1)) - xAt(0)) * (menuPos / Math.max(1, n - 1)), 0, 0.07, '#ffffff', 0.8);
  uiText(0.5, 0.5 - 0.14, w.name, 26, 'rgba(240,246,255,0.95)');
  const lv = w.levels[levelIdx];
  uiText(0.5, 0.5 + 0.1, `${lv.id} · ${lv.name}`, 17, 'rgba(220,232,250,0.85)');
  uiText(0.5, 0.9, 'enter to play · esc back', 13, 'rgba(150,165,190,0.5)');
}

function drawHud() {
  const lv = currentLevelDef();
  uiText(0.015, 0.03, `${lv.id}  ${lv.name}`, 14, 'rgba(190,205,228,0.55)', 'left');
  uiText(0.985, 0.97, 'R restart · esc map', 12, 'rgba(150,165,190,0.4)', 'right');
  if (levelNameTimer > 0 && levelNameTimer < 2.2) {
    const a = Math.min(1, levelNameTimer, (2.2 - levelNameTimer) * 2);
    uiText(0.5, 0.12, lv.name, 26, `rgba(240,246,255,${0.9 * a})`);
  }
  if (sim && sim.complete) {
    const a = Math.min(1, (1.3 - completeTimer) * 3);
    uiText(0.5, 0.5, '◆', 44, `rgba(255,215,94,${a})`);
  }
}
