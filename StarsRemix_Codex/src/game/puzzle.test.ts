import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { starterPuzzle } from "./puzzles.ts";
import "./engine.js";

const { validatePuzzleShape } = globalThis.StarsRemixEngine;

describe("validatePuzzleShape", () => {
  it("accepts the valid starter puzzle", () => {
    assert.doesNotThrow(() => validatePuzzleShape(starterPuzzle));
  });

  it("rejects a puzzle with the wrong number of houses", () => {
    const houses = starterPuzzle.houses.map((row) => row.map(() => 0));
    assert.throws(
      () => validatePuzzleShape({ ...starterPuzzle, houses }),
      /exactly 8 houses/,
    );
  });
});
