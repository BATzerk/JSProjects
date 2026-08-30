await import("../src/game/common-ground-engine.js");
const engine = globalThis.CommonGroundEngine;

function makeRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function touchesUsed(key, used, size) {
  if (used.has(key)) return true;
  const cell = engine.parseCellKey(key);
  return engine.orthogonalNeighbors(cell.row, cell.col, size)
    .some((neighbor) => used.has(engine.cellKey(neighbor.row, neighbor.col)));
}

function growRegion(size, target, used, random) {
  const available = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const key = engine.cellKey(row, col);
      if (!touchesUsed(key, used, size)) available.push(key);
    }
  }
  if (!available.length) return null;

  const cells = new Set([available[Math.floor(random() * available.length)]]);
  while (cells.size < target) {
    const frontier = new Set();
    for (const key of cells) {
      const cell = engine.parseCellKey(key);
      for (const neighbor of engine.orthogonalNeighbors(cell.row, cell.col, size)) {
        const neighborKey = engine.cellKey(neighbor.row, neighbor.col);
        if (!cells.has(neighborKey) && !touchesUsed(neighborKey, used, size)) {
          frontier.add(neighborKey);
        }
      }
    }
    if (!frontier.size) return null;
    const choices = [...frontier];
    cells.add(choices[Math.floor(random() * choices.length)]);
  }
  return cells;
}

function makeCandidate(spec, random) {
  const used = new Set();
  const regions = [];
  for (let regionIndex = 0; regionIndex < spec.regions; regionIndex += 1) {
    const region = growRegion(spec.size, spec.target, used, random);
    if (!region) return null;
    region.forEach((key) => used.add(key));
    regions.push(region);
  }
  if (!engine.isComplementConnected(spec.size, used)) return null;

  const seeds = regions.map((region) => {
    const choices = [...region];
    return engine.parseCellKey(choices[Math.floor(random() * choices.length)]);
  });
  return { seeds, regions, fieldKeys: [...used].sort() };
}

const specs = [
  { size: 5, target: 2, regions: 5, title: "First Steps", difficulty: "Easy" },
  { size: 6, target: 3, regions: 5, title: "Around the Bend", difficulty: "Easy" },
  { size: 7, target: 3, regions: 7, title: "Stepping Stones", difficulty: "Medium" },
  { size: 7, target: 4, regions: 5, title: "Open Channel", difficulty: "Medium" },
  { size: 8, target: 4, regions: 7, title: "The Long Way", difficulty: "Hard" },
  { size: 8, target: 5, regions: 6, title: "Narrow Passage", difficulty: "Hard" },
  { size: 9, target: 5, regions: 8, title: "Common Thread", difficulty: "Expert" },
];

const random = makeRandom(0xC011EC7);
const puzzles = [];
for (const spec of specs) {
  let accepted = null;
  for (let attempt = 1; attempt <= 25000 && !accepted; attempt += 1) {
    const candidate = makeCandidate(spec, random);
    if (!candidate) continue;
    const puzzle = {
      id: `common-${spec.target}-${spec.size}-${puzzles.length + 1}`,
      title: spec.title,
      difficulty: spec.difficulty,
      size: spec.size,
      target: spec.target,
      seeds: candidate.seeds,
    };
    const solutions = engine.solvePuzzle(puzzle, 2);
    if (
      solutions.length === 1 &&
      solutions[0].fieldKeys.join("|") === candidate.fieldKeys.join("|")
    ) {
      accepted = { ...puzzle, solution: candidate.fieldKeys };
      console.error(`Accepted ${spec.title} after ${attempt} attempts.`);
    }
  }
  if (!accepted) throw new Error(`Could not find a unique puzzle for ${spec.title}.`);
  puzzles.push(accepted);
}

console.log(JSON.stringify(puzzles, null, 2));
