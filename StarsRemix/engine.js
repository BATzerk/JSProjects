// engine.js — pure game logic, no DOM dependencies

// ─── Grid helpers ─────────────────────────────────────────────────────────────

// All 8 neighbours (for star adjacency checking).
function getAdjacentIndices(idx, N) {
  const r = Math.floor(idx / N), c = idx % N;
  const out = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < N && nc >= 0 && nc < N)
        out.push(nr * N + nc);
    }
  return out;
}

// 4-connected neighbours only (for region flood-fill).
function get4AdjacentIndices(idx, N) {
  const r = Math.floor(idx / N), c = idx % N;
  const out = [];
  if (r > 0)     out.push((r - 1) * N + c);
  if (r < N - 1) out.push((r + 1) * N + c);
  if (c > 0)     out.push(r * N + c - 1);
  if (c < N - 1) out.push(r * N + c + 1);
  return out;
}

// ─── Validation ───────────────────────────────────────────────────────────────

// Returns the Set of star-cell indices that violate any rule.
function getErrorCells(cellState, regions, N, K) {
  const numRegions = Math.max(...regions) + 1;
  const errors = new Set();
  const rowStars = Array.from({ length: N }, () => []);
  const colStars = Array.from({ length: N }, () => []);
  const regStars = Array.from({ length: numRegions }, () => []);

  for (let i = 0; i < N * N; i++) {
    if (cellState[i] !== 1) continue;
    rowStars[Math.floor(i / N)].push(i);
    colStars[i % N].push(i);
    regStars[regions[i]].push(i);
  }

  for (const group of [...rowStars, ...colStars, ...regStars])
    if (group.length > K) group.forEach(i => errors.add(i));

  for (let i = 0; i < N * N; i++) {
    if (cellState[i] !== 1) continue;
    for (const j of getAdjacentIndices(i, N))
      if (cellState[j] === 1) { errors.add(i); errors.add(j); }
  }

  return errors;
}

// Returns true only when every row, column, and region has exactly K stars with
// no adjacency violations.
function checkWin(cellState, regions, N, K) {
  if (cellState.filter(s => s === 1).length !== N * K) return false;
  if (getErrorCells(cellState, regions, N, K).size > 0) return false;
  const numRegions = Math.max(...regions) + 1;
  const rowCount = new Array(N).fill(0);
  const colCount = new Array(N).fill(0);
  const regCount = new Array(numRegions).fill(0);
  for (let i = 0; i < N * N; i++) {
    if (cellState[i] !== 1) continue;
    rowCount[Math.floor(i / N)]++;
    colCount[i % N]++;
    regCount[regions[i]]++;
  }
  return rowCount.every(v => v === K) && colCount.every(v => v === K) && regCount.every(v => v === K);
}

// ─── Solver ───────────────────────────────────────────────────────────────────

// Returns the first solution grid (array of 0/1, length N*N), or null.
function solvePuzzle(regions, N, K) {
  return _runSolver(regions, N, K, 1)[0] ?? null;
}

// Returns how many solutions exist, up to `limit` (default 2 — enough for a
// uniqueness check without exhaustive search).
function countSolutions(regions, N, K, limit = 2) {
  return _runSolver(regions, N, K, limit).length;
}

function _runSolver(regions, N, K, limit) {
  const numRegions = Math.max(...regions) + 1;
  const grid = new Array(N * N).fill(0);
  const rowCount = new Array(N).fill(0);
  const colCount = new Array(N).fill(0);
  const regCount = new Array(numRegions).fill(0);
  const solutions = [];

  function canPlace(idx) {
    const r = Math.floor(idx / N), c = idx % N;
    if (rowCount[r] >= K || colCount[c] >= K || regCount[regions[idx]] >= K) return false;
    for (const n of getAdjacentIndices(idx, N)) if (grid[n] === 1) return false;
    return true;
  }

  function solve(idx) {
    if (solutions.length >= limit) return;
    if (idx === N * N) {
      if (rowCount.every(v => v === K) && colCount.every(v => v === K) && regCount.every(v => v === K))
        solutions.push(grid.slice());
      return;
    }
    // branch: skip this cell
    solve(idx + 1);
    // branch: place star here
    if (canPlace(idx)) {
      const r = Math.floor(idx / N), c = idx % N;
      grid[idx] = 1; rowCount[r]++; colCount[c]++; regCount[regions[idx]]++;
      solve(idx + 1);
      grid[idx] = 0; rowCount[r]--; colCount[c]--; regCount[regions[idx]]--;
    }
  }

  solve(0);
  return solutions;
}

// ─── Star placement ───────────────────────────────────────────────────────────

