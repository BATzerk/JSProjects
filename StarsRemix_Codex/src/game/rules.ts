import type {
  BoardState,
  Conflict,
  Position,
  Puzzle,
  UnitStatus,
  Validation,
} from "./types.ts";

export function validateBoard(puzzle: Puzzle, board: BoardState): Validation {
  const unitStatuses = [
    ...getRowStatuses(puzzle, board),
    ...getColumnStatuses(puzzle, board),
    ...getHouseStatuses(puzzle, board),
  ];
  const conflicts = [
    ...getOverfilledConflicts(puzzle, board, unitStatuses),
    ...getAdjacencyConflicts(board),
  ];

  const allUnitsComplete = unitStatuses.every((status) => status.complete);

  return {
    solved: allUnitsComplete && conflicts.length === 0,
    conflicts,
    unitStatuses,
  };
}

export function getStarKey(position: Position): string {
  return `${position.row}:${position.col}`;
}

function getRowStatuses(puzzle: Puzzle, board: BoardState): UnitStatus[] {
  return board.map((row, index) =>
    makeStatus("row", index, row.filter((cell) => cell === "star").length, puzzle.starsPerUnit),
  );
}

function getColumnStatuses(puzzle: Puzzle, board: BoardState): UnitStatus[] {
  return Array.from({ length: puzzle.size }, (_, col) => {
    let count = 0;
    for (let row = 0; row < puzzle.size; row += 1) {
      if (board[row][col] === "star") count += 1;
    }
    return makeStatus("column", col, count, puzzle.starsPerUnit);
  });
}

function getHouseStatuses(puzzle: Puzzle, board: BoardState): UnitStatus[] {
  const counts = new Map<number, number>();

  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      if (board[row][col] === "star") {
        const house = puzzle.houses[row][col];
        counts.set(house, (counts.get(house) ?? 0) + 1);
      }
    }
  }

  return getHouseIds(puzzle).map((house) =>
    makeStatus("house", house, counts.get(house) ?? 0, puzzle.starsPerUnit),
  );
}

function makeStatus(
  kind: UnitStatus["kind"],
  index: number,
  count: number,
  required: number,
): UnitStatus {
  return {
    kind,
    index,
    count,
    required,
    complete: count === required,
    overfilled: count > required,
  };
}

function getOverfilledConflicts(
  puzzle: Puzzle,
  board: BoardState,
  statuses: UnitStatus[],
): Conflict[] {
  return statuses
    .filter((status) => status.overfilled)
    .map((status) => ({
      cells: getUnitStarPositions(puzzle, board, status.kind, status.index),
      reason: `${labelUnit(status.kind, status.index)} has ${status.count} stars.`,
    }));
}

function getAdjacencyConflicts(board: BoardState): Conflict[] {
  const conflicts: Conflict[] = [];
  const size = board.length;

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (board[row][col] !== "star") continue;

      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
          if (rowOffset === 0 && colOffset === 0) continue;
          const otherRow = row + rowOffset;
          const otherCol = col + colOffset;

          if (otherRow < row || (otherRow === row && otherCol <= col)) continue;
          if (otherRow < 0 || otherCol < 0 || otherRow >= size || otherCol >= size) continue;

          if (board[otherRow][otherCol] === "star") {
            conflicts.push({
              cells: [
                { row, col },
                { row: otherRow, col: otherCol },
              ],
              reason: "Stars cannot touch, even diagonally.",
            });
          }
        }
      }
    }
  }

  return conflicts;
}

function getUnitStarPositions(
  puzzle: Puzzle,
  board: BoardState,
  kind: UnitStatus["kind"],
  index: number,
): Position[] {
  const cells: Position[] = [];

  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      if (board[row][col] !== "star") continue;
      if (kind === "row" && row === index) cells.push({ row, col });
      if (kind === "column" && col === index) cells.push({ row, col });
      if (kind === "house" && puzzle.houses[row][col] === index) cells.push({ row, col });
    }
  }

  return cells;
}

function getHouseIds(puzzle: Puzzle): number[] {
  return [...new Set(puzzle.houses.flat())].sort((a, b) => a - b);
}

function labelUnit(kind: UnitStatus["kind"], index: number): string {
  if (kind === "row") return `Row ${index + 1}`;
  if (kind === "column") return `Column ${index + 1}`;
  return `House ${index + 1}`;
}
