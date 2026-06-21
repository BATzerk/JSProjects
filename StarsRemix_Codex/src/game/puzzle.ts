import type { Position, Puzzle } from "./types.ts";

export function getHouseIds(puzzle: Puzzle): number[] {
  return [...new Set(puzzle.houses.flat())].sort((a, b) => a - b);
}

export function validatePuzzleShape(puzzle: Puzzle): void {
  if (!Number.isInteger(puzzle.size) || puzzle.size <= 0) {
    throw new Error("Puzzle size must be a positive integer.");
  }
  if (!Number.isInteger(puzzle.starsPerUnit) || puzzle.starsPerUnit <= 0) {
    throw new Error("Stars per unit must be a positive integer.");
  }
  if (puzzle.houses.length !== puzzle.size) {
    throw new Error("Puzzle must include one house row per board row.");
  }

  puzzle.houses.forEach((row, index) => {
    if (row.length !== puzzle.size) {
      throw new Error(`House row ${index} must have ${puzzle.size} cells.`);
    }
    if (row.some((house) => !Number.isInteger(house) || house < 0)) {
      throw new Error(`House row ${index} contains an invalid house ID.`);
    }
  });

  const houseIds = getHouseIds(puzzle);
  if (houseIds.length !== puzzle.size) {
    throw new Error(`Puzzle must contain exactly ${puzzle.size} houses; found ${houseIds.length}.`);
  }
  houseIds.forEach((house, index) => {
    if (house !== index) {
      throw new Error("House IDs must be contiguous and start at 0.");
    }
    if (!isHouseConnected(puzzle, house)) {
      throw new Error(`House ${house} is not connected.`);
    }
  });
}

export function isHouseConnected(puzzle: Puzzle, house: number): boolean {
  const cells: Position[] = [];
  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      if (puzzle.houses[row][col] === house) cells.push({ row, col });
    }
  }
  if (cells.length === 0) return false;

  const seen = new Set([`${cells[0].row}:${cells[0].col}`]);
  const queue = [cells[0]];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const next of orthogonalNeighbors(current, puzzle.size)) {
      const key = `${next.row}:${next.col}`;
      if (puzzle.houses[next.row][next.col] === house && !seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  return seen.size === cells.length;
}

export function orthogonalNeighbors(position: Position, size: number): Position[] {
  return [
    { row: position.row - 1, col: position.col },
    { row: position.row + 1, col: position.col },
    { row: position.row, col: position.col - 1 },
    { row: position.row, col: position.col + 1 },
  ].filter(({ row, col }) => row >= 0 && col >= 0 && row < size && col < size);
}
