// Part of the StarsRemix browser app (classic script, no build step).
// Rendering: the main render() pass, status overlays, and view helpers.
// These app/*.js files were one IIFE; they now share top-level state and
// functions through the global (lexical) scope of classic scripts. Load
// order is fixed in index.html; app-actions.js runs the boot call last.

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

function setSolutionReveal(visible) {
  root.querySelector(".board")?.classList.toggle("is-debug-revealed", visible);
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

