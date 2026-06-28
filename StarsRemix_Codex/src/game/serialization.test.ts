import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./serialization.js";

const puzzle = {
  id: "test", title: "Test Board", size: 2, starsPerUnit: 1,
  houses: [[0, 0], [1, 1]],
};
const board = [["star", "mark"], ["empty", "empty"]];
const solution = [{ row: 0, col: 0 }, { row: 1, col: 1 }];

describe("board file serialization", () => {
  it("round-trips puzzle progress and an unrated status", () => {
    const text = globalThis.StarsRemixSerialization.serializeBoard({
      puzzle, board, solution, difficultyReport: null,
    });
    const loaded = globalThis.StarsRemixSerialization.deserializeBoard(text);
    assert.deepEqual(loaded, { puzzle, board, solution, difficultyReport: null });
    assert.equal(JSON.parse(text).difficulty.status, "unrated");
  });

  it("preserves an incalculable difficulty report", () => {
    const report = { solved: false, label: "Incalculable", score: 3, steps: [], techniqueCounts: [] };
    const text = globalThis.StarsRemixSerialization.serializeBoard({
      puzzle, board, solution, difficultyReport: report,
    });
    assert.equal(JSON.parse(text).difficulty.status, "incalculable");
    assert.deepEqual(globalThis.StarsRemixSerialization.deserializeBoard(text).difficultyReport, report);
  });

  it("rejects malformed board states", () => {
    const text = globalThis.StarsRemixSerialization.serializeBoard({
      puzzle, board, solution, difficultyReport: null,
    });
    const malformed = JSON.parse(text);
    malformed.board[0][0] = "banana";
    assert.throws(() => globalThis.StarsRemixSerialization.deserializeBoard(JSON.stringify(malformed)), /board state/);
  });
});

declare global {
  var StarsRemixSerialization: {
    serializeBoard: (value: any) => string;
    deserializeBoard: (value: string) => any;
  };
}
