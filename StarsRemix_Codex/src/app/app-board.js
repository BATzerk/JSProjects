// Part of the StarsRemix browser app (classic script, no build step).
// Board mutation and move history (apply/replace, undo/redo, soft-hint lifecycle).
// These app/*.js files were one IIFE; they now share top-level state and
// functions through the global (lexical) scope of classic scripts. Load
// order is fixed in index.html; app-actions.js runs the boot call last.

function applyBoard(nextBoard) {
  if (boardsMatch(board, nextBoard)) return;
  const previousBoard = board;
  enteringTokenKeys = getEnteringTokenKeys(previousBoard, nextBoard);
  const wasShowingSuccess = Boolean(currentSoftHint?.isSatisfied);
  if (!wasShowingSuccess) clearSoftHintSuccessTimers();
  undoStack = [...undoStack, board];
  redoStack = [];
  board = nextBoard;
  currentHint = null;
  currentCheck = null;
  currentSoftHint = updateSoftHintAfterMove(currentSoftHint, previousBoard, board);
  render();
  if (currentSoftHint?.isSatisfied && !wasShowingSuccess) scheduleSoftHintSuccessExit();
}

function updateSoftHintAfterMove(activeSoftHint, previousBoard, nextBoard) {
  if (!activeSoftHint) return null;
  if (activeSoftHint.isSatisfied) return activeSoftHint;

  const matchingHint = globalThis.StarsRemixHints.findSoftHintByKind(
    puzzle,
    nextBoard,
    activeSoftHint.hint.kind,
    solution,
  );

  const moveSatisfied = globalThis.StarsRemixHints.isSoftHintTechniqueSatisfied(
    puzzle,
    previousBoard,
    nextBoard,
    solution,
    activeSoftHint.hint.kind,
  );
  if (moveSatisfied) {
    return { ...activeSoftHint, isSatisfied: true };
  }
  if (!matchingHint) return null;

  return {
    hint: matchingHint,
    stage: Math.min(activeSoftHint.stage, matchingHint.stages.length - 1),
  };
}

function clearSoftHintSuccessTimers() {
  window.clearTimeout(softHintSuccessTimer);
  window.clearTimeout(softHintRemovalTimer);
  softHintSuccessTimer = null;
  softHintRemovalTimer = null;
}

function scheduleSoftHintSuccessExit() {
  softHintSuccessTimer = window.setTimeout(() => {
    const card = root.querySelector(".soft-hint-card.is-satisfied");
    if (!card || !currentSoftHint?.isSatisfied) return;
    card.classList.add("is-leaving");
    softHintRemovalTimer = window.setTimeout(() => {
      if (!currentSoftHint?.isSatisfied) return;
      currentSoftHint = null;
      softHintSuccessTimer = null;
      softHintRemovalTimer = null;
      render();
    }, 280);
  }, 1500);
}

function replaceBoard(nextBoard) {
  if (boardsMatch(board, nextBoard)) return;
  const previousBoard = board;
  enteringTokenKeys = getEnteringTokenKeys(previousBoard, nextBoard);
  const wasShowingSuccess = Boolean(currentSoftHint?.isSatisfied);
  if (!wasShowingSuccess) clearSoftHintSuccessTimers();
  board = nextBoard;
  currentHint = null;
  currentSoftHint = updateSoftHintAfterMove(currentSoftHint, previousBoard, board);
  currentCheck = null;
  render();
  if (currentSoftHint?.isSatisfied && !wasShowingSuccess) scheduleSoftHintSuccessExit();
}

function undo() {
  const previous = undoStack[undoStack.length - 1];
  if (!previous) return;
  undoStack = undoStack.slice(0, -1);
  redoStack = [...redoStack, board];
  board = previous;
  currentHint = null;
  currentSoftHint = null;
  currentCheck = null;
  render();
}

function redo() {
  const next = redoStack[redoStack.length - 1];
  if (!next) return;
  redoStack = redoStack.slice(0, -1);
  undoStack = [...undoStack, board];
  board = next;
  currentHint = null;
  currentSoftHint = null;
  currentCheck = null;
  render();
}

function boardsMatch(left, right) {
  return left.every((row, rowIndex) =>
    row.every((cell, colIndex) => cell === right[rowIndex][colIndex]),
  );
}

function getEnteringTokenKeys(previousBoard, nextBoard) {
  const keys = new Set();
  nextBoard.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell !== "empty" && cell !== previousBoard[rowIndex][colIndex]) {
        keys.add(getStarKey({ row: rowIndex, col: colIndex }));
      }
    });
  });
  return keys;
}

// Progressive generation shell: keeps the UI responsive and the attempt
// counter live by yielding to the browser between batches, while delegating
