import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("browser loading contract", () => {
  it("keeps the game directly openable without ES module loading", async () => {
    const index = await readFile(new URL("../../index.html", import.meta.url), "utf8");
    const engine = await readFile(new URL("./engine.js", import.meta.url), "utf8");
    // The browser app is split across ordered classic scripts; app-state.js
    // declares shared state first and app-actions.js runs the boot call last.
    const appFiles = ["app-state", "app-view", "app-cells", "app-board", "app-actions"];
    const appPositions = appFiles.map((name) =>
      index.indexOf(`src="./src/app/${name}.js"`),
    );
    const appFirstPosition = appPositions[0];
    const appLastPosition = appPositions[appPositions.length - 1];
    const appView = await readFile(new URL("../app/app-view.js", import.meta.url), "utf8");
    const enginePosition = index.indexOf('src="./src/game/engine.js"');
    const serializationPosition = index.indexOf('src="./src/game/serialization.js"');
    // The hint runtime is split across ordered classic scripts; the registry
    // (technique table + StarsRemixHints export) must load last, after every
    // strategy function it references is defined.
    const hintFiles = [
      "core",
      "strategies-basic",
      "strategies-advanced",
      "difficulty",
      "registry",
    ];
    const hintPositions = hintFiles.map((name) =>
      index.indexOf(`src="./src/game/hints/${name}.js"`),
    );
    const hintsFirstPosition = hintPositions[0];
    const hintsRegistryPosition = hintPositions[hintPositions.length - 1];

    assert.ok(enginePosition >= 0, "index.html must load the engine runtime");
    assert.ok(serializationPosition >= 0, "index.html must load the serialization runtime");
    hintPositions.forEach((position, slot) => {
      assert.ok(position >= 0, `index.html must load hints/${hintFiles[slot]}.js`);
      if (slot > 0) {
        assert.ok(position > hintPositions[slot - 1], `hints/${hintFiles[slot]}.js must load after the previous hint file`);
      }
    });
    appPositions.forEach((position, slot) => {
      assert.ok(position >= 0, `index.html must load app/${appFiles[slot]}.js`);
      if (slot > 0) {
        assert.ok(position > appPositions[slot - 1], `app/${appFiles[slot]}.js must load after the previous app file`);
      }
    });
    assert.ok(hintsFirstPosition > serializationPosition, "serialization must load before the hint runtime");
    assert.ok(appFirstPosition > hintsRegistryPosition, "hint runtime must load before the app");
    assert.ok(appFirstPosition > enginePosition, "engine runtime must load before the app");
    assert.ok(appLastPosition > appFirstPosition, "app boot script must load last");
    assert.doesNotMatch(index, /<script[^>]+type=["']module["']/i);
    assert.doesNotMatch(engine, /^\s*import\s/m);
    assert.doesNotMatch(engine, /^\s*export\s/m);
    // The split hint files must stay classic scripts (no ES module syntax).
    for (const name of hintFiles) {
      const source = await readFile(new URL(`./hints/${name}.js`, import.meta.url), "utf8");
      assert.doesNotMatch(source, /^\s*import\s/m, `hints/${name}.js must not use ES imports`);
      assert.doesNotMatch(source, /^\s*export\s/m, `hints/${name}.js must not use ES exports`);
    }
    // The split app files must stay classic scripts (no ES module syntax).
    for (const name of appFiles) {
      const source = await readFile(new URL(`../app/${name}.js`, import.meta.url), "utf8");
      assert.doesNotMatch(source, /^\s*import\s/m, `app/${name}.js must not use ES imports`);
      assert.doesNotMatch(source, /^\s*export\s/m, `app/${name}.js must not use ES exports`);
    }
    assert.match(appView, /StarsRemixHints\.findHint\(puzzle, board\)/);
    assert.doesNotMatch(appView, /StarsRemixHints\.findHint\(puzzle, board, solution\)/);
  });
});

declare global {
  // Runtime namespace shared by the classic browser script and Node tests.
  var StarsRemixHints: {
    findHint: (puzzle: any, board: string[][]) => any;
    applyHint: (board: string[][], hint: any) => string[][];
  };
  // Shared puzzle engine: board, rules, solver, and generation domain.
  var StarsRemixEngine: any;
}
