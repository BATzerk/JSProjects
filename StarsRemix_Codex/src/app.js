(function () {
  const starterPuzzle = {
    id: "codex-starter-8x8",
    title: "First Light",
    size: 8,
    starsPerUnit: 2,
    houses: [
      [4, 4, 4, 5, 5, 5, 6, 6],
      [4, 4, 4, 5, 5, 5, 6, 6],
      [3, 3, 5, 5, 1, 1, 6, 6],
      [3, 3, 5, 0, 1, 1, 1, 7],
      [3, 2, 5, 0, 1, 1, 1, 7],
      [3, 2, 2, 0, 0, 0, 7, 7],
      [3, 3, 2, 2, 0, 0, 7, 7],
      [3, 3, 2, 2, 0, 0, 7, 7],
    ],
  };
  const starterSolution = [
    { row: 0, col: 4 }, { row: 0, col: 6 },
    { row: 1, col: 0 }, { row: 1, col: 2 },
    { row: 2, col: 4 }, { row: 2, col: 6 },
    { row: 3, col: 0 }, { row: 3, col: 2 },
    { row: 4, col: 5 }, { row: 4, col: 7 },
    { row: 5, col: 1 }, { row: 5, col: 3 },
    { row: 6, col: 5 }, { row: 6, col: 7 },
    { row: 7, col: 1 }, { row: 7, col: 3 },
  ];

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

  let puzzle = starterPuzzle;
  let solution = starterSolution;
  let selectedBoardSize = 10;
  let board = createEmptyBoard(puzzle.size);
  let undoStack = [];
  let redoStack = [];
  let isDraggingMarks = false;
  let currentHint = null;

  const root = document.querySelector("#root");

  if (!root) {
    throw new Error("Missing app root.");
  }

  validatePuzzleShape(puzzle);
  render();

  function render() {
    const validation = validateBoard(puzzle, board);
    const conflictKeys = new Set();
    const hintColors = new Map(
      (currentHint?.cells ?? []).map((cell) => [getStarKey(cell), cell.color]),
    );

    validation.conflicts.forEach((conflict) => {
      conflict.cells.forEach((cell) => conflictKeys.add(getStarKey(cell)));
    });

    root.innerHTML = `
      <main class="app-shell">
        <section class="top-bar" aria-label="Puzzle controls">
          <p class="brand">StarsRemix - Codex</p>
          <div class="size-controls" aria-label="Board size">
            ${[9, 10].map((size) => `
              <button class="size-button${selectedBoardSize === size ? " is-active" : ""}" type="button" data-size="${size}" aria-pressed="${selectedBoardSize === size}">${size}×${size}</button>
            `).join("")}
          </div>
          <button class="action-button" type="button" data-action="generate">new board</button>
          <button class="action-button hint-button" type="button" data-action="hint">Hint</button>
          <button class="action-button debug-reveal-button" type="button" data-action="reveal">DEBUG reveal solution</button>
          <button class="icon-button" type="button" aria-label="Undo" title="Undo" data-action="undo" ${undoStack.length === 0 ? "disabled" : ""}>
            ↺
          </button>
          <button class="icon-button" type="button" aria-label="Redo" title="Redo" data-action="redo" ${redoStack.length === 0 ? "disabled" : ""}>
            ↻
          </button>
        </section>

        <section class="play-layout">
          <div class="board-wrap">
            <div class="board" role="grid" aria-label="${puzzle.size} by ${puzzle.size} star puzzle">
              ${renderCells(conflictKeys, hintColors)}
            </div>
          </div>

          <aside class="status-panel" aria-label="Puzzle status">
            ${validation.solved ? '<div class="solved-banner is-visible">Solved</div>' : ""}
            ${currentHint ? `
              <div class="hint-card" role="status" aria-live="polite">
                <h2>Hint</h2>
                <p>${escapeHtml(currentHint.message)}</p>
              </div>
            ` : ""}
            <div class="conflict-list">
              <h2>Conflicts</h2>
              ${
                validation.conflicts.length === 0
                  ? "<p>None</p>"
                  : validation.conflicts
                      .slice(0, 4)
                      .map((conflict) => `<p>${escapeHtml(conflict.reason)}</p>`)
                      .join("")
              }
            </div>
          </aside>
        </section>
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
        if (board[row][col] !== "mark") {
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

    root.querySelector("[data-action='hint']")?.addEventListener("click", () => {
      currentHint = validation.solved
        ? { kind: "solved", message: "The puzzle is solved — no hint needed!", cells: [] }
        : globalThis.StarsRemixHints.findHint(puzzle, board, solution);
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

  function loadGeneratedPuzzle(size) {
    selectedBoardSize = size;
    const generated = generatePuzzle(size);
    puzzle = generated.puzzle;
    solution = generated.solution;
    board = createEmptyBoard(puzzle.size);
    undoStack = [];
    redoStack = [];
    currentHint = null;
    render();
  }

  function renderCells(conflictKeys, hintColors) {
    return board
      .map((row, rowIndex) =>
        row
          .map((cell, colIndex) => {
            const houseId = puzzle.houses[rowIndex][colIndex];
            const hasConflict = conflictKeys.has(getStarKey({ row: rowIndex, col: colIndex }));
            const hintColor = hintColors.get(getStarKey({ row: rowIndex, col: colIndex }));
            const classes = [
              "cell",
              cell !== "empty" ? `is-${cell}` : "",
              hasConflict ? "has-conflict" : "",
              hintColor ? `hint-${hintColor}` : "",
            ]
              .filter(Boolean)
              .join(" ");
            const borders = getBorderStyle(puzzle.houses, rowIndex, colIndex);
            const content = renderCellContent(cell);
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
                style="background-color: ${housePalette[houseId % housePalette.length]}; ${borders}"
              >${debugSolution}${content}</button>
            `;
          })
          .join(""),
      )
      .join("");
  }

  function renderCellContent(cell) {
    if (cell === "star") {
      return `
        <svg class="star-token" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <defs>
            <radialGradient id="star-shine" cx="36%" cy="26%" r="72%">
              <stop offset="0%" stop-color="#fff2a1" />
              <stop offset="42%" stop-color="#ffbd35" />
              <stop offset="100%" stop-color="#f08318" />
            </radialGradient>
          </defs>
          <path class="star-body" d="M50 8 C54 8 57 30 61 34 C65 38 88 33 90 37 C92 41 72 53 70 58 C68 64 82 82 78 86 C75 90 57 76 50 76 C43 76 25 90 22 86 C18 82 32 64 30 58 C28 53 8 41 10 37 C12 33 35 38 39 34 C43 30 46 8 50 8 Z" />
          <path class="star-highlight" d="M38 32 C43 23 49 18 54 18 C57 18 55 25 49 31 C44 36 36 40 34 38 C32 37 34 35 38 32 Z" />
        </svg>
      `;
    }

    if (cell === "mark") {
      return '<span class="mark-token" aria-hidden="true">×</span>';
    }

    return "";
  }

  function applyBoard(nextBoard) {
    if (boardsMatch(board, nextBoard)) return;
    undoStack = [...undoStack, board];
    redoStack = [];
    board = nextBoard;
    currentHint = null;
    render();
  }

  function replaceBoard(nextBoard) {
    if (boardsMatch(board, nextBoard)) return;
    board = nextBoard;
    currentHint = null;
    render();
  }

  function undo() {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    undoStack = undoStack.slice(0, -1);
    redoStack = [...redoStack, board];
    board = previous;
    currentHint = null;
    render();
  }

  function redo() {
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    redoStack = redoStack.slice(0, -1);
    undoStack = [...undoStack, board];
    board = next;
    currentHint = null;
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

  function generatePuzzle(size) {
    const starsPerUnit = 2;
    if (size < 9) {
      throw new Error(
        "Random two-star boards require at least 9 rows and columns to avoid predictable maximum-density layouts.",
      );
    }
    const patterns = createRowPatterns(size, starsPerUnit);

    for (let attempt = 0; attempt < 1000; attempt += 1) {
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
      if (countSolutions(candidate, patterns, 2) === 1) return { puzzle: candidate, solution };
    }
    throw new Error("Unable to generate a unique puzzle. Please try again.");
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
  });
})();
