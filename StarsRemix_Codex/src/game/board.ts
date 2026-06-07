import type { BoardState, CellState, Puzzle } from "./types.ts";

export function createEmptyBoard(size: number): BoardState {
  return Array.from({ length: size }, () =>
    Array.from<CellState>({ length: size }).fill("empty"),
  );
}

export function cycleCellState(state: CellState): CellState {
  if (state === "empty") return "mark";
  if (state === "mark") return "star";
  return "empty";
}

export function setCell(
  board: BoardState,
  row: number,
  col: number,
  state: CellState,
): BoardState {
  return board.map((cells, currentRow) =>
    cells.map((cell, currentCol) =>
      currentRow === row && currentCol === col ? state : cell,
    ),
  );
}

export function validatePuzzleShape(puzzle: Puzzle): void {
  if (puzzle.size <= 0) {
    throw new Error("Puzzle size must be positive.");
  }

  if (puzzle.houses.length !== puzzle.size) {
    throw new Error("Puzzle must include one house row per board row.");
  }

  puzzle.houses.forEach((row, index) => {
    if (row.length !== puzzle.size) {
      throw new Error(`House row ${index} must have ${puzzle.size} cells.`);
    }
  });
}
