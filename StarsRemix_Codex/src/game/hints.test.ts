import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./hints.js";

const { findHint } = globalThis.StarsRemixHints;

const puzzle = {
  size: 4,
  starsPerUnit: 2,
  houses: [
    [0, 0, 1, 1],
    [0, 0, 1, 1],
    [2, 2, 3, 3],
    [2, 2, 3, 3],
  ],
};
const solution = [
  { row: 0, col: 0 }, { row: 0, col: 2 },
  { row: 2, col: 0 }, { row: 2, col: 2 },
];

function emptyBoard() {
  return Array.from({ length: 4 }, () => Array(4).fill("empty"));
}

describe("findHint", () => {
  it("prioritizes and highlights incorrect stars and Xs in red", () => {
    const board = emptyBoard();
    board[0][0] = "mark";
    board[1][1] = "star";
    const hint = findHint(puzzle, board, solution);
    assert.equal(hint.kind, "incorrect");
    assert.deepEqual(hint.cells, [
      { row: 0, col: 0, color: "red" },
      { row: 1, col: 1, color: "red" },
    ]);
  });

  it("points out empty spaces surrounding a correct star", () => {
    const board = emptyBoard();
    board[0][0] = "star";
    const hint = findHint(puzzle, board, solution);
    assert.equal(hint.kind, "surround-star");
    assert.deepEqual(hint.cells, [
      { row: 0, col: 0, color: "gold" },
      { row: 0, col: 1, color: "blue" },
      { row: 1, col: 0, color: "blue" },
      { row: 1, col: 1, color: "blue" },
    ]);
  });

  it("points out the rest of a completed unit after star neighbors are marked", () => {
    const largerPuzzle = {
      size: 6,
      starsPerUnit: 2,
      houses: Array.from({ length: 6 }, (_, row) => Array(6).fill(row)),
    };
    const largerSolution = [{ row: 0, col: 0 }, { row: 0, col: 3 }];
    const board = Array.from({ length: 6 }, () => Array(6).fill("empty"));
    board[0][0] = "star";
    board[0][3] = "star";
    board[1][0] = board[1][1] = board[1][2] = board[1][3] = board[1][4] = "mark";
    board[0][1] = "mark";
    board[0][2] = board[0][4] = "mark";
    const hint = findHint(largerPuzzle, board, largerSolution);
    assert.equal(hint.kind, "complete-unit");
    assert.match(hint.message, /^Row 1/);
    assert.deepEqual(hint.cells, [
      { row: 0, col: 0, color: "gold" },
      { row: 0, col: 3, color: "gold" },
      { row: 0, col: 5, color: "blue" },
    ]);
  });
});
