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

const starterPuzzle = {
  id: "codex-starter-10x10",
  title: "First Light",
  size: 10,
  starsPerUnit: 2,
  houses: [
    [0, 0, 0, 0, 1, 1, 2, 2, 2, 2],
    [0, 0, 0, 0, 1, 1, 2, 2, 2, 2],
    [3, 3, 3, 1, 1, 1, 4, 4, 2, 2],
    [3, 3, 3, 1, 1, 1, 4, 4, 4, 5],
    [3, 3, 1, 1, 1, 4, 4, 4, 5, 5],
    [6, 3, 3, 7, 7, 7, 4, 4, 5, 5],
    [6, 6, 3, 7, 8, 7, 7, 5, 5, 9],
    [6, 6, 6, 7, 8, 8, 7, 7, 9, 9],
    [6, 6, 6, 6, 8, 8, 8, 9, 9, 9],
    [6, 6, 6, 6, 8, 8, 9, 9, 9, 9],
  ],
};
const starterSolution = [];

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

let puzzle = starterPuzzle;
let solution = starterSolution;
let selectedBoardSize = puzzle.size;
let board = createEmptyBoard(puzzle.size);
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
let difficultyReport = null;
let fileMenuOpen = false;
let fileNotice = null;

const root = document.querySelector("#root");

if (!root) {
  throw new Error("Missing app root.");
}

