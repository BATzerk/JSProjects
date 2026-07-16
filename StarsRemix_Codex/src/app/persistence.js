// Durable game-state boundary. UI-only state deliberately stays out of snapshots.
const savedBoardStorageKey = "stars-remix:last-board";
const libraryProgressStorageKey = "stars-remix:library-progress-v1";

function createCurrentSnapshot() {
  return globalThis.StarsRemixSnapshots.create({
    puzzle: gameState.puzzle,
    board: gameState.progress.board,
    solution: gameState.solution,
    difficultyLabel: gameState.analysis.difficultyReport?.label ?? "Unrated",
  });
}

function applySnapshot(snapshot) {
  globalThis.StarsRemixSnapshots.validate(snapshot);
  validatePuzzleShape(snapshot.puzzle);
  gameState = globalThis.StarsRemixState.replaceGame(gameState, {
    puzzle: snapshot.puzzle,
    board: snapshot.progress.board,
    solution: snapshot.solution,
  });
  selectedBoardSize = gameState.puzzle.size;
  resetGameSessionState();
}

function resetGameSessionState() {
  undoStack = [];
  redoStack = [];
  currentHint = null;
  currentSoftHint = null;
  currentCheck = null;
  solutionRevealVisible = false;
}

function encodeCurrentSnapshot() {
  return globalThis.StarsRemixSerialization.serializeSnapshot(createCurrentSnapshot());
}

function decodeAndApplySnapshot(contents) {
  const snapshot = globalThis.StarsRemixSerialization.deserializeSnapshot(contents);
  applySnapshot(snapshot);
  return snapshot;
}

function saveBoardToDevice() {
  try {
    window.localStorage.setItem(savedBoardStorageKey, encodeCurrentSnapshot());
    const libraryBoard = getLibraryBoard(gameState.puzzle.id);
    if (libraryBoard) {
      const progress = readLibraryProgress();
      progress.boards[gameState.puzzle.id] = {
        board: gameState.progress.board,
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(libraryProgressStorageKey, JSON.stringify(progress));
    }
  } catch {
    // Storage may be unavailable; persistence failure must not stop play.
  }
}

function getLibraryBoard(puzzleId) {
  return boardLibrary.boards.find(({ puzzle }) => puzzle.id === puzzleId) ?? null;
}

function readLibraryProgress() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(libraryProgressStorageKey) ?? "null");
    if (parsed?.version === 1 && parsed.boards && typeof parsed.boards === "object") return parsed;
  } catch {
    // A damaged progress index should not block the board library.
  }
  return { version: 1, boards: {} };
}

function getLibraryBoardStatus(entry, progress = readLibraryProgress()) {
  const saved = progress.boards[entry.puzzle.id]?.board;
  if (!isLibraryProgressBoard(saved, entry.puzzle.size)) {
    return { kind: "new", label: "New", filled: 0 };
  }
  try {
    const validation = validateBoard(entry.puzzle, saved);
    const filled = saved.flat().filter((state) => state !== "empty").length;
    if (validation.solved) return { kind: "completed", label: "Completed", filled };
    if (filled > 0) return { kind: "progress", label: "In progress", filled };
  } catch {
    // Treat incompatible saved progress as a fresh board.
  }
  return { kind: "new", label: "New", filled: 0 };
}

function isLibraryProgressBoard(board, size) {
  const states = globalThis.StarsRemixSnapshots.CELL_STATES;
  return Array.isArray(board) && board.length === size && board.every((row) =>
    Array.isArray(row) && row.length === size && row.every((state) => states.includes(state)),
  );
}

function makeLibraryDifficultyReport(entry) {
  return {
    solved: true,
    label: entry.difficulty.label,
    bigTicketCount: entry.difficulty.bigTicketCount,
    score: entry.difficulty.score,
    steps: [],
    techniqueCounts: [],
    starsPlaced: entry.puzzle.size * entry.puzzle.starsPerUnit,
    totalStars: entry.puzzle.size * entry.puzzle.starsPerUnit,
    logicalSteps: entry.difficulty.logicalSteps,
    catalogRating: true,
  };
}

function loadLibraryBoard(puzzleId) {
  const entry = getLibraryBoard(puzzleId);
  if (!entry) return false;
  const progress = readLibraryProgress();
  const savedBoard = progress.boards[puzzleId]?.board;
  const board = isLibraryProgressBoard(savedBoard, entry.puzzle.size)
    ? savedBoard
    : createEmptyBoard(entry.puzzle.size);
  gameState = globalThis.StarsRemixState.replaceGame(gameState, {
    puzzle: entry.puzzle,
    solution: entry.solution,
    board,
  });
  gameState = globalThis.StarsRemixState.setDifficultyReport(
    gameState,
    makeLibraryDifficultyReport(entry),
  );
  selectedBoardSize = entry.puzzle.size;
  boardLibraryOpen = false;
  fileMenuOpen = false;
  resetGameSessionState();
  saveBoardToDevice();
  render();
  return true;
}

function restoreBoardFromDevice() {
  try {
    const contents = window.localStorage.getItem(savedBoardStorageKey);
    if (!contents) return false;
    decodeAndApplySnapshot(contents);
    return true;
  } catch {
    try { window.localStorage.removeItem(savedBoardStorageKey); }
    catch { /* Access to local storage itself may be blocked. */ }
    return false;
  }
}
