import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./engine.js";

const {
  isHouseConnected,
  validatePuzzleShape,
  countSolutions,
  generatePuzzle,
  generateSolution,
  createSeededRandom,
  hasThreeCellHouse,
  completePuzzleFromHouses,
  inspectPartialHouses,
  getPaintHouseId,
} = globalThis.StarsRemixEngine;

describe("generatePuzzle", () => {
  it("creates a reproducible, connected puzzle with one solution", () => {
    const first = generatePuzzle({ seed: "first-light-42", maxAttempts: 2_000 });
    const second = generatePuzzle({ seed: "first-light-42", maxAttempts: 2_000 });

    assert.deepEqual(first.puzzle.houses, second.puzzle.houses);
    assert.deepEqual(first.solution, second.solution);
    assert.equal(countSolutions(first.puzzle, 2), 1);
    assert.doesNotThrow(() => validatePuzzleShape(first.puzzle));
    assert.equal(new Set(first.puzzle.houses.flat()).size, first.puzzle.size);
    assert.equal(hasThreeCellHouse(first.puzzle.houses), false);

    for (let house = 0; house < first.puzzle.size; house += 1) {
      assert.equal(isHouseConnected(first.puzzle, house), true);
      assert.equal(
        first.solution.filter(({ row, col }) => first.puzzle.houses[row][col] === house).length,
        first.puzzle.starsPerUnit,
      );
    }
  });

  it("identifies a region containing exactly three cells", () => {
    assert.equal(hasThreeCellHouse([
      [0, 0, 0, 1],
      [2, 2, 1, 1],
      [2, 2, 1, 1],
      [2, 2, 1, 1],
    ]), true);
    assert.equal(hasThreeCellHouse([
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [2, 2, 2, 2],
      [3, 3, 3, 3],
    ]), false);
  });

  it("places the required non-touching stars in every row and column", () => {
    const { puzzle, solution } = generatePuzzle({ seed: "constraint-check", maxAttempts: 2_000 });
    const keys = new Set(solution.map(({ row, col }) => `${row}:${col}`));

    for (let index = 0; index < puzzle.size; index += 1) {
      assert.equal(solution.filter(({ row }) => row === index).length, puzzle.starsPerUnit);
      assert.equal(solution.filter(({ col }) => col === index).length, puzzle.starsPerUnit);
    }
    for (const { row, col } of solution) {
      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
          if (rowOffset !== 0 || colOffset !== 0) {
            assert.equal(keys.has(`${row + rowOffset}:${col + colOffset}`), false);
          }
        }
      }
    }
  });

  it("does not collapse different seeds into a small set of repeated star patterns", () => {
    const layouts = new Set<string>();

    for (let index = 0; index < 12; index += 1) {
      const solution = generateSolution(10, 2, createSeededRandom(`variety-${index}`));
      assert.ok(solution);
      layouts.add(solution.map(({ row, col }) => `${row}:${col}`).join("|"));
    }

    assert.ok(layouts.size >= 10, `Expected at least 10 distinct layouts; found ${layouts.size}.`);
  });

  it("uses a roomy default board and rejects predictable 8 by 8 generation", () => {
    assert.equal(generatePuzzle({ seed: "room-to-wander" }).puzzle.size, 9);
    assert.throws(
      () => generatePuzzle({ size: 8, seed: "too-tight" }),
      /at least 9 rows and columns/,
    );
  });

  it("supports the available board sizes", () => {
    for (const size of [9, 10]) {
      const starsPerUnit = 2;
      const generated = generatePuzzle({
        size,
        starsPerUnit,
        seed: `size-${size}`,
        maxAttempts: 2_000,
      });
      assert.equal(generated.puzzle.size, size);
      assert.equal(generated.puzzle.starsPerUnit, starsPerUnit);
      assert.equal(countSolutions(generated.puzzle, 2), 1);
    }
  });

  it("can place a varied, valid constellation on an 11 by 11 board", () => {
    const solution = generateSolution(11, 2, createSeededRandom("eleven-stars"));
    assert.ok(solution);
    assert.equal(solution.length, 22);

    for (let index = 0; index < 11; index += 1) {
      assert.equal(solution.filter(({ row }) => row === index).length, 2);
      assert.equal(solution.filter(({ col }) => col === index).length, 2);
    }
  });
});

