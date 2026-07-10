// Part of the StarsRemix browser app (classic script, no build step).
// Shared mutable game state, constants, and the engine bindings.
// These app/*.js files were one IIFE; they now share top-level state and
// functions through the global (lexical) scope of classic scripts. Load
// order is fixed in index.html; app-actions.js runs the boot call last.

const engine = globalThis.StarsRemixEngine;
// Domain helpers shared with the engine; used by bare name throughout the UI.
const {
  createEmptyBoard,
  cycleCellState,
  setCell,
  validateBoard,
  getStarKey,
  validatePuzzleShape,
} = engine;

/* Previous 11x11 startup board:
const initialGame = {
  puzzle: {
    id: "codex-default-11x11",
    title: "Default Constellation",
    size: 11,
    starsPerUnit: 2,
    houses: [
      [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
      [0, 0, 3, 3, 1, 4, 1, 2, 2, 2, 2],
      [0, 3, 3, 3, 4, 4, 4, 2, 2, 2, 2],
      [0, 0, 4, 3, 4, 4, 4, 2, 4, 2, 2],
      [0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 2],
      [5, 5, 4, 4, 4, 4, 4, 4, 4, 6, 6],
      [5, 7, 7, 4, 4, 4, 4, 4, 6, 6, 6],
      [5, 7, 4, 4, 4, 4, 4, 4, 4, 6, 8],
      [5, 7, 7, 7, 7, 4, 9, 9, 8, 8, 8],
      [5, 10, 10, 7, 4, 4, 4, 9, 8, 9, 8],
      [5, 5, 10, 10, 10, 10, 9, 9, 9, 9, 8],
    ],
  },
  solution: [
    { row: 0, col: 5 }, { row: 0, col: 9 },
    { row: 1, col: 1 }, { row: 1, col: 3 },
    { row: 2, col: 7 }, { row: 2, col: 9 },
    { row: 3, col: 1 }, { row: 3, col: 3 },
    { row: 4, col: 5 }, { row: 4, col: 7 },
    { row: 5, col: 0 }, { row: 5, col: 10 },
    { row: 6, col: 2 }, { row: 6, col: 8 },
    { row: 7, col: 0 }, { row: 7, col: 10 },
    { row: 8, col: 4 }, { row: 8, col: 6 },
    { row: 9, col: 2 }, { row: 9, col: 8 },
    { row: 10, col: 4 }, { row: 10, col: 6 },
  ],
};
*/

const initialGame = {
  puzzle: {
    id: "codex-default-9x9",
    title: "Default Constellation",
    size: 9,
    starsPerUnit: 2,
    houses: [
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 2, 2, 2, 2, 2, 3, 3],
      [1, 4, 2, 5, 5, 5, 2, 3, 3],
      [1, 4, 2, 2, 2, 5, 2, 3, 3],
      [1, 4, 4, 2, 5, 5, 2, 3, 3],
      [1, 4, 2, 2, 2, 5, 2, 6, 6],
      [4, 4, 2, 5, 5, 5, 7, 6, 6],
      [4, 4, 7, 7, 7, 7, 7, 6, 6],
      [8, 8, 8, 8, 8, 8, 8, 8, 8],
    ],
  },
  solution: [
    { row: 0, col: 1 }, { row: 0, col: 3 },
    { row: 1, col: 5 }, { row: 1, col: 7 },
    { row: 2, col: 0 }, { row: 2, col: 3 },
    { row: 3, col: 5 }, { row: 3, col: 7 },
    { row: 4, col: 0 }, { row: 4, col: 2 },
    { row: 5, col: 4 }, { row: 5, col: 8 },
    { row: 6, col: 1 }, { row: 6, col: 6 },
    { row: 7, col: 4 }, { row: 7, col: 8 },
    { row: 8, col: 2 }, { row: 8, col: 6 },
  ],
};

const housePalette = [
  "#fff3eb",
  "#eefaf1",
  "#f5f0ff",
  "#fff9df",
  "#ebf9ff",
  "#fff0f5",
  "#f3fae8",
  "#fff5e8",
  "#f0f4ff",
  "#eefbf7",
  "#fff2ea",
  "#f5faea",
  "#fff0fb",
];
const useHouseColors = false;
let gameState = globalThis.StarsRemixState.createGameState({
  puzzle: initialGame.puzzle,
  solution: initialGame.solution,
  board: createEmptyBoard(initialGame.puzzle.size),
});
let selectedBoardSize = gameState.puzzle.size;
let undoStack = [];
let redoStack = [];
let isDraggingMarks = false;
let currentHint = null;
let currentSoftHint = null;
let softHintSuccessTimer = null;
let softHintRemovalTimer = null;
let currentCheck = null;
let generationProgress = null;
let difficultyProgress = null;
let difficultyAnalysisId = 0;
let fileMenuOpen = false;
let fileNotice = null;
let solutionRevealVisible = false;
let enteringTokenKeys = new Set();
let poofingTokenDelays = new Map();

const root = document.querySelector("#root");

if (!root) {
  throw new Error("Missing app root.");
}
