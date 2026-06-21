function findHint(puzzle, board, solution) {
  const solutionKeys = new Set(solution.map(cellKey));
  const incorrectCells = [];

  forEachCell(puzzle.size, ({ row, col }) => {
    const state = board[row][col];
    const shouldBeStar = solutionKeys.has(cellKey({ row, col }));
    if ((state === "star" && !shouldBeStar) || (state === "mark" && shouldBeStar)) {
      incorrectCells.push({ row, col, color: "red" });
    }
  });

  if (incorrectCells.length > 0) {
    return {
      kind: "incorrect",
      message: incorrectCells.length === 1
        ? "This space is marked incorrectly."
        : "These spaces are marked incorrectly.",
      cells: incorrectCells,
    };
  }

  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      if (board[row][col] !== "star") continue;
      const openNeighbors = surroundingCells({ row, col }, puzzle.size)
        .filter((cell) => board[cell.row][cell.col] === "empty");
      if (openNeighbors.length > 0) {
        return {
          kind: "surround-star",
          message: "All stars must be surrounded by Xs. Add Xs in the blue spaces around the gold star.",
          cells: [
            { row, col, color: "gold" },
            ...openNeighbors.map((cell) => ({ ...cell, color: "blue" })),
          ],
        };
      }
    }
  }

  for (const unit of getUnits(puzzle)) {
    const stars = unit.cells.filter(({ row, col }) => board[row][col] === "star");
    const openCells = unit.cells.filter(({ row, col }) => board[row][col] === "empty");
    if (stars.length === puzzle.starsPerUnit && openCells.length > 0) {
      return {
        kind: "complete-unit",
        message: `${unit.label} already has ${puzzle.starsPerUnit} stars. Fill the remaining blue spaces with Xs.`,
        cells: [
          ...stars.map((cell) => ({ ...cell, color: "gold" })),
          ...openCells.map((cell) => ({ ...cell, color: "blue" })),
        ],
      };
    }
  }

  return {
    kind: "none",
    message: "No hint from the current set applies yet. More hint strategies are coming soon.",
    cells: [],
  };
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

globalThis.StarsRemixHints = { findHint };
