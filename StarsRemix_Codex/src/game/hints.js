function findHint(puzzle, board) {
  const context = {
    puzzle,
    board,
    units: getUnits(puzzle),
  };

  for (const strategy of hintStrategies) {
    const hint = strategy(context);
    if (hint) return hint;
  }

  return {
    kind: "none",
    message: "No hint from the current set applies yet. More hint strategies are coming soon.",
    cells: [],
  };
}

function applyHint(board, hint) {
  return (hint.moves ?? []).reduce((nextBoard, move) =>
    nextBoard.map((row, rowIndex) => row.map((state, colIndex) =>
      rowIndex === move.row && colIndex === move.col ? move.state : state,
    )), board);
}

const hintStrategies = [
  findRuleConflictHint,
  findSurroundStarHint,
  findCompleteUnitHint,
  findForcedStarHint,
  findImpossibleStarHint,
];

function findRuleConflictHint({ puzzle, board, units }) {
  const stars = collectCells(puzzle.size, ({ row, col }) => board[row][col] === "star");
  for (let index = 0; index < stars.length; index += 1) {
    const touchingStar = stars.slice(index + 1).find((star) => cellsTouch(stars[index], star));
    if (touchingStar) {
      return {
        kind: "rule-conflict",
        message: "Stars cannot touch, even diagonally. One of the red stars must be removed.",
        cells: [stars[index], touchingStar].map((cell) => ({ ...cell, color: "red" })),
      };
    }
  }

  for (const unit of units) {
    const unitStars = unit.cells.filter(({ row, col }) => board[row][col] === "star");
    if (unitStars.length > puzzle.starsPerUnit) {
      return {
        kind: "rule-conflict",
        message: `${unit.label} can only contain ${puzzle.starsPerUnit} stars. Remove one of the red stars.`,
        cells: unitStars.map((cell) => ({ ...cell, color: "red" })),
      };
    }
  }
  return null;
}

function findSurroundStarHint({ puzzle, board }) {
  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      if (board[row][col] !== "star") continue;
      const openNeighbors = surroundingCells({ row, col }, puzzle.size)
        .filter((cell) => board[cell.row][cell.col] === "empty");
      if (openNeighbors.length > 0) {
        return {
          kind: "surround-star",
          message: "All stars must be surrounded by Xs. Add Xs in the gray spaces around the gold star.",
        cells: [
          { row, col, color: "gold" },
          ...openNeighbors.map((cell) => ({ ...cell, color: "blue" })),
        ],
        moves: openNeighbors.map((cell) => ({ ...cell, state: "mark" })),
      };
      }
    }
  }
  return null;
}

function findCompleteUnitHint({ puzzle, board, units }) {
  for (const unit of units) {
    const stars = unit.cells.filter(({ row, col }) => board[row][col] === "star");
    const openCells = unit.cells.filter(({ row, col }) => board[row][col] === "empty");
    if (stars.length === puzzle.starsPerUnit && openCells.length > 0) {
      return {
        kind: "complete-unit",
        message: `${unit.label} already has ${puzzle.starsPerUnit} stars. Fill the remaining gray spaces with Xs.`,
        cells: [
          ...stars.map((cell) => ({ ...cell, color: "gold" })),
          ...openCells.map((cell) => ({ ...cell, color: "blue" })),
        ],
        moves: openCells.map((cell) => ({ ...cell, state: "mark" })),
      };
    }
  }
  return null;
}

function findForcedStarHint({ puzzle, board, units }) {
  for (const unit of units) {
    const stars = unit.cells.filter(({ row, col }) => board[row][col] === "star");
    const openCells = unit.cells.filter(({ row, col }) => board[row][col] === "empty");
    const starsNeeded = puzzle.starsPerUnit - stars.length;
    if (starsNeeded > 0 && openCells.length === starsNeeded) {
      const forcedCell = openCells[0];
      return {
        kind: "forced-star",
        message: `${unit.label} needs ${starsNeeded === 1 ? "one more star" : `${starsNeeded} more stars`}, and every other space is marked with an X. Add a star in the gold space.`,
        cells: [{ ...forcedCell, color: "gold" }],
        moves: [{ ...forcedCell, state: "star" }],
      };
    }
  }
  return null;
}

