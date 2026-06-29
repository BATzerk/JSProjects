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

const initialGame = engine.generatePuzzle({ size: 9 });

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

let puzzle = initialGame.puzzle;
let solution = initialGame.solution;
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
let difficultyAnalysisId = 0;
let fileMenuOpen = false;
let fileNotice = null;
let solutionRevealVisible = false;

const root = document.querySelector("#root");

if (!root) {
  throw new Error("Missing app root.");
}
