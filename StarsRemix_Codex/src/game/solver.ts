import { validatePuzzleShape } from "./puzzle.ts";
import type { Position, Puzzle } from "./types.ts";

export type SolveOptions = {
  limit?: number;
};

export type SolveResult = {
  count: number;
  solutions: Position[][];
  truncated: boolean;
};

export function solvePuzzle(puzzle: Puzzle, options: SolveOptions = {}): SolveResult {
  validatePuzzleShape(puzzle);
  const limit = Math.max(1, options.limit ?? Number.POSITIVE_INFINITY);
  const patterns = createRowPatterns(puzzle.size, puzzle.starsPerUnit);
  const columnCounts = Array<number>(puzzle.size).fill(0);
  const houseCounts = Array<number>(puzzle.size).fill(0);
  const chosen: number[][] = [];
  const solutions: Position[][] = [];
  let truncated = false;

  function search(row: number): void {
    if (solutions.length >= limit) {
      truncated = true;
      return;
    }
    if (row === puzzle.size) {
      if (columnCounts.every((count) => count === puzzle.starsPerUnit) &&
          houseCounts.every((count) => count === puzzle.starsPerUnit)) {
        solutions.push(chosen.flatMap((cols, solutionRow) =>
          cols.map((col) => ({ row: solutionRow, col })),
        ));
      }
      return;
    }

    const rowsRemaining = puzzle.size - row - 1;
    for (const pattern of patterns) {
      if (!canFollow(chosen[row - 1], pattern)) continue;
      if (pattern.some((col) => columnCounts[col] >= puzzle.starsPerUnit)) continue;

      const houses = pattern.map((col) => puzzle.houses[row][col]);
      const additions = new Map<number, number>();
      houses.forEach((house) => additions.set(house, (additions.get(house) ?? 0) + 1));
      if ([...additions].some(([house, count]) => houseCounts[house] + count > puzzle.starsPerUnit)) {
        continue;
      }

      pattern.forEach((col) => columnCounts[col] += 1);
      additions.forEach((count, house) => houseCounts[house] += count);
      const columnsPossible = columnCounts.every((count) =>
        count <= puzzle.starsPerUnit && count + rowsRemaining >= puzzle.starsPerUnit,
      );
      const housesPossible = houseCounts.every((count) => count <= puzzle.starsPerUnit);

      if (columnsPossible && housesPossible) {
        chosen.push(pattern);
        search(row + 1);
        chosen.pop();
      }
      pattern.forEach((col) => columnCounts[col] -= 1);
      additions.forEach((count, house) => houseCounts[house] -= count);
      if (solutions.length >= limit) {
        truncated = true;
        return;
      }
    }
  }

  search(0);
  return { count: solutions.length, solutions, truncated };
}

export function countSolutions(puzzle: Puzzle, limit = 2): number {
  return solvePuzzle(puzzle, { limit }).count;
}

export function createRowPatterns(size: number, starsPerRow: number): number[][] {
  const patterns: number[][] = [];
  function build(start: number, chosen: number[]): void {
    if (chosen.length === starsPerRow) {
      patterns.push([...chosen]);
      return;
    }
    const needed = starsPerRow - chosen.length;
    for (let col = start; col <= size - (needed * 2 - 1); col += 1) {
      chosen.push(col);
      build(col + 2, chosen);
      chosen.pop();
    }
  }
  build(0, []);
  return patterns;
}

export function canFollow(previous: number[] | undefined, current: number[]): boolean {
  if (!previous) return true;
  return current.every((col) => previous.every((other) => Math.abs(col - other) > 1));
}
