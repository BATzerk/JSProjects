// Part of the StarsRemix browser app (classic script, no build step).
// Cell rendering and hint-message formatting (the board grid view).
// These app/*.js files were one IIFE; they now share top-level state and
// functions through the global (lexical) scope of classic scripts. Load
// order is fixed in index.html; app-actions.js runs the boot call last.

function renderCells(conflictKeys, hintColors, hintUnits, hintPreviewStates, hintAssumption) {
  return board
    .map((row, rowIndex) =>
      row
        .map((cell, colIndex) => {
          const houseId = puzzle.houses[rowIndex][colIndex];
          const hasConflict = conflictKeys.has(getStarKey({ row: rowIndex, col: colIndex }));
          const position = { row: rowIndex, col: colIndex };
          const positionKey = getStarKey(position);
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
            ...hintUnitEdges,
            hintColor ? `hint-${hintColor}` : "",
          ]
            .filter(Boolean)
            .join(" ");
          const borders = getBorderStyle(puzzle.houses, rowIndex, colIndex);
          const content = renderCellContent(cell, hintColor, hintPreviewState, assumptionState);
          const debugSolution = solution.some((position) =>
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

function renderCellContent(cell, hintColor, hintPreviewState, assumptionState) {
  if (cell === "star") {
    return renderStarToken();
  }

  if (cell === "empty" && assumptionState === "star") {
    return renderStarToken("hint-assumption-star");
  }

  if (cell === "empty" && assumptionState === "mark") {
    return '<span class="mark-token hint-assumption-mark" aria-hidden="true">×</span>';
  }

  if (cell === "empty" && hintPreviewState === "star") {
    return renderStarToken("hint-ghost-star hint-preview-star");
  }

  if (cell === "empty" && hintPreviewState === "mark") {
    return '<span class="mark-token hint-preview-mark" aria-hidden="true">×</span>';
  }

  if (cell === "empty" && hintColor === "gray") {
    return renderStarToken("hint-ghost-star");
  }

  if (cell === "mark") {
    return '<span class="mark-token" aria-hidden="true">×</span>';
  }

  return "";
}

function renderStarToken(extraClass = "") {
  return `
      <svg class="star-token${extraClass ? ` ${extraClass}` : ""}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="star-shine" cx="40%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#ffd447" />
            <stop offset="88%" stop-color="#ffd447" />
            <stop offset="100%" stop-color="#e5a512" />
          </radialGradient>
        </defs>
        <path class="star-body" d="M50 8 C54 8 57 30 61 34 C65 38 88 33 90 37 C92 41 72 53 70 58 C68 64 82 82 78 86 C75 90 57 76 50 76 C43 76 25 90 22 86 C18 82 32 64 30 58 C28 53 8 41 10 37 C12 33 35 38 39 34 C43 30 46 8 50 8 Z" />
        <path class="star-highlight" d="M40 30 C43 25 47 22 49 23 C50 24 47 28 44 31 C42 33 39 34 38 33 C37 32 38 31 40 30 Z" />
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
  return getUnits(puzzle)
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


