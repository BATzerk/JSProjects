(function () {
  const starterPuzzle = {
    id: "codex-starter-10x10",
    title: "First Light",
    size: 10,
    starsPerUnit: 2,
    houses: [
      [0, 0, 0, 0, 1, 1, 2, 2, 2, 2],
      [0, 0, 0, 0, 1, 1, 2, 2, 2, 2],
      [3, 3, 3, 1, 1, 1, 4, 4, 2, 2],
      [3, 3, 3, 1, 1, 1, 4, 4, 4, 5],
      [3, 3, 1, 1, 1, 4, 4, 4, 5, 5],
      [6, 3, 3, 7, 7, 7, 4, 4, 5, 5],
      [6, 6, 3, 7, 8, 7, 7, 5, 5, 9],
      [6, 6, 6, 7, 8, 8, 7, 7, 9, 9],
      [6, 6, 6, 6, 8, 8, 8, 9, 9, 9],
      [6, 6, 6, 6, 8, 8, 9, 9, 9, 9],
    ],
  };
  const starterSolution = [];

  const housePalette = [
    "#fff3eb",
    "#eefaf1",
    "#f5f0ff",
    "#fff9df",
    "#ebf9ff",
    "#fff0f5",
    "#f3fae8",
    "#fff5e8",
    "#f0f4ff",
    "#eefbf7",
    "#fff2ea",
    "#f5faea",
    "#fff0fb",
  ];
  const useHouseColors = false;

  let puzzle = starterPuzzle;
  let solution = starterSolution;
  let selectedBoardSize = puzzle.size;
  let board = createEmptyBoard(puzzle.size);
  let undoStack = [];
  let redoStack = [];
  let isDraggingMarks = false;
  let currentHint = null;
  let currentSoftHint = null;
  let softHintSuccessTimer = null;
  let softHintRemovalTimer = null;
  let currentCheck = null;
  let generationProgress = null;
  let difficultyProgress = null;
  let difficultyReport = null;
  let fileMenuOpen = false;
  let fileNotice = null;

  const root = document.querySelector("#root");

  if (!root) {
    throw new Error("Missing app root.");
  }

  validatePuzzleShape(puzzle);
  render();

  function render() {
    const validation = validateBoard(puzzle, board);
    const conflictKeys = new Set();
    const softHintStage = currentSoftHint && !currentSoftHint.isSatisfied
      ? currentSoftHint.hint.stages[currentSoftHint.stage]
      : null;
    const activeHint = currentHint ?? softHintStage;
    const hintColors = new Map(
      (activeHint?.cells ?? []).map((cell) => [getStarKey(cell), cell.color]),
    );
    const hintPreviewStates = new Map(
      (activeHint?.cells ?? [])
        .filter((cell) => cell.previewState)
        .map((cell) => [getStarKey(cell), cell.previewState]),
    );
    const hintAssumption = activeHint?.assumption ?? null;
    const hintUnits = getMentionedHintUnits(activeHint?.message ?? "");

    validation.conflicts.forEach((conflict) => {
      conflict.cells.forEach((cell) => conflictKeys.add(getStarKey(cell)));
    });

    root.innerHTML = `
      <main class="app-shell">
        <section class="top-bar" aria-label="Puzzle controls">
          <div>
            <p class="brand">StarsRemix - Codex</p>
            <p class="board-title">${escapeHtml(puzzle.title)} · ${puzzle.size}×${puzzle.size} · ${difficultyReport ? escapeHtml(difficultyReport.label) : "Unrated"}</p>
          </div>
          <div class="file-menu">
            <button class="action-button file-menu-button" type="button" data-action="file-menu" aria-expanded="${fileMenuOpen}">Boards</button>
            ${fileMenuOpen ? `
              <div class="file-menu-popover" role="menu" aria-label="Saved boards">
                <button type="button" role="menuitem" data-action="save-board">Save current board…</button>
                <button type="button" role="menuitem" data-action="load-board">Load board file…</button>
              </div>
            ` : ""}
            <input class="board-file-input" type="file" accept=".stars.json,.json,application/json" data-board-file hidden>
          </div>
        </section>

        <section class="play-layout">
          <div class="board-column">
            <div class="history-controls" aria-label="Move history">
              <button class="icon-button" type="button" aria-label="Undo" title="Undo" data-action="undo" ${undoStack.length === 0 ? "disabled" : ""}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4 12l5 5M5 12h8a6 6 0 0 1 6 6" /></svg>
              </button>
              <button class="icon-button" type="button" aria-label="Redo" title="Redo" data-action="redo" ${redoStack.length === 0 ? "disabled" : ""}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 7 5 5-5 5m4-5h-8a6 6 0 0 0-6 6" /></svg>
              </button>
              <button class="action-button soft-hint-button" type="button" data-action="soft-hint" title="Soft Hint (G)">Soft Hint <kbd>G</kbd></button>
              <button class="action-button check-button" type="button" data-action="check">Check</button>
              <button class="action-button hint-button" type="button" data-action="hint">Hint</button>
            </div>
            <div class="board" role="grid" aria-label="${puzzle.size} by ${puzzle.size} star puzzle">
              ${renderCells(conflictKeys, hintColors, hintUnits, hintPreviewStates, hintAssumption)}
            </div>
          </div>

          <div class="board-sidebar">
            <aside class="status-panel" aria-label="Puzzle status">
              ${validation.solved ? '<div class="solved-banner is-visible">Solved</div>' : ""}
              ${currentHint ? `
                <div class="hint-card" role="status" aria-live="polite">
                  <h2>Hint</h2>
                  <p>${formatHintMessage(currentHint.message)}</p>
                  ${currentHint.moves?.length ? '<p class="hint-apply-prompt">Press Hint again to apply.</p>' : ""}
                </div>
              ` : ""}
              ${currentSoftHint ? `
                <div class="hint-card soft-hint-card${currentSoftHint.isSatisfied ? " is-satisfied" : ""}" role="status" aria-live="polite">
                  ${currentSoftHint.isSatisfied ? `
                    <div class="soft-hint-success-icon" aria-hidden="true">✓</div>
                    <div>
                      <p class="hint-kicker">Soft Hint Complete</p>
                      <h2>${escapeHtml(currentSoftHint.hint.title)}</h2>
                      <p class="soft-hint-success-message">That’s exactly the technique.</p>
                    </div>
                  ` : `
                    <p class="hint-kicker">Soft Hint · ${currentSoftHint.stage + 1} of ${currentSoftHint.hint.stages.length}</p>
                    <h2>${escapeHtml(currentSoftHint.hint.title)}</h2>
                    <p>${formatHintMessage(softHintStage.message)}</p>
                    <p class="hint-apply-prompt">${currentSoftHint.stage < currentSoftHint.hint.stages.length - 1 ? "Press G again for a little more." : "That's the full hint — the move is still yours."}</p>
                  `}
                </div>
              ` : ""}
              ${currentCheck ? `
                <div class="check-card ${currentCheck.hasError ? "has-error" : "is-clear"}" role="status" aria-live="polite">
                  <h2>Check</h2>
                  <p>${currentCheck.hasError ? "There is an error somewhere on the board." : "No errors found so far."}</p>
                </div>
              ` : ""}
              ${difficultyReport ? renderDifficultyReport() : ""}
              ${fileNotice ? `<div class="file-notice ${fileNotice.kind}" role="status">${escapeHtml(fileNotice.message)}</div>` : ""}
            </aside>
            <div class="new-board-controls" aria-label="New board controls">
              <div class="size-controls" aria-label="Board size">
                ${[9, 10, 11].map((size) => `
                  <button class="size-button${selectedBoardSize === size ? " is-active" : ""}" type="button" data-size="${size}" aria-pressed="${selectedBoardSize === size}" ${generationProgress ? "disabled" : ""}>${size}×${size}</button>
                `).join("")}
              </div>
              <button class="action-button" type="button" data-action="generate" ${generationProgress ? "disabled" : ""}>new board</button>
              <button class="action-button difficulty-button" type="button" data-action="difficulty" ${generationProgress || difficultyProgress ? "disabled" : ""}>Rate difficulty</button>
              <button class="action-button debug-reveal-button" type="button" data-action="reveal">DEBUG reveal solution</button>
            </div>
          </div>
        </section>
        ${generationProgress ? renderGenerationOverlay() : ""}
        ${difficultyProgress ? renderDifficultyOverlay() : ""}
      </main>
    `;

    const boardElement = root.querySelector(".board");
    if (boardElement) {
      boardElement.style.gridTemplateColumns = `repeat(${puzzle.size}, minmax(0, 1fr))`;
    }

    root.querySelectorAll("[data-row][data-col]").forEach((cell) => {
      cell.addEventListener("contextmenu", (event) => {
        event.preventDefault();
      });

      cell.addEventListener("auxclick", (event) => {
        event.preventDefault();
      });

      cell.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);

        if (event.button === 2) {
          applyBoard(setCell(board, row, col, "empty"));
          return;
        }

        if (event.button === 1) {
          applyBoard(setCell(board, row, col, board[row][col] === "star" ? "empty" : "star"));
          return;
        }

        const nextState = cycleCellState(board[row][col]);
        isDraggingMarks = nextState === "mark";
        applyBoard(setCell(board, row, col, nextState));
      });

      cell.addEventListener("pointerenter", () => {
        if (!isDraggingMarks) return;
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        if (board[row][col] === "empty") {
          replaceBoard(setCell(board, row, col, "mark"));
        }
      });
    });

    root.querySelector("[data-action='undo']")?.addEventListener("click", () => {
      undo();
    });

    root.querySelector("[data-action='redo']")?.addEventListener("click", () => {
      redo();
    });

    root.querySelector("[data-action='generate']")?.addEventListener("click", () => {
      loadGeneratedPuzzle(selectedBoardSize);
    });

    root.querySelector("[data-action='difficulty']")?.addEventListener("click", () => {
      calculateDifficulty();
    });

    root.querySelector("[data-action='file-menu']")?.addEventListener("click", () => {
      fileMenuOpen = !fileMenuOpen;
      render();
    });

    root.querySelector("[data-action='save-board']")?.addEventListener("click", saveBoardFile);
    root.querySelector("[data-action='load-board']")?.addEventListener("click", () => {
      root.querySelector("[data-board-file]")?.click();
    });
    root.querySelector("[data-board-file]")?.addEventListener("change", loadBoardFile);

    root.querySelector("[data-action='hint']")?.addEventListener("click", () => {
      if (currentHint?.moves?.length) {
        applyBoard(globalThis.StarsRemixHints.applyHint(board, currentHint));
        return;
      }
      currentSoftHint = null;
      currentCheck = null;
      currentHint = validation.solved
        ? { kind: "solved", message: "The puzzle is solved — no hint needed!", cells: [] }
        : globalThis.StarsRemixHints.findHint(puzzle, board);
      render();
    });

    root.querySelector("[data-action='soft-hint']")?.addEventListener("click", () => {
      currentHint = null;
      currentCheck = null;
      if (!currentSoftHint) {
        const hint = globalThis.StarsRemixHints.findSoftHint(puzzle, board, solution);
        currentSoftHint = { hint, stage: 0 };
      } else {
        currentSoftHint.stage = Math.min(
          currentSoftHint.stage + 1,
          currentSoftHint.hint.stages.length - 1,
        );
      }
      render();
    });

    root.querySelector("[data-action='check']")?.addEventListener("click", () => {
      currentHint = null;
      currentSoftHint = null;
      currentCheck = {
        hasError: globalThis.StarsRemixHints.checkBoardForErrors(puzzle, board, solution),
      };
      render();
    });

    root.querySelectorAll("[data-size]").forEach((button) => {
      button.addEventListener("click", () => {
        loadGeneratedPuzzle(Number(button.dataset.size));
      });
    });

    const revealButton = root.querySelector("[data-action='reveal']");
    revealButton?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      setSolutionReveal(true);
    });
    revealButton?.addEventListener("pointerleave", () => setSolutionReveal(false));
  }

  async function loadGeneratedPuzzle(size) {
    if (generationProgress) return;
    selectedBoardSize = size;
    generationProgress = { attempt: 0, maximum: size === 11 ? 250 : 1000 };
    render();

    try {
      await nextPaint();
      const generated = await generatePuzzle(size, (attempt, maximum) => {
        generationProgress = { attempt, maximum };
        updateGenerationOverlay();
      });
      puzzle = generated.puzzle;
      solution = generated.solution;
      board = createEmptyBoard(puzzle.size);
      undoStack = [];
      redoStack = [];
      currentHint = null;
      currentSoftHint = null;
      currentCheck = null;
      difficultyReport = null;
    } finally {
      generationProgress = null;
      render();
    }
  }

  async function calculateDifficulty() {
    if (difficultyProgress || generationProgress) return;
    difficultyReport = null;
    difficultyProgress = {
      percent: 0,
      starsPlaced: 0,
      totalStars: puzzle.size * puzzle.starsPerUnit,
      stepsCompleted: 0,
      technique: "basic rules",
      tier: "Basic",
    };
    render();

    try {
      await nextPaint();
      difficultyReport = await globalThis.StarsRemixHints.analyzeDifficulty(puzzle, {
        onProgress(progress) {
          difficultyProgress = progress;
          updateDifficultyOverlay();
        },
        yieldControl: nextPaint,
      });
    } finally {
      difficultyProgress = null;
      render();
    }
  }

  function saveBoardFile() {
    const contents = globalThis.StarsRemixSerialization.serializeBoard({
      puzzle, board, solution, difficultyReport,
    });
    const blobUrl = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${safeFilename(puzzle.title)}-${puzzle.size}x${puzzle.size}.stars.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
    fileMenuOpen = false;
    fileNotice = { kind: "success", message: "Board file saved." };
    render();
  }

  async function loadBoardFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const loaded = globalThis.StarsRemixSerialization.deserializeBoard(await file.text());
      validatePuzzleShape(loaded.puzzle);
      puzzle = loaded.puzzle;
      board = loaded.board;
      solution = loaded.solution;
      difficultyReport = loaded.difficultyReport;
      selectedBoardSize = puzzle.size;
      undoStack = [];
      redoStack = [];
      currentHint = null;
      currentSoftHint = null;
      currentCheck = null;
      fileNotice = { kind: "success", message: `Loaded ${file.name}.` };
    } catch (error) {
      fileNotice = { kind: "error", message: error instanceof Error ? error.message : "Unable to load that board." };
    }
    fileMenuOpen = false;
    render();
  }

  function safeFilename(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "board";
  }

  function renderGenerationOverlay() {
    const percent = generationProgress.maximum === 0
      ? 0
      : Math.min(99, Math.round((generationProgress.attempt / generationProgress.maximum) * 100));
    return `
      <div class="generation-overlay" role="dialog" aria-modal="true" aria-labelledby="generation-title">
        <div class="generation-card">
          <div class="generation-sparkle" aria-hidden="true">✦</div>
          <h2 id="generation-title">Generating Board</h2>
          <p class="generation-detail">Trying constellation ${generationProgress.attempt + 1} of ${generationProgress.maximum}</p>
          <div class="generation-track" role="progressbar" aria-label="Board generation progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
            <div class="generation-fill" style="width: ${percent}%"></div>
          </div>
          <p class="generation-percent">${percent}% of attempt budget</p>
        </div>
      </div>
    `;
  }

  function updateGenerationOverlay() {
    const overlay = root.querySelector(".generation-overlay");
    if (!overlay) return;
    const percent = Math.min(
      99,
      Math.round((generationProgress.attempt / generationProgress.maximum) * 100),
    );
    overlay.querySelector(".generation-detail").textContent =
      `Trying constellation ${generationProgress.attempt + 1} of ${generationProgress.maximum}`;
    overlay.querySelector(".generation-fill").style.width = `${percent}%`;
    overlay.querySelector(".generation-track").setAttribute("aria-valuenow", String(percent));
    overlay.querySelector(".generation-percent").textContent = `${percent}% of attempt budget`;
  }

  function renderDifficultyOverlay() {
    const percent = difficultyProgress.percent;
    return `
      <div class="generation-overlay" role="dialog" aria-modal="true" aria-labelledby="difficulty-title">
        <div class="generation-card difficulty-loading-card">
          <div class="generation-sparkle" aria-hidden="true">✦</div>
          <h2 id="difficulty-title">Calculating Difficulty</h2>
          <p class="generation-detail">Checking ${escapeHtml(difficultyProgress.technique)} · ${escapeHtml(difficultyProgress.tier)}</p>
          <div class="generation-track" role="progressbar" aria-label="Difficulty analysis progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
            <div class="generation-fill difficulty-fill" style="width: ${Math.max(3, percent)}%"></div>
          </div>
          <p class="generation-percent">${difficultyProgress.starsPlaced} of ${difficultyProgress.totalStars} stars placed · ${difficultyProgress.stepsCompleted} logical steps</p>
        </div>
      </div>
    `;
  }

  function updateDifficultyOverlay() {
    const overlay = root.querySelector(".generation-overlay");
    if (!overlay) return;
    overlay.querySelector(".generation-detail").textContent =
      `Checking ${difficultyProgress.technique} · ${difficultyProgress.tier}`;
    overlay.querySelector(".generation-fill").style.width = `${Math.max(3, difficultyProgress.percent)}%`;
    overlay.querySelector(".generation-track").setAttribute("aria-valuenow", String(difficultyProgress.percent));
    overlay.querySelector(".generation-percent").textContent =
      `${difficultyProgress.starsPlaced} of ${difficultyProgress.totalStars} stars placed · ${difficultyProgress.stepsCompleted} logical steps`;
  }

  function renderDifficultyReport() {
    const report = difficultyReport;
    const summary = report.techniqueCounts.map((technique) => `
      <li>
        <span>${escapeHtml(technique.title)}</span>
        <span class="technique-tier">${escapeHtml(technique.tier)}</span>
        <strong>×${technique.count}</strong>
      </li>
    `).join("");
    const steps = report.steps.map((step) => `
      <li class="difficulty-step${step.bigTicket ? " is-big-ticket" : ""}">
        <div><strong>${step.number}. ${escapeHtml(step.title)}</strong><span>${escapeHtml(step.tier)}</span></div>
        <p>${step.moves.map(formatDifficultyMove).join(", ")}</p>
      </li>
    `).join("");

    return `
      <section class="difficulty-report" aria-label="Board difficulty report">
        <p class="hint-kicker">Board difficulty</p>
        <div class="difficulty-grade">${escapeHtml(report.label)}</div>
        <p>${report.solved
          ? `${report.bigTicketCount} big-ticket deduction${report.bigTicketCount === 1 ? "" : "s"} · weighted score ${report.score}`
          : `The current technique set placed ${report.starsPlaced} of ${report.totalStars} stars, so this board cannot be rated completely yet.`}</p>
        <ul class="technique-summary">${summary}</ul>
        <details class="difficulty-details">
          <summary>Every logical move (${report.steps.length})</summary>
          <ol>${steps}</ol>
        </details>
      </section>
    `;
  }

  function formatDifficultyMove(move) {
    const token = move.state === "star" ? "★" : "×";
    return `${token} R${move.row + 1}C${move.col + 1}`;
  }

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

  function applyBoard(nextBoard) {
    if (boardsMatch(board, nextBoard)) return;
    const previousBoard = board;
    const wasShowingSuccess = Boolean(currentSoftHint?.isSatisfied);
    if (!wasShowingSuccess) clearSoftHintSuccessTimers();
    undoStack = [...undoStack, board];
    redoStack = [];
    board = nextBoard;
    currentHint = null;
    currentCheck = null;
    currentSoftHint = updateSoftHintAfterMove(currentSoftHint, previousBoard, board);
    render();
    if (currentSoftHint?.isSatisfied && !wasShowingSuccess) scheduleSoftHintSuccessExit();
  }

  function updateSoftHintAfterMove(activeSoftHint, previousBoard, nextBoard) {
    if (!activeSoftHint) return null;
    if (activeSoftHint.isSatisfied) return activeSoftHint;

    const matchingHint = globalThis.StarsRemixHints.findSoftHintByKind(
      puzzle,
      nextBoard,
      activeSoftHint.hint.kind,
      solution,
    );

    const moveSatisfied = globalThis.StarsRemixHints.isSoftHintTechniqueSatisfied(
      puzzle,
      previousBoard,
      nextBoard,
      solution,
      activeSoftHint.hint.kind,
    );
    if (moveSatisfied) {
      return { ...activeSoftHint, isSatisfied: true };
    }
    if (!matchingHint) return null;

    return {
      hint: matchingHint,
      stage: Math.min(activeSoftHint.stage, matchingHint.stages.length - 1),
    };
  }

  function clearSoftHintSuccessTimers() {
    window.clearTimeout(softHintSuccessTimer);
    window.clearTimeout(softHintRemovalTimer);
    softHintSuccessTimer = null;
    softHintRemovalTimer = null;
  }

  function scheduleSoftHintSuccessExit() {
    softHintSuccessTimer = window.setTimeout(() => {
      const card = root.querySelector(".soft-hint-card.is-satisfied");
      if (!card || !currentSoftHint?.isSatisfied) return;
      card.classList.add("is-leaving");
      softHintRemovalTimer = window.setTimeout(() => {
        if (!currentSoftHint?.isSatisfied) return;
        currentSoftHint = null;
        softHintSuccessTimer = null;
        softHintRemovalTimer = null;
        render();
      }, 280);
    }, 1500);
  }

  function replaceBoard(nextBoard) {
    if (boardsMatch(board, nextBoard)) return;
    const previousBoard = board;
    const wasShowingSuccess = Boolean(currentSoftHint?.isSatisfied);
    if (!wasShowingSuccess) clearSoftHintSuccessTimers();
    board = nextBoard;
    currentHint = null;
    currentSoftHint = updateSoftHintAfterMove(currentSoftHint, previousBoard, board);
    currentCheck = null;
    render();
    if (currentSoftHint?.isSatisfied && !wasShowingSuccess) scheduleSoftHintSuccessExit();
  }

  function undo() {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    undoStack = undoStack.slice(0, -1);
    redoStack = [...redoStack, board];
    board = previous;
    currentHint = null;
    currentSoftHint = null;
    currentCheck = null;
    render();
  }

  function redo() {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    redoStack = redoStack.slice(0, -1);
    undoStack = [...undoStack, board];
    board = next;
    currentHint = null;
    currentSoftHint = null;
    currentCheck = null;
    render();
  }

  function boardsMatch(left, right) {
    return left.every((row, rowIndex) =>
      row.every((cell, colIndex) => cell === right[rowIndex][colIndex]),
    );
  }

  function createEmptyBoard(size) {
    return Array.from({ length: size }, () => Array.from({ length: size }).fill("empty"));
  }

  function cycleCellState(state) {
    if (state === "empty") return "mark";
    if (state === "mark") return "star";
    return "empty";
  }

  function setCell(currentBoard, row, col, state) {
    return currentBoard.map((cells, currentRow) =>
      cells.map((cell, currentCol) =>
        currentRow === row && currentCol === col ? state : cell,
      ),
    );
  }

  async function generatePuzzle(size, onProgress) {
    const starsPerUnit = 2;
    if (size < 9) {
      throw new Error(
        "Random two-star boards require at least 9 rows and columns to avoid predictable maximum-density layouts.",
      );
    }
    const patterns = createRowPatterns(size, starsPerUnit);

    const maximumAttempts = size === 11 ? 250 : 1000;
    let validFallback = null;
    for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
      if (attempt % 5 === 0) {
        onProgress(attempt, maximumAttempts);
        await nextPaint();
      }
      const solution = generateSolution(size, starsPerUnit, patterns);
      const houses = solution && generateHouses(size, solution, starsPerUnit);
      if (!houses) continue;

      const candidate = {
        id: `generated-${Date.now()}-${attempt}`,
        title: "Random Constellation",
        size,
        starsPerUnit,
        houses,
      };
      validFallback ??= { puzzle: candidate, solution };
      if (countSolutions(candidate, patterns, 2) === 1) return { puzzle: candidate, solution };
    }
    if (size === 11 && validFallback) return validFallback;
    throw new Error("Unable to generate a unique puzzle. Please try again.");
  }

  function nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  function generateSolution(size, required, patterns) {
    const columnCounts = Array(size).fill(0);
    const chosen = [];

    function search(row) {
      if (row === size) return columnCounts.every((count) => count === required);
      const rowsRemaining = size - row - 1;
      for (const pattern of shuffle(patterns)) {
        if (!canFollow(chosen[row - 1], pattern)) continue;
        if (pattern.some((col) => columnCounts[col] >= required)) continue;
        pattern.forEach((col) => columnCounts[col] += 1);
        const possible = columnCounts.every((count) => count + rowsRemaining >= required);
        if (possible) {
          chosen.push(pattern);
          if (search(row + 1)) return true;
          chosen.pop();
        }
        pattern.forEach((col) => columnCounts[col] -= 1);
      }
      return false;
    }

    if (!search(0)) return null;
    return chosen.flatMap((columns, row) => columns.map((col) => ({ row, col })));
  }

  function generateHouses(size, solution, starsPerHouse) {
    const starKeys = new Set(solution.map(getStarKey));
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const houses = Array.from({ length: size }, () => Array(size).fill(-1));
      const stars = shuffle(solution);
      let failed = false;

      for (let house = 0; house < stars.length / starsPerHouse; house += 1) {
        if (starsPerHouse === 1) {
          houses[stars[house].row][stars[house].col] = house;
          continue;
        }
        const path = findPath(stars[house * 2], stars[house * 2 + 1], houses, starKeys);
        if (!path) {
          failed = true;
          break;
        }
        path.forEach(({ row, col }) => houses[row][col] = house);
      }
      if (failed) continue;

      while (houses.flat().includes(-1)) {
        const frontier = [];
        for (let row = 0; row < size; row += 1) {
          for (let col = 0; col < size; col += 1) {
            if (houses[row][col] !== -1) continue;
            if (neighbors({ row, col }, size).some((cell) => houses[cell.row][cell.col] !== -1)) {
              frontier.push({ row, col });
            }
          }
        }
        const cell = pick(frontier);
        const adjacentHouses = neighbors(cell, size)
          .map(({ row, col }) => houses[row][col])
          .filter((house) => house !== -1);
        houses[cell.row][cell.col] = pick(adjacentHouses);
      }
      return houses;
    }
    return null;
  }

  function findPath(start, target, houses, starKeys) {
    const size = houses.length;
    const targetKey = getStarKey(target);
    const queue = [start];
    const previous = new Map([[getStarKey(start), null]]);

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (getStarKey(current) === targetKey) break;
      for (const next of shuffle(neighbors(current, size))) {
        const key = getStarKey(next);
        if (previous.has(key) || houses[next.row][next.col] !== -1) continue;
        if (starKeys.has(key) && key !== targetKey) continue;
        previous.set(key, current);
        queue.push(next);
      }
    }
    if (!previous.has(targetKey)) return null;

    const path = [];
    let current = target;
    while (current) {
      path.push(current);
      current = previous.get(getStarKey(current)) ?? null;
    }
    return path;
  }

  function countSolutions(candidate, patterns, limit) {
    const columns = Array(candidate.size).fill(0);
    const houseCounts = Array(candidate.size).fill(0);
    const chosen = [];
    let count = 0;

    function search(row) {
      if (count >= limit) return;
      if (row === candidate.size) {
        if (columns.every((value) => value === candidate.starsPerUnit) &&
            houseCounts.every((value) => value === candidate.starsPerUnit)) count += 1;
        return;
      }
      const rowsRemaining = candidate.size - row - 1;
      for (const pattern of patterns) {
        if (!canFollow(chosen[row - 1], pattern)) continue;
        if (pattern.some((col) => columns[col] >= candidate.starsPerUnit)) continue;
        const additions = new Map();
        pattern.forEach((col) => {
          const house = candidate.houses[row][col];
          additions.set(house, (additions.get(house) ?? 0) + 1);
        });
        if ([...additions].some(([house, value]) => houseCounts[house] + value > candidate.starsPerUnit)) continue;

        pattern.forEach((col) => columns[col] += 1);
        additions.forEach((value, house) => houseCounts[house] += value);
        if (columns.every((value) => value + rowsRemaining >= candidate.starsPerUnit)) {
          chosen.push(pattern);
          search(row + 1);
          chosen.pop();
        }
        pattern.forEach((col) => columns[col] -= 1);
        additions.forEach((value, house) => houseCounts[house] -= value);
        if (count >= limit) return;
      }
    }

    search(0);
    return count;
  }

  function createRowPatterns(size, required) {
    const patterns = [];
    function build(start, chosen) {
      if (chosen.length === required) {
        patterns.push([...chosen]);
        return;
      }
      const needed = required - chosen.length;
      for (let col = start; col <= size - (needed * 2 - 1); col += 1) {
        chosen.push(col);
        build(col + 2, chosen);
        chosen.pop();
      }
    }
    build(0, []);
    return patterns;
  }

  function canFollow(previous, current) {
    return !previous || current.every((col) => previous.every((other) => Math.abs(col - other) > 1));
  }

  function neighbors(position, size) {
    return [
      { row: position.row - 1, col: position.col },
      { row: position.row + 1, col: position.col },
      { row: position.row, col: position.col - 1 },
      { row: position.row, col: position.col + 1 },
    ].filter(({ row, col }) => row >= 0 && col >= 0 && row < size && col < size);
  }

  function shuffle(values) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }

  function pick(values) {
    return values[Math.floor(Math.random() * values.length)];
  }

  function setSolutionReveal(visible) {
    root.querySelector(".board")?.classList.toggle("is-debug-revealed", visible);
  }

  function validatePuzzleShape(puzzle) {
    if (puzzle.size <= 0) {
      throw new Error("Puzzle size must be positive.");
    }

    if (puzzle.houses.length !== puzzle.size) {
      throw new Error("Puzzle must include one house row per board row.");
    }

    puzzle.houses.forEach((row, index) => {
      if (row.length !== puzzle.size) {
        throw new Error(`House row ${index} must have ${puzzle.size} cells.`);
      }
    });
  }

  function validateBoard(puzzle, currentBoard) {
    const unitStatuses = [
      ...getRowStatuses(puzzle, currentBoard),
      ...getColumnStatuses(puzzle, currentBoard),
      ...getHouseStatuses(puzzle, currentBoard),
    ];
    const conflicts = [
      ...getOverfilledConflicts(puzzle, currentBoard, unitStatuses),
      ...getAdjacencyConflicts(currentBoard),
    ];

    return {
      solved: unitStatuses.every((status) => status.complete) && conflicts.length === 0,
      conflicts,
      unitStatuses,
    };
  }

  function getStarKey(position) {
    return `${position.row}:${position.col}`;
  }

  function getRowStatuses(puzzle, currentBoard) {
    return currentBoard.map((row, index) =>
      makeStatus("row", index, row.filter((cell) => cell === "star").length, puzzle.starsPerUnit),
    );
  }

  function getColumnStatuses(puzzle, currentBoard) {
    return Array.from({ length: puzzle.size }, (_, col) => {
      let count = 0;
      for (let row = 0; row < puzzle.size; row += 1) {
        if (currentBoard[row][col] === "star") count += 1;
      }
      return makeStatus("column", col, count, puzzle.starsPerUnit);
    });
  }

  function getHouseStatuses(puzzle, currentBoard) {
    const counts = new Map();

    for (let row = 0; row < puzzle.size; row += 1) {
      for (let col = 0; col < puzzle.size; col += 1) {
        if (currentBoard[row][col] === "star") {
          const house = puzzle.houses[row][col];
          counts.set(house, (counts.get(house) ?? 0) + 1);
        }
      }
    }

    return getHouseIds(puzzle).map((house) =>
      makeStatus("house", house, counts.get(house) ?? 0, puzzle.starsPerUnit),
    );
  }

  function makeStatus(kind, index, count, required) {
    return {
      kind,
      index,
      count,
      required,
      complete: count === required,
      overfilled: count > required,
    };
  }

  function getOverfilledConflicts(puzzle, currentBoard, statuses) {
    return statuses
      .filter((status) => status.overfilled)
      .map((status) => ({
        cells: getUnitStarPositions(puzzle, currentBoard, status.kind, status.index),
        reason: `${labelUnit(status.kind, status.index)} has ${status.count} stars.`,
      }));
  }

  function getAdjacencyConflicts(currentBoard) {
    const conflicts = [];
    const size = currentBoard.length;

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (currentBoard[row][col] !== "star") continue;

        for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
          for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
            if (rowOffset === 0 && colOffset === 0) continue;
            const otherRow = row + rowOffset;
            const otherCol = col + colOffset;

            if (otherRow < row || (otherRow === row && otherCol <= col)) continue;
            if (otherRow < 0 || otherCol < 0 || otherRow >= size || otherCol >= size) continue;

            if (currentBoard[otherRow][otherCol] === "star") {
              conflicts.push({
                cells: [
                  { row, col },
                  { row: otherRow, col: otherCol },
                ],
                reason: "Stars cannot touch, even diagonally.",
              });
            }
          }
        }
      }
    }

    return conflicts;
  }

  function getUnitStarPositions(puzzle, currentBoard, kind, index) {
    const cells = [];

    for (let row = 0; row < puzzle.size; row += 1) {
      for (let col = 0; col < puzzle.size; col += 1) {
        if (currentBoard[row][col] !== "star") continue;
        if (kind === "row" && row === index) cells.push({ row, col });
        if (kind === "column" && col === index) cells.push({ row, col });
        if (kind === "house" && puzzle.houses[row][col] === index) cells.push({ row, col });
      }
    }

    return cells;
  }

  function getHouseIds(puzzle) {
    return [...new Set(puzzle.houses.flat())].sort((a, b) => a - b);
  }

  function labelUnit(kind, index) {
    if (kind === "row") return `Row ${index + 1}`;
    if (kind === "column") return `Column ${index + 1}`;
    return `House ${index + 1}`;
  }

  function getBorderStyle(houses, row, col) {
    const house = houses[row][col];
    const size = houses.length;
    const border = "3px solid #1d1d1b";
    const thin = "1px solid rgba(29, 29, 27, 0.28)";

    return [
      `border-top: ${row === 0 || houses[row - 1][col] !== house ? border : thin}`,
      `border-right: ${col === size - 1 || houses[row][col + 1] !== house ? border : thin}`,
      `border-bottom: ${row === size - 1 || houses[row + 1][col] !== house ? border : thin}`,
      `border-left: ${col === 0 || houses[row][col - 1] !== house ? border : thin}`,
    ].join("; ");
  }

  function escapeHtml(value) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  window.addEventListener("pointerup", () => {
    isDraggingMarks = false;
    setSolutionReveal(false);
  });

  window.addEventListener("pointercancel", () => setSolutionReveal(false));

  window.addEventListener("blur", () => {
    isDraggingMarks = false;
    setSolutionReveal(false);
  });

  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const key = event.key.toLowerCase();
    if (key === "z") {
      event.preventDefault();
      undo();
    }

    if (key === "r" || key === "y" || key === "x") {
      event.preventDefault();
      redo();
    }

    if (key === "h") {
      event.preventDefault();
      root.querySelector("[data-action='hint']")?.click();
    }

    if (key === "g") {
      event.preventDefault();
      root.querySelector("[data-action='soft-hint']")?.click();
    }

    if (key === "escape" && currentSoftHint) {
      event.preventDefault();
      currentSoftHint = null;
      render();
    }
  });
})();
