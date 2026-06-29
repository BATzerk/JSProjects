// Part of the StarsRemix hint runtime (classic script, no build step).
// Advanced strategies (propagation, locked groups) plus shared geometry helpers.
// Top-level functions here are global and shared across the hints/*.js
// files; load order is fixed in index.html and hints.test.ts. The
// technique registry and public StarsRemixHints export live in registry.js,
// which loads last.

function findShallowPropagationHint({ puzzle, board, units }) {
  const context = { puzzle, board, units };
  if (getPropagationContradiction(context)) return null;

  const openCells = collectCells(puzzle.size, ({ row, col }) => board[row][col] === "empty");
  const starBranches = new Map();
  for (const candidate of openCells) {
    const starBranch = propagateAssumption(context, candidate, "star");
    starBranches.set(cellKey(candidate), starBranch);
    if (!starBranch.contradiction) continue;
    const markBranch = propagateAssumption(context, candidate, "mark");
    if (markBranch.contradiction) continue;
    return createPropagationHint(candidate, starBranch, "star");
  }

  for (const candidate of openCells) {
    const markBranch = propagateAssumption(context, candidate, "mark");
    if (!markBranch.contradiction) continue;
    const starBranch = starBranches.get(cellKey(candidate));
    if (starBranch?.contradiction) continue;
    return createPropagationHint(candidate, markBranch, "mark");
  }
  return null;
}

function findPlacementPropagationHint({ puzzle, board, units }) {
  const unitMasks = units.map((unit) => cellsToMask(unit.cells, puzzle.size));
  const domains = units.map((unit) => getUnitStarPlacements(
    unit,
    board,
    puzzle.starsPerUnit,
    puzzle.size,
  ).map((cells) => ({
    cells,
    mask: cellsToMask(cells, puzzle.size),
    touchingMask: cellsToTouchingMask(cells, puzzle.size),
  })));
  if (domains.some((domain) => domain.length === 0)) return null;

  const neighbors = units.map(() => []);
  for (let left = 0; left < units.length; left += 1) {
    for (let right = left + 1; right < units.length; right += 1) {
      if (!unitsConstrainEachOther(units[left], units[right])) continue;
      neighbors[left].push(right);
      neighbors[right].push(left);
    }
  }

  const queue = neighbors.flatMap((unitNeighbors, unitIndex) =>
    unitNeighbors.map((neighborIndex) => [unitIndex, neighborIndex]));
  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const [unitIndex, neighborIndex] = queue[queueIndex];
    queueIndex += 1;
    const intersectionMask = unitMasks[unitIndex] & unitMasks[neighborIndex];
    const enforceTouching = units[unitIndex].kind === "row" && units[neighborIndex].kind === "row";
    const compatiblePlacements = domains[unitIndex].filter((placement) =>
      domains[neighborIndex].some((neighborPlacement) => placementsAreCompatible(
        placement,
        neighborPlacement,
        intersectionMask,
        enforceTouching,
      )),
    );
    if (compatiblePlacements.length === domains[unitIndex].length) continue;
    if (compatiblePlacements.length === 0) return null;
    domains[unitIndex] = compatiblePlacements;
    for (const otherNeighbor of neighbors[unitIndex]) {
      if (otherNeighbor !== neighborIndex) queue.push([otherNeighbor, unitIndex]);
    }
  }

  const openCells = collectCells(puzzle.size, ({ row, col }) => board[row][col] === "empty");
  for (const cell of openCells) {
    const containingUnits = units
      .map((unit, index) => ({ unit, index }))
      .filter(({ unit }) => unit.cells.some((unitCell) => sameCell(unitCell, cell)))
      .sort((left, right) => domains[left.index].length - domains[right.index].length);
    const forcingUnit = containingUnits.find(({ index }) =>
      domains[index].every((placement) => placement.cells.some((star) => sameCell(star, cell))));
    if (!forcingUnit) continue;
    return createPlacementPropagationHint(
      forcingUnit.unit,
      domains[forcingUnit.index].map((placement) => placement.cells),
      cell,
      "star",
    );
  }

  for (const cell of openCells) {
    const containingUnits = units
      .map((unit, index) => ({ unit, index }))
      .filter(({ unit }) => unit.cells.some((unitCell) => sameCell(unitCell, cell)))
      .sort((left, right) => domains[left.index].length - domains[right.index].length);
    const excludingUnit = containingUnits.find(({ index }) =>
      domains[index].every((placement) => placement.cells.every((star) => !sameCell(star, cell))));
    if (!excludingUnit) continue;
    return createPlacementPropagationHint(
      excludingUnit.unit,
      domains[excludingUnit.index].map((placement) => placement.cells),
      cell,
      "mark",
    );
  }
  return null;
}

