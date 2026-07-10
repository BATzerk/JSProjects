// Part of the StarsRemix browser app (classic script, no build step).
// Controllers (generation, difficulty, file I/O), input wiring, and boot.
// These app/*.js files were one IIFE; they now share top-level state and
// functions through the global (lexical) scope of classic scripts. Load
// order is fixed in index.html; app-actions.js runs the boot call last.

async function loadGeneratedPuzzle(size) {
  if (generationProgress) return;
  difficultyAnalysisId += 1;
  difficultyProgress = null;
  gameState = globalThis.StarsRemixState.setDifficultyReport(gameState, null);
  selectedBoardSize = size;
  generationProgress = { attempt: 0, maximum: size === 11 ? 250 : 1000 };
  let boardWasLoaded = false;
  render();

  try {
    await nextPaint();
    const generated = await generatePuzzle(size, (attempt, maximum) => {
      generationProgress = { attempt, maximum };
      updateGenerationOverlay();
    });
    gameState = globalThis.StarsRemixState.replaceGame(gameState, {
      puzzle: generated.puzzle,
      solution: generated.solution,
      board: createEmptyBoard(generated.puzzle.size),
    });
    resetGameSessionState();
    saveBoardToDevice();
    boardWasLoaded = true;
  } finally {
    generationProgress = null;
    render();
  }

  if (boardWasLoaded) await calculateDifficulty();
}

async function calculateDifficulty() {
  if (generationProgress) return;
  const analysisId = ++difficultyAnalysisId;
  const puzzleToAnalyze = gameState.puzzle;
  gameState = globalThis.StarsRemixState.setDifficultyReport(gameState, null);
  difficultyProgress = {
    percent: 0,
    starsPlaced: 0,
    totalStars: gameState.puzzle.size * gameState.puzzle.starsPerUnit,
    stepsCompleted: 0,
    technique: "basic rules",
    tier: "Basic",
  };
  render();

  try {
    await nextPaint();
    const report = await globalThis.StarsRemixHints.analyzeDifficulty(puzzleToAnalyze, {
      onProgress(progress) {
        if (analysisId !== difficultyAnalysisId) return;
        difficultyProgress = progress;
        updateDifficultyPanel();
      },
      yieldControl: nextPaint,
    });
    if (analysisId === difficultyAnalysisId) {
      gameState = globalThis.StarsRemixState.setDifficultyReport(gameState, report);
    }
  } finally {
    if (analysisId === difficultyAnalysisId) {
      difficultyProgress = null;
      render();
    }
  }
}

function saveBoardFile() {
  const contents = encodeCurrentSnapshot();
  const blobUrl = URL.createObjectURL(new Blob([contents], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `${safeFilename(gameState.puzzle.title)}-${gameState.puzzle.size}x${gameState.puzzle.size}.stars`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
  fileMenuOpen = false;
  fileNotice = { kind: "success", message: "Board file saved." };
  render();
}

async function loadBoardFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  let boardWasLoaded = false;
  try {
    decodeAndApplySnapshot(await file.text());
    fileNotice = { kind: "success", message: `Loaded ${file.name}.` };
    saveBoardToDevice();
    boardWasLoaded = true;
  } catch (error) {
    fileNotice = { kind: "error", message: error instanceof Error ? error.message : "Unable to load that board." };
  }
  fileMenuOpen = false;
  render();
  if (boardWasLoaded) await calculateDifficulty();
}

function safeFilename(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "board";
}

async function generatePuzzle(size, onProgress) {
  const starsPerUnit = 2;
  if (size < 9) {
    throw new Error(
      "Random two-star boards require at least 9 rows and columns to avoid predictable maximum-density layouts.",
    );
  }

  const maximumAttempts = size === 11 ? 250 : 1000;
  let validFallback = null;
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    if (attempt % 5 === 0) {
      onProgress(attempt, maximumAttempts);
      await nextPaint();
    }
    const solution = engine.generateSolution(size, starsPerUnit);
    const houses = solution && engine.generateHouses(size, solution);
    if (!houses || engine.hasThreeCellHouse(houses)) continue;

    const candidate = {
      id: `generated-${Date.now()}-${attempt}`,
      title: "Random Constellation",
      size,
      starsPerUnit,
      houses,
    };
    validFallback ??= { puzzle: candidate, solution };
    if (engine.countSolutions(candidate, 2) === 1) return { puzzle: candidate, solution };
  }
  if (size === 11 && validFallback) return validFallback;
  throw new Error("Unable to generate a unique puzzle. Please try again.");
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

window.addEventListener("pointerup", () => {
  isDraggingMarks = false;
});

window.addEventListener("click", (event) => {
  if (fileMenuOpen && event.target instanceof Element && !event.target.closest(".file-menu")) {
    fileMenuOpen = false;
    render();
  }
});

window.addEventListener("blur", () => {
  isDraggingMarks = false;
});

function dismissActiveUi() {
  if (fileMenuOpen) {
    fileMenuOpen = false;
  } else if (currentHint) {
    currentHint = null;
  } else if (currentSoftHint) {
    clearSoftHintSuccessTimers();
    currentSoftHint = null;
  } else if (currentCheck) {
    currentCheck = null;
  } else {
    return false;
  }

  render();
  return true;
}

window.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  const key = event.key.toLowerCase();
  if (key === "escape") {
    if (dismissActiveUi()) event.preventDefault();
    return;
  }

  if (key === "z") {
    event.preventDefault();
    undo();
  }

  if (key === "r" || key === "y" || key === "x") {
    event.preventDefault();
    redo();
  }

  if (key === "h") {
    event.preventDefault();
    root.querySelector("[data-action='hint']")?.click();
  }

  if (key === "g") {
    event.preventDefault();
    root.querySelector("[data-action='soft-hint']")?.click();
  }

  if (key === "c") {
    event.preventDefault();
    root.querySelector("[data-action='check']")?.click();
  }
});

// Boot: prefer the last locally saved game, then validate, paint, and rate it.
restoreBoardFromDevice();
validatePuzzleShape(gameState.puzzle);
calculateDifficulty();
