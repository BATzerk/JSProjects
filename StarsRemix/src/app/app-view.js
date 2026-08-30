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
        <div class="top-actions">
          <button class="action-button choose-board-button" type="button" data-action="browse-library">
            <span aria-hidden="true">✦</span> Choose a board
          </button>
          <button class="action-button create-board-button" type="button" data-action="board-editor">Create</button>
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
          <div class="history-controls board-controls" aria-label="Move history and puzzle help">
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
              <div class="hint-control${currentSoftHint ? " is-active" : ""}">
                <button class="action-button soft-hint-button" type="button" data-action="soft-hint" title="Hint (H)">Hint<span class="shortcut-key" aria-hidden="true">H</span></button>
                ${currentSoftHint ? '<button class="hint-dismiss-button" type="button" data-action="dismiss-soft-hint" aria-label="Dismiss hint" title="Dismiss hint">×</button>' : ""}
              </div>
              <button class="action-button check-button" type="button" data-action="check" title="Check (C)">Check<span class="shortcut-key" aria-hidden="true">C</span></button>
            </div>
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
                    <p class="hint-kicker">Hint Complete</p>
                    <h2>${escapeHtml(currentSoftHint.hint.title)}</h2>
                    <p class="soft-hint-success-message">That’s exactly the technique.</p>
                  </div>
                ` : `
                  <p class="hint-kicker">Hint · ${currentSoftHint.stage + 1} of ${currentSoftHint.hint.stages.length}</p>
                  <h2>${escapeHtml(currentSoftHint.hint.title)}</h2>
                  <p>${formatHintMessage(softHintStage.message)}</p>
                  <p class="hint-apply-prompt">${currentSoftHint.stage < currentSoftHint.hint.stages.length - 1 ? "Press Hint again for a little more." : "That's the full hint — the move is still yours."}</p>
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
          <details class="debug-panel">
            <summary>
              <span>Debug tools</span>
              <span class="debug-chevron" aria-hidden="true">+</span>
            </summary>
            <div class="debug-panel-body">
              <section class="debug-group" aria-label="Random board generator">
                <div>
                  <p class="control-kicker">Board generator</p>
                  <h2>Load a random test board</h2>
                </div>
                <div class="size-controls compact-size-controls" aria-label="Random board size">
                  ${[9, 10, 11].map((size) => `
                    <button class="size-button${selectedBoardSize === size ? " is-active" : ""}" type="button" data-size="${size}" aria-pressed="${selectedBoardSize === size}" ${generationProgress ? "disabled" : ""}>${size}×${size}</button>
                  `).join("")}
                </div>
                <button class="debug-primary-button" type="button" data-action="generate" ${generationProgress ? "disabled" : ""}>
                  New random ${selectedBoardSize}×${selectedBoardSize}
                </button>
              </section>
              <section class="debug-group debug-file-tools" aria-label="Game file tools">
                <button type="button" data-action="reveal" aria-pressed="${solutionRevealVisible}">${solutionRevealVisible ? "Hide" : "Reveal"} solution</button>
                <button type="button" data-action="save-board">Export game file</button>
                <button type="button" data-action="load-board">Import game file</button>
                <input class="board-file-input" type="file" accept=".stars,.stars.json,.json,text/plain,application/json" data-board-file hidden>
              </section>
              ${fileNotice ? `<span class="debug-notice ${fileNotice.kind}" role="status">${escapeHtml(fileNotice.message)}</span>` : ""}
            </div>
          </details>
          <p class="site-credit">Based on Inkwell's fabulous game, <a href="https://inkwellgames.com/games/stars">Stars</a>. This is a fan-made recreation only made public so Brett's friend Chris Hallberg can play.</p>
          <div class="bottom-actions">
            <button class="icon-button theme-toggle" type="button" data-action="toggle-theme" aria-label="Switch to ${nightMode ? "day" : "night"} mode" title="Switch to ${nightMode ? "day" : "night"} mode" aria-pressed="${nightMode}">
              ${nightMode
                ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>'
                : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.1A8.5 8.5 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z" /></svg>'}
            </button>
          </div>
        </div>
      </section>
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
      if (!isDraggingMarks || window.matchMedia("(hover: none), (pointer: coarse)").matches) return;
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

  root.querySelector("[data-action='toggle-theme']")?.addEventListener("click", () => {
    setNightMode(!nightMode);
  });

  root.querySelectorAll("[data-action='browse-library']").forEach((button) => {
    button.addEventListener("click", () => {
      const currentEntry = getLibraryBoard(gameState.puzzle.id);
      selectedLibrarySource = currentEntry?.source === "community" ? "community" : "built-in";
      selectedLibraryDifficulty = currentEntry?.difficulty.label ?? selectedLibraryDifficulty;
      boardLibraryOpen = true;
      render();
      loadCommunityBoards();
    });
  });
  root.querySelectorAll("[data-action='board-editor']").forEach((button) => {
    button.addEventListener("click", () => {
      window.location.href = "./editor.html";
    });
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

  root.querySelectorAll("[data-library-source]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedLibrarySource = button.dataset.librarySource;
      render();
      if (selectedLibrarySource === "community") loadCommunityBoards();
    });
  });

  root.querySelectorAll("[data-library-board]").forEach((button) => {
    button.addEventListener("click", () => loadLibraryBoard(button.dataset.libraryBoard));
  });

  root.querySelector("[data-action='surprise-board']")?.addEventListener("click", () => {
    const choices = boardLibrary.boards.filter(
      (entry) => entry.puzzle.id !== gameState.puzzle.id &&
        (entry.source === "community" ? "community" : "built-in") === selectedLibrarySource,
    );
    const choice = choices[Math.floor(Math.random() * choices.length)];
    if (choice) loadLibraryBoard(choice.puzzle.id);
  });

  root.querySelector("[data-action='save-board']")?.addEventListener("click", saveBoardFile);
  root.querySelector("[data-action='load-board']")?.addEventListener("click", () => {
    root.querySelector("[data-board-file]")?.click();
  });
  root.querySelector("[data-board-file]")?.addEventListener("change", loadBoardFile);

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

  root.querySelector("[data-action='dismiss-soft-hint']")?.addEventListener("click", () => {
    clearSoftHintSuccessTimers();
    currentSoftHint = null;
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
  const sourceBoards = boardLibrary.boards.filter(
    (entry) => (entry.source === "community" ? "community" : "built-in") === selectedLibrarySource,
  );
  const selectedBoards = sourceBoards
    .filter(({ difficulty }) => difficulty.label === selectedLibraryDifficulty)
    .map((entry, index) => ({
      entry,
      displayNumber: index + 1,
      played: getLibraryBoardStatus(entry, progress).kind !== "new",
    }))
    .sort((left, right) => Number(left.played) - Number(right.played));

  return `
    <div class="library-overlay" role="dialog" aria-modal="true" aria-labelledby="library-title">
      <section class="library-dialog">
        <header class="library-header">
          <div>
            <p class="library-kicker">Find your next constellation</p>
            <h2 id="library-title">Choose a board</h2>
          </div>
          <button class="library-surprise" type="button" data-action="surprise-board">Surprise me</button>
          <button class="library-close" type="button" data-action="close-library" aria-label="Close board library">×</button>
        </header>
        <nav class="library-source-tabs" aria-label="Board collection">
          <button type="button" data-library-source="built-in" class="library-source-tab${selectedLibrarySource === "built-in" ? " is-active" : ""}" aria-pressed="${selectedLibrarySource === "built-in"}">Built-in</button>
          <button type="button" data-library-source="community" class="library-source-tab${selectedLibrarySource === "community" ? " is-active" : ""}" aria-pressed="${selectedLibrarySource === "community"}">Community${communityBoardsLoading ? '<span class="loading-dot" aria-label="Loading"></span>' : ""}</button>
        </nav>
        <nav class="difficulty-tabs" aria-label="Choose a difficulty">
          ${libraryDifficulties.map((difficulty) => {
            const count = sourceBoards.filter((entry) => entry.difficulty.label === difficulty).length;
            return `
              <button type="button" data-library-difficulty="${difficulty}" data-difficulty="${difficulty}" class="difficulty-tab${selectedLibraryDifficulty === difficulty ? " is-active" : ""}" aria-pressed="${selectedLibraryDifficulty === difficulty}">
                <span>${difficulty}</span>
                <small>${count}</small>
              </button>
            `;
          }).join("")}
        </nav>
        <div class="library-board-list" aria-label="${selectedLibraryDifficulty} boards">
          ${selectedBoards.length ? selectedBoards.map(({ entry, displayNumber }) => {
            const status = getLibraryBoardStatus(entry, progress);
            const isCurrent = entry.puzzle.id === gameState.puzzle.id;
            const displayTitle = entry.source === "community"
              ? entry.puzzle.title
              : `#${displayNumber}`;
            const statusLabel = isCurrent
              ? "Playing"
              : status.kind === "completed"
                ? "✓ Completed"
                : status.kind === "progress"
                  ? "Continue"
                  : "";
            return `
              <button type="button" class="library-board-card${isCurrent ? " is-current" : ""}" data-library-board="${entry.puzzle.id}" data-difficulty="${entry.difficulty.label}">
                ${renderLibraryThumbnail(entry.puzzle)}
                <span class="library-board-copy">
                  <strong>${escapeHtml(displayTitle)}</strong>
                  ${entry.source === "community" ? `<small>by ${escapeHtml(entry.author?.name ?? "a player")}</small>` : ""}
                  ${statusLabel ? `<small class="board-card-status is-${isCurrent ? "current" : status.kind}">${statusLabel}</small>` : ""}
                </span>
              </button>
            `;
          }).join("") : `
            <div class="library-empty">
              <p>${selectedLibrarySource === "community" ? `No ${selectedLibraryDifficulty.toLowerCase()} community boards yet.` : `No ${selectedLibraryDifficulty.toLowerCase()} boards yet.`}</p>
              ${selectedLibrarySource === "community" ? '<button class="library-workshop-link" type="button" data-action="board-editor">Make one in the Board Workshop</button>' : ""}
              ${selectedLibrarySource === "community" && communityBoardsError ? `<small class="library-load-error">${escapeHtml(communityBoardsError)}</small>` : ""}
            </div>
          `}
        </div>
        <footer class="library-footer">
          <span>Have a constellation in mind?</span>
          <button type="button" data-action="board-editor">Create a board <span aria-hidden="true">→</span></button>
        </footer>
      </section>
    </div>
  `;
}

function renderLibraryThumbnail(puzzle) {
  const size = puzzle.size;
  const lines = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const edges = getHouseEdges(puzzle.houses, row, col);
      // Draw only the interior house boundaries; the outer <rect> frames the board.
      if (col < size - 1 && edges.right) lines.push(`M${col + 1} ${row}v1`);
      if (row < size - 1 && edges.bottom) lines.push(`M${col} ${row + 1}h1`);
    }
  }
  return `
    <svg class="library-board-thumbnail" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <rect x=".12" y=".12" width="${size - 0.24}" height="${size - 0.24}" rx=".35"></rect>
      <path d="${lines.join("")}"></path>
    </svg>
  `;
}

function generationPercent() {
  return generationProgress.maximum === 0
    ? 0
    : Math.min(99, Math.round((generationProgress.attempt / generationProgress.maximum) * 100));
}

function generationDetailText() {
  return `Trying constellation ${generationProgress.attempt + 1} of ${generationProgress.maximum}`;
}

function renderGenerationOverlay() {
  const percent = generationPercent();
  return `
    <div class="generation-overlay" role="dialog" aria-modal="true" aria-labelledby="generation-title">
      <div class="generation-card">
        <div class="generation-sparkle" aria-hidden="true">✦</div>
        <h2 id="generation-title">Generating Board</h2>
        <p class="generation-detail">${generationDetailText()}</p>
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
  const percent = generationPercent();
  overlay.querySelector(".generation-detail").textContent = generationDetailText();
  overlay.querySelector(".generation-fill").style.width = `${percent}%`;
  overlay.querySelector(".generation-track").setAttribute("aria-valuenow", String(percent));
  overlay.querySelector(".generation-percent").textContent = `${percent}% of attempt budget`;
}

