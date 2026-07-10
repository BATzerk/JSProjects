// Headless solution verifier. Every level carries a scripted solution proving
// it is completable exactly as designed. Run: node tests/run.mjs [levelId...]
//
// Step forms:
//   ['RU', units]      hold keys (chars pressed in order; LAST is highest
//                      priority at junctions; 's' = spacebar) for the time it
//                      takes to travel `units` at full speed
//   ['wait', seconds]  idle
//   ['until', fn, timeoutSec?]  idle until fn(sim) is true (fail on timeout)
//   ['untilHold', 'RU', fn, timeoutSec?]  hold keys until fn(sim) is true

import { Sim, DT } from '../src/core/sim.js';
import { WORLDS } from '../src/levels/index.js';

const PLAYER_SPEED = 3.4;

function inputFrom(str) {
  const dirs = [];
  let space = false;
  for (const ch of str) {
    if (ch === 's') space = true;
    else if ('RLUD'.includes(ch)) dirs.unshift(ch); // last pressed = first tried
  }
  return { dirs, space };
}

export function runSolution(def, { trace = false } = {}) {
  const sim = new Sim(def);
  const idle = { dirs: [], space: false };
  let stepIdx = 0;
  for (const step of def.solution) {
    stepIdx++;
    const fail = (why) => ({ ok: false, why: `step ${stepIdx} ${JSON.stringify(String(step[0]))}: ${why}`, sim });
    if (step[0] === 'wait') {
      const frames = Math.round(step[1] / DT);
      for (let i = 0; i < frames; i++) {
        sim.step(idle);
        if (sim.dead) return fail(`died (${sim.deathCause})`);
        if (sim.complete) return { ok: true, sim };
      }
    } else if (step[0] === 'until' || step[0] === 'untilHold') {
      const hold = step[0] === 'untilHold' ? inputFrom(step[1]) : idle;
      const fn = step[0] === 'untilHold' ? step[2] : step[1];
      const timeout = (step[0] === 'untilHold' ? step[3] : step[2]) ?? 12;
      let t = 0, done = false;
      while (t < timeout) {
        if (fn(sim)) { done = true; break; }
        sim.step(hold);
        t += DT;
        if (sim.dead) return fail(`died (${sim.deathCause})`);
        if (sim.complete) return { ok: true, sim };
      }
      if (!done && !fn(sim)) return fail(`timed out after ${timeout}s`);
    } else {
      const input = inputFrom(step[0]);
      const frames = Math.round((step[1] / PLAYER_SPEED) / DT);
      for (let i = 0; i < frames; i++) {
        sim.step(input);
        if (sim.dead) return fail(`died (${sim.deathCause}) at t=${sim.time.toFixed(2)} pos=(${fmt(sim)})`);
        if (sim.complete) return { ok: true, sim };
      }
    }
    if (trace) console.log(`  after step ${stepIdx}: pos=(${fmt(sim)}) t=${sim.time.toFixed(2)}`);
  }
  if (sim.complete) return { ok: true, sim };
  const left = sim.level.diamonds.filter((g) => !g.taken).length;
  return { ok: false, why: `script ended incomplete: ${left} diamond(s) left, pos=(${fmt(sim)})`, sim };
}

function fmt(sim) {
  return sim.dashes.map((d) => `${d.x?.toFixed(2)},${d.y?.toFixed(2)}`).join(' & ');
}

const filter = process.argv.slice(2);
const trace = process.env.TRACE === '1';
let pass = 0, failCount = 0, skip = 0;
for (const world of WORLDS) {
  for (const def of world.levels) {
    if (filter.length && !filter.includes(def.id)) continue;
    if (!def.solution) {
      console.log(`SKIP  ${def.id} ${def.name} (no solution script)`);
      skip++;
      continue;
    }
    let res;
    try {
      res = runSolution(def, { trace });
    } catch (err) {
      res = { ok: false, why: `threw: ${err.message}` };
    }
    if (res.ok) {
      console.log(`pass  ${def.id} ${def.name}  (${res.sim.time.toFixed(1)}s)`);
      pass++;
    } else {
      console.log(`FAIL  ${def.id} ${def.name}: ${res.why}`);
      failCount++;
    }
  }
}
console.log(`\n${pass} passed, ${failCount} failed, ${skip} skipped`);
process.exit(failCount ? 1 : 0);
