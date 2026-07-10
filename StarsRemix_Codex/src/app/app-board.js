// Part of the StarsRemix browser app (classic script, no build step).
// Board mutation and move history (apply/replace, undo/redo, soft-hint lifecycle).
// These app/*.js files were one IIFE; they now share top-level state and
// functions through the global (lexical) scope of classic scripts. Load
// order is fixed in index.html; app-actions.js runs the boot call last.

function applyBoard(nextBoard) {
  if (boardsMatch(gameState.progress.board, nextBoard)) return;
  const previousBoard = gameState.progress.board;
  enteringTokenKeys = getEnteringTokenKeys(previousBoard, nextBoard);
  const wasShowingSuccess = Boolean(currentSoftHint?.isSatisfied);
  if (!wasShowingSuccess) clearSoftHintSuccessTimers();
  undoStack = [...undoStack, gameState.progress.board];
  redoStack = [];
  gameState = globalThis.StarsRemixState.updateBoard(gameState, nextBoard);
  currentHint = null;
  currentCheck = null;
  currentSoftHint = updateSoftHintAfterMove(currentSoftHint, previousBoard, gameState.progress.board);
  saveBoardToDevice();
  render();
  if (currentSoftHint?.isSatisfied && !wasShowingSuccess) scheduleSoftHintSuccessExit();
}

function updateSoftHintAfterMove(activeSoftHint, previousBoard, nextBoard) {
  if (!activeSoftHint) return null;
  if (activeSoftHint.isSatisfied) return activeSoftHint;

  const matchingHint = globalThis.StarsRemixHints.findSoftHintByKind(
    gameState.puzzle,
    nextBoard,
    activeSoftHint.hint.kind,
    gameState.solution,
  );

  const moveSatisfied = globalThis.StarsRemixHints.isSoftHintTechniqueSatisfied(
    gameState.puzzle,
    previousBoard,
    nextBoard,
    gameState.solution,
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
  if (boardsMatch(gameState.progress.board, nextBoard)) return;
  const previousBoard = gameState.progress.board;
  enteringTokenKeys = getEnteringTokenKeys(previousBoard, nextBoard);
  const wasShowingSuccess = Boolean(currentSoftHint?.isSatisfied);
  if (!wasShowingSuccess) clearSoftHintSuccessTimers();
  gameState = globalThis.StarsRemixState.updateBoard(gameState, nextBoard);
  currentHint = null;
  currentSoftHint = updateSoftHintAfterMove(currentSoftHint, previousBoard, gameState.progress.board);
  currentCheck = null;
  saveBoardToDevice();
  render();
  if (currentSoftHint?.isSatisfied && !wasShowingSuccess) scheduleSoftHintSuccessExit();
}

function undo() {
  const previous = undoStack[undoStack.length - 1];
  if (!previous) return;
  undoStack = undoStack.slice(0, -1);
  redoStack = [...redoStack, gameState.progress.board];
  gameState = globalThis.StarsRemixState.updateBoard(gameState, previous);
  currentHint = null;
  currentSoftHint = null;
  currentCheck = null;
  saveBoardToDevice();
  render();
}

function redo() {
  const next = redoStack[redoStack.length - 1];
  if (!next) return;
  redoStack = redoStack.slice(0, -1);
  undoStack = [...undoStack, gameState.progress.board];
  gameState = globalThis.StarsRemixState.updateBoard(gameState, next);
  currentHint = null;
  currentSoftHint = null;
  currentCheck = null;
  saveBoardToDevice();
  render();
}

function restoreLastSolvableBoard() {
  const checkpointIndex = undoStack.findLastIndex((candidate) =>
    !globalThis.StarsRemixHints.findBoardMistake(gameState.puzzle, candidate, gameState.solution),
  );
  if (checkpointIndex < 0) return false;

  const previousBoard = gameState.progress.board;
  const checkpoint = undoStack[checkpointIndex];
  poofingTokenDelays = getRemovedTokenDelays(previousBoard, checkpoint, checkpointIndex);
  undoStack = undoStack.slice(0, checkpointIndex);
  redoStack = [...redoStack, previousBoard];
  gameState = globalThis.StarsRemixState.updateBoard(gameState, checkpoint);
  currentHint = null;
  currentSoftHint = null;
  currentCheck = null;
  saveBoardToDevice();
  render();
  poofingTokenDelays = new Map();
  return true;
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


function getRemovedTokenDelays(previousBoard, checkpoint, checkpointIndex) {
  const removedKeys = new Set();
  previousBoard.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell !== "empty" && cell !== checkpoint[rowIndex][colIndex]) {
        removedKeys.add(getStarKey({ row: rowIndex, col: colIndex }));
      }
    });
  });

  const timeline = [checkpoint, ...undoStack.slice(checkpointIndex + 1), previousBoard];
  const delays = new Map();
  let burstGroup = 0;
  for (let index = timeline.length - 1; index > 0; index -= 1) {
    const newerBoard = timeline[index];
    const olderBoard = timeline[index - 1];
    let foundInGroup = false;
    newerBoard.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const key = getStarKey({ row: rowIndex, col: colIndex });
        if (
          removedKeys.has(key)
          && !delays.has(key)
          && cell !== olderBoard[rowIndex][colIndex]
        ) {
          delays.set(key, burstGroup * 50);
          foundInGroup = true;
        }
      });
    });
    if (foundInGroup) burstGroup += 1;
  }
  return delays;
}

// Progressive generation shell: keeps the UI responsive and the attempt
// counter live by yielding to the browser between batches, while delegating
