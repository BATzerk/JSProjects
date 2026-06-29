(function (global) {
  // Classic-script puzzle engine shared by the browser runtime (app.js) and the
  // Node test suite. This is the single source of truth for the Stars domain:
  // board helpers, puzzle-shape validation, rule checking, the solver, and the
  // puzzle generator. Mirrors the tested-and-shipped pattern used by hints.js
  // and serialization.js.

  // ---------------------------------------------------------------------------
  // Board helpers
  // ---------------------------------------------------------------------------

  function createEmptyBoard(size) {
    return Array.from({ length: size }, () => Array.from({ length: size }).fill("empty"));
  }

  function cycleCellState(state) {
    if (state === "empty") return "mark";
    if (state === "mark") return "star";
    return "empty";
  }

  function setCell(board, row, col, state) {
    return board.map((cells, currentRow) =>
      cells.map((cell, currentCol) =>
        currentRow === row && currentCol === col ? state : cell,
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Geometry + puzzle shape
  // ---------------------------------------------------------------------------

  function getStarKey(position) {
    return `${position.row}:${position.col}`;
  }

  function orthogonalNeighbors(position, size) {
    return [
      { row: position.row - 1, col: position.col },
      { row: position.row + 1, col: position.col },
      { row: position.row, col: position.col - 1 },
      { row: position.row, col: position.col + 1 },
    ].filter(({ row, col }) => row >= 0 && col >= 0 && row < size && col < size);
  }

  function getHouseIds(puzzle) {
    return [...new Set(puzzle.houses.flat())].sort((a, b) => a - b);
  }

  function isHouseConnected(puzzle, house) {
    const cells = [];
    for (let row = 0; row < puzzle.size; row += 1) {
      for (let col = 0; col < puzzle.size; col += 1) {
        if (puzzle.houses[row][col] === house) cells.push({ row, col });
      }
    }
    if (cells.length === 0) return false;

    const seen = new Set([getStarKey(cells[0])]);
    const queue = [cells[0]];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      for (const next of orthogonalNeighbors(current, puzzle.size)) {
        const key = getStarKey(next);
        if (puzzle.houses[next.row][next.col] === house && !seen.has(key)) {
          seen.add(key);
          queue.push(next);
        }
      }
    }
    return seen.size === cells.length;
  }

  function validatePuzzleShape(puzzle) {
    if (!Number.isInteger(puzzle.size) || puzzle.size <= 0) {
      throw new Error("Puzzle size must be a positive integer.");
    }
    if (!Number.isInteger(puzzle.starsPerUnit) || puzzle.starsPerUnit <= 0) {
      throw new Error("Stars per unit must be a positive integer.");
    }
    if (puzzle.houses.length !== puzzle.size) {
      throw new Error("Puzzle must include one house row per board row.");
    }

    puzzle.houses.forEach((row, index) => {
      if (row.length !== puzzle.size) {
        throw new Error(`House row ${index} must have ${puzzle.size} cells.`);
      }
      if (row.some((house) => !Number.isInteger(house) || house < 0)) {
        throw new Error(`House row ${index} contains an invalid house ID.`);
      }
    });

    const houseIds = getHouseIds(puzzle);
    if (houseIds.length !== puzzle.size) {
      throw new Error(`Puzzle must contain exactly ${puzzle.size} houses; found ${houseIds.length}.`);
    }
    houseIds.forEach((house, index) => {
      if (house !== index) {
        throw new Error("House IDs must be contiguous and start at 0.");
      }
      if (!isHouseConnected(puzzle, house)) {
        throw new Error(`House ${house} is not connected.`);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Rule checking
  // ---------------------------------------------------------------------------

  function validateBoard(puzzle, board) {
    const unitStatuses = [
      ...getRowStatuses(puzzle, board),
      ...getColumnStatuses(puzzle, board),
      ...getHouseStatuses(puzzle, board),
    ];
    const conflicts = [
      ...getOverfilledConflicts(puzzle, board, unitStatuses),
      ...getAdjacencyConflicts(board),
    ];

    return {
      solved: unitStatuses.every((status) => status.complete) && conflicts.length === 0,
      conflicts,
      unitStatuses,
    };
  }

  function getRowStatuses(puzzle, board) {
    return board.map((row, index) =>
      makeStatus("row", index, row.filter((cell) => cell === "star").length, puzzle.starsPerUnit),
    );
  }

  function getColumnStatuses(puzzle, board) {
    return Array.from({ length: puzzle.size }, (_, col) => {
      let count = 0;
      for (let row = 0; row < puzzle.size; row += 1) {
        if (board[row][col] === "star") count += 1;
      }
      return makeStatus("column", col, count, puzzle.starsPerUnit);
    });
  }

  function getHouseStatuses(puzzle, board) {
    const counts = new Map();

    for (let row = 0; row < puzzle.size; row += 1) {
      for (let col = 0; col < puzzle.size; col += 1) {
        if (board[row][col] === "star") {
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

  function getOverfilledConflicts(puzzle, board, statuses) {
    return statuses
      .filter((status) => status.overfilled)
      .map((status) => ({
        cells: getUnitStarPositions(puzzle, board, status.kind, status.index),
        reason: `${labelUnit(status.kind, status.index)} has ${status.count} stars.`,
      }));
  }

  function getAdjacencyConflicts(board) {
    const conflicts = [];
    const size = board.length;

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (board[row][col] !== "star") continue;

        for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
          for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
            if (rowOffset === 0 && colOffset === 0) continue;
            const otherRow = row + rowOffset;
            const otherCol = col + colOffset;

            if (otherRow < row || (otherRow === row && otherCol <= col)) continue;
            if (otherRow < 0 || otherCol < 0 || otherRow >= size || otherCol >= size) continue;

            if (board[otherRow][otherCol] === "star") {
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

  function getUnitStarPositions(puzzle, board, kind, index) {
    const cells = [];

    for (let row = 0; row < puzzle.size; row += 1) {
      for (let col = 0; col < puzzle.size; col += 1) {
        if (board[row][col] !== "star") continue;
        if (kind === "row" && row === index) cells.push({ row, col });
        if (kind === "column" && col === index) cells.push({ row, col });
        if (kind === "house" && puzzle.houses[row][col] === index) cells.push({ row, col });
      }
    }

    return cells;
  }

  function labelUnit(kind, index) {
    if (kind === "row") return `Row ${index + 1}`;
    if (kind === "column") return `Column ${index + 1}`;
    return `House ${index + 1}`;
  }

  // ---------------------------------------------------------------------------
  // Solver
  // ---------------------------------------------------------------------------

  function createRowPatterns(size, starsPerRow) {
    const patterns = [];
    function build(start, chosen) {
      if (chosen.length === starsPerRow) {
        patterns.push([...chosen]);
        return;
      }
      const needed = starsPerRow - chosen.length;
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
    if (!previous) return true;
    return current.every((col) => previous.every((other) => Math.abs(col - other) > 1));
  }

  function solvePuzzle(puzzle, options = {}) {
    validatePuzzleShape(puzzle);
    const limit = Math.max(1, options.limit ?? Number.POSITIVE_INFINITY);
    const patterns = createRowPatterns(puzzle.size, puzzle.starsPerUnit);
    const columnCounts = Array(puzzle.size).fill(0);
    const houseCounts = Array(puzzle.size).fill(0);
    const chosen = [];
    const solutions = [];
    let truncated = false;

    function search(row) {
      if (solutions.length >= limit) {
        truncated = true;
        return;
      }
      if (row === puzzle.size) {
        if (columnCounts.every((count) => count === puzzle.starsPerUnit) &&
            houseCounts.every((count) => count === puzzle.starsPerUnit)) {
          solutions.push(chosen.flatMap((cols, solutionRow) =>
            cols.map((col) => ({ row: solutionRow, col })),
          ));
        }
        return;
      }

      const rowsRemaining = puzzle.size - row - 1;
      for (const pattern of patterns) {
        if (!canFollow(chosen[row - 1], pattern)) continue;
        if (pattern.some((col) => columnCounts[col] >= puzzle.starsPerUnit)) continue;

        const houses = pattern.map((col) => puzzle.houses[row][col]);
        const additions = new Map();
        houses.forEach((house) => additions.set(house, (additions.get(house) ?? 0) + 1));
        if ([...additions].some(([house, count]) => houseCounts[house] + count > puzzle.starsPerUnit)) {
          continue;
        }

        pattern.forEach((col) => columnCounts[col] += 1);
        additions.forEach((count, house) => houseCounts[house] += count);
        const columnsPossible = columnCounts.every((count) =>
          count <= puzzle.starsPerUnit && count + rowsRemaining >= puzzle.starsPerUnit,
        );
        const housesPossible = houseCounts.every((count) => count <= puzzle.starsPerUnit);

        if (columnsPossible && housesPossible) {
          chosen.push(pattern);
          search(row + 1);
          chosen.pop();
        }
        pattern.forEach((col) => columnCounts[col] -= 1);
        additions.forEach((count, house) => houseCounts[house] -= count);
        if (solutions.length >= limit) {
          truncated = true;
          return;
        }
      }
    }

    search(0);
    return { count: solutions.length, solutions, truncated };
  }

  function countSolutions(puzzle, limit = 2) {
    return solvePuzzle(puzzle, { limit }).count;
  }

  // ---------------------------------------------------------------------------
  // Randomness
  // ---------------------------------------------------------------------------

  function createSeededRandom(seed) {
    let state = hashSeed(String(seed));
    return {
      next() {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      },
    };
  }

  // Math.random-backed source for the non-deterministic browser runtime.
  const systemRandom = { next: () => Math.random() };

  function shuffle(values, random = systemRandom) {
    const shuffled = [...values];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const other = Math.floor(random.next() * (index + 1));
      [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
    }
    return shuffled;
  }

  function pick(values, random = systemRandom) {
    if (values.length === 0) throw new Error("Cannot pick from an empty collection.");
    return values[Math.floor(random.next() * values.length)];
  }

  function hashSeed(seed) {
    let hash = 1779033703 ^ seed.length;
    for (let index = 0; index < seed.length; index += 1) {
      hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353);
      hash = (hash << 13) | (hash >>> 19);
    }
    return (hash ^ (hash >>> 16)) >>> 0;
  }

  // ---------------------------------------------------------------------------
  // Generation
  // ---------------------------------------------------------------------------

  function generateSolution(size, starsPerUnit, random = systemRandom) {
    const patterns = createRowPatterns(size, starsPerUnit);
    const columnCounts = Array(size).fill(0);
    const chosen = [];

    function search(row) {
      if (row === size) return columnCounts.every((count) => count === starsPerUnit);
      const rowsRemaining = size - row - 1;

      for (const pattern of shuffle(patterns, random)) {
        if (!canFollow(chosen[row - 1], pattern)) continue;
        if (pattern.some((col) => columnCounts[col] >= starsPerUnit)) continue;

        pattern.forEach((col) => columnCounts[col] += 1);
        const possible = columnCounts.every((count) =>
          count <= starsPerUnit && count + rowsRemaining >= starsPerUnit,
        );
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

  function generateHouses(size, solution, random = systemRandom, maxAttempts = 100, starsPerHouse = 2) {
    if (starsPerHouse < 1 || starsPerHouse > 2 || solution.length % starsPerHouse !== 0) return null;
    const starKeys = new Set(solution.map(getStarKey));

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const houses = Array.from({ length: size }, () => Array(size).fill(-1));
      const shuffledStars = shuffle(solution, random);
      let failed = false;

      for (let house = 0; house < shuffledStars.length / starsPerHouse; house += 1) {
        const start = shuffledStars[house * starsPerHouse];
        if (starsPerHouse === 1) {
          houses[start.row][start.col] = house;
          continue;
        }
        const target = shuffledStars[house * starsPerHouse + 1];
        const path = findRandomPath(start, target, size, houses, starKeys, random);
        if (!path) {
          failed = true;
          break;
        }
        path.forEach(({ row, col }) => houses[row][col] = house);
      }
      if (failed) continue;

      fillUnassignedCells(houses, random);
      return houses;
    }
    return null;
  }

  function findRandomPath(start, target, size, houses, starKeys, random) {
    const targetKey = getStarKey(target);
    const queue = [start];
    const previous = new Map([[getStarKey(start), null]]);

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (getStarKey(current) === targetKey) break;
      for (const next of shuffle(orthogonalNeighbors(current, size), random)) {
        const key = getStarKey(next);
        if (previous.has(key)) continue;
        if (houses[next.row][next.col] !== -1) continue;
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

  function fillUnassignedCells(houses, random) {
    const size = houses.length;
    let remaining = houses.flat().filter((house) => house === -1).length;
    while (remaining > 0) {
      const frontier = [];
      for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
          if (houses[row][col] !== -1) continue;
          if (orthogonalNeighbors({ row, col }, size).some((cell) => houses[cell.row][cell.col] !== -1)) {
            frontier.push({ row, col });
          }
        }
      }
      if (frontier.length === 0) throw new Error("House growth reached an impossible state.");
      const cell = pick(frontier, random);
      const neighboringHouses = orthogonalNeighbors(cell, size)
        .map(({ row, col }) => houses[row][col])
        .filter((house) => house !== -1);
      houses[cell.row][cell.col] = pick(neighboringHouses, random);
      remaining -= 1;
    }
  }

  function generatePuzzle(config = {}) {
    const size = config.size ?? 9;
    const starsPerUnit = config.starsPerUnit ?? 2;
    const maxAttempts = config.maxAttempts ?? 1000;
    const seed = String(config.seed ?? `${Date.now()}-${Math.random()}`);
    const random = createSeededRandom(seed);
    const diagnostics = {
      seed,
      attempts: 0,
      rejectedSolutions: 0,
      rejectedHouseLayouts: 0,
      rejectedNonUnique: 0,
    };

    if (!Number.isInteger(size) || !Number.isInteger(starsPerUnit) || size <= 0 || starsPerUnit <= 0) {
      throw new Error("Generator dimensions must be positive integers.");
    }
    if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
      throw new Error("Maximum attempts must be a positive integer.");
    }
    if (starsPerUnit !== 2) {
      throw new Error("This ruleset requires exactly two stars per unit.");
    }
    if (size < 9) {
      throw new Error(
        "Random two-star boards require at least 9 rows and columns to avoid predictable maximum-density layouts.",
      );
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      diagnostics.attempts = attempt;
      const solution = generateSolution(size, starsPerUnit, random);
      if (!solution) {
        diagnostics.rejectedSolutions += 1;
        continue;
      }

      const houses = generateHouses(
        size,
        solution,
        random,
        config.houseAttemptsPerSolution ?? 100,
        starsPerUnit,
      );
      if (!houses) {
        diagnostics.rejectedHouseLayouts += 1;
        continue;
      }

      const puzzle = {
        id: `generated-${slug(seed)}-${attempt}`,
        title: config.title ?? "Random Constellation",
        size,
        starsPerUnit,
        houses,
      };
      validatePuzzleShape(puzzle);
      if (countSolutions(puzzle, 2) !== 1) {
        diagnostics.rejectedNonUnique += 1;
        continue;
      }
      return { puzzle, solution, diagnostics: { ...diagnostics } };
    }

    throw new Error(
      `Unable to generate a unique puzzle after ${maxAttempts} attempts (seed ${seed}).`,
    );
  }

  function slug(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "seed";
  }

  global.StarsRemixEngine = {
    // Board
    createEmptyBoard,
    cycleCellState,
    setCell,
    // Geometry + shape
    getStarKey,
    orthogonalNeighbors,
    getHouseIds,
    isHouseConnected,
    validatePuzzleShape,
    // Rules
    validateBoard,
    // Solver
    createRowPatterns,
    canFollow,
    solvePuzzle,
    countSolutions,
    // Randomness
    createSeededRandom,
    shuffle,
    pick,
    // Generation
    generateSolution,
    generateHouses,
    generatePuzzle,
  };
})(globalThis);
