import { createEmptyBoard, cycleCellState, setCell, validatePuzzleShape } from "./game/board.js";
import { starterPuzzle } from "./game/puzzles.js";
import { getStarKey, validateBoard } from "./game/rules.js";

validatePuzzleShape(starterPuzzle);

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

let board = createEmptyBoard(starterPuzzle.size);
let undoStack = [];
let redoStack = [];
let isDraggingMarks = false;

const root = document.querySelector("#root");

if (!root) {
  throw new Error("Missing app root.");
}

render();

function render() {
  const validation = validateBoard(starterPuzzle, board);
  const conflictKeys = new Set();

  validation.conflicts.forEach((conflict) => {
    conflict.cells.forEach((cell) => conflictKeys.add(getStarKey(cell)));
  });

  root.innerHTML = `
    <main class="app-shell">
      <section class="top-bar" aria-label="Puzzle controls">
        <div>
          <p class="eyebrow">StarsRemix Codex</p>
          <h1>${starterPuzzle.title}</h1>
        </div>
        <button class="icon-button" type="button" aria-label="Undo" title="Undo" data-action="undo" ${undoStack.length === 0 ? "disabled" : ""}>
          ↺
        </button>
        <button class="icon-button" type="button" aria-label="Redo" title="Redo" data-action="redo" ${redoStack.length === 0 ? "disabled" : ""}>
          ↻
        </button>
      </section>

      <section class="play-layout">
        <div class="board-wrap">
          <div class="board" role="grid" aria-label="${starterPuzzle.size} by ${starterPuzzle.size} star puzzle">
            ${renderCells(conflictKeys)}
          </div>
        </div>

        <aside class="status-panel" aria-label="Puzzle status">
          <div class="${validation.solved ? "solved-banner is-visible" : "solved-banner"}">Solved</div>
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
    boardElement.style.gridTemplateColumns = `repeat(${starterPuzzle.size}, minmax(0, 1fr))`;
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
}

function renderCells(conflictKeys) {
  return board
    .map((row, rowIndex) =>
      row
        .map((cell, colIndex) => {
          const houseId = starterPuzzle.houses[rowIndex][colIndex];
          const hasConflict = conflictKeys.has(getStarKey({ row: rowIndex, col: colIndex }));
          const classes = ["cell", cell !== "empty" ? `is-${cell}` : "", hasConflict ? "has-conflict" : ""]
            .filter(Boolean)
            .join(" ");
          const borders = getBorderStyle(starterPuzzle.houses, rowIndex, colIndex);
          const content = renderCellContent(cell);

          return `
            <button
              class="${classes}"
              type="button"
              role="gridcell"
              aria-label="Row ${rowIndex + 1}, column ${colIndex + 1}, house ${houseId + 1}"
              data-row="${rowIndex}"
              data-col="${colIndex}"
              style="background-color: ${housePalette[houseId % housePalette.length]}; ${borders}"
            >${content}</button>
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
  render();
}

function replaceBoard(nextBoard) {
  if (boardsMatch(board, nextBoard)) return;
  board = nextBoard;
  render();
}

function undo() {
  const previous = undoStack.at(-1);
  if (!previous) return;
  undoStack = undoStack.slice(0, -1);
  redoStack = [...redoStack, board];
  board = previous;
  render();
}

function redo() {
  const next = redoStack.at(-1);
  if (!next) return;
  redoStack = redoStack.slice(0, -1);
  undoStack = [...undoStack, board];
  board = next;
  render();
}

function boardsMatch(left, right) {
  return left.every((row, rowIndex) =>
    row.every((cell, colIndex) => cell === right[rowIndex][colIndex]),
  );
}

window.addEventListener("pointerup", () => {
  isDraggingMarks = false;
});

window.addEventListener("blur", () => {
  isDraggingMarks = false;
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
