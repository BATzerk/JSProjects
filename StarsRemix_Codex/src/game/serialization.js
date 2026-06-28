(function (global) {
  const FORMAT = "stars-remix-board";
  const VERSION = 1;
  const CELL_STATES = new Set(["empty", "mark", "star"]);

  function serializeBoard({ puzzle, board, solution, difficultyReport }) {
    validatePuzzle(puzzle);
    validateBoard(board, puzzle.size);
    validateSolution(solution, puzzle.size);
    const saved = {
      format: FORMAT,
      version: VERSION,
      savedAt: new Date().toISOString(),
      puzzle: clone(puzzle),
      board: clone(board),
      solution: clone(solution),
      difficulty: difficultyReport
        ? { status: difficultyReport.solved ? "rated" : "incalculable", report: clone(difficultyReport) }
        : { status: "unrated" },
    };
    return JSON.stringify(saved, null, 2);
  }

  function deserializeBoard(text) {
    let saved;
    try {
      saved = JSON.parse(text);
    } catch {
      throw new Error("That file is not valid JSON.");
    }
    if (!saved || saved.format !== FORMAT || saved.version !== VERSION) {
      throw new Error("That is not a supported Stars Remix board file.");
    }
    validatePuzzle(saved.puzzle);
    validateBoard(saved.board, saved.puzzle.size);
    validateSolution(saved.solution, saved.puzzle.size);
    if (!saved.difficulty || !["unrated", "rated", "incalculable"].includes(saved.difficulty.status)) {
      throw new Error("The saved difficulty status is invalid.");
    }
    if (saved.difficulty.status !== "unrated" && !isDifficultyReport(saved.difficulty.report)) {
      throw new Error("The saved difficulty report is invalid.");
    }
    return {
      puzzle: clone(saved.puzzle),
      board: clone(saved.board),
      solution: clone(saved.solution),
      difficultyReport: saved.difficulty.status === "unrated" ? null : clone(saved.difficulty.report),
    };
  }

  function validatePuzzle(puzzle) {
    if (!puzzle || typeof puzzle.id !== "string" || typeof puzzle.title !== "string"
      || !Number.isInteger(puzzle.size) || puzzle.size <= 0
      || !Number.isInteger(puzzle.starsPerUnit) || puzzle.starsPerUnit <= 0
      || !Array.isArray(puzzle.houses) || puzzle.houses.length !== puzzle.size
      || puzzle.houses.some((row) => !Array.isArray(row) || row.length !== puzzle.size
        || row.some((house) => !Number.isInteger(house) || house < 0))) {
      throw new Error("The saved puzzle data is invalid.");
    }
  }

  function validateBoard(board, size) {
    if (!Array.isArray(board) || board.length !== size
      || board.some((row) => !Array.isArray(row) || row.length !== size
        || row.some((cell) => !CELL_STATES.has(cell)))) {
      throw new Error("The saved board state is invalid.");
    }
  }

  function validateSolution(solution, size) {
    if (!Array.isArray(solution) || solution.some((cell) => !cell
      || !Number.isInteger(cell.row) || !Number.isInteger(cell.col)
      || cell.row < 0 || cell.col < 0 || cell.row >= size || cell.col >= size)) {
      throw new Error("The saved solution is invalid.");
    }
  }

  function isDifficultyReport(report) {
    return Boolean(report && typeof report.solved === "boolean" && typeof report.label === "string"
      && Number.isFinite(report.score) && Array.isArray(report.steps)
      && Array.isArray(report.techniqueCounts));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  global.StarsRemixSerialization = { serializeBoard, deserializeBoard };
})(globalThis);