function unitsConstrainEachOther(leftUnit, rightUnit) {
  if (leftUnit.kind === "row" && rightUnit.kind === "row") {
    return Math.abs(leftUnit.index - rightUnit.index) === 1;
  }
  if (leftUnit.kind !== "row" && rightUnit.kind !== "row") return false;
  return leftUnit.cells.some((leftCell) =>
    rightUnit.cells.some((rightCell) => sameCell(leftCell, rightCell)));
}

function placementsAreCompatible(leftPlacement, rightPlacement, intersectionMask, enforceTouching) {
  if ((leftPlacement.mask & intersectionMask) !== (rightPlacement.mask & intersectionMask)) {
    return false;
  }
  if (!enforceTouching) return true;
  const sharedStars = leftPlacement.mask & rightPlacement.mask;
  return (leftPlacement.touchingMask & rightPlacement.mask) === sharedStars;
}

function cellsToMask(cells, size) {
  return cells.reduce(
    (mask, { row, col }) => mask | (1n << BigInt(row * size + col)),
    0n,
  );
}

function cellsToTouchingMask(cells, size) {
  return cellsToMask(cells.flatMap((cell) => [cell, ...surroundingCells(cell, size)]), size);
}

function createPlacementPropagationHint(unit, placements, cell, state) {
  const possibleStars = uniqueCells(placements.flat())
    .filter((possible) => !sameCell(possible, cell))
    .sort(compareCells);
  const result = state === "star" ? "must contain a star" : "cannot contain a star";
  return {
    kind: "placement-propagation",
    message: `After cross-checking the compatible row, column, and house placements, every surviving pattern for ${unit.label} agrees that the blue space ${result}. ${state === "star" ? "Add a star there." : "Mark it with an X."}`,
    cells: [
      ...possibleStars.map((possible) => ({ ...possible, color: "gray" })),
      { ...cell, color: "blue" },
    ],
    unitCells: unit.cells,
    moves: [{ ...cell, state }],
  };
}

function createPropagationHint(candidate, failedBranch, assumedState) {
  const forcedState = assumedState === "star" ? "mark" : "star";
  const contradictionKeys = new Set(failedBranch.contradiction.cells.map(cellKey));
  const consequenceCells = [...failedBranch.consequences.values()]
    .filter((move) => !sameCell(move, candidate) && !contradictionKeys.has(cellKey(move)))
    .map((move) => ({ ...move, color: "gray", previewState: move.state }));
  const contradictionCells = uniqueCells(failedBranch.contradiction.cells)
    .filter((cell) => !sameCell(cell, candidate))
    .map((cell) => ({
      ...cell,
      color: "red",
      previewState: failedBranch.board[cell.row][cell.col] === "empty"
        ? undefined
        : failedBranch.board[cell.row][cell.col],
    }));

  return {
    kind: "shallow-propagation",
    message: `Suppose the purple ${assumedState === "star" ? "star" : "X"} in the blue space were real. The gray moves would follow, but then ${failedBranch.contradiction.reason}. Therefore the blue space must be ${forcedState === "star" ? "a star" : "an X"}.`,
    cells: [
      ...consequenceCells,
      ...contradictionCells,
      { ...candidate, color: "blue" },
    ],
    assumption: { ...candidate, state: assumedState },
    moves: [{ ...candidate, state: forcedState }],
  };
}

function propagateAssumption({ puzzle, board, units }, candidate, assumedState) {
  let simulatedBoard = setCellState(board, candidate, assumedState);
  const consequences = new Map();
  const maximumSteps = Math.min(4, puzzle.size);

  for (let step = 0; step < maximumSteps; step += 1) {
    const contradiction = getPropagationContradiction({ puzzle, board: simulatedBoard, units });
    if (contradiction) return { board: simulatedBoard, consequences, contradiction };

    const nextHint = findPropagationRuleHint({ puzzle, board: simulatedBoard, units });
    if (!nextHint?.moves?.length) break;
    const nextBoard = applyHint(simulatedBoard, nextHint);
    let changed = false;
    for (const move of nextHint.moves) {
      if (simulatedBoard[move.row][move.col] === move.state) continue;
      changed = true;
      consequences.set(cellKey(move), move);
    }
    if (!changed) break;
    simulatedBoard = nextBoard;
  }

  return {
    board: simulatedBoard,
    consequences,
    contradiction: getPropagationContradiction({ puzzle, board: simulatedBoard, units }),
  };
}

