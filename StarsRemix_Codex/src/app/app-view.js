// Part of the StarsRemix browser app (classic script, no build step).
// Rendering: the main render() pass, status overlays, and view helpers.
// These app/*.js files were one IIFE; they now share top-level state and
// functions through the global (lexical) scope of classic scripts. Load
// order is fixed in index.html; app-actions.js runs the boot call last.

function render() {
  const validation = validateBoard(gameState.puzzle, gameState.progress.board);
  const conflictKeys = new Set();
  const softHintStage = currentSoftHint && !currentSoftHint.isSatisfied
    ? currentSoftHint.hint.stages[currentSoftHint.stage]
    : null;
  const activeCheck = currentCheck?.revealLocation ? currentCheck : null;
  const activeHint = currentHint ?? softHintStage ?? activeCheck;
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
          <p class="brand">StarsRemix</p>
          <p class="board-title">${escapeHtml(gameState.puzzle.title)} · ${gameState.puzzle.size}×${gameState.puzzle.size} · ${difficultyProgress ? "Evaluating…" : gameState.analysis.difficultyReport ? escapeHtml(gameState.analysis.difficultyReport.label) : "Unrated"}</p>
        </div>
        <div class="history-controls" aria-label="Move history and puzzle help">
          <div class="history-control-group">
            <button class="icon-button" type="button" aria-label="Undo" title="Undo" data-action="undo" ${undoStack.length === 0 ? "disabled" : ""}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4 12l5 5M5 12h8a6 6 0 0 1 6 6" /></svg>
              <span class="shortcut-key" aria-hidden="true">Z</span>
            </button>
            <button class="icon-button" type="button" aria-label="Redo" title="Redo" data-action="redo" ${redoStack.length === 0 ? "disabled" : ""}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 7 5 5-5 5m4-5h-8a6 6 0 0 0-6 6" /></svg>
              <span class="shortcut-key" aria-hidden="true">R</span>
            </button>
          </div>
          <div class="history-control-group">
            <button class="action-button soft-hint-button" type="button" data-action="soft-hint" title="Soft Hint (G)">Soft Hint<span class="shortcut-key" aria-hidden="true">G</span></button>
            <button class="action-button hint-button" type="button" data-action="hint" title="Hint (H)">Hint<span class="shortcut-key" aria-hidden="true">H</span></button>
            <button class="action-button check-button" type="button" data-action="check" title="Check (C)">Check<span class="shortcut-key" aria-hidden="true">C</span></button>
          </div>
        </div>
        <div class="top-actions">
          <button class="icon-button theme-toggle" type="button" data-action="toggle-theme" aria-label="Switch to ${nightMode ? "day" : "night"} mode" title="Switch to ${nightMode ? "day" : "night"} mode" aria-pressed="${nightMode}">
            ${nightMode
              ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>'
              : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.1A8.5 8.5 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z" /></svg>'}
          </button>
          <div class="file-menu">
            <button class="action-button file-menu-button" type="button" data-action="file-menu" aria-expanded="${fileMenuOpen}">Boards</button>
            ${fileMenuOpen ? `
              <div class="file-menu-popover" role="menu" aria-label="Saved boards">
                <button type="button" role="menuitem" data-action="browse-library">Choose from board library…</button>
                <button type="button" role="menuitem" data-action="board-editor">Open board workshop…</button>
                <button type="button" role="menuitem" data-action="save-board">Save current board…</button>
                <button type="button" role="menuitem" data-action="load-board">Load board file…</button>
              </div>
            ` : ""}
            <input class="board-file-input" type="file" accept=".stars,.stars.json,.json,text/plain,application/json" data-board-file hidden>
          </div>
        </div>
      </section>

      <section class="play-layout">
        <div class="board-column">
          <div
            class="board${solutionRevealVisible ? " is-debug-revealed" : ""}"
            role="grid"
            aria-label="${gameState.puzzle.size} by ${gameState.puzzle.size} star puzzle"
            style="--board-border-width: ${5 / gameState.puzzle.size}cqw; --house-border-width: ${4 / gameState.puzzle.size}cqw; --cell-border-width: ${1.67 / gameState.puzzle.size}cqw"
          >
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
                <p>${formatHintMessage(currentCheck.message)}</p>
                ${currentCheck.hasError ? `<p class="hint-apply-prompt">${currentCheck.revealLocation ? "Press Check again to undo to the last solvable board." : "Press Check again to reveal it."}</p>` : ""}
              </div>
            ` : ""}
            ${difficultyProgress ? renderDifficultyProgress() : gameState.analysis.difficultyReport ? renderDifficultyReport() : ""}
            ${fileNotice ? `<div class="file-notice ${fileNotice.kind}" role="status">${escapeHtml(fileNotice.message)}</div>` : ""}
          </aside>
          <div class="new-board-controls" aria-label="New board controls">
            <div class="size-controls" aria-label="Board size">
              ${[9, 10, 11].map((size) => `
                <button class="size-button${selectedBoardSize === size ? " is-active" : ""}" type="button" data-size="${size}" aria-pressed="${selectedBoardSize === size}" ${generationProgress ? "disabled" : ""}>${size}×${size}</button>
              `).join("")}
            </div>
            <button class="action-button" type="button" data-action="generate" ${generationProgress ? "disabled" : ""}>new board</button>
            <button class="action-button debug-reveal-button" type="button" data-action="reveal" aria-pressed="${solutionRevealVisible}">DEBUG ${solutionRevealVisible ? "hide" : "reveal"} solution</button>
          </div>
        </div>
      </section>
      <footer class="site-footer">
        Based on Inkwell's fabulous game, <a href="https://inkwellgames.com/games/stars">Stars</a>. This is a fan-made recreation only made public so Brett's friend Chris Hallberg can play.
      </footer>
      ${boardLibraryOpen ? renderBoardLibrary() : ""}
      ${generationProgress ? renderGenerationOverlay() : ""}
    </main>
  `;
  enteringTokenKeys = new Set();

  const boardElement = root.querySelector(".board");
  if (boardElement) {
    boardElement.style.gridTemplateColumns = `repeat(${gameState.puzzle.size}, minmax(0, 1fr))`;
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
        applyBoard(setCell(gameState.progress.board, row, col, "empty"));
        return;
      }

      if (event.button === 1) {
        applyBoard(setCell(gameState.progress.board, row, col, gameState.progress.board[row][col] === "star" ? "empty" : "star"));
        return;
      }

      const nextState = cycleCellState(gameState.progress.board[row][col]);
      isDraggingMarks = nextState === "mark";
      applyBoard(setCell(gameState.progress.board, row, col, nextState));
    });

    cell.addEventListener("pointerenter", () => {
      if (!isDraggingMarks) return;
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      if (gameState.progress.board[row][col] === "empty") {
        replaceBoard(setCell(gameState.progress.board, row, col, "mark"));
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

  root.querySelector("[data-action='file-menu']")?.addEventListener("click", () => {
    fileMenuOpen = !fileMenuOpen;
    render();
  });

  root.querySelector("[data-action='toggle-theme']")?.addEventListener("click", () => {
    setNightMode(!nightMode);
  });

  root.querySelector("[data-action='browse-library']")?.addEventListener("click", () => {
    const currentEntry = getLibraryBoard(gameState.puzzle.id);
    selectedLibraryDifficulty = currentEntry?.difficulty.label ?? selectedLibraryDifficulty;
    fileMenuOpen = false;
    boardLibraryOpen = true;
    render();
  });
  root.querySelector("[data-action='board-editor']")?.addEventListener("click", () => {
    window.location.href = "./editor.html";
  });

  root.querySelector("[data-action='close-library']")?.addEventListener("click", () => {
    boardLibraryOpen = false;
    render();
  });

  root.querySelectorAll("[data-library-difficulty]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedLibraryDifficulty = button.dataset.libraryDifficulty;
      render();
    });
  });

  root.querySelectorAll("[data-library-board]").forEach((button) => {
    button.addEventListener("click", () => loadLibraryBoard(button.dataset.libraryBoard));
  });

  root.querySelector("[data-action='save-board']")?.addEventListener("click", saveBoardFile);
  root.querySelector("[data-action='load-board']")?.addEventListener("click", () => {
    root.querySelector("[data-board-file]")?.click();
  });
  root.querySelector("[data-board-file]")?.addEventListener("change", loadBoardFile);

  root.querySelector("[data-action='hint']")?.addEventListener("click", () => {
    if (currentHint?.moves?.length) {
      applyBoard(globalThis.StarsRemixHints.applyHint(gameState.progress.board, currentHint));
      return;
    }
    currentSoftHint = null;
    currentCheck = null;
    const mistake = globalThis.StarsRemixHints.findBoardMistake(gameState.puzzle, gameState.progress.board, gameState.solution);
    if (mistake) {
      const locationStage = mistake.stages.at(-1);
      currentHint = { ...mistake, ...locationStage };
    } else {
      currentHint = validation.solved
        ? { kind: "solved", message: "The puzzle is solved — no hint needed!", cells: [] }
        : globalThis.StarsRemixHints.findHint(gameState.puzzle, gameState.progress.board);
    }
    render();
  });

  root.querySelector("[data-action='soft-hint']")?.addEventListener("click", () => {
    currentHint = null;
    currentCheck = null;
    if (!currentSoftHint) {
      const hint = globalThis.StarsRemixHints.findSoftHint(gameState.puzzle, gameState.progress.board, gameState.solution);
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
    if (currentCheck?.hasError && currentCheck.revealLocation) {
      restoreLastSolvableBoard();
      return;
    }
    const mistake = globalThis.StarsRemixHints.findBoardMistake(gameState.puzzle, gameState.progress.board, gameState.solution);
    const revealLocation = Boolean(currentCheck?.hasError && mistake);
    const locationStage = mistake?.stages.at(-1);
    currentCheck = {
      hasError: Boolean(mistake),
      revealLocation,
      message: revealLocation
        ? locationStage.message
        : mistake?.stages[0].message ?? "No errors found so far.",
      cells: revealLocation ? locationStage.cells : [],
    };
    render();
  });

  root.querySelectorAll("[data-size]").forEach((button) => {
    button.addEventListener("click", () => {
      loadGeneratedPuzzle(Number(button.dataset.size));
    });
  });

  root.querySelector("[data-action='reveal']")?.addEventListener("click", () => {
    setSolutionReveal(!solutionRevealVisible);
  });
}

