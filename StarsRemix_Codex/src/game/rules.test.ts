import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyBoard, cycleCellState, setCell } from "./board.ts";
import { starterPuzzle } from "./puzzles.ts";
import { validateBoard } from "./rules.ts";

describe("validateBoard", () => {
  it("cycles cells from X to star to clear", () => {
    assert.equal(cycleCellState("empty"), "mark");
    assert.equal(cycleCellState("mark"), "star");
    assert.equal(cycleCellState("star"), "empty");
  });

  it("flags adjacent stars, including diagonals", () => {
    let board = createEmptyBoard(starterPuzzle.size);
    board = setCell(board, 0, 0, "star");
    board = setCell(board, 1, 1, "star");

    const validation = validateBoard(starterPuzzle, board);

    assert.deepEqual(validation.conflicts.find((conflict) => conflict.reason.includes("touch")), {
      cells: [
        { row: 0, col: 0 },
        { row: 1, col: 1 },
      ],
      reason: "Stars cannot touch, even diagonally.",
    });
  });

  it("flags overfilled rows, columns, and houses", () => {
    let board = createEmptyBoard(starterPuzzle.size);
    board = setCell(board, 0, 0, "star");
    board = setCell(board, 0, 1, "star");
    board = setCell(board, 0, 2, "star");

    const validation = validateBoard(starterPuzzle, board);
    const reasons = validation.conflicts.map((conflict) => conflict.reason);

    assert.ok(reasons.includes("Row 1 has 3 stars."));
    assert.ok(reasons.includes("House 1 has 3 stars."));
  });

  it("does not call an incomplete board solved", () => {
    const validation = validateBoard(starterPuzzle, createEmptyBoard(starterPuzzle.size));

    assert.equal(validation.solved, false);
  });
});
