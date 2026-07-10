import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./state.js";

const puzzle = { id: "one", size: 2 };
const solution = [{ row: 0, col: 0 }];
const board = [["empty", "empty"], ["empty", "empty"]];

describe("game state transitions", () => {
  it("updates board progress without changing puzzle identity or analysis", () => {
    const report = { label: "Easy" };
    const state = globalThis.StarsRemixState.createGameState({ puzzle, solution, board, difficultyReport: report });
    const nextBoard = [["star", "empty"], ["empty", "empty"]];
    const next = globalThis.StarsRemixState.updateBoard(state, nextBoard);

    assert.notEqual(next, state);
    assert.equal(next.puzzle, puzzle);
    assert.equal(next.solution, solution);
    assert.equal(next.analysis.difficultyReport, report);
    assert.equal(next.progress.board, nextBoard);
    assert.equal(state.progress.board, board);
  });

  it("replaces the complete durable game and clears stale analysis", () => {
    const state = globalThis.StarsRemixState.createGameState({
      puzzle, solution, board, difficultyReport: { label: "Hard" },
    });
    const replacement = {
      puzzle: { id: "two", size: 3 },
      solution: [{ row: 1, col: 1 }],
      board: [["empty"]],
    };
    const next = globalThis.StarsRemixState.replaceGame(state, replacement);

    assert.deepEqual(next, {
      puzzle: replacement.puzzle,
      solution: replacement.solution,
      progress: { board: replacement.board },
      analysis: { difficultyReport: null },
    });
  });

  it("records completed analysis without changing puzzle progress", () => {
    const state = globalThis.StarsRemixState.createGameState({ puzzle, solution, board });
    const report = { label: "Moderate" };
    const next = globalThis.StarsRemixState.setDifficultyReport(state, report);

    assert.equal(next.analysis.difficultyReport, report);
    assert.equal(next.progress, state.progress);
    assert.equal(next.puzzle, state.puzzle);
  });
});

declare global {
  var StarsRemixState: {
    createGameState: (value: any) => any;
    replaceGame: (state: any, value: any) => any;
    updateBoard: (state: any, board: any) => any;
    setDifficultyReport: (state: any, report: any) => any;
  };
}