describe("completePuzzleFromHouses", () => {
  it("selects house colors the same way as consecutive editor strokes", () => {
    const houses = Array.from({ length: 9 }, () => Array(9).fill(-1));
    assert.equal(getPaintHouseId(houses, 0, 0), 0);
    houses[0][0] = 0;
    houses[0][1] = 0;
    assert.equal(getPaintHouseId(houses, 2, 2), 1, "a new blank stroke uses the next unused house");
    assert.equal(getPaintHouseId(houses, 0, 0), 0, "starting on a painted house extends that house");

    for (let house = 1; house < 9; house += 1) houses[house][0] = house;
    assert.equal(getPaintHouseId(houses, 8, 8), -1, "blank painting stops after every house is used");
  });

  it("completes a blank editor board with a unique puzzle", () => {
    const blank = Array.from({ length: 9 }, () => Array(9).fill(-1));
    const generated = completePuzzleFromHouses(blank, {
      seed: "blank-editor-board",
      maxAttempts: 2_000,
    });

    assert.equal(countSolutions(generated.puzzle, 2), 1);
    assert.doesNotThrow(() => validatePuzzleShape(generated.puzzle));
    assert.equal(generated.solution.length, 18);
  });

  it("preserves a painted house exactly while generating the others", () => {
    const partial = Array.from({ length: 9 }, (_, row) =>
      Array(9).fill(row === 0 ? 0 : -1),
    );
    const generated = completePuzzleFromHouses(partial, {
      seed: "locked-painted-house",
      maxAttempts: 2_000,
    });

    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        assert.equal(generated.puzzle.houses[row][col] === 0, partial[row][col] === 0);
      }
    }
    assert.equal(countSolutions(generated.puzzle, 2), 1);
  });

  it("rejects disconnected painted houses", () => {
    const partial = Array.from({ length: 9 }, () => Array(9).fill(-1));
    partial[0][0] = 0;
    partial[0][2] = 0;
    assert.throws(
      () => completePuzzleFromHouses(partial, { seed: "disconnected" }),
      /split into separate pieces/,
    );
  });

  it("explains when a painted house fits entirely within a 2 by 2 area", () => {
    const partial = Array.from({ length: 9 }, () => Array(9).fill(-1));
    partial[0][0] = 0;
    partial[0][1] = 0;

    const inspection = inspectPartialHouses(partial);
    assert.equal(inspection.valid, false);
    assert.equal(inspection.issues.some((issue) => issue.code === "house-cannot-fit-stars"), true);
    assert.match(inspection.issues.find((issue) => issue.code === "house-cannot-fit-stars").message, /within a 2×2 area/);
  });

  it("accepts a straight three-tile house but rejects an L-shaped one", () => {
    const straight = Array.from({ length: 9 }, () => Array(9).fill(-1));
    straight[0][0] = 0;
    straight[0][1] = 0;
    straight[0][2] = 0;

    const straightInspection = inspectPartialHouses(straight);
    assert.equal(straightInspection.valid, true);
    const completed = completePuzzleFromHouses(straight, {
      seed: "straight-three-painted-house",
      maxAttempts: 2_000,
    });
    assert.equal(completed.puzzle.houses.flat().filter((house) => house === 0).length, 3);
    assert.deepEqual(
      completed.solution.filter(({ row, col }) => completed.puzzle.houses[row][col] === 0),
      [{ row: 0, col: 0 }, { row: 0, col: 2 }],
    );

    const bent = Array.from({ length: 9 }, () => Array(9).fill(-1));
    bent[0][0] = 0;
    bent[0][1] = 0;
    bent[1][0] = 0;

    const bentInspection = inspectPartialHouses(bent);
    assert.equal(bentInspection.valid, false);
    assert.equal(bentInspection.issues.some((issue) => issue.code === "house-cannot-fit-stars"), true);
  });

  it("identifies a trapped blank pocket and its location", () => {
    const partial = Array.from({ length: 9 }, () => Array(9).fill(0));
    partial[8][7] = -1;
    partial[8][8] = -1;

    const inspection = inspectPartialHouses(partial);
    const pocketIssue = inspection.issues.find((issue) => issue.code === "blank-pocket-cannot-fit-stars");
    assert.ok(pocketIssue);
    assert.match(pocketIssue.message, /row 9, columns 8–9/);
    assert.match(pocketIssue.message, /within a 2×2 area/);
  });

  it("rejects a trapped blank 2 by 2 pocket", () => {
    const partial = Array.from({ length: 9 }, () => Array(9).fill(0));
    partial[7][7] = -1;
    partial[7][8] = -1;
    partial[8][7] = -1;
    partial[8][8] = -1;

    const inspection = inspectPartialHouses(partial);
    const pocketIssue = inspection.issues.find((issue) => issue.code === "blank-pocket-cannot-fit-stars");
    assert.ok(pocketIssue);
    assert.match(pocketIssue.message, /rows 8–9, columns 8–9/);
  });

  it("explains when a huge painted house would force too many stars", () => {
    const partial = Array.from({ length: 9 }, (_, row) =>
      Array(9).fill(row < 5 ? 0 : -1),
    );
    const inspection = inspectPartialHouses(partial);
    const issue = inspection.issues.find((candidate) => candidate.code === "house-forces-too-many-stars");
    assert.ok(issue);
    assert.match(issue.message, /forced to contain at least 10 stars/);
    assert.match(issue.message, /exactly 2/);
  });
});
