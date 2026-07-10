import world1 from './world1.js';
import world2 from './world2.js';
import world3 from './world3.js';
import world4 from './world4.js';
import world5 from './world5.js';
import world6 from './world6.js';
import bonus from './bonus.js';

export const WORLDS = [world1, world2, world3, world4, world5, world6, bonus];

export function findLevel(id) {
  for (const w of WORLDS) {
    const lv = w.levels.find((l) => l.id === id);
    if (lv) return { world: w, level: lv };
  }
  return null;
}
