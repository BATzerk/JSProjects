import { createEmptyBoard, cycleCellState, setCell, validatePuzzleShape } from "./game/board.ts";
import { starterPuzzle } from "./game/puzzles.ts";
import { getStarKey, validateBoard } from "./game/rules.ts";
import type { BoardState, UnitStatus } from "./game/types.ts";

validatePuzzleShape(starterPuzzle);

const housePalette = [
  "#f5c6a5",
  "#a8d8b9",
  "#d5c4f2",
  "#f2d98d",
  "#9fd3e8",
  "#f1b5c8",
  "#bdd99f",
  "#e8c79f",
  "#b9c8ee",
  "#c8dfd7",
  "#efc6a8",
  "#c7d6a5",
  "#e6bdde",
];

let board = createEmptyBoard(starterPuzzle.size);

const root = document.querySelector<HTMLDivElement>("#root");

if (!root) {
  throw new Error("Missing app root.");
}

render();

function render() {
  const validation = validateBoard(starterPuzzle, board);
  const conflictKeys = new Set<string>();

  validation.conflicts.forEach((conflict) => {
    conflict.cells.forEach((cell) => conflictKeys.add(getStarKey(cell)));
  });

  root!.innerHTML = `
    <main class="app-shell">
      <section class="top-bar" aria-label="Puzzle controls">
        <div>
          <p class="eyebrow">StarsRemix Codex</p>
          <h1>${starterPuzzle.title}</h1>
        </div>
        <button class="icon-button" type="button" aria-label="Reset puzzle" title="Reset puzzle" data-action="reset">
          ↺
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
          ${renderProgressGroup("Rows", validation.unitStatuses.filter((status) => status.kind === "row"))}
          ${renderProgressGroup("Columns", validation.unitStatuses.filter((status) => status.kind === "column"))}
          ${renderProgressGroup("Houses", validation.unitStatuses.filter((status) => status.kind === "house"))}
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

  const boardElement = root!.querySelector<HTMLElement>(".board");
  if (boardElement) {
    boardElement.style.gridTemplateColumns = `repeat(${starterPuzzle.size}, minmax(0, 1fr))`;
  }

  root!.querySelectorAll<HTMLButtonElement>("[data-row][data-col]").forEach((cell) => {
    cell.addEventListener("click", () => {
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      board = setCell(board, row, col, cycleCellState(board[row][col]));
      render();
    });
  });

  root!.querySelector<HTMLButtonElement>("[data-action='reset']")?.addEventListener("click", () => {
    board = createEmptyBoard(starterPuzzle.size);
    render();
  });
}

function renderCells(conflictKeys: Set<string>): string {
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
          const content = cell === "star" ? "✦" : cell === "mark" ? "x" : "";

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

function renderProgressGroup(title: string, statuses: UnitStatus[]): string {
  return `
    <div class="progress-group">
      <h2>${title}</h2>
      <div class="progress-grid">
        ${statuses
          .map((status) => {
            const classes = [
              "progress-pill",
              status.complete ? "is-complete" : "",
              status.overfilled ? "is-overfilled" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return `<span class="${classes}" title="${title} ${status.index + 1}: ${status.count}/${status.required}">${status.count}/${status.required}</span>`;
          })
          .join("")}
      </div>
    </div>
  `;
}

function getBorderStyle(houses: number[][], row: number, col: number): string {
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

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