function findImpossibleStarHint({ puzzle, board, units }) {
  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      if (board[row][col] !== "empty") continue;
      const candidate = { row, col };
      const assumedBoard = setAssumedStar(board, candidate);
      const blockedUnit = units.find((unit) => !unitCanFitRequiredStars(
        unit,
        assumedBoard,
        puzzle.starsPerUnit,
        puzzle.size,
      ));
      if (!blockedUnit) continue;
      const possiblePlacements = getUnitStarPlacements(
        blockedUnit,
        board,
        puzzle.starsPerUnit,
        puzzle.size,
      );
      const grayCells = uniqueCells(possiblePlacements.flat())
        .filter((cell) => !sameCell(cell, candidate) && cellsTouch(candidate, cell))
        .sort((left, right) => left.row - right.row || left.col - right.col);

      return {
        kind: "impossible-star",
        message: `At least one star must go somewhere in the marked spaces for ${blockedUnit.label}. A star in the gray space would block all of them, so mark the gray space with an X.`,
        cells: [
          { ...candidate, color: "blue" },
          ...grayCells.map((cell) => ({ ...cell, color: "gray" })),
        ],
        moves: [{ ...candidate, state: "mark" }],
      };
    }
  }
  return null;
}

function setAssumedStar(board, position) {
  return board.map((row, rowIndex) => row.map((state, colIndex) =>
    rowIndex === position.row && colIndex === position.col ? "star" : state,
  ));
}

function unitCanFitRequiredStars(unit, board, required, size) {
  return getUnitStarPlacements(unit, board, required, size, 1).length > 0;
}

function getUnitStarPlacements(unit, board, required, size, limit = Number.POSITIVE_INFINITY) {
  const placedStars = unit.cells.filter(({ row, col }) => board[row][col] === "star");
  if (placedStars.length > required || hasTouchingPair(placedStars)) return [];

  const starsNeeded = required - placedStars.length;
  if (starsNeeded === 0) return [[]];

  const candidates = unit.cells.filter(({ row, col }) =>
    board[row][col] === "empty" &&
    surroundingCells({ row, col }, size).every((cell) => board[cell.row][cell.col] !== "star"),
  );
  return collectNonTouchingStarPlacements(candidates, starsNeeded, limit);
}

function collectNonTouchingStarPlacements(candidates, needed, limit) {
  const placements = [];
  const chosen = [];

  function search(start) {
    if (placements.length >= limit) return;
    if (chosen.length === needed) {
      placements.push([...chosen]);
      return;
    }
    if (candidates.length - start < needed - chosen.length) return;

    for (let index = start; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      if (chosen.some((star) => cellsTouch(star, candidate))) continue;
      chosen.push(candidate);
      search(index + 1);
      chosen.pop();
    }
  }

  search(0);
  return placements;
}

function hasTouchingPair(cells) {
  return cells.some((cell, index) =>
    cells.slice(index + 1).some((other) => cellsTouch(cell, other)),
  );
}

function cellsTouch(left, right) {
  return Math.abs(left.row - right.row) <= 1 && Math.abs(left.col - right.col) <= 1;
}

function sameCell(left, right) {
  return left.row === right.row && left.col === right.col;
}

function uniqueCells(cells) {
  const seen = new Set();
  return cells.filter((cell) => {
    const key = cellKey(cell);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getUnits(puzzle) {
  const rows = Array.from({ length: puzzle.size }, (_, row) => ({
    label: `Row ${row + 1}`,
    cells: Array.from({ length: puzzle.size }, (_, col) => ({ row, col })),
  }));
  const columns = Array.from({ length: puzzle.size }, (_, col) => ({
    label: `Column ${col + 1}`,
    cells: Array.from({ length: puzzle.size }, (_, row) => ({ row, col })),
  }));
  const houses = [...new Set(puzzle.houses.flat())]
    .sort((left, right) => left - right)
    .map((house) => ({
      label: `House ${house + 1}`,
      cells: collectCells(puzzle.size, ({ row, col }) => puzzle.houses[row][col] === house),
    }));
  return [...rows, ...columns, ...houses];
}

function surroundingCells(position, size) {
  const cells = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const row = position.row + rowOffset;
      const col = position.col + colOffset;
      if (row >= 0 && col >= 0 && row < size && col < size) cells.push({ row, col });
    }
  }
  return cells;
}

function collectCells(size, predicate) {
  const cells = [];
  forEachCell(size, (cell) => {
    if (predicate(cell)) cells.push(cell);
  });
  return cells;
}

function forEachCell(size, callback) {
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) callback({ row, col });
  }
}

function cellKey({ row, col }) {
  return `${row}:${col}`;
}

globalThis.StarsRemixHints = { findHint, applyHint };
