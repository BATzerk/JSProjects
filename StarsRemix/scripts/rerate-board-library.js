import { readExistingLibrary, writeLibrary } from "./board-library-files.js";

await import("../src/game/engine.js");
await import("../src/game/hints/core.js");
await import("../src/game/hints/strategies-basic.js");
await import("../src/game/hints/strategies-advanced.js");
await import("../src/game/hints/difficulty.js");
await import("../src/game/hints/registry.js");

const difficultyOrder = ["Easy", "Moderate", "Hard", "Very Hard", "Expert"];
const checkOnly = process.argv.includes("--check");
const library = await readExistingLibrary();
const reratedBoards = [];

for (const [index, entry] of library.boards.entries()) {
  const report = await globalThis.StarsRemixHints.analyzeDifficulty(entry.puzzle);
  if (!report.solved || !difficultyOrder.includes(report.label)) {
    throw new Error(`Unable to rate ${entry.puzzle.id}.`);
  }
  reratedBoards.push({
    ...entry,
    difficulty: {
      label: report.label,
      score: report.score,
      bigTicketCount: report.bigTicketCount,
      highestTier: report.highestTier,
      logicalSteps: report.steps.length,
    },
  });
  console.log(`Rated ${index + 1}/${library.boards.length}: ${entry.puzzle.id} → ${report.label}`);
}

const ordinals = Object.fromEntries(difficultyOrder.map((label) => [label, 0]));
for (const entry of reratedBoards) {
  if (entry.puzzle.id.startsWith("handmade-")) continue;
  const label = entry.difficulty.label;
  ordinals[label] += 1;
  entry.puzzle.title = `${label} ${String(ordinals[label]).padStart(2, "0")}`;
}

if (checkOnly) {
  if (JSON.stringify(library.boards) !== JSON.stringify(reratedBoards)) {
    throw new Error("The stored board-library ratings are out of date.");
  }
  console.log("All stored board-library ratings match the current analyzer.");
} else {
  await writeLibrary({ version: library.version ?? 1, boards: reratedBoards });
}
console.log(difficultyOrder.map((label) => `${label}: ${ordinals[label]}`).join(" · "));
