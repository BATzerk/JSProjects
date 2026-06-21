import type { Position, Puzzle } from "../types.ts";

export type RandomSource = {
  next(): number;
};

export type GeneratorConfig = {
  size?: number;
  starsPerUnit?: number;
  seed?: string | number;
  maxAttempts?: number;
  houseAttemptsPerSolution?: number;
  title?: string;
};

export type GenerationDiagnostics = {
  seed: string;
  attempts: number;
  rejectedSolutions: number;
  rejectedHouseLayouts: number;
  rejectedNonUnique: number;
};

export type GeneratedPuzzle = {
  puzzle: Puzzle;
  solution: Position[];
  diagnostics: GenerationDiagnostics;
};
