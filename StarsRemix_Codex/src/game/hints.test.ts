import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./hints.js";

const { findHint, findSoftHint, applyHint, analyzeDifficulty, techniques } = globalThis.StarsRemixHints;

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
    assert.match(firstHint.message, /remaining 2 stars in Row 1/);
    assert.deepEqual(firstHint.cells, [{ row: 0, col: 1, color: "gold" }]);
    assert.deepEqual(firstHint.moves, [{ row: 0, col: 1, state: "star" }]);

    board[0][1] = "star";
    board[1][0] = board[1][1] = board[1][2] = "mark";
    const secondHint = findHint(rowPuzzle, board);
    assert.equal(secondHint.kind, "forced-star");
    assert.match(secondHint.message, /remaining star in Row 1/);
    assert.deepEqual(secondHint.cells, [{ row: 0, col: 5, color: "gold" }]);
  });

  it("finds forced stars in columns and houses too", () => {
    const columnBoard = Array.from({ length: 4 }, () => Array(4).fill("mark"));
    columnBoard[0][1] = columnBoard[2][1] = "empty";
    const columnHint = findHint(puzzle, columnBoard);
    assert.equal(columnHint.kind, "forced-star");
    assert.match(columnHint.message, /Column 2/);
    assert.deepEqual(columnHint.cells, [{ row: 0, col: 1, color: "gold" }]);

    const housePuzzle = {
      size: 4,
      starsPerUnit: 2,
      houses: Array.from({ length: 4 }, () => Array(4).fill(0)),
    };
    const houseBoard = Array.from({ length: 4 }, () => Array(4).fill("mark"));
    houseBoard[0][0] = houseBoard[2][2] = "empty";
    const houseHint = findHint(housePuzzle, houseBoard);
    assert.equal(houseHint.kind, "forced-star");
    assert.match(houseHint.message, /House 1/);
    assert.deepEqual(houseHint.cells, [{ row: 0, col: 0, color: "gold" }]);
  });

  it("finds a star forced by every viable placement in an irregular house", () => {
    const housePuzzle = {
      size: 4,
      starsPerUnit: 2,
      houses: Array.from({ length: 4 }, () => Array(4).fill(0)),
    };
    const board = Array.from({ length: 4 }, () => Array(4).fill("mark"));
    board[0][0] = "empty";
    board[2][2] = "empty";
    board[3][3] = "empty";

    const hint = findHint(housePuzzle, board);
    assert.equal(hint.kind, "forced-star");
    assert.match(hint.message, /remaining 2 stars in House 1/);
    assert.deepEqual(hint.cells, [{ row: 0, col: 0, color: "gold" }]);
    assert.deepEqual(hint.moves, [{ row: 0, col: 0, state: "star" }]);
  });

  it("reserves a row's remaining capacity for a house intersection", () => {
    const intersectionPuzzle = {
      size: 6,
      starsPerUnit: 1,
      houses: Array.from({ length: 6 }, () => Array(6).fill(1)),
    };
    intersectionPuzzle.houses[2][2] = 0;
    intersectionPuzzle.houses[2][4] = 0;
    const board = Array.from({ length: 6 }, () => Array(6).fill("empty"));

    const hint = findHint(intersectionPuzzle, board);

    assert.equal(hint.kind, "locked-intersection");
    assert.match(hint.message, /House 1 reserves Row 3's remaining star/);
    assert.deepEqual(hint.cells, [
      { row: 2, col: 2, color: "gray" },
      { row: 2, col: 4, color: "gray" },
      { row: 2, col: 0, color: "blue" },
    ]);
    assert.deepEqual(hint.moves, [{ row: 2, col: 0, state: "mark" }]);
  });

  it("reserves a column's remaining capacity for a house intersection", () => {
    const intersectionPuzzle = {
      size: 6,
      starsPerUnit: 1,
      houses: Array.from({ length: 6 }, () => Array(6).fill(1)),
    };
    intersectionPuzzle.houses[2][2] = 0;
    intersectionPuzzle.houses[4][2] = 0;
    const board = Array.from({ length: 6 }, () => Array(6).fill("empty"));

    const hint = findHint(intersectionPuzzle, board);

    assert.equal(hint.kind, "locked-intersection");
    assert.match(hint.message, /House 1 reserves Column 3's remaining star/);
    assert.deepEqual(hint.cells, [
      { row: 2, col: 2, color: "gray" },
      { row: 4, col: 2, color: "gray" },
      { row: 0, col: 2, color: "blue" },
    ]);
    assert.deepEqual(hint.moves, [{ row: 0, col: 2, state: "mark" }]);
  });

  it("combines two houses to reserve the remaining capacity of two rows", () => {
    const capacityPuzzle = {
      size: 6,
      starsPerUnit: 1,
      houses: Array.from({ length: 6 }, () => Array(6).fill(2)),
    };
    capacityPuzzle.houses[1][0] = 0;
    capacityPuzzle.houses[4][3] = 0;
    capacityPuzzle.houses[1][5] = 1;
    capacityPuzzle.houses[4][2] = 1;
    const board = Array.from({ length: 6 }, () => Array(6).fill("empty"));

    const hint = findHint(capacityPuzzle, board);

    assert.equal(hint.kind, "multi-unit-capacity");
    assert.match(hint.message, /House 1 and House 2/);
    assert.match(hint.message, /Row 2 and Row 5/);
    assert.deepEqual(hint.cells, [
      { row: 1, col: 0, color: "gray" },
      { row: 1, col: 5, color: "gray" },
      { row: 4, col: 2, color: "gray" },
      { row: 4, col: 3, color: "gray" },
      { row: 1, col: 1, color: "blue" },
    ]);
    assert.deepEqual(hint.unitCells, [
      { row: 1, col: 0 },
      { row: 4, col: 3 },
      { row: 1, col: 5 },
      { row: 4, col: 2 },
    ]);
    assert.deepEqual(hint.moves, [{ row: 1, col: 1, state: "mark" }]);
  });

  it("combines three houses to reserve the remaining capacity of three rows", () => {
    const capacityPuzzle = {
      size: 8,
      starsPerUnit: 1,
      houses: Array.from({ length: 8 }, () => Array(8).fill(3)),
    };
    [
      [1, 0, 0], [3, 3, 0], [5, 6, 0],
      [1, 3, 1], [3, 6, 1], [5, 0, 1],
      [1, 6, 2], [3, 0, 2], [5, 3, 2],
    ].forEach(([row, col, house]) => {
      capacityPuzzle.houses[row][col] = house;
    });
    const board = Array.from({ length: 8 }, () => Array(8).fill("empty"));

    const hint = findHint(capacityPuzzle, board);

    assert.equal(hint.kind, "triple-unit-capacity");
    assert.match(hint.message, /House 1, House 2, and House 3/);
    assert.match(hint.message, /Row 2, Row 4, and Row 6/);
    assert.deepEqual(hint.cells, [
      { row: 1, col: 0, color: "gray" },
      { row: 1, col: 3, color: "gray" },
      { row: 1, col: 6, color: "gray" },
      { row: 3, col: 0, color: "gray" },
      { row: 3, col: 3, color: "gray" },
      { row: 3, col: 6, color: "gray" },
      { row: 5, col: 0, color: "gray" },
      { row: 5, col: 3, color: "gray" },
      { row: 5, col: 6, color: "gray" },
      { row: 1, col: 1, color: "blue" },
    ]);
    assert.equal(hint.unitCells.length, 9);
    assert.deepEqual(hint.moves, [{ row: 1, col: 1, state: "mark" }]);
  });

  it("rejects an assumption only after its forced consequences create a contradiction", () => {
    const propagationPuzzle = {
      size: 9,
      starsPerUnit: 2,
      houses: [
        [8, 8, 8, 7, 7, 7, 7, 6, 6],
        [8, 8, 8, 8, 1, 1, 7, 1, 6],
        [8, 8, 8, 8, 1, 1, 1, 1, 6],
        [3, 3, 3, 8, 8, 1, 0, 1, 6],
        [3, 3, 3, 8, 4, 4, 0, 1, 1],
        [5, 5, 8, 8, 4, 4, 0, 1, 1],
        [5, 4, 4, 4, 4, 0, 0, 2, 2],
        [5, 5, 4, 2, 2, 2, 2, 2, 2],
        [5, 5, 4, 4, 4, 4, 2, 2, 2],
      ],
    };
    const board = [
      ["empty", "empty", "empty", "empty", "empty", "empty", "empty", "empty", "empty"],
      ["empty", "empty", "empty", "mark", "mark", "mark", "empty", "mark", "empty"],
      ["empty", "empty", "empty", "empty", "empty", "empty", "empty", "mark", "empty"],
      ["empty", "mark", "empty", "mark", "empty", "mark", "empty", "mark", "empty"],
      ["empty", "mark", "empty", "mark", "empty", "mark", "empty", "mark", "empty"],
      ["empty", "empty", "empty", "empty", "empty", "mark", "empty", "empty", "empty"],
      ["empty", "mark", "empty", "empty", "empty", "empty", "empty", "empty", "empty"],
      ["empty", "empty", "empty", "empty", "empty", "empty", "empty", "empty", "empty"],
      ["empty", "empty", "empty", "empty", "empty", "empty", "empty", "empty", "empty"],
    ];

    const hint = findHint(propagationPuzzle, board);

    assert.equal(hint.kind, "shallow-propagation");
    assert.match(hint.message, /Suppose the purple star in the blue space were real/);
    assert.match(hint.message, /House 8 would have no valid way/);
    assert.deepEqual(hint.assumption, { row: 0, col: 7, state: "star" });
    assert.deepEqual(hint.moves, [{ row: 0, col: 7, state: "mark" }]);
    assert.ok(hint.cells.some((cell) => cell.color === "gray" && cell.previewState === "star"));
    assert.ok(hint.cells.some((cell) => cell.color === "gray" && cell.previewState === "mark"));
    assert.ok(hint.cells.some((cell) => cell.color === "red"));
    assert.deepEqual(hint.cells.at(-1), { row: 0, col: 7, color: "blue" });

    const applied = applyHint(board, hint);
    assert.equal(applied[0][7], "mark");
    assert.equal(board[0][7], "empty");
  });

  it("marks an outside cell that touches every option in a locked star group", () => {
    const lockedHousePuzzle = {
      size: 6,
      starsPerUnit: 1,
      houses: Array.from({ length: 6 }, () => Array(6).fill(1)),
    };
    lockedHousePuzzle.houses[2][2] = 0;
    lockedHousePuzzle.houses[3][3] = 0;
    const board = Array.from({ length: 6 }, () => Array(6).fill("empty"));

    const hint = findHint(lockedHousePuzzle, board);

    assert.equal(hint.kind, "locked-star-group");
    assert.match(hint.message, /^House 1 must contain a star in one of the gray spaces/);
    assert.deepEqual(hint.cells, [
      { row: 2, col: 2, color: "gray" },
      { row: 3, col: 3, color: "gray" },
      { row: 2, col: 3, color: "blue" },
    ]);
    assert.deepEqual(hint.moves, [{ row: 2, col: 3, state: "mark" }]);
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

describe("findSoftHint", () => {
  it("reports a board error before offering a solving technique", () => {
    const board = emptyBoard();
    board[0][0] = "mark";
    const solution = [
      { row: 0, col: 0 }, { row: 0, col: 2 },
      { row: 1, col: 1 }, { row: 1, col: 3 },
    ];

    const hint = findSoftHint(puzzle, board, solution);

    assert.equal(hint.kind, "board-error");
    assert.equal(hint.title, "Board Error");
    assert.equal(hint.stages[0].message, "There is an error somewhere on the board.");
    assert.equal(hint.stages[1].message, "The error is somewhere in Row 1.");
    assert.deepEqual(hint.stages[2].cells, [{ row: 0, col: 0, color: "red" }]);
    assert.match(hint.stages[2].message, /must contain a star/);
  });

  it("reveals a named technique, then its location, then the full deduction", () => {
    const board = emptyBoard();
    board[0][0] = "star";

    const hint = findSoftHint(puzzle, board);

    assert.equal(hint.title, "Star Halo");
    assert.equal(hint.stages.length, 3);
    assert.match(hint.stages[0].message, /missing Xs around a star/);
    assert.deepEqual(hint.stages[0].cells, []);
    assert.deepEqual(hint.stages[1].cells, [{ row: 0, col: 0, color: "gold" }]);
    assert.match(hint.stages[2].message, /surrounded by Xs/);
    assert.ok(hint.stages[2].cells.some((cell) => cell.color === "blue"));
    assert.equal(hint.stages[2].moves, undefined, "soft hints never apply moves");
  });

  it("names a forced star technique Only Place", () => {
    const rowPuzzle = {
      size: 8,
      starsPerUnit: 2,
      houses: Array.from({ length: 8 }, (_, row) => Array(8).fill(row)),
    };
    const board = Array.from({ length: 8 }, () => Array(8).fill("empty"));
    board[0] = ["mark", "empty", "mark", "mark", "mark", "empty", "mark", "mark"];

    const hint = findSoftHint(rowPuzzle, board);

    assert.equal(hint.title, "Only Place");
    assert.match(hint.stages[0].message, /only one valid location/);
    assert.equal(hint.stages[1].message, "Look closely at Row 1.");
  });
});

describe("analyzeDifficulty", () => {
  it("codifies techniques in strict simplest-first order", () => {
    assert.deepEqual(
      techniques.map(({ kind }) => kind),
      [
        "rule-conflict",
        "surround-star",
        "complete-unit",
        "forced-star",
        "locked-intersection",
        "locked-star-group",
        "impossible-star",
        "multi-unit-capacity",
        "triple-unit-capacity",
        "shallow-propagation",
      ],
    );
    assert.deepEqual(
      techniques.map(({ weight }) => weight),
      [...techniques.map(({ weight }) => weight)].sort((left, right) => left - right),
    );
  });

  it("records every logical move and rates an obvious board Easy", async () => {
    const progress = [];
    const report = await analyzeDifficulty(
      { size: 1, starsPerUnit: 1, houses: [[0]] },
      { onProgress: (update) => progress.push(update) },
    );

    assert.equal(report.solved, true);
    assert.equal(report.label, "Easy");
    assert.equal(report.bigTicketCount, 0);
    assert.deepEqual(report.steps, [{
      number: 1,
      kind: "forced-star",
      title: "Only Place",
      tier: "Basic",
      weight: 0,
      bigTicket: false,
      message: "Every valid way to fit the remaining star in Row 1 uses the gold space. Add a star there.",
      moves: [{ row: 0, col: 0, state: "star" }],
    }]);
    assert.ok(progress.some(({ technique }) => technique === "Only Place"));
  });
});