// Generates a random valid star placement (K per row AND column, no adjacency).
// Returns an array of star cell-indices (length N*K), or null on failure.
function generateStarPlacement(N, K, rng = Math.random) {
  const grid = new Array(N * N).fill(0);
  const colCount = new Array(N).fill(0);

  function canPlace(idx) {
    if (colCount[idx % N] >= K) return false;
    for (const n of getAdjacentIndices(idx, N)) if (grid[n] === 1) return false;
    return true;
  }

  function pickCols(row, cols, colIdx, placed) {
    if (placed === K) return solveRow(row + 1);
    const remaining = cols.length - colIdx;
    if (remaining < K - placed) return false;
    const idx = row * N + cols[colIdx];
    if (canPlace(idx)) {
      grid[idx] = 1; colCount[cols[colIdx]]++;
      if (pickCols(row, cols, colIdx + 1, placed + 1)) return true;
      grid[idx] = 0; colCount[cols[colIdx]]--;
    }
    return pickCols(row, cols, colIdx + 1, placed);
  }

  function solveRow(row) {
    if (row === N) return colCount.every(v => v === K);
    return pickCols(row, shuffle(Array.from({ length: N }, (_, i) => i), rng), 0, 0);
  }

  for (let attempt = 0; attempt < 50; attempt++) {
    grid.fill(0); colCount.fill(0);
    if (solveRow(0)) return grid.reduce((a, v, i) => { if (v) a.push(i); return a; }, []);
  }
  return null;
}

// ─── Region growth ────────────────────────────────────────────────────────────

// Grows N connected regions to cover all cells, seeded from `starGroups`
// (array of K-length arrays of star indices, one per region).
// Uses randomised Voronoi flood-fill over 4-connectivity.
function growRegions(starGroups, N, rng = Math.random) {
  const regions = new Array(N * N).fill(-1);
  const frontier = [];

  function claim(idx, regionId) {
    if (regions[idx] !== -1) return;
    regions[idx] = regionId;
    for (const n of get4AdjacentIndices(idx, N))
      if (regions[n] === -1) frontier.push({ idx: n, regionId });
  }

  for (let r = 0; r < starGroups.length; r++)
    for (const idx of starGroups[r]) claim(idx, r);

  shuffle(frontier, rng);

  while (frontier.length > 0) {
    const i = Math.floor(rng() * frontier.length);
    const { idx, regionId } = frontier[i];
    frontier.splice(i, 1);
    if (regions[idx] !== -1) continue;
    claim(idx, regionId);
  }

  return regions;
}

// ─── Puzzle generation ────────────────────────────────────────────────────────

// Generates a puzzle with a unique solution.
// Options:
//   maxAttempts  — how many (star placement + region growth) tries before giving up
//   rng          — seeded or default Math.random
// Returns { regions, solution } or null on failure.
function generatePuzzle(N, K, { maxAttempts = 200, rng = Math.random } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const starIndices = generateStarPlacement(N, K, rng);
    if (!starIndices) continue;

    const groups = _partitionRandom(starIndices, K, rng);
    const regions = growRegions(groups, N, rng);
    if (regions.includes(-1)) continue;

    if (countSolutions(regions, N, K, 2) === 1) {
      const solution = solvePuzzle(regions, N, K);
      return { regions, solution };
    }
  }
  return null;
}

// ─── Difficulty estimation ────────────────────────────────────────────────────

// Rough proxy: average region compactness (area / bounding-box area).
// Returns a value in [0, 1] where 0 = compact/easy, 1 = elongated/hard.
function estimateDifficulty(regions, N) {
  const numRegions = Math.max(...regions) + 1;
  const cells = Array.from({ length: numRegions }, () => []);
  for (let i = 0; i < N * N; i++) cells[regions[i]].push(i);

  const compactness = cells.map(group => {
    const rows = group.map(i => Math.floor(i / N));
    const cols = group.map(i => i % N);
    const bbox =
      (Math.max(...rows) - Math.min(...rows) + 1) *
      (Math.max(...cols) - Math.min(...cols) + 1);
    return group.length / bbox;
  });

  const avg = compactness.reduce((a, b) => a + b, 0) / compactness.length;
  return 1 - avg; // 0 = easy (fat blobs), 1 = hard (snaky)
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Split arr into chunks of size K in random order.
function _partitionRandom(arr, K, rng) {
  const shuffled = shuffle([...arr], rng);
  const groups = [];
  for (let i = 0; i < shuffled.length; i += K)
    groups.push(shuffled.slice(i, i + K));
  return groups;
}

// ─── Environment exports ──────────────────────────────────────────────────────
// Node / CommonJS (Jest, Vitest in CJS mode, plain require())
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getAdjacentIndices, get4AdjacentIndices,
    getErrorCells, checkWin,
    solvePuzzle, countSolutions,
    generateStarPlacement, growRegions, generatePuzzle,
    estimateDifficulty, shuffle,
  };
}
