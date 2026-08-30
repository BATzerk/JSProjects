(function (global) {
  "use strict";

  const CELL_UNKNOWN = "unknown";
  const CELL_FIELD = "field";
  const CELL_GROUND = "ground";

  function cellKey(row, col) {
    return `${row}:${col}`;
  }

  function parseCellKey(key) {
    const [row, col] = key.split(":").map(Number);
    return { row, col };
  }

  function orthogonalNeighbors(row, col, size) {
    return [
      { row: row - 1, col },
      { row: row + 1, col },
      { row, col: col - 1 },
      { row, col: col + 1 },
    ].filter((cell) =>
      cell.row >= 0 && cell.col >= 0 && cell.row < size && cell.col < size,
    );
  }

  function validatePuzzleShape(puzzle) {
    if (!puzzle || !Number.isInteger(puzzle.size) || puzzle.size < 3) {
      throw new Error("Puzzle size must be an integer of at least 3.");
    }
    if (!Number.isInteger(puzzle.target) || puzzle.target < 2) {
      throw new Error("Puzzle target must be an integer of at least 2.");
    }
    if (!Array.isArray(puzzle.seeds) || puzzle.seeds.length < 2) {
      throw new Error("Puzzle must contain at least two seeds.");
    }

    const seen = new Set();
    for (const seed of puzzle.seeds) {
      if (
        !Number.isInteger(seed.row) ||
        !Number.isInteger(seed.col) ||
        seed.row < 0 ||
        seed.col < 0 ||
        seed.row >= puzzle.size ||
        seed.col >= puzzle.size
      ) {
        throw new Error("Every seed must be inside the puzzle grid.");
      }
      const key = cellKey(seed.row, seed.col);
      if (seen.has(key)) throw new Error("Puzzle seeds must occupy distinct cells.");
      seen.add(key);
    }
  }

  function createBoard(puzzle) {
    validatePuzzleShape(puzzle);
    const board = Array.from({ length: puzzle.size }, () =>
      Array.from({ length: puzzle.size }, () => CELL_UNKNOWN),
    );
    for (const seed of puzzle.seeds) board[seed.row][seed.col] = CELL_FIELD;
    return board;
  }

  function cloneBoard(board) {
    return board.map((row) => [...row]);
  }

  function setCell(board, row, col, state) {
    if (![CELL_UNKNOWN, CELL_FIELD, CELL_GROUND].includes(state)) return board;
    if (!board[row] || board[row][col] == null || board[row][col] === state) return board;
    const next = cloneBoard(board);
    next[row][col] = state;
    return next;
  }

  function isSeed(puzzle, row, col) {
    return puzzle.seeds.some((seed) => seed.row === row && seed.col === col);
  }

  function getComponents(board, predicate) {
    const size = board.length;
    const seen = new Set();
    const components = [];

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const startKey = cellKey(row, col);
        if (seen.has(startKey) || !predicate(board[row][col], row, col)) continue;

        const component = [];
        const queue = [{ row, col }];
        seen.add(startKey);
        for (let index = 0; index < queue.length; index += 1) {
          const current = queue[index];
          component.push(current);
          for (const neighbor of orthogonalNeighbors(current.row, current.col, size)) {
            const key = cellKey(neighbor.row, neighbor.col);
            if (
              !seen.has(key) &&
              predicate(board[neighbor.row][neighbor.col], neighbor.row, neighbor.col)
            ) {
              seen.add(key);
              queue.push(neighbor);
            }
          }
        }
        components.push(component);
      }
    }
    return components;
  }

  function componentContaining(components, row, col) {
    return components.find((component) =>
      component.some((cell) => cell.row === row && cell.col === col),
    );
  }

  function validateBoard(puzzle, board) {
    validatePuzzleShape(puzzle);
    if (
      !Array.isArray(board) ||
      board.length !== puzzle.size ||
      board.some((row) => !Array.isArray(row) || row.length !== puzzle.size)
    ) {
      throw new Error("Board dimensions must match the puzzle.");
    }

    const seedKeys = new Set(puzzle.seeds.map((seed) => cellKey(seed.row, seed.col)));
    const fieldComponents = getComponents(board, (state) => state === CELL_FIELD);
    const groundComponents = getComponents(board, (state) => state === CELL_GROUND);
    const traversableGround = getComponents(board, (state) => state !== CELL_FIELD);
    const conflicts = [];
    const conflictKeys = new Set();
    let unknownCount = 0;

    function addConflict(cells, message, kind) {
      const keys = cells.map((cell) => cellKey(cell.row, cell.col));
      keys.forEach((key) => conflictKeys.add(key));
      conflicts.push({ cells, keys, message, kind });
    }

    for (let row = 0; row < puzzle.size; row += 1) {
      for (let col = 0; col < puzzle.size; col += 1) {
        const state = board[row][col];
        if (![CELL_UNKNOWN, CELL_FIELD, CELL_GROUND].includes(state)) {
          throw new Error(`Invalid cell state at ${row},${col}.`);
        }
        if (state === CELL_UNKNOWN) unknownCount += 1;
      }
    }

    for (const seed of puzzle.seeds) {
      if (board[seed.row][seed.col] !== CELL_FIELD) {
        addConflict([seed], "Numbered tiles are always filled.", "seed");
      }
    }

    for (const component of fieldComponents) {
      const seeds = component.filter((cell) => seedKeys.has(cellKey(cell.row, cell.col)));
      if (seeds.length > 1) {
        addConflict(component, "Two numbered regions have joined.", "joined-seeds");
      }
      if (component.length > puzzle.target) {
        addConflict(component, `This region is larger than ${puzzle.target}.`, "overfilled");
      }
      if (unknownCount === 0 && seeds.length === 0) {
        addConflict(component, "Every filled region needs one number.", "orphan");
      }
    }

    const groundCells = groundComponents.flat();
    if (groundCells.length > 1 && traversableGround.length > 1) {
      const reachable = new Set(
        (traversableGround.find((component) =>
          component.some((cell) => board[cell.row][cell.col] === CELL_GROUND),
        ) ?? []).map((cell) => cellKey(cell.row, cell.col)),
      );
      const stranded = groundCells.filter((cell) => !reachable.has(cellKey(cell.row, cell.col)));
      if (stranded.length) {
        addConflict(stranded, "The background has been split apart.", "ground-split");
      }
    }

    const regions = puzzle.seeds.map((seed, index) => {
      const component = componentContaining(fieldComponents, seed.row, seed.col) ?? [];
      const seedCount = component.filter((cell) => seedKeys.has(cellKey(cell.row, cell.col))).length;
      return {
        index,
        seed,
        count: component.length,
        target: puzzle.target,
        complete: component.length === puzzle.target && seedCount === 1,
        overfilled: component.length > puzzle.target,
        joined: seedCount > 1,
      };
    });

    const fieldRulesComplete =
      fieldComponents.length === puzzle.seeds.length &&
      fieldComponents.every((component) => {
        const seedCount = component.filter((cell) => seedKeys.has(cellKey(cell.row, cell.col))).length;
        return component.length === puzzle.target && seedCount === 1;
      });
    const groundConnected = groundComponents.length === 1;
    const solved =
      unknownCount === 0 &&
      conflicts.length === 0 &&
      fieldRulesComplete &&
      groundConnected;

    return {
      solved,
      conflicts,
      conflictKeys,
      unknownCount,
      regions,
      completeRegions: regions.filter((region) => region.complete).length,
      groundConnected,
      groundComponentCount: groundComponents.length,
    };
  }

  function boardFromSolution(puzzle, fieldKeys) {
    const fields = fieldKeys instanceof Set ? fieldKeys : new Set(fieldKeys);
    return Array.from({ length: puzzle.size }, (_, row) =>
      Array.from({ length: puzzle.size }, (_, col) =>
        fields.has(cellKey(row, col)) ? CELL_FIELD : CELL_GROUND,
      ),
    );
  }

  function enumerateSeedRegions(puzzle, seed) {
    const otherSeeds = new Set(
      puzzle.seeds
        .filter((other) => other !== seed)
        .map((other) => cellKey(other.row, other.col)),
    );
    const start = cellKey(seed.row, seed.col);
    const frontier = new Set(
      orthogonalNeighbors(seed.row, seed.col, puzzle.size).map((cell) =>
        cellKey(cell.row, cell.col),
      ),
    );
    const visitedShapes = new Set();
    const regions = [];

    function grow(cells, edge) {
      const signature = [...cells].sort().join("|");
      if (visitedShapes.has(signature)) return;
      visitedShapes.add(signature);

      if (cells.size === puzzle.target) {
        regions.push(new Set(cells));
        return;
      }

      for (const nextKey of [...edge]) {
        if (otherSeeds.has(nextKey)) continue;
        const nextCells = new Set(cells);
        nextCells.add(nextKey);
        const nextEdge = new Set(edge);
        nextEdge.delete(nextKey);
        const next = parseCellKey(nextKey);
        for (const neighbor of orthogonalNeighbors(next.row, next.col, puzzle.size)) {
          const neighborKey = cellKey(neighbor.row, neighbor.col);
          if (!nextCells.has(neighborKey)) nextEdge.add(neighborKey);
        }
        grow(nextCells, nextEdge);
      }
    }

    grow(new Set([start]), frontier);
    return regions;
  }

  function setsTouch(left, right, size) {
    for (const key of left) {
      if (right.has(key)) return true;
      const cell = parseCellKey(key);
      for (const neighbor of orthogonalNeighbors(cell.row, cell.col, size)) {
        if (right.has(cellKey(neighbor.row, neighbor.col))) return true;
      }
    }
    return false;
  }

  function isComplementConnected(size, fieldKeys) {
    const background = [];
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (!fieldKeys.has(cellKey(row, col))) background.push({ row, col });
      }
    }
    if (!background.length) return false;

    const seen = new Set([cellKey(background[0].row, background[0].col)]);
    const queue = [background[0]];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      for (const neighbor of orthogonalNeighbors(current.row, current.col, size)) {
        const key = cellKey(neighbor.row, neighbor.col);
        if (!fieldKeys.has(key) && !seen.has(key)) {
          seen.add(key);
          queue.push(neighbor);
        }
      }
    }
    return seen.size === background.length;
  }

  function solvePuzzle(puzzle, maxSolutions = 2) {
    validatePuzzleShape(puzzle);
    const entries = puzzle.seeds.map((seed, seedIndex) => ({
      seed,
      seedIndex,
      candidates: enumerateSeedRegions(puzzle, seed),
    })).sort((left, right) => left.candidates.length - right.candidates.length);
    const solutions = [];

    function search(entryIndex, chosen, used) {
      if (solutions.length >= maxSolutions) return;
      if (entryIndex === entries.length) {
        if (!isComplementConnected(puzzle.size, used)) return;
        const regions = Array.from({ length: puzzle.seeds.length });
        chosen.forEach(({ seedIndex, candidate }) => {
          regions[seedIndex] = [...candidate].map(parseCellKey);
        });
        solutions.push({ fieldKeys: [...used].sort(), regions });
        return;
      }

      const entry = entries[entryIndex];
      for (const candidate of entry.candidates) {
        let blocked = false;
        for (const selected of chosen) {
          if (setsTouch(candidate, selected.candidate, puzzle.size)) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;

        const nextUsed = new Set(used);
        candidate.forEach((key) => nextUsed.add(key));
        chosen.push({ seedIndex: entry.seedIndex, candidate });
        search(entryIndex + 1, chosen, nextUsed);
        chosen.pop();
        if (solutions.length >= maxSolutions) return;
      }
    }

    search(0, [], new Set());
    return solutions;
  }

  function isBoardConsistentWithSolution(board, solutionKeys) {
    const solution = solutionKeys instanceof Set ? solutionKeys : new Set(solutionKeys);
    for (let row = 0; row < board.length; row += 1) {
      for (let col = 0; col < board.length; col += 1) {
        const state = board[row][col];
        const shouldBeField = solution.has(cellKey(row, col));
        if (state === CELL_FIELD && !shouldBeField) return false;
        if (state === CELL_GROUND && shouldBeField) return false;
      }
    }
    return true;
  }

  const api = {
    CELL_UNKNOWN,
    CELL_FIELD,
    CELL_GROUND,
    cellKey,
    parseCellKey,
    orthogonalNeighbors,
    validatePuzzleShape,
    createBoard,
    cloneBoard,
    setCell,
    isSeed,
    getComponents,
    validateBoard,
    boardFromSolution,
    enumerateSeedRegions,
    solvePuzzle,
    isComplementConnected,
    isBoardConsistentWithSolution,
  };

  global.CommonGroundEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
