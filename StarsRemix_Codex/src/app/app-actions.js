// Part of the StarsRemix browser app (classic script, no build step).
// Controllers (generation, difficulty, file I/O), input wiring, and boot.
// These app/*.js files were one IIFE; they now share top-level state and
// functions through the global (lexical) scope of classic scripts. Load
// order is fixed in index.html; app-actions.js runs the boot call last.

async function loadGeneratedPuzzle(size) {
  if (generationProgress) return;
  selectedBoardSize = size;
  generationProgress = { attempt: 0, maximum: size === 11 ? 250 : 1000 };
  render();

  try {
    await nextPaint();
    const generated = await generatePuzzle(size, (attempt, maximum) => {
      generationProgress = { attempt, maximum };
      updateGenerationOverlay();
    });
    puzzle = generated.puzzle;
    solution = generated.solution;
    board = createEmptyBoard(puzzle.size);
    undoStack = [];
    redoStack = [];
    currentHint = null;
    currentSoftHint = null;
    currentCheck = null;
    difficultyReport = null;
  } finally {
    generationProgress = null;
    render();
  }
}

async function calculateDifficulty() {
  if (difficultyProgress || generationProgress) return;
  difficultyReport = null;
  difficultyProgress = {
    percent: 0,
    starsPlaced: 0,
    totalStars: puzzle.size * puzzle.starsPerUnit,
    stepsCompleted: 0,
    technique: "basic rules",
    tier: "Basic",
  };
  render();

  try {
    await nextPaint();
    difficultyReport = await globalThis.StarsRemixHints.analyzeDifficulty(puzzle, {
      onProgress(progress) {
        difficultyProgress = progress;
        updateDifficultyOverlay();
      },
      yieldControl: nextPaint,
    });
  } finally {
    difficultyProgress = null;
    render();
  }
}

function saveBoardFile() {
  const contents = globalThis.StarsRemixSerialization.serializeBoard({
    puzzle, board, solution, difficultyReport,
  });
  const blobUrl = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `${safeFilename(puzzle.title)}-${puzzle.size}x${puzzle.size}.stars.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
  fileMenuOpen = false;
  fileNotice = { kind: "success", message: "Board file saved." };
  render();
}

async function loadBoardFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const loaded = globalThis.StarsRemixSerialization.deserializeBoard(await file.text());
    validatePuzzleShape(loaded.puzzle);
    puzzle = loaded.puzzle;
    board = loaded.board;
    solution = loaded.solution;
    difficultyReport = loaded.difficultyReport;
    selectedBoardSize = puzzle.size;
    undoStack = [];
    redoStack = [];
    currentHint = null;
    currentSoftHint = null;
    currentCheck = null;
    fileNotice = { kind: "success", message: `Loaded ${file.name}.` };
  } catch (error) {
    fileNotice = { kind: "error", message: error instanceof Error ? error.message : "Unable to load that board." };
  }
  fileMenuOpen = false;
  render();
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
    if (!houses) continue;

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
  setSolutionReveal(false);
});

window.addEventListener("pointercancel", () => setSolutionReveal(false));

window.addEventListener("blur", () => {
  isDraggingMarks = false;
  setSolutionReveal(false);
});

window.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  const key = event.key.toLowerCase();
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

  if (key === "escape" && currentSoftHint) {
    event.preventDefault();
    currentSoftHint = null;
    render();
  }
});

// Boot: validate the starting puzzle and paint the first frame.
validatePuzzleShape(puzzle);
render();
