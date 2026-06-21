import { validatePuzzleShape } from "../puzzle.ts";
import { countSolutions } from "../solver.ts";
import type { Puzzle } from "../types.ts";
import { generateHouses } from "./generate-houses.ts";
import { generateSolution } from "./generate-solution.ts";
import { createSeededRandom } from "./random.ts";
import type { GeneratedPuzzle, GenerationDiagnostics, GeneratorConfig } from "./types.ts";

export function generatePuzzle(config: GeneratorConfig = {}): GeneratedPuzzle {
  const size = config.size ?? 10;
  const starsPerUnit = config.starsPerUnit ?? 2;
  const maxAttempts = config.maxAttempts ?? 1_000;
  const seed = String(config.seed ?? `${Date.now()}-${Math.random()}`);
  const random = createSeededRandom(seed);
  const diagnostics: GenerationDiagnostics = {
    seed,
    attempts: 0,
    rejectedSolutions: 0,
    rejectedHouseLayouts: 0,
    rejectedNonUnique: 0,
  };

  if (!Number.isInteger(size) || !Number.isInteger(starsPerUnit) || size <= 0 || starsPerUnit <= 0) {
    throw new Error("Generator dimensions must be positive integers.");
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
    throw new Error("Maximum attempts must be a positive integer.");
  }
  if (starsPerUnit !== 2) {
    throw new Error("This ruleset requires exactly two stars per unit.");
  }
  if (size < 9) {
    throw new Error(
      "Random two-star boards require at least 9 rows and columns to avoid predictable maximum-density layouts.",
    );
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    diagnostics.attempts = attempt;
    const solution = generateSolution(size, starsPerUnit, random);
    if (!solution) {
      diagnostics.rejectedSolutions += 1;
      continue;
    }

    const houses = generateHouses(
      size,
      solution,
      random,
      config.houseAttemptsPerSolution ?? 100,
      starsPerUnit,
    );
    if (!houses) {
      diagnostics.rejectedHouseLayouts += 1;
      continue;
    }

    const puzzle: Puzzle = {
      id: `generated-${slug(seed)}-${attempt}`,
      title: config.title ?? "Random Constellation",
      size,
      starsPerUnit,
      houses,
    };
    validatePuzzleShape(puzzle);
    if (countSolutions(puzzle, 2) !== 1) {
      diagnostics.rejectedNonUnique += 1;
      continue;
    }
    return { puzzle, solution, diagnostics: { ...diagnostics } };
  }

  throw new Error(
    `Unable to generate a unique puzzle after ${maxAttempts} attempts (seed ${seed}).`,
  );
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "seed";
}
