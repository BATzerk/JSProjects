import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./hints.js";

const { findHint, applyHint } = globalThis.StarsRemixHints;

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
function emptyBoard() {
  return Array.from({ length: 4 }, () => Array(4).fill("empty"));
}

describe("findHint", () => {
  it("accepts only the puzzle and current board, never a solution", () => {
    assert.equal(findHint.length, 2);
  });

  it("detects visible rule conflicts without consulting a solution", () => {
    const board = emptyBoard();
    board[0][0] = "star";
    board[1][1] = "star";
    const hint = findHint(puzzle, board);
    assert.equal(hint.kind, "rule-conflict");
    assert.deepEqual(hint.cells, [
      { row: 0, col: 0, color: "red" },
      { row: 1, col: 1, color: "red" },
    ]);
  });

  it("points out empty spaces surrounding a correct star", () => {
    const board = emptyBoard();
    board[0][0] = "star";
    const hint = findHint(puzzle, board);
    assert.equal(hint.kind, "surround-star");
    assert.deepEqual(hint.cells, [
      { row: 0, col: 0, color: "gold" },
      { row: 0, col: 1, color: "blue" },
      { row: 1, col: 0, color: "blue" },
      { row: 1, col: 1, color: "blue" },
    ]);
    assert.deepEqual(hint.moves, [
      { row: 0, col: 1, state: "mark" },
      { row: 1, col: 0, state: "mark" },
      { row: 1, col: 1, state: "mark" },
    ]);

    const applied = applyHint(board, hint);
    assert.equal(applied[0][0], "star");
    assert.equal(applied[0][1], "mark");
    assert.equal(applied[1][0], "mark");
    assert.equal(applied[1][1], "mark");
    assert.equal(board[0][1], "empty", "applying a hint must not mutate the prior board");
  });

  it("points out the rest of a completed unit after star neighbors are marked", () => {
    const largerPuzzle = {
      size: 6,
      starsPerUnit: 2,
      houses: Array.from({ length: 6 }, (_, row) => Array(6).fill(row)),
    };
    const board = Array.from({ length: 6 }, () => Array(6).fill("empty"));
    board[0][0] = "star";
    board[0][3] = "star";
    board[1][0] = board[1][1] = board[1][2] = board[1][3] = board[1][4] = "mark";
    board[0][1] = "mark";
    board[0][2] = board[0][4] = "mark";
    const hint = findHint(largerPuzzle, board);
    assert.equal(hint.kind, "complete-unit");
    assert.match(hint.message, /^Row 1/);
    assert.deepEqual(hint.cells, [
      { row: 0, col: 0, color: "gold" },
      { row: 0, col: 3, color: "gold" },
      { row: 0, col: 5, color: "blue" },
    ]);
  });

  it("suggests forced stars one at a time when a row's open spaces equal its missing stars", () => {
    const rowPuzzle = {
      size: 8,
      starsPerUnit: 2,
      houses: Array.from({ length: 8 }, (_, row) => Array(8).fill(row)),
    };
    const board = Array.from({ length: 8 }, () => Array(8).fill("empty"));
    board[0] = ["mark", "empty", "mark", "mark", "mark", "empty", "mark", "mark"];

    const firstHint = findHint(rowPuzzle, board);
    assert.equal(firstHint.kind, "forced-star");
    assert.match(firstHint.message, /^Row 1 needs 2 more stars/);
    assert.deepEqual(firstHint.cells, [{ row: 0, col: 1, color: "gold" }]);
    assert.deepEqual(firstHint.moves, [{ row: 0, col: 1, state: "star" }]);

    board[0][1] = "star";
    board[1][0] = board[1][1] = board[1][2] = "mark";
    const secondHint = findHint(rowPuzzle, board);
    assert.equal(secondHint.kind, "forced-star");
    assert.match(secondHint.message, /^Row 1 needs one more star/);
    assert.deepEqual(secondHint.cells, [{ row: 0, col: 5, color: "gold" }]);
  });

  it("finds forced stars in columns and houses too", () => {
    const columnBoard = Array.from({ length: 4 }, () => Array(4).fill("mark"));
    columnBoard[0][1] = columnBoard[2][1] = "empty";
    const columnHint = findHint(puzzle, columnBoard);
    assert.equal(columnHint.kind, "forced-star");
    assert.match(columnHint.message, /^Column 2/);
    assert.deepEqual(columnHint.cells, [{ row: 0, col: 1, color: "gold" }]);

    const houseBoard = Array.from({ length: 4 }, () => Array(4).fill("mark"));
    houseBoard[0][0] = houseBoard[1][1] = "empty";
    const houseHint = findHint(puzzle, houseBoard);
    assert.equal(houseHint.kind, "forced-star");
    assert.match(houseHint.message, /^House 1/);
    assert.deepEqual(houseHint.cells, [{ row: 0, col: 0, color: "gold" }]);
  });

  it("marks a 3 by 3 house's center because a star there would block a second star", () => {
    const squareHousePuzzle = {
      size: 6,
      starsPerUnit: 2,
      houses: Array.from({ length: 6 }, (_, row) =>
        Array.from({ length: 6 }, (_, col) =>
          row < 3 ? (col < 3 ? 0 : 1) : (col < 3 ? 2 : 3),
        ),
      ),
    };
    const board = Array.from({ length: 6 }, () => Array(6).fill("empty"));

    const hint = findHint(squareHousePuzzle, board);
    assert.equal(hint.kind, "impossible-star");
    assert.match(hint.message, /At least one star must go somewhere in the marked spaces/);
    assert.match(hint.message, /House 1/);
    assert.deepEqual(hint.cells, [
      { row: 1, col: 1, color: "blue" },
      { row: 0, col: 0, color: "gray" },
      { row: 0, col: 1, color: "gray" },
      { row: 0, col: 2, color: "gray" },
      { row: 1, col: 0, color: "gray" },
      { row: 1, col: 2, color: "gray" },
      { row: 2, col: 0, color: "gray" },
      { row: 2, col: 1, color: "gray" },
      { row: 2, col: 2, color: "gray" },
    ]);
    assert.deepEqual(hint.moves, [{ row: 1, col: 1, state: "mark" }]);
  });
});
