// Durable game-state boundary. UI-only state deliberately stays out of snapshots.
const savedBoardStorageKey = "stars-remix:last-board";

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
  } catch {
    // Storage may be unavailable; persistence failure must not stop play.
  }
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