function findPropagationRuleHint(context) {
  const propagationStrategies = [
    findSurroundStarHint,
    findCompleteUnitHint,
    findForcedStarHint,
  ];
  for (const strategy of propagationStrategies) {
    const hint = strategy(context);
    if (hint?.moves?.length) return hint;
  }
  return null;
}

function getPropagationContradiction({ puzzle, board, units }) {
  const stars = collectCells(puzzle.size, ({ row, col }) => board[row][col] === "star");
  for (let index = 0; index < stars.length; index += 1) {
    const touchingStar = stars.slice(index + 1).find((star) => cellsTouch(stars[index], star));
    if (touchingStar) {
      return {
        reason: "two red stars would touch",
        cells: [stars[index], touchingStar],
      };
    }
  }

  for (const unit of units) {
    const unitStars = unit.cells.filter(({ row, col }) => board[row][col] === "star");
    if (unitStars.length > puzzle.starsPerUnit) {
      return {
        reason: `${unit.label} would contain too many stars`,
        cells: unitStars,
      };
    }
    if (!unitCanFitRequiredStars(unit, board, puzzle.starsPerUnit, puzzle.size)) {
      return {
        reason: `${unit.label} would have no valid way to fit its remaining stars`,
        cells: unit.cells,
      };
    }
  }
  return null;
}

function setCellState(board, position, state) {
  return board.map((row, rowIndex) => row.map((cellState, colIndex) =>
    rowIndex === position.row && colIndex === position.col ? state : cellState,
  ));
}

function findLockedStarGroupHint({ puzzle, board, units }) {
  for (const unit of units) {
    const placements = getUnitStarPlacements(
      unit,
      board,
      puzzle.starsPerUnit,
      puzzle.size,
    );
    if (placements.length < 2) continue;

    const unitKeys = new Set(unit.cells.map(cellKey));
    const outsideCells = collectCells(puzzle.size, ({ row, col }) =>
      board[row][col] === "empty" && !unitKeys.has(cellKey({ row, col })),
    );

    for (const outsideCell of outsideCells) {
      const touchingPlacementCells = uniqueCells(placements.flat())
        .filter((cell) => cellsTouch(cell, outsideCell))
        .sort(compareCells);
      const lockedGroup = findSmallestPlacementHitGroup(placements, touchingPlacementCells);
      if (!lockedGroup || lockedGroup.length < 2) continue;

      return {
        kind: "locked-star-group",
        message: `${unit.label} must contain a star in one of the gray spaces. The blue space touches every one of them, so it cannot contain a star. Mark it with an X.`,
        cells: [
          ...lockedGroup.map((cell) => ({ ...cell, color: "gray" })),
          { ...outsideCell, color: "blue" },
        ],
        moves: [{ ...outsideCell, state: "mark" }],
      };
    }
  }
  return null;
}

function findSmallestPlacementHitGroup(placements, candidates) {
  const chosen = [];

  function search(start, targetSize) {
    if (chosen.length === targetSize) {
      return placements.every((placement) =>
        placement.some((cell) => chosen.some((chosenCell) => sameCell(cell, chosenCell))),
      ) ? [...chosen] : null;
    }

    for (let index = start; index <= candidates.length - (targetSize - chosen.length); index += 1) {
      chosen.push(candidates[index]);
      const result = search(index + 1, targetSize);
      chosen.pop();
      if (result) return result;
    }
    return null;
  }

  for (let size = 1; size <= candidates.length; size += 1) {
    const result = search(0, size);
    if (result) return result;
  }
  return null;
}

function findImpossibleStarHint({ puzzle, board, units }) {
  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      if (board[row][col] !== "empty") continue;
      const candidate = { row, col };
      const assumedBoard = setAssumedStar(board, candidate);
      const blockedUnit = units.find((unit) => !unitCanFitRequiredStars(
        unit,
        assumedBoard,
        puzzle.starsPerUnit,
        puzzle.size,
      ));
      if (!blockedUnit) continue;
      const possiblePlacements = getUnitStarPlacements(
        blockedUnit,
        board,
        puzzle.starsPerUnit,
        puzzle.size,
      );
      const grayCells = uniqueCells(possiblePlacements.flat())
        .filter((cell) => !sameCell(cell, candidate) && cellsTouch(candidate, cell))
        .sort((left, right) => left.row - right.row || left.col - right.col);

      return {
        kind: "impossible-star",
        message: `At least one star must go somewhere in the marked spaces for ${blockedUnit.label}. A star in the blue space would block all of them, so mark the blue space with an X.`,
        cells: [
          { ...candidate, color: "blue" },
          ...grayCells.map((cell) => ({ ...cell, color: "gray" })),
        ],
        moves: [{ ...candidate, state: "mark" }],
      };
    }
  }
  return null;
}

