// Part of the StarsRemix hint runtime (classic script, no build step).
// Difficulty analysis: solver-style replay that rates a puzzle.
// Top-level functions here are global and shared across the hints/*.js
// files; load order is fixed in index.html and hints.test.ts. The
// technique registry and public StarsRemixHints export live in registry.js,
// which loads last.

async function analyzeDifficulty(puzzle, options = {}) {
  const onProgress = options.onProgress ?? (() => {});
  const yieldControl = options.yieldControl ?? (() => Promise.resolve());
  const maximumSteps = puzzle.size * puzzle.size * 2;
  let analysisBoard = Array.from(
    { length: puzzle.size },
    () => Array(puzzle.size).fill("empty"),
  );
  const steps = [];

  while (!boardIsSolved(puzzle, analysisBoard) && steps.length < maximumSteps) {
    const hint = await findHintForAnalysis(puzzle, analysisBoard, {
      onTechnique: (technique, techniqueIndex) => {
        onProgress(makeDifficultyProgress(
          puzzle,
          analysisBoard,
          steps.length,
          technique,
          techniqueIndex,
        ));
      },
      yieldControl,
    });
    const moves = (hint.moves ?? []).filter(
      (move) => analysisBoard[move.row][move.col] !== move.state,
    );
    if (moves.length === 0) break;

    const technique = getTechniqueDefinition(hint.kind);
    analysisBoard = applyHint(analysisBoard, { moves });
    steps.push({
      number: steps.length + 1,
      kind: hint.kind,
      title: technique.title,
      tier: technique.tier,
      weight: technique.weight,
      bigTicket: technique.bigTicket,
      message: hint.message,
      moves,
    });
    onProgress(makeDifficultyProgress(puzzle, analysisBoard, steps.length, technique, 0));
    await yieldControl();
  }

  const solved = boardIsSolved(puzzle, analysisBoard);
  const bigTicketCount = steps.filter(({ bigTicket }) => bigTicket).length;
  const score = steps.reduce((total, { weight }) => total + weight, 0);
  const techniqueCounts = techniqueDefinitions
    .map((technique) => ({
      kind: technique.kind,
      title: technique.title,
      tier: technique.tier,
      weight: technique.weight,
      bigTicket: technique.bigTicket,
      count: steps.filter((step) => step.kind === technique.kind).length,
    }))
    .filter(({ count }) => count > 0);

  return {
    solved,
    label: solved ? getDifficultyLabel(bigTicketCount, score) : "Incalculable",
    bigTicketCount,
    score,
    steps,
    techniqueCounts,
    starsPlaced: countBoardState(analysisBoard, "star"),
    totalStars: puzzle.size * puzzle.starsPerUnit,
  };
}

async function findHintForAnalysis(puzzle, board, { onTechnique, yieldControl }) {
  const context = { puzzle, board, units: getUnits(puzzle) };
  for (let index = 0; index < hintStrategies.length; index += 1) {
    const technique = hintStrategies[index];
    onTechnique(technique, index);
    if (technique.weight >= 2) await yieldControl();
    const hint = technique.strategy(context);
    if (hint) return hint;
  }
  return { kind: "none", message: "No technique applies.", cells: [] };
}

function makeDifficultyProgress(puzzle, board, stepsCompleted, technique, techniqueIndex) {
  const starsPlaced = countBoardState(board, "star");
  const totalStars = puzzle.size * puzzle.starsPerUnit;
  return {
    percent: Math.min(99, Math.round((starsPlaced / totalStars) * 100)),
    starsPlaced,
    totalStars,
    stepsCompleted,
    technique: technique.title,
    tier: technique.tier,
    strategyIndex: techniqueIndex,
    strategyCount: hintStrategies.length,
  };
}

function countBoardState(board, state) {
  return board.reduce(
    (total, row) => total + row.filter((cellState) => cellState === state).length,
    0,
  );
}

function boardIsSolved(puzzle, board) {
  const units = getUnits(puzzle);
  return !findRuleConflictHint({ puzzle, board, units }) && units.every((unit) =>
    unit.cells.filter(({ row, col }) => board[row][col] === "star").length === puzzle.starsPerUnit,
  );
}

function getDifficultyLabel(bigTicketCount, score) {
  if (bigTicketCount === 0 && score <= 2) return "Easy";
  if (bigTicketCount === 0) return "Moderate";
  if (bigTicketCount <= 2) return "Hard";
  if (bigTicketCount <= 4) return "Very Hard";
  return "Expert";
}

function cellKey({ row, col }) {
  return `${row}:${col}`;
}

// Publish to the shared global scope so the other hints/*.js files (and the
// Node test harness, which loads each file as a module) can resolve these by name.
Object.assign(globalThis, { analyzeDifficulty,findHintForAnalysis,makeDifficultyProgress,countBoardState,boardIsSolved,getDifficultyLabel,cellKey });
