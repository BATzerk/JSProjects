(function () {
  const root = document.querySelector("#editor-root");
  const colors = [
    "#f3b8aa", "#a9d8b8", "#cbb8ec", "#f0d178", "#9dd8e8", "#efa9c5",
    "#c4dc8c", "#e9ba80", "#aebee8", "#91d6c7", "#e5a88e",
  ];
  const storageKey = "stars-remix:board-editor-draft:v1";
  let state = loadDraft();
  let result = null;
  let difficulty = null;
  let published = null;
  let worker = null;
  let busyMessage = "";
  let progress = null;
  let notice = null;
  let showSolution = false;
  let painting = false;
  let paintMode = "paint";
  let activePaintHouse = null;

  function blankState(size = 9) {
    return {
      size,
      title: "",
      houses: Array.from({ length: size }, () => Array(size).fill(-1)),
    };
  }

  function loadDraft() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      const validGrid = [9, 10, 11].includes(saved.size) &&
        Array.isArray(saved.houses) && saved.houses.length === saved.size &&
        saved.houses.every((row) => Array.isArray(row) && row.length === saved.size &&
          row.every((house) => Number.isInteger(house) && house >= -1 && house < saved.size));
      if (validGrid) return saved;
    } catch {}
    return blankState();
  }

  function saveDraft() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
  }

  function render() {
    const displayHouses = result?.puzzle.houses ?? state.houses;
    const solutionKeys = new Set((showSolution ? result?.solution ?? [] : [])
      .map(({ row, col }) => `${row}:${col}`));
    const paintedCounts = Array.from({ length: state.size }, (_, house) =>
      state.houses.flat().filter((value) => value === house).length,
    );
    const nextUnusedHouse = paintedCounts.findIndex((count) => count === 0);
    const inspection = globalThis.StarsRemixEngine.inspectPartialHouses(state.houses);
    const assignedCount = state.houses.flat().filter((house) => house >= 0).length;
    const canPublish = result && difficulty?.solved && difficulty.label !== "Incalculable" && state.title.trim() && !published;

    root.innerHTML = `
      <main class="workshop-shell">
        <header class="workshop-header">
          <div>
            <a class="back-link" href="./index.html">← Back to StarsRemix</a>
            <p class="eyebrow">Local design tool</p>
            <h1>Board Workshop</h1>
            <p class="lede">Paint the houses you care about. The workshop will preserve them exactly and construct a unique, solvable board around them.</p>
          </div>
          <div class="draft-fields">
            <label>Board title<input id="board-title" maxlength="80" placeholder="e.g. Crescent Garden" value="${escapeHtml(state.title)}"></label>
            <label>Board size<select id="board-size">${[9, 10, 11].map((size) => `<option ${state.size === size ? "selected" : ""}>${size}</option>`).join("")}</select></label>
          </div>
        </header>

        <section class="workspace">
          <div class="board-column">
            <div class="board-meta">
              <span>${assignedCount} of ${state.size * state.size} tiles handmade</span>
              <span>${paintedCounts.filter(Boolean).length} of ${state.size} houses painted</span>
            </div>
            <div class="editor-board ${result ? "is-completed" : ""}" style="--board-size:${state.size}" aria-label="House editor board">
              ${displayHouses.map((row, rowIndex) => row.map((house, colIndex) => {
                const star = solutionKeys.has(`${rowIndex}:${colIndex}`);
                const blank = house === -1;
                return `<button class="editor-cell ${blank ? "is-blank" : ""}" data-row="${rowIndex}" data-col="${colIndex}" style="${cellStyle(displayHouses, rowIndex, colIndex)}" aria-label="Row ${rowIndex + 1}, column ${colIndex + 1}${blank ? ", unassigned" : `, house ${house + 1}`}">${star ? "<span class=\"solution-star\">★</span>" : ""}</button>`;
              }).join("")).join("")}
            </div>
            <p class="board-help">Start a stroke on a blank tile to paint the next unused house. Start on an existing house to extend it. Right-click and drag to erase.</p>
          </div>

          <aside class="tool-panel">
            <section class="completion-section">
              <p class="step">When ready</p><h2>Complete & analyze</h2>
              <div class="primary-actions">
                <button class="button primary" id="complete-board" ${worker ? "disabled" : ""}>${result ? "Try another completion" : "Complete board"}</button>
                ${worker ? '<button class="button secondary" id="cancel-work">Cancel</button>' : ""}
              </div>
              ${busyMessage ? `<div class="progress-card"><span class="spinner"></span><div><strong>${escapeHtml(busyMessage)}</strong><small>${escapeHtml(progress ?? "This can take a moment for tightly constrained shapes.")}</small></div></div>` : ""}
              ${notice ? noticePanel() : ""}
              ${result && difficulty ? resultPanel() : ""}
            </section>

            <section>
              <div class="section-heading"><div><p class="step">Paint</p><h2>Paint houses</h2></div><button class="text-button" id="clear-paint" ${assignedCount ? "" : "disabled"}>Clear paint</button></div>
              <div class="house-palette" style="--palette-size:${state.size}" aria-label="House colors">
                ${paintedCounts.map((count, house) => `<div class="house-swatch ${nextUnusedHouse === house ? "is-next" : ""}" style="--swatch:${colors[house % colors.length]}" title="House ${house + 1} · ${count ? `${count} tiles` : nextUnusedHouse === house ? "paints next" : "unused"}" aria-label="House ${house + 1}, ${count ? `${count} tiles` : nextUnusedHouse === house ? "paints next" : "unused"}">${house + 1}</div>`).join("")}
              </div>
              <p class="tip">Each new stroke on blank space automatically uses the next unused color. Painted houses are treated as finished, exact shapes.</p>
              ${legalityPanel(inspection)}
            </section>

            <section class="publish-section">
              <p class="step">Publish</p><h2>Add to the game</h2>
              <p class="tip">Publishing creates an individual handmade source file and rebuilds the game’s board library immediately.</p>
              <button class="button publish" id="publish-board" ${canPublish ? "" : "disabled"}>${published ? "Added to library ✓" : "Add to board library"}</button>
              ${published ? `<p class="published-note">Saved as <strong>${escapeHtml(published.puzzle.id)}</strong>. It is ready in the game’s ${escapeHtml(published.difficulty.label)} library.</p>` : ""}
            </section>
          </aside>
        </section>
        <footer class="workshop-reset">
          <div><strong>Want to start over?</strong><span>This clears the handmade draft but does not remove published boards.</span></div>
          <button class="button secondary" id="new-board">New blank board</button>
        </footer>
      </main>`;
    bindEvents();
  }

  function legalityPanel(inspection) {
    if (inspection.valid) {
      const remaining = inspection.missingHouseIds.length;
      return `<div class="legality-card is-valid" role="status"><strong>Shape is viable</strong><p>${remaining ? `${remaining} ${remaining === 1 ? "house remains" : "houses remain"} for automatic completion.` : "All houses are painted and locally legal."}</p></div>`;
    }
    return `<div class="legality-card is-invalid" role="alert"><strong>Not completable yet</strong><ul>${inspection.issues.map((issue) => `<li>${escapeHtml(issue.message)}</li>`).join("")}</ul></div>`;
  }

  function noticePanel() {
    return `<div class="notice ${notice.kind}" role="status"><strong>${escapeHtml(notice.message)}</strong>${notice.details?.length ? `<ul>${notice.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul>` : ""}</div>`;
  }

  function resultPanel() {
    return `<div class="result-card">
      <div class="difficulty-badge ${difficulty.label.toLowerCase().replaceAll(" ", "-")}">${escapeHtml(difficulty.label)}</div>
      <dl><div><dt>Score</dt><dd>${difficulty.score}</dd></div><div><dt>Logical steps</dt><dd>${difficulty.logicalSteps}</dd></div><div><dt>Advanced moves</dt><dd>${difficulty.bigTicketCount}</dd></div><div><dt>Attempts</dt><dd>${result.diagnostics.attempts}</dd></div></dl>
      <label class="solution-toggle"><input id="show-solution" type="checkbox" ${showSolution ? "checked" : ""}> Show solution stars</label>
    </div>`;
  }

  function cellStyle(houses, row, col) {
    const house = houses[row][col];
    if (house === -1) return "";
    const thick = "3px solid #25231f";
    const thin = "1px solid rgba(37,35,31,.22)";
    return [
      `--cell-color:${colors[house % colors.length]}`,
      `border-top:${row === 0 || houses[row - 1][col] !== house ? thick : thin}`,
      `border-right:${col === state.size - 1 || houses[row][col + 1] !== house ? thick : thin}`,
      `border-bottom:${row === state.size - 1 || houses[row + 1][col] !== house ? thick : thin}`,
      `border-left:${col === 0 || houses[row][col - 1] !== house ? thick : thin}`,
    ].join(";");
  }

  function bindEvents() {
    document.querySelector("#board-title").addEventListener("input", (event) => {
      state.title = event.target.value;
      published = null;
      saveDraft();
      const publishButton = document.querySelector("#publish-board");
      if (publishButton) {
        publishButton.disabled = !(result && difficulty?.solved && difficulty.label !== "Incalculable" && state.title.trim());
      }
    });
    document.querySelector("#board-size").addEventListener("change", (event) => {
      const size = Number(event.target.value);
      state = blankState(size);
      resetResult();
      saveDraft();
      render();
    });
    document.querySelector("#new-board").addEventListener("click", () => {
      if (state.houses.flat().some((house) => house >= 0) && !confirm("Start over with a totally blank board?")) return;
      state = blankState(state.size);
      resetResult();
      saveDraft();
      render();
    });
    document.querySelector("#clear-paint").addEventListener("click", () => {
      state.houses = Array.from({ length: state.size }, () => Array(state.size).fill(-1));
      resetResult();
      saveDraft();
      render();
    });
    document.querySelectorAll(".editor-cell").forEach((cell) => {
      cell.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 && event.button !== 2) return;
        event.preventDefault();
        if (result) resetResult();
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        paintMode = event.button === 2 ? "erase" : "paint";
        if (paintMode === "paint") {
          activePaintHouse = globalThis.StarsRemixEngine.getPaintHouseId(state.houses, row, col);
          if (activePaintHouse === -1) {
            painting = false;
            notice = { kind: "error", message: "All house colors are already in use. Start on an existing house to extend it, or erase a house first." };
            render();
            return;
          }
        } else {
          activePaintHouse = null;
        }
        painting = true;
        paintCell(row, col);
      });
      cell.addEventListener("pointerenter", (event) => {
        if (!painting || (event.buttons & 3) === 0) return;
        paintCell(Number(cell.dataset.row), Number(cell.dataset.col));
      });
      cell.addEventListener("contextmenu", (event) => event.preventDefault());
    });
    document.querySelector("#complete-board").addEventListener("click", completeBoard);
    document.querySelector("#cancel-work")?.addEventListener("click", cancelWork);
    document.querySelector("#show-solution")?.addEventListener("change", (event) => {
      showSolution = event.target.checked;
      render();
    });
    document.querySelector("#publish-board").addEventListener("click", publishBoard);
  }

  function paintCell(row, col) {
    if (result) resetResult();
    const current = state.houses[row][col];
    if (paintMode === "paint" && current >= 0 && current !== activePaintHouse) return;
    const value = paintMode === "erase" ? -1 : activePaintHouse;
    if (state.houses[row][col] === value) return;
    state.houses[row][col] = value;
    notice = null;
    saveDraft();
    render();
  }

  function completeBoard() {
    notice = null;
    published = null;
    const inspection = globalThis.StarsRemixEngine.inspectPartialHouses(state.houses);
    if (!inspection.valid) {
      notice = {
        kind: "error",
        message: "This draft cannot be completed yet:",
        details: inspection.issues.map((issue) => issue.message),
      };
      render();
      return;
    }
    worker = new Worker("./src/editor/editor-worker.js");
    busyMessage = "Constructing the missing houses…";
    progress = "Beginning the search";
    worker.addEventListener("message", handleWorkerMessage);
    worker.addEventListener("error", () => finishWithError("The completion worker stopped unexpectedly."));
    worker.postMessage({
      type: "complete",
      houses: state.houses,
      title: state.title.trim() || "Untitled Handmade Board",
      seed: `editor-${Date.now()}-${Math.random()}`,
      maxAttempts: state.size === 11 ? 3_000 : 4_000,
    });
    render();
  }

  function handleWorkerMessage(event) {
    const message = event.data;
    if (message.type === "generation-progress") {
      const candidateLabel = message.progress.candidateMaximum > 1 ? `Candidate ${message.progress.candidate} of ${message.progress.candidateMaximum} · ` : "";
      progress = `${candidateLabel}attempt ${message.progress.attempt} of ${message.progress.maximum}`;
      render();
    } else if (message.type === "analysis-started") {
      result = message.generated;
      busyMessage = "Checking logical difficulty…";
      progress = `${message.candidateMaximum > 1 ? `Candidate ${message.candidate} of ${message.candidateMaximum} · ` : ""}testing the basic rules`;
      render();
    } else if (message.type === "difficulty-progress") {
      const detail = message.progress.technique || "logical techniques";
      const candidateLabel = message.progress.candidateMaximum > 1 ? `Candidate ${message.progress.candidate} of ${message.progress.candidateMaximum} · ` : "";
      progress = `${candidateLabel}${message.progress.percent ?? 0}% · ${detail}`;
      render();
    } else if (message.type === "candidate-rejected") {
      result = null;
      busyMessage = "Trying a more logically solvable completion…";
      progress = `The unique candidate ${message.candidate} of ${message.candidateMaximum} was incalculable`;
      render();
    } else if (message.type === "completed") {
      result = message.generated;
      difficulty = message.difficulty;
      if (!difficulty.solved || difficulty.label === "Incalculable") {
        notice = { kind: "error", message: "The board is unique, but the logical analyzer could not finish it. Try another completion." };
      } else {
        notice = { kind: "success", message: "Unique solution confirmed. This board is ready to publish." };
      }
      stopWorker();
      render();
    } else if (message.type === "error") {
      finishWithError(message.message);
    }
  }

  async function publishBoard() {
    if (!result || !difficulty) return;
    const title = state.title.trim();
    if (!title) {
      notice = { kind: "error", message: "Give the board a title before publishing." };
      render();
      return;
    }
    busyMessage = "Adding the board to the library…";
    progress = "Validating it one last time";
    render();
    try {
      const response = await fetch("./api/handmade-boards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ puzzle: { ...result.puzzle, title } }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to publish this board.");
      published = body.entry;
      result.puzzle.id = body.entry.puzzle.id;
      result.puzzle.title = body.entry.puzzle.title;
      notice = { kind: "success", message: "Board added to the library." };
    } catch (error) {
      notice = { kind: "error", message: error.message };
    } finally {
      busyMessage = "";
      progress = null;
      render();
    }
  }

  function cancelWork() {
    stopWorker();
    result = null;
    difficulty = null;
    notice = { kind: "info", message: "Completion cancelled. Your painted houses are unchanged." };
    render();
  }

  function finishWithError(message) {
    stopWorker();
    result = null;
    difficulty = null;
    notice = { kind: "error", message };
    render();
  }

  function stopWorker() {
    worker?.terminate();
    worker = null;
    busyMessage = "";
    progress = null;
  }

  function resetResult() {
    result = null;
    difficulty = null;
    published = null;
    showSolution = false;
    notice = null;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    })[character]);
  }

  window.addEventListener("pointerup", () => { painting = false; activePaintHouse = null; });
  window.addEventListener("blur", () => { painting = false; activePaintHouse = null; });
  render();
})();
