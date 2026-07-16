import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import "./engine.js";

const difficulties = ["Easy", "Moderate", "Hard", "Very Hard", "Expert"];
const library = JSON.parse(
  await readFile(new URL("./board-library-data.json", import.meta.url), "utf8"),
);

describe("generated board library", () => {
  it("contains at least 20 saved, calculable boards per difficulty", () => {
    assert.equal(library.version, 1);
    assert.ok(Array.isArray(library.boards));
    for (const difficulty of difficulties) {
      assert.ok(
        library.boards.filter((entry) => entry.difficulty.label === difficulty).length >= 20,
        `Expected at least 20 ${difficulty} boards.`,
      );
    }
    assert.equal(
      library.boards.some((entry) => entry.difficulty.label === "Incalculable"),
      false,
    );
  });

  it("uses stable unique IDs and stores valid solved boards", () => {
    const ids = new Set();
    for (const entry of library.boards) {
      assert.equal(ids.has(entry.puzzle.id), false, `Duplicate board ID ${entry.puzzle.id}.`);
      ids.add(entry.puzzle.id);
      assert.ok(difficulties.includes(entry.difficulty.label));
      assert.doesNotThrow(() => globalThis.StarsRemixEngine.validatePuzzleShape(entry.puzzle));

      const solutionBoard = globalThis.StarsRemixEngine.createEmptyBoard(entry.puzzle.size);
      for (const { row, col } of entry.solution) solutionBoard[row][col] = "star";
      assert.equal(globalThis.StarsRemixEngine.validateBoard(entry.puzzle, solutionBoard).solved, true);
    }
  });
});
