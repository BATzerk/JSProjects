import type { Puzzle } from "./types.ts";

export const starterPuzzle: Puzzle = {
  id: "codex-starter-8x8",
  title: "First Light",
  size: 8,
  starsPerUnit: 2,
  houses: [
    [0, 0, 0, 1, 1, 1, 2, 2],
    [0, 3, 3, 3, 1, 4, 4, 2],
    [0, 3, 5, 3, 1, 4, 2, 2],
    [6, 6, 5, 5, 5, 4, 4, 2],
    [6, 7, 7, 5, 8, 8, 4, 9],
    [6, 6, 7, 7, 8, 10, 10, 9],
    [11, 6, 12, 12, 8, 8, 10, 9],
    [11, 11, 11, 12, 12, 10, 10, 9],
  ],
};
