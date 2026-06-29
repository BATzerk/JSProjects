// Part of the StarsRemix hint runtime (classic script, no build step).
// Public hint API: findHint, applyHint, and the soft-hint lifecycle.
// Top-level functions here are global and shared across the hints/*.js
// files; load order is fixed in index.html and hints.test.ts. The
// technique registry and public StarsRemixHints export live in registry.js,
// which loads last.

function findHint(puzzle, board) {
  const context = {
    puzzle,
    board,
    units: getUnits(puzzle),
  };

  for (const technique of hintStrategies) {
    const hint = technique.strategy(context);
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

function findSoftHint(puzzle, board, solution) {
  const mistake = findBoardMistake(puzzle, board, solution);
  if (mistake) return mistake;

  const units = getUnits(puzzle);
  const hasConflict = Boolean(findRuleConflictHint({ puzzle, board, units }));
  const isSolved = !hasConflict && units.every((unit) =>
    unit.cells.filter(({ row, col }) => board[row][col] === "star").length === puzzle.starsPerUnit,
  );
  if (isSolved) {
    return createSoftHint({
      kind: "solved",
      message: "The puzzle is solved — no hint needed!",
      cells: [],
    });
  }
  return createSoftHint(findHint(puzzle, board));
}

function findSoftHintByKind(puzzle, board, techniqueKind, solution) {
  if (techniqueKind === "board-error") return findBoardMistake(puzzle, board, solution);

  const technique = techniqueDefinitions.find(({ kind }) => kind === techniqueKind);
  const strategy = techniqueKind === "triple-unit-capacity"
    ? findMultiUnitCapacityHint
    : technique?.strategy;
  if (!strategy) return null;

  const hint = strategy({ puzzle, board, units: getUnits(puzzle) });
  return hint?.kind === techniqueKind ? createSoftHint(hint) : null;
}

function findBoardMistake(puzzle, board, solution) {
  if (!Array.isArray(solution) || solution.length === 0) return null;
  const solutionKeys = new Set(solution.map(cellKey));

  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      const state = board[row][col];
      const shouldBeStar = solutionKeys.has(cellKey({ row, col }));
      if ((state === "star" && shouldBeStar) || (state === "mark" && !shouldBeStar) || state === "empty") {
        continue;
      }

      const message = state === "star"
        ? "The highlighted star cannot be here. Remove it or replace it with an X."
        : "The highlighted X covers a space that must contain a star. Clear it or place a star.";
      return {
        kind: "board-error",
        title: "Board Error",
        stages: [
          { message: "There is an error somewhere on the board.", cells: [] },
          { message: `The error is somewhere in Row ${row + 1}.`, cells: [] },
          { message, cells: [{ row, col, color: "red" }] },
        ],
      };
    }
  }
  return null;
}

function checkBoardForErrors(puzzle, board, solution) {
  return Boolean(findBoardMistake(puzzle, board, solution));
}

function isSoftHintTechniqueSatisfied(puzzle, previousBoard, nextBoard, solution, techniqueKind) {
  if (findBoardMistake(puzzle, nextBoard, solution)) return false;

  if (techniqueKind === "board-error") {
    return !findBoardMistake(puzzle, nextBoard, solution);
  }

  const changedCells = collectCells(puzzle.size, ({ row, col }) =>
    previousBoard[row][col] !== nextBoard[row][col],
  );
  if (changedCells.length !== 1) return false;

  const changedCell = changedCells[0];
  const intendedMove = {
    ...changedCell,
    state: nextBoard[changedCell.row][changedCell.col],
  };
  const technique = techniqueDefinitions.find(({ kind }) => kind === techniqueKind);
  const strategy = techniqueKind === "triple-unit-capacity"
    ? findMultiUnitCapacityHint
    : technique?.strategy;
  if (!strategy) return false;

  let techniqueBoard = previousBoard.map((row) => [...row]);
  if (
    previousBoard[changedCell.row][changedCell.col] === "mark"
    && intendedMove.state === "star"
  ) {
    techniqueBoard[changedCell.row][changedCell.col] = "empty";
  }
  for (let step = 0; step < puzzle.size * puzzle.size; step += 1) {
    const hint = strategy({
      puzzle,
      board: techniqueBoard,
      units: getUnits(puzzle),
    });
    if (!hint?.moves?.length) return false;
    if (hint.kind === techniqueKind && hint.moves.some((move) =>
      move.row === intendedMove.row
      && move.col === intendedMove.col
      && move.state === intendedMove.state,
    )) {
      return true;
    }
    techniqueBoard = applyHint(techniqueBoard, hint);
  }
  return false;
}

function createSoftHint(hint) {
  const technique = getTechniqueDefinition(hint.kind);
  const focusCells = (hint.cells ?? [])
    .filter((cell) => cell.color !== "blue" || hint.kind === "rule-conflict")
    .map(({ previewState, ...cell }) => cell);
  const unitLabels = [...new Set(
    (hint.message.match(/\b(?:Row|Column|House) \d+\b/g) ?? []),
  )];
  const locationMessage = unitLabels.length > 0
    ? `Look closely at ${joinLabels(unitLabels)}.`
    : hint.kind === "surround-star"
      ? "Look around the highlighted star."
      : "Look closely at the highlighted part of the board.";

  return {
    kind: hint.kind,
    title: technique.title,
    stages: [
      { message: technique.nudge, cells: [] },
      { message: locationMessage, cells: [] },
      { message: locationMessage, cells: focusCells },
      {
        message: hint.message,
        cells: hint.cells ?? [],
        assumption: hint.assumption,
      },
    ],
  };
}

function joinLabels(labels) {
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

function getTechniqueDefinition(kind) {
  if (kind === "solved") {
    return { kind, title: "All Done", tier: "Basic", weight: 0, bigTicket: false, nudge: "The puzzle is solved — no hint needed!" };
  }
  if (kind === "none") {
    return { kind, title: "No Technique Found", tier: "Unknown", weight: 0, bigTicket: false, nudge: "No soft hint from the current set applies yet." };
  }
  return techniqueDefinitions.find((technique) => technique.kind === kind) ?? {
    kind,
    title: "Next Step",
    tier: "Unknown",
    weight: 0,
    bigTicket: false,
    nudge: "There is a logical next step available.",
  };
}

// Publish to the shared global scope so the other hints/*.js files (and the
// Node test harness, which loads each file as a module) can resolve these by name.
Object.assign(globalThis, { findHint,applyHint,findSoftHint,findSoftHintByKind,findBoardMistake,checkBoardForErrors,isSoftHintTechniqueSatisfied,createSoftHint,joinLabels,getTechniqueDefinition });
