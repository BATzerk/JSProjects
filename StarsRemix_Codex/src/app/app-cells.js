// Part of the StarsRemix browser app (classic script, no build step).
// Cell rendering and hint-message formatting (the board grid view).
// These app/*.js files were one IIFE; they now share top-level state and
// functions through the global (lexical) scope of classic scripts. Load
// order is fixed in index.html; app-actions.js runs the boot call last.

function renderCells(conflictKeys, hintColors, hintUnits, hintPreviewStates, hintAssumption) {
  return gameState.progress.board
    .map((row, rowIndex) =>
      row
        .map((cell, colIndex) => {
          const houseId = gameState.puzzle.houses[rowIndex][colIndex];
          const hasConflict = conflictKeys.has(getStarKey({ row: rowIndex, col: colIndex }));
          const position = { row: rowIndex, col: colIndex };
          const positionKey = getStarKey(position);
          const isTokenEntering = enteringTokenKeys.has(positionKey);
          const tokenPoofDelay = poofingTokenDelays.get(positionKey);
          const hintColor = hintColors.get(positionKey);
          const hintPreviewState = hintPreviewStates.get(positionKey);
          const assumptionState = hintAssumption && getStarKey(hintAssumption) === positionKey
            ? hintAssumption.state
            : null;
          const hintUnitEdges = getHintUnitEdgeClasses(rowIndex, colIndex, hintUnits);
          const classes = [
            "cell",
            cell !== "empty" ? `is-${cell}` : "",
            hasConflict ? "has-conflict" : "",
            isTokenEntering ? "token-entering" : "",
            ...hintUnitEdges,
            hintColor ? `hint-${hintColor}` : "",
          ]
            .filter(Boolean)
            .join(" ");
          const borders = getBorderStyle(gameState.puzzle.houses, rowIndex, colIndex);
          const content = `${renderCellContent(cell, hintColor, hintPreviewState, assumptionState)}${tokenPoofDelay !== undefined ? renderPoofBurst(tokenPoofDelay) : ""}`;
          const debugSolution = gameState.solution.some((position) =>
            position.row === rowIndex && position.col === colIndex,
          ) ? '<span class="debug-solution-star" aria-hidden="true">✦</span>' : "";

          return `
            <button
              class="${classes}"
              type="button"
              role="gridcell"
              aria-label="Row ${rowIndex + 1}, column ${colIndex + 1}, house ${houseId + 1}"
              data-row="${rowIndex}"
              data-col="${colIndex}"
              style="background-color: ${useHouseColors ? housePalette[houseId % housePalette.length] : "#ffffff"}; ${borders}"
            >${debugSolution}${content}</button>
          `;
        })
        .join(""),
    )
    .join("");
}

function renderPoofBurst(burstDelay) {
  return `
    <span class="poof-burst" aria-hidden="true">
      ${[
        [-18, -22], [4, -27], [23, -13], [25, 11],
        [8, 26], [-15, 24], [-27, 4], [-25, -15],
      ].map(([x, y], index) =>
        `<span class="poof-particle" style="--poof-x: ${x}px; --poof-y: ${y}px; --poof-delay: ${burstDelay + (index * 12)}ms"></span>`,
      ).join("")}
    </span>
  `;
}

function renderCellContent(cell, hintColor, hintPreviewState, assumptionState) {
  if (cell === "star") {
    return renderStarToken();
  }

  if (cell === "empty" && assumptionState === "star") {
    return renderStarToken("hint-assumption-star");
  }

  if (cell === "empty" && assumptionState === "mark") {
    return renderMarkToken("hint-assumption-mark");
  }

  if (cell === "empty" && hintPreviewState === "star") {
    return renderStarToken("hint-ghost-star hint-preview-star");
  }

  if (cell === "empty" && hintPreviewState === "mark") {
    return renderMarkToken("hint-preview-mark");
  }

  if (cell === "empty" && hintColor === "gray") {
    return renderStarToken("hint-ghost-star");
  }

  if (cell === "mark") {
    return renderMarkToken();
  }

  return "";
}

function renderStarToken(extraClass = "") {
  return `<img class="star-token${extraClass ? ` ${extraClass}` : ""}" src="./public/assets/star.png" alt="" aria-hidden="true" draggable="false" />`;
}

function renderMarkToken(extraClass = "") {
  return `
    <svg class="mark-token${extraClass ? ` ${extraClass}` : ""}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path d="M14 14 L86 86 M86 14 L14 86" />
    </svg>
  `;
}

function formatHintMessage(message) {
  return escapeHtml(message)
    .replaceAll("marked spaces", '<strong class="hint-star-text">marked spaces</strong>')
    .replace(/blue spaces?/g, (phrase) => `<strong class="hint-blue-text">${phrase}</strong>`)
    .replace(/\b(?:Row|Column|House) \d+\b/g, (label) =>
      `<strong class="hint-unit-text">${label}</strong>`);
}

function getMentionedHintUnits(message) {
  const labels = new Set(message.match(/\b(?:Row|Column|House) \d+\b/g) ?? []);
  return getUnits(gameState.puzzle)
    .filter((unit) => labels.has(unit.label))
    .map((unit) => ({ ...unit, cellKeys: new Set(unit.cells.map(getStarKey)) }));
}

function getHintUnitEdgeClasses(row, col, hintUnits) {
  const cellKey = getStarKey({ row, col });
  const edges = new Set();
  const directions = [
    ["top", -1, 0],
    ["right", 0, 1],
    ["bottom", 1, 0],
    ["left", 0, -1],
  ];

  hintUnits.forEach((unit) => {
    if (!unit.cellKeys.has(cellKey)) return;
    directions.forEach(([edge, rowOffset, colOffset]) => {
      const neighborKey = getStarKey({ row: row + rowOffset, col: col + colOffset });
      if (!unit.cellKeys.has(neighborKey)) edges.add(`hint-unit-${edge}`);
    });
  });

  return [...edges];
}
