import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { publishHandmadeBoard } from "./board-library-files.js";
import "../src/game/engine.js";
import "../src/game/hints/core.js";
import "../src/game/hints/strategies-basic.js";
import "../src/game/hints/strategies-advanced.js";
import "../src/game/hints/difficulty.js";
import "../src/game/hints/registry.js";

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error("Usage: npm run import:board -- /path/to/downloaded-board.json");
}

const input = JSON.parse(await readFile(resolve(inputPath), "utf8"));
const title = String(input?.puzzle?.title ?? "").trim();
if (!title || title.length > 80) {
  throw new Error("Board title must be between 1 and 80 characters.");
}

const puzzle = {
  id: "handmade-import",
  title,
  size: input?.puzzle?.size,
  starsPerUnit: input?.puzzle?.starsPerUnit,
  houses: input?.puzzle?.houses,
};
const engine = globalThis.StarsRemixEngine;
engine.validatePuzzleShape(puzzle);

const solved = engine.solvePuzzle(puzzle, { limit: 2 });
if (solved.count !== 1) {
  throw new Error("Handmade boards must have exactly one solution.");
}

const report = await globalThis.StarsRemixHints.analyzeDifficulty(puzzle);
if (!report.solved || report.label === "Incalculable") {
  throw new Error("The board must be solvable by the difficulty analyzer.");
}

const result = await publishHandmadeBoard({
  puzzle,
  solution: solved.solutions[0],
  difficulty: {
    label: report.label,
    score: report.score,
    bigTicketCount: report.bigTicketCount,
    logicalSteps: report.steps.length,
  },
});

console.log(`Imported ${result.entry.puzzle.title} as ${result.entry.puzzle.id}.`);
console.log(`Rebuilt the gameplay catalog with ${result.librarySize} boards.`);
