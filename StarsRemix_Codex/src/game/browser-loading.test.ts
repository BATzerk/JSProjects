import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("browser loading contract", () => {
  it("keeps the game directly openable without ES module loading", async () => {
    const index = await readFile(new URL("../../index.html", import.meta.url), "utf8");
    const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
    const hintsPosition = index.indexOf('src="./src/game/hints.js"');
    const appPosition = index.indexOf('src="./src/app.js"');

    assert.ok(hintsPosition >= 0, "index.html must load the hint runtime");
    assert.ok(appPosition > hintsPosition, "hint runtime must load before app.js");
    assert.doesNotMatch(index, /<script[^>]+type=["']module["']/i);
    assert.doesNotMatch(app, /^\s*import\s/m);
    assert.match(app, /StarsRemixHints\.findHint\(puzzle, board\)/);
    assert.doesNotMatch(app, /StarsRemixHints\.findHint\(puzzle, board, solution\)/);
  });
});

declare global {
  // Runtime namespace shared by the classic browser script and Node tests.
  var StarsRemixHints: {
    findHint: (puzzle: any, board: string[][]) => any;
  };
}
