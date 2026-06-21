import { canFollow, createRowPatterns } from "../solver.ts";
import type { Position } from "../types.ts";
import { shuffle } from "./random.ts";
import type { RandomSource } from "./types.ts";

export function generateSolution(
  size: number,
  starsPerUnit: number,
  random: RandomSource,
): Position[] | null {
  const patterns = createRowPatterns(size, starsPerUnit);
  const columnCounts = Array<number>(size).fill(0);
  const chosen: number[][] = [];

  function search(row: number): boolean {
    if (row === size) return columnCounts.every((count) => count === starsPerUnit);
    const rowsRemaining = size - row - 1;

    for (const pattern of shuffle(patterns, random)) {
      if (!canFollow(chosen[row - 1], pattern)) continue;
      if (pattern.some((col) => columnCounts[col] >= starsPerUnit)) continue;

      pattern.forEach((col) => columnCounts[col] += 1);
      const possible = columnCounts.every((count) =>
        count <= starsPerUnit && count + rowsRemaining >= starsPerUnit,
      );
      if (possible) {
        chosen.push(pattern);
        if (search(row + 1)) return true;
        chosen.pop();
      }
      pattern.forEach((col) => columnCounts[col] -= 1);
    }
    return false;
  }

  if (!search(0)) return null;
  return chosen.flatMap((columns, row) => columns.map((col) => ({ row, col })));
}
