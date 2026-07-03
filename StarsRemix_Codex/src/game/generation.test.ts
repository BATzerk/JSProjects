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
