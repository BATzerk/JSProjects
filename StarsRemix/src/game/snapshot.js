(function (global) {
  const CELL_STATES = ["empty", "mark", "star"];
  const DIFFICULTIES = ["Unrated", "Easy", "Moderate", "Hard", "Very Hard", "Expert", "Incalculable"];

  function create({ puzzle, board, solution, difficultyLabel = "Unrated" }) {
    const snapshot = {
      puzzle: clone(puzzle),
      progress: { board: clone(board) },
      solution: clone(solution),
      difficulty: { label: difficultyLabel },
    };
    validate(snapshot);
    return snapshot;
  }

  function validate(snapshot) {
    if (!snapshot || typeof snapshot !== "object") throw new Error("The saved game data is invalid.");
    validatePuzzle(snapshot.puzzle);
    validateBoard(snapshot.progress?.board, snapshot.puzzle.size);
    validateSolution(snapshot.solution, snapshot.puzzle.size, snapshot.puzzle.starsPerUnit);
    if (!snapshot.difficulty || !DIFFICULTIES.includes(snapshot.difficulty.label)) {
      throw new Error("The saved difficulty is invalid.");
    }
    return snapshot;
  }

  function validatePuzzle(puzzle) {
    if (!puzzle || typeof puzzle.id !== "string" || typeof puzzle.title !== "string"
      || puzzle.id.length > 1024 || puzzle.title.length > 1024
      || !Number.isInteger(puzzle.size) || puzzle.size <= 0 || puzzle.size > 32
      || !Number.isInteger(puzzle.starsPerUnit) || puzzle.starsPerUnit <= 0 || puzzle.starsPerUnit > puzzle.size
      || !Array.isArray(puzzle.houses) || puzzle.houses.length !== puzzle.size
      || puzzle.houses.some((row) => !Array.isArray(row) || row.length !== puzzle.size
        || row.some((house) => !Number.isInteger(house) || house < 0 || house >= puzzle.size))) {
      throw new Error("The saved puzzle data is invalid.");
    }
    const houseIds = new Set(puzzle.houses.flat());
    if (houseIds.size !== puzzle.size
      || Array.from({ length: puzzle.size }, (_, index) => index).some((index) => !houseIds.has(index))) {
      throw new Error("The saved puzzle houses are invalid.");
    }
  }

  function validateBoard(board, size) {
    if (!Array.isArray(board) || board.length !== size
      || board.some((row) => !Array.isArray(row) || row.length !== size
        || row.some((cell) => !CELL_STATES.includes(cell)))) {
      throw new Error("The saved board state is invalid.");
    }
  }

  function validateSolution(solution, size, starsPerUnit) {
    if (!Array.isArray(solution) || solution.length !== size * starsPerUnit
      || solution.some((cell) => !cell
        || !Number.isInteger(cell.row) || !Number.isInteger(cell.col)
        || cell.row < 0 || cell.col < 0 || cell.row >= size || cell.col >= size)) {
      throw new Error("The saved solution is invalid.");
    }
    const positions = new Set(solution.map(({ row, col }) => `${row}:${col}`));
    if (positions.size !== solution.length) throw new Error("The saved solution contains duplicate stars.");
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  global.StarsRemixSnapshots = {
    CELL_STATES,
    DIFFICULTIES,
    create,
    validate,
  };
})(globalThis);
