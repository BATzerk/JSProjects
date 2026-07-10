import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./snapshot.js";
import "./serialization-sr2.js";
import "./serialization.js";

const puzzle = {
  id: "test", title: "Test Board", size: 2, starsPerUnit: 1,
  houses: [[0, 0], [1, 1]],
};
const board = [["star", "mark"], ["empty", "empty"]];
const solution = [{ row: 0, col: 0 }, { row: 1, col: 1 }];

describe("board file serialization", () => {
  it("round-trips puzzle progress in the compact format", () => {
    const snapshot = globalThis.StarsRemixSnapshots.create({ puzzle, board, solution });
    const text = globalThis.StarsRemixSerialization.serializeSnapshot(snapshot);
    assert.equal(text, "SR2.2.1.0.dGVzdA.VGVzdCBCb2FyZA.DA.Bg.DA.1psruvk");
    assert.deepEqual(globalThis.StarsRemixSerialization.deserializeSnapshot(text), snapshot);
  });

  it("keeps the old board-shaped API compatible", () => {
    const text = globalThis.StarsRemixSerialization.serializeBoard({ puzzle, board, solution, difficultyReport: null });
    assert.deepEqual(globalThis.StarsRemixSerialization.deserializeBoard(text), {
      puzzle, board, solution, difficultyReport: null, difficultyLabel: "Unrated",
    });
  });

  it("stores the difficulty label without its analysis history", () => {
    const report = { solved: true, label: "Hard", score: 42, steps: [{ enormous: "history" }], techniqueCounts: [] };
    const text = globalThis.StarsRemixSerialization.serializeBoard({ puzzle, board, solution, difficultyReport: report });
    assert.doesNotMatch(text, /history|score|steps/);
    const loaded = globalThis.StarsRemixSerialization.deserializeBoard(text);
    assert.equal(loaded.difficultyLabel, "Hard");
    assert.equal(loaded.difficultyReport, null);
  });

  it("detects damaged compact strings", () => {
    const text = globalThis.StarsRemixSerialization.serializeBoard({ puzzle, board, solution, difficultyReport: null });
    assert.throws(() => globalThis.StarsRemixSerialization.deserializeBoard(`${text.slice(0, -1)}x`), /damaged/);
  });

  it("continues to load version-one JSON saves", () => {
    const legacy = JSON.stringify({
      format: "stars-remix-board", version: 1, puzzle, board, solution,
      difficulty: { status: "rated", report: { label: "Moderate" } },
    });
    assert.equal(globalThis.StarsRemixSerialization.deserializeBoard(legacy).difficultyLabel, "Moderate");
  });

  it("rejects incomplete, duplicate, and out-of-range solutions", () => {
    assert.throws(() => globalThis.StarsRemixSnapshots.create({
      puzzle, board, solution: solution.slice(0, 1),
    }), /solution/);
    assert.throws(() => globalThis.StarsRemixSnapshots.create({
      puzzle, board, solution: [solution[0], solution[0]],
    }), /duplicate/);
    assert.throws(() => globalThis.StarsRemixSnapshots.create({
      puzzle, board, solution: [{ row: 0, col: 0 }, { row: 2, col: 0 }],
    }), /solution/);
  });

  it("rejects oversized input before attempting to decode it", () => {
    assert.throws(() => globalThis.StarsRemixSerialization.deserializeSnapshot("x".repeat(100_001)), /too large/);
  });
});

declare global {
  var StarsRemixSerialization: {
    serializeSnapshot: (value: any) => string;
    deserializeSnapshot: (value: string) => any;
    serializeBoard: (value: any) => string;
    deserializeBoard: (value: string) => any;
  };
  var StarsRemixSnapshots: { create: (value: any) => any };
}