function renderBoardLibrary() {
  const progress = readLibraryProgress();
  const selectedBoards = boardLibrary.boards.filter(
    ({ difficulty }) => difficulty.label === selectedLibraryDifficulty,
  );
  const completedTotal = boardLibrary.boards.filter(
    (entry) => getLibraryBoardStatus(entry, progress).kind === "completed",
  ).length;
  const inProgressTotal = boardLibrary.boards.filter(
    (entry) => getLibraryBoardStatus(entry, progress).kind === "progress",
  ).length;

  return `
    <div class="library-overlay" role="dialog" aria-modal="true" aria-labelledby="library-title">
      <section class="library-dialog">
        <header class="library-header">
          <div>
            <p class="hint-kicker">Board library</p>
            <h2 id="library-title">Choose your next constellation</h2>
            <p>${completedTotal} completed · ${inProgressTotal} in progress · ${boardLibrary.boards.length} total</p>
          </div>
          <button class="library-close" type="button" data-action="close-library" aria-label="Close board library">×</button>
        </header>
        <nav class="difficulty-tabs" aria-label="Choose a difficulty">
          ${libraryDifficulties.map((difficulty) => {
            const entries = boardLibrary.boards.filter((entry) => entry.difficulty.label === difficulty);
            const completed = entries.filter((entry) => getLibraryBoardStatus(entry, progress).kind === "completed").length;
            return `
              <button type="button" data-library-difficulty="${difficulty}" class="difficulty-tab${selectedLibraryDifficulty === difficulty ? " is-active" : ""}" aria-pressed="${selectedLibraryDifficulty === difficulty}">
                <span>${difficulty}</span>
                <small>${completed}/${entries.length} complete</small>
              </button>
            `;
          }).join("")}
        </nav>
        <div class="library-board-list" aria-label="${selectedLibraryDifficulty} boards">
          ${selectedBoards.length ? selectedBoards.map((entry) => {
            const status = getLibraryBoardStatus(entry, progress);
            const isCurrent = entry.puzzle.id === gameState.puzzle.id;
            return `
              <button type="button" class="library-board-card${isCurrent ? " is-current" : ""}" data-library-board="${entry.puzzle.id}">
                <span class="library-board-number">${entry.puzzle.title.replace(`${entry.difficulty.label} `, "")}</span>
                <span class="library-board-copy">
                  <strong>${escapeHtml(entry.puzzle.title)}</strong>
                  <small>${entry.puzzle.size}×${entry.puzzle.size} · ${entry.difficulty.logicalSteps} logical steps${isCurrent ? " · Current board" : ""}</small>
                </span>
                <span class="board-status is-${status.kind}">${status.label}</span>
                ${status.kind === "progress" ? `<span class="board-progress-note">${status.filled} cells filled</span>` : ""}
              </button>
            `;
          }).join("") : `<div class="library-empty">No ${selectedLibraryDifficulty} boards have been generated yet.</div>`}
        </div>
      </section>
    </div>
  `;
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

function renderDifficultyProgress() {
  const percent = difficultyProgress.percent;
  return `
    <section class="difficulty-report difficulty-loading" aria-label="Board difficulty is being evaluated" aria-live="polite">
      <p class="hint-kicker">Board difficulty</p>
      <div class="difficulty-grade">Evaluating…</div>
      <p class="difficulty-progress-detail">Checking ${escapeHtml(difficultyProgress.technique)} · ${escapeHtml(difficultyProgress.tier)}</p>
      <div class="generation-track" role="progressbar" aria-label="Difficulty analysis progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
        <div class="generation-fill difficulty-fill" style="width: ${Math.max(3, percent)}%"></div>
      </div>
      <p class="difficulty-progress-count">${difficultyProgress.starsPlaced} of ${difficultyProgress.totalStars} stars placed · ${difficultyProgress.stepsCompleted} logical steps</p>
    </section>
  `;
}

function updateDifficultyPanel() {
  const panel = root.querySelector(".difficulty-loading");
  if (!panel) return;
  panel.querySelector(".difficulty-progress-detail").textContent =
    `Checking ${difficultyProgress.technique} · ${difficultyProgress.tier}`;
  panel.querySelector(".generation-fill").style.width = `${Math.max(3, difficultyProgress.percent)}%`;
  panel.querySelector(".generation-track").setAttribute("aria-valuenow", String(difficultyProgress.percent));
  panel.querySelector(".difficulty-progress-count").textContent =
    `${difficultyProgress.starsPlaced} of ${difficultyProgress.totalStars} stars placed · ${difficultyProgress.stepsCompleted} logical steps`;
}

function renderDifficultyReport() {
  const report = gameState.analysis.difficultyReport;
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
      ${report.catalogRating
        ? `<p class="catalog-rating-note">Pre-rated for the board library · ${report.logicalSteps} logical steps</p>`
        : `<ul class="technique-summary">${summary}</ul>
          <details class="difficulty-details">
            <summary>Every logical move (${report.steps.length})</summary>
            <ol>${steps}</ol>
          </details>`}
    </section>
  `;
}

function formatDifficultyMove(move) {
  const token = move.state === "star" ? "★" : "×";
  return `${token} R${move.row + 1}C${move.col + 1}`;
}

function setSolutionReveal(visible) {
  solutionRevealVisible = visible;
  root.querySelector(".board")?.classList.toggle("is-debug-revealed", visible);
  const revealButton = root.querySelector("[data-action='reveal']");
  revealButton?.setAttribute("aria-pressed", String(visible));
  if (revealButton) revealButton.textContent = `DEBUG ${visible ? "hide" : "reveal"} solution`;
}

function getBorderStyle(houses, row, col) {
  const house = houses[row][col];
  const size = houses.length;
  const border = "var(--house-border-width) solid var(--board-line)";
  const thin = "var(--cell-border-width) solid var(--board-line-soft)";

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