function difficultyDetailText() {
  return `Checking ${difficultyProgress.technique} · ${difficultyProgress.tier}`;
}

function difficultyCountText() {
  return `${difficultyProgress.starsPlaced} of ${difficultyProgress.totalStars} stars placed · ${difficultyProgress.stepsCompleted} logical steps`;
}

function difficultyFillWidth() {
  return `${Math.max(3, difficultyProgress.percent)}%`;
}

function renderDifficultyProgress() {
  const percent = difficultyProgress.percent;
  return `
    <section class="difficulty-report difficulty-loading" aria-label="Board difficulty is being evaluated" aria-live="polite">
      <p class="hint-kicker">Board difficulty</p>
      <div class="difficulty-grade">Evaluating…</div>
      <p class="difficulty-progress-detail">${escapeHtml(difficultyDetailText())}</p>
      <div class="generation-track" role="progressbar" aria-label="Difficulty analysis progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
        <div class="generation-fill difficulty-fill" style="width: ${difficultyFillWidth()}"></div>
      </div>
      <p class="difficulty-progress-count">${difficultyCountText()}</p>
    </section>
  `;
}

function updateDifficultyPanel() {
  const panel = root.querySelector(".difficulty-loading");
  if (!panel) return;
  panel.querySelector(".difficulty-progress-detail").textContent = difficultyDetailText();
  panel.querySelector(".generation-fill").style.width = difficultyFillWidth();
  panel.querySelector(".generation-track").setAttribute("aria-valuenow", String(difficultyProgress.percent));
  panel.querySelector(".difficulty-progress-count").textContent = difficultyCountText();
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
    <section class="difficulty-report compact-difficulty-report" aria-label="Board difficulty report">
      <div class="difficulty-at-a-glance">
        <div>
          <p class="hint-kicker">Board difficulty</p>
          <div class="difficulty-grade">${escapeHtml(report.label)}</div>
        </div>
      </div>
      <p>${report.solved
        ? `${report.logicalSteps ?? report.steps.length} logical steps · weighted score ${report.score}`
        : `${report.starsPlaced} of ${report.totalStars} stars placed by the current analyzer.`}</p>
      ${report.catalogRating
        ? `<p class="catalog-rating-note">Rated for the board library</p>`
        : `<details class="analysis-disclosure">
            <summary>View full analysis · ${report.steps.length} logical steps</summary>
            <ul class="technique-summary">${summary}</ul>
            <div class="difficulty-details expanded-difficulty-details">
              <p>Every logical move</p>
              <ol>${steps}</ol>
            </div>
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
  if (revealButton) revealButton.textContent = `${visible ? "Hide" : "Reveal"} solution`;
}

function getBorderStyle(houses, row, col) {
  const edges = getHouseEdges(houses, row, col);
  const border = "var(--house-border-width) solid var(--board-line)";
  const thin = "var(--cell-border-width) solid var(--board-line-soft)";

  return [
    `border-top: ${edges.top ? border : thin}`,
    `border-right: ${edges.right ? border : thin}`,
    `border-bottom: ${edges.bottom ? border : thin}`,
    `border-left: ${edges.left ? border : thin}`,
  ].join("; ");
}
