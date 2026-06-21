import type { BoardState, CellState } from "./types.ts";

export { validatePuzzleShape } from "./puzzle.ts";

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
