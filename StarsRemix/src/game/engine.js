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

  function getPaintHouseId(houses, row, col) {
    const existingHouse = houses[row]?.[col];
    if (Number.isInteger(existingHouse) && existingHouse >= 0) return existingHouse;
    const used = new Set(houses.flat().filter((house) => Number.isInteger(house) && house >= 0));
    return Array.from({ length: houses.length }, (_, house) => house)
      .find((house) => !used.has(house)) ?? -1;
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

  function inspectPartialHouses(houses) {
    const size = houses.length;
    const issues = [];
    if (!Number.isInteger(size) || size < 1 || houses.some((row) => !Array.isArray(row) || row.length !== size)) {
      return {
        valid: false,
        issues: [{ code: "invalid-grid", message: "The painted board must be a square grid." }],
        lockedHouseIds: [],
        missingHouseIds: [],
      };
    }
    for (const row of houses) {
      if (row.some((house) => !Number.isInteger(house) || house < -1 || house >= size)) {
        return {
          valid: false,
          issues: [{
            code: "invalid-house-id",
            message: `House IDs must be unassigned or between 1 and ${size}.`,
          }],
          lockedHouseIds: [],
          missingHouseIds: [],
        };
      }
    }

    const lockedHouseIds = [...new Set(houses.flat().filter((house) => house >= 0))].sort((a, b) => a - b);
    const lockedSet = new Set(lockedHouseIds);
    const missingHouseIds = Array.from({ length: size }, (_, house) => house)
      .filter((house) => !lockedSet.has(house));
    const partialPuzzle = { size, starsPerUnit: 2, houses };
    for (const house of lockedHouseIds) {
      const cells = [];
      for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
          if (houses[row][col] === house) cells.push({ row, col });
        }
      }
      if (!isHouseConnected(partialPuzzle, house)) {
        issues.push({
          code: "disconnected-house",
          house,
          message: `House ${house + 1} is split into separate pieces. Join all of its tiles into one connected shape.`,
        });
        continue;
      }
      if (!hasNonTouchingCellPair(cells)) {
        issues.push({
          code: "house-cannot-fit-stars",
          house,
          message: `House ${house + 1} fits entirely within a 2×2 area, so any two stars in it would touch. Stretch it across at least three rows or columns.`,
        });
      }
      const forcedByRows = Array.from({ length: size }, (_, row) => {
        const outsideColumns = Array.from({ length: size }, (_, col) => col)
          .filter((col) => houses[row][col] !== house);
        return Math.max(0, 2 - maxTwoNonAdjacent(outsideColumns));
      }).reduce((total, count) => total + count, 0);
      const forcedByColumns = Array.from({ length: size }, (_, col) => {
        const outsideRows = Array.from({ length: size }, (_, row) => row)
          .filter((row) => houses[row][col] !== house);
        return Math.max(0, 2 - maxTwoNonAdjacent(outsideRows));
      }).reduce((total, count) => total + count, 0);
      const forcedStars = Math.max(forcedByRows, forcedByColumns);
      if (forcedStars > 2) {
        issues.push({
          code: "house-forces-too-many-stars",
          house,
          message: `House ${house + 1} covers so much of the board that it would be forced to contain at least ${forcedStars} stars, but every house must contain exactly 2.`,
        });
      }
    }

    const blankComponents = findCellComponents(houses, -1);
    const blankCount = blankComponents.reduce((total, component) => total + component.length, 0);
    if (blankCount > 0 && missingHouseIds.length === 0) {
      issues.push({
        code: "no-unused-houses",
        message: `${blankCount} ${blankCount === 1 ? "tile is" : "tiles are"} still blank, but all ${size} houses have already been used. Erase part of a house or fill the gaps by extending an existing house.`,
      });
    } else if (blankCount === 0 && missingHouseIds.length > 0) {
      issues.push({
        code: "no-room-for-houses",
        message: `No blank tiles remain for ${missingHouseIds.length} missing ${missingHouseIds.length === 1 ? "house" : "houses"}.`,
      });
    } else if (blankCount > 0) {
      for (const component of blankComponents) {
        if (!hasNonTouchingCellPair(component)) {
          issues.push({
            code: "blank-pocket-cannot-fit-stars",
            cells: component,
            message: `The blank pocket at ${describeCellArea(component)} fits entirely within a 2×2 area, so it cannot hold two non-touching stars.`,
          });
        }
      }
      if (blankComponents.length > missingHouseIds.length) {
        issues.push({
          code: "too-many-blank-pockets",
          message: `The painted houses divide the blank space into ${blankComponents.length} separate pockets, but only ${missingHouseIds.length} ${missingHouseIds.length === 1 ? "house remains" : "houses remain"}. At least one pocket cannot be filled.`,
        });
      }
      const remainingCapacity = blankComponents.reduce((total, component) => total + Math.floor(component.length / 3), 0);
      if (blankCount < missingHouseIds.length * 3) {
        issues.push({
          code: "not-enough-blank-tiles",
          message: `${missingHouseIds.length} ${missingHouseIds.length === 1 ? "house still needs" : "houses still need"} at least ${missingHouseIds.length * 3} blank tiles, but only ${blankCount} remain.`,
        });
      } else if (remainingCapacity < missingHouseIds.length) {
        issues.push({
          code: "blank-pockets-lack-capacity",
          message: `The separate blank pockets can fit at most ${remainingCapacity} more ${remainingCapacity === 1 ? "house" : "houses"}, but ${missingHouseIds.length} are still missing.`,
        });
      }
    }

    return { valid: issues.length === 0, issues, lockedHouseIds, missingHouseIds, blankComponents };
  }

  function findCellComponents(houses, target) {
    const size = houses.length;
    const seen = new Set();
    const components = [];
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (houses[row][col] !== target || seen.has(`${row}:${col}`)) continue;
        const component = [];
        const queue = [{ row, col }];
        seen.add(`${row}:${col}`);
        for (let index = 0; index < queue.length; index += 1) {
          const cell = queue[index];
          component.push(cell);
          for (const next of orthogonalNeighbors(cell, size)) {
            const key = `${next.row}:${next.col}`;
            if (houses[next.row][next.col] === target && !seen.has(key)) {
              seen.add(key);
              queue.push(next);
            }
          }
        }
        components.push(component);
      }
    }
    return components;
  }

  function maxTwoNonAdjacent(indices) {
    if (indices.length === 0) return 0;
    return indices.some((value, index) => indices.slice(index + 1).some((other) =>
      Math.abs(value - other) > 1,
    )) ? 2 : 1;
  }

  function hasNonTouchingCellPair(cells) {
    return cells.some((cell, index) => cells.slice(index + 1).some((other) =>
      Math.abs(cell.row - other.row) > 1 || Math.abs(cell.col - other.col) > 1,
    ));
  }

  function describeCellArea(cells) {
    const rows = cells.map(({ row }) => row);
    const cols = cells.map(({ col }) => col);
    const minRow = Math.min(...rows) + 1;
    const maxRow = Math.max(...rows) + 1;
    const minCol = Math.min(...cols) + 1;
    const maxCol = Math.max(...cols) + 1;
    const rowLabel = minRow === maxRow ? `row ${minRow}` : `rows ${minRow}–${maxRow}`;
    const colLabel = minCol === maxCol ? `column ${minCol}` : `columns ${minCol}–${maxCol}`;
    return `${rowLabel}, ${colLabel}`;
  }

  function validatePartialHouses(houses) {
    const inspection = inspectPartialHouses(houses);
    if (!inspection.valid) throw new Error(inspection.issues[0].message);
    return inspection.lockedHouseIds;
  }

  function generateConstrainedHouses(partialHouses, solution, random = systemRandom, maxAttempts = 100) {
    const size = partialHouses.length;
    const lockedHouseIds = validatePartialHouses(partialHouses);
    const lockedSet = new Set(lockedHouseIds);
    const missingHouseIds = Array.from({ length: size }, (_, house) => house)
      .filter((house) => !lockedSet.has(house));
    const starKeys = new Set(solution.map(getStarKey));

    for (const house of lockedHouseIds) {
      const starCount = solution.filter(({ row, col }) => partialHouses[row][col] === house).length;
      if (starCount !== 2) return null;
    }

    const remainingStars = solution.filter(({ row, col }) => partialHouses[row][col] === -1);
    if (remainingStars.length !== missingHouseIds.length * 2) return null;
    if (missingHouseIds.length === 0) {
      return partialHouses.some((row) => row.includes(-1)) ? null : partialHouses.map((row) => [...row]);
    }

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const houses = partialHouses.map((row) => [...row]);
      const pairedStars = shuffle(remainingStars, random);
      const shuffledHouseIds = shuffle(missingHouseIds, random);
      let failed = false;

      for (let index = 0; index < shuffledHouseIds.length; index += 1) {
        const house = shuffledHouseIds[index];
        const start = pairedStars[index * 2];
        const target = pairedStars[index * 2 + 1];
        const path = findRandomPath(start, target, size, houses, starKeys, random);
        if (!path) {
          failed = true;
          break;
        }
        path.forEach(({ row, col }) => houses[row][col] = house);
      }
      if (failed) continue;
      if (!fillUnassignedCells(houses, random, new Set(missingHouseIds))) continue;
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

  function fillUnassignedCells(houses, random, allowedHouses = null) {
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
      if (frontier.length === 0) return false;
      const cell = pick(frontier, random);
      const neighboringHouses = orthogonalNeighbors(cell, size)
        .map(({ row, col }) => houses[row][col])
        .filter((house) => house !== -1 && (!allowedHouses || allowedHouses.has(house)));
      if (neighboringHouses.length === 0) {
        const usableFrontier = frontier.filter((candidate) => orthogonalNeighbors(candidate, size)
          .some(({ row, col }) => {
            const house = houses[row][col];
            return house !== -1 && (!allowedHouses || allowedHouses.has(house));
          }));
        if (usableFrontier.length === 0) return false;
        const usableCell = pick(usableFrontier, random);
        const usableHouses = orthogonalNeighbors(usableCell, size)
          .map(({ row, col }) => houses[row][col])
          .filter((house) => house !== -1 && (!allowedHouses || allowedHouses.has(house)));
        houses[usableCell.row][usableCell.col] = pick(usableHouses, random);
        remaining -= 1;
        continue;
      }
      houses[cell.row][cell.col] = pick(neighboringHouses, random);
      remaining -= 1;
    }
    return true;
  }

  function hasThreeCellHouse(houses, houseIds = null) {
    const houseSizes = new Map();
    for (const house of houses.flat()) {
      if (houseIds && !houseIds.has(house)) continue;
      houseSizes.set(house, (houseSizes.get(house) ?? 0) + 1);
    }
    return [...houseSizes.values()].some((size) => size === 3);
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
      if (attempt === 1 || attempt % 25 === 0) {
        config.onProgress?.({ attempt, maximum: maxAttempts, diagnostics: { ...diagnostics } });
      }
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
      if (hasThreeCellHouse(houses)) {
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

  function completePuzzleFromHouses(partialHouses, config = {}) {
    const size = partialHouses.length;
    const starsPerUnit = 2;
    const maxAttempts = config.maxAttempts ?? 4_000;
    const houseAttemptsPerSolution = config.houseAttemptsPerSolution ?? 80;
    const seed = String(config.seed ?? `${Date.now()}-${Math.random()}`);
    const random = createSeededRandom(seed);
    const lockedHouseIds = validatePartialHouses(partialHouses);
    const lockedSet = new Set(lockedHouseIds);
    const missingHouseIds = Array.from({ length: size }, (_, house) => house)
      .filter((house) => !lockedSet.has(house));
    const diagnostics = {
      seed,
      attempts: 0,
      rejectedSolutions: 0,
      rejectedHouseLayouts: 0,
      rejectedNonUnique: 0,
    };

    if (size < 9) {
      throw new Error("Board completion requires at least 9 rows and columns.");
    }
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
      throw new Error("Maximum attempts must be a positive integer.");
    }

    const isComplete = !partialHouses.some((row) => row.includes(-1));
    if (isComplete) {
      const puzzle = {
        id: config.id ?? `handmade-${slug(config.title ?? seed)}`,
        title: config.title ?? "Handmade Constellation",
        size,
        starsPerUnit,
        houses: partialHouses.map((row) => [...row]),
      };
      validatePuzzleShape(puzzle);
      const solved = solvePuzzle(puzzle, { limit: 2 });
      if (solved.count !== 1) {
        throw new Error(solved.count === 0 ? "This board has no solution." : "This board has multiple solutions.");
      }
      return { puzzle, solution: solved.solutions[0], diagnostics };
    }

    if (lockedHouseIds.length === size) {
      throw new Error("Every house ID is already painted, but some tiles are still unassigned.");
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      diagnostics.attempts = attempt;
      if (attempt === 1 || attempt % 25 === 0) {
        config.onProgress?.({ attempt, maximum: maxAttempts, diagnostics: { ...diagnostics } });
      }
      const solution = generateSolution(size, starsPerUnit, random);
      if (!solution) {
        diagnostics.rejectedSolutions += 1;
        continue;
      }
      const houses = generateConstrainedHouses(
        partialHouses,
        solution,
        random,
        houseAttemptsPerSolution,
      );
      if (!houses || hasThreeCellHouse(houses, new Set(missingHouseIds))) {
        diagnostics.rejectedHouseLayouts += 1;
        continue;
      }
      const puzzle = {
        id: config.id ?? `handmade-${slug(config.title ?? seed)}`,
        title: config.title ?? "Handmade Constellation",
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
      `The painted shapes pass the local checks, but no unique solution could be built after ${maxAttempts} attempts. Their row or column placement may prevent two non-touching stars per house; try widening, moving, or removing one painted house.`,
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
    getPaintHouseId,
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
    inspectPartialHouses,
    validatePartialHouses,
    generateConstrainedHouses,
    hasThreeCellHouse,
    generatePuzzle,
    completePuzzleFromHouses,
  };
})(globalThis);