function setAssumedStar(board, position) {
  return board.map((row, rowIndex) => row.map((state, colIndex) =>
    rowIndex === position.row && colIndex === position.col ? "star" : state,
  ));
}

function unitCanFitRequiredStars(unit, board, required, size) {
  return getUnitStarPlacements(unit, board, required, size, 1).length > 0;
}

function getUnitStarPlacements(unit, board, required, size, limit = Number.POSITIVE_INFINITY) {
  const placedStars = unit.cells.filter(({ row, col }) => board[row][col] === "star");
  if (placedStars.length > required || hasTouchingPair(placedStars)) return [];

  const starsNeeded = required - placedStars.length;
  if (starsNeeded === 0) return [[]];

  const candidates = unit.cells.filter(({ row, col }) =>
    board[row][col] === "empty" &&
    surroundingCells({ row, col }, size).every((cell) => board[cell.row][cell.col] !== "star"),
  );
  return collectNonTouchingStarPlacements(candidates, starsNeeded, limit);
}

function collectNonTouchingStarPlacements(candidates, needed, limit) {
  const placements = [];
  const chosen = [];

  function search(start) {
    if (placements.length >= limit) return;
    if (chosen.length === needed) {
      placements.push([...chosen]);
      return;
    }
    if (candidates.length - start < needed - chosen.length) return;

    for (let index = start; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      if (chosen.some((star) => cellsTouch(star, candidate))) continue;
      chosen.push(candidate);
      search(index + 1);
      chosen.pop();
    }
  }

  search(0);
  return placements;
}

function hasTouchingPair(cells) {
  return cells.some((cell, index) =>
    cells.slice(index + 1).some((other) => cellsTouch(cell, other)),
  );
}

function cellsTouch(left, right) {
  return Math.abs(left.row - right.row) <= 1 && Math.abs(left.col - right.col) <= 1;
}

function sameCell(left, right) {
  return left.row === right.row && left.col === right.col;
}

function uniqueCells(cells) {
  const seen = new Set();
  return cells.filter((cell) => {
    const key = cellKey(cell);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compareCells(left, right) {
  return left.row - right.row || left.col - right.col;
}

function getUnits(puzzle) {
  const rows = Array.from({ length: puzzle.size }, (_, row) => ({
    kind: "row",
    index: row,
    label: `Row ${row + 1}`,
    cells: Array.from({ length: puzzle.size }, (_, col) => ({ row, col })),
  }));
  const columns = Array.from({ length: puzzle.size }, (_, col) => ({
    kind: "column",
    index: col,
    label: `Column ${col + 1}`,
    cells: Array.from({ length: puzzle.size }, (_, row) => ({ row, col })),
  }));
  const houses = [...new Set(puzzle.houses.flat())]
    .sort((left, right) => left - right)
    .map((house) => ({
      kind: "house",
      index: house,
      label: `House ${house + 1}`,
      cells: collectCells(puzzle.size, ({ row, col }) => puzzle.houses[row][col] === house),
    }));
  return [...rows, ...columns, ...houses];
}

function surroundingCells(position, size) {
  const cells = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const row = position.row + rowOffset;
      const col = position.col + colOffset;
      if (row >= 0 && col >= 0 && row < size && col < size) cells.push({ row, col });
    }
  }
  return cells;
}

function collectCells(size, predicate) {
  const cells = [];
  forEachCell(size, (cell) => {
    if (predicate(cell)) cells.push(cell);
  });
  return cells;
}

function forEachCell(size, callback) {
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) callback({ row, col });
  }
}

// Publish to the shared global scope so the other hints/*.js files (and the
// Node test harness, which loads each file as a module) can resolve these by name.
Object.assign(globalThis, { findShallowPropagationHint,findPlacementPropagationHint,unitsConstrainEachOther,placementsAreCompatible,cellsToMask,cellsToTouchingMask,createPlacementPropagationHint,createPropagationHint,propagateAssumption,findPropagationRuleHint,getPropagationContradiction,setCellState,findLockedStarGroupHint,findSmallestPlacementHitGroup,findImpossibleStarHint,setAssumedStar,unitCanFitRequiredStars,getUnitStarPlacements,collectNonTouchingStarPlacements,hasTouchingPair,cellsTouch,sameCell,uniqueCells,compareCells,getUnits,surroundingCells,collectCells,forEachCell });
