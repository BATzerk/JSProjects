import type { Puzzle } from "./types.ts";

export const starterPuzzle: Puzzle = {
  id: "codex-starter-8x8",
  title: "First Light",
  size: 8,
  starsPerUnit: 2,
  houses: [
    [4, 4, 4, 5, 5, 5, 6, 6],
    [4, 4, 4, 5, 5, 5, 6, 6],
    [3, 3, 5, 5, 1, 1, 6, 6],
    [3, 3, 5, 0, 1, 1, 1, 7],
    [3, 2, 5, 0, 1, 1, 1, 7],
    [3, 2, 2, 0, 0, 0, 7, 7],
    [3, 3, 2, 2, 0, 0, 7, 7],
    [3, 3, 2, 2, 0, 0, 7, 7],
  ],
};
