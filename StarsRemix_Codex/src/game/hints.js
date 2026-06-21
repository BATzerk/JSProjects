function findHint(puzzle, board) {
  const context = {
    puzzle,
    board,
    units: getUnits(puzzle),
  };

  for (const strategy of hintStrategies) {
    const hint = strategy(context);
    if (hint) return hint;
  }

  return {
    kind: "none",
    message: "No hint from the current set applies yet. More hint strategies are coming soon.",
    cells: [],
  };
}

function applyHint(board, hint) {
  return (hint.moves ?? []).reduce((nextBoard, move) =>
    nextBoard.map((row, rowIndex) => row.map((state, colIndex) =>
      rowIndex === move.row && colIndex === move.col ? move.state : state,
    )), board);
}

const hintStrategies = [
  findRuleConflictHint,
  findSurroundStarHint,
  findCompleteUnitHint,
  findForcedStarHint,
  findLockedIntersectionHint,
  findLockedStarGroupHint,
  findImpossibleStarHint,
  findMultiUnitCapacityHint,
  findShallowPropagationHint,
];

function findRuleConflictHint({ puzzle, board, units }) {
  const stars = collectCells(puzzle.size, ({ row, col }) => board[row][col] === "star");
  for (let index = 0; index < stars.length; index += 1) {
    const touchingStar = stars.slice(index + 1).find((star) => cellsTouch(stars[index], star));
    if (touchingStar) {
      return {
        kind: "rule-conflict",
        message: "Stars cannot touch, even diagonally. One of the red stars must be removed.",
        cells: [stars[index], touchingStar].map((cell) => ({ ...cell, color: "red" })),
      };
    }
  }

  for (const unit of units) {
    const unitStars = unit.cells.filter(({ row, col }) => board[row][col] === "star");
    if (unitStars.length > puzzle.starsPerUnit) {
      return {
        kind: "rule-conflict",
        message: `${unit.label} can only contain ${puzzle.starsPerUnit} stars. Remove one of the red stars.`,
        cells: unitStars.map((cell) => ({ ...cell, color: "red" })),
      };
    }
  }
  return null;
}

function findSurroundStarHint({ puzzle, board }) {
  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      if (board[row][col] !== "star") continue;
      const openNeighbors = surroundingCells({ row, col }, puzzle.size)
        .filter((cell) => board[cell.row][cell.col] === "empty");
      if (openNeighbors.length > 0) {
        return {
          kind: "surround-star",
          message: "All stars must be surrounded by Xs. Add Xs in the blue spaces around the gold star.",
        cells: [
          { row, col, color: "gold" },
          ...openNeighbors.map((cell) => ({ ...cell, color: "blue" })),
        ],
        moves: openNeighbors.map((cell) => ({ ...cell, state: "mark" })),
      };
      }
    }
  }
  return null;
}

function findCompleteUnitHint({ puzzle, board, units }) {
  for (const unit of units) {
    const stars = unit.cells.filter(({ row, col }) => board[row][col] === "star");
    const openCells = unit.cells.filter(({ row, col }) => board[row][col] === "empty");
    if (stars.length === puzzle.starsPerUnit && openCells.length > 0) {
      return {
        kind: "complete-unit",
        message: `${unit.label} already has ${puzzle.starsPerUnit} stars. Fill the remaining blue spaces with Xs.`,
        cells: [
          ...stars.map((cell) => ({ ...cell, color: "gold" })),
          ...openCells.map((cell) => ({ ...cell, color: "blue" })),
        ],
        moves: openCells.map((cell) => ({ ...cell, state: "mark" })),
      };
    }
  }
  return null;
}

function findForcedStarHint({ puzzle, board, units }) {
  for (const unit of units) {
    const stars = unit.cells.filter(({ row, col }) => board[row][col] === "star");
    const starsNeeded = puzzle.starsPerUnit - stars.length;
    if (starsNeeded <= 0) continue;

    const placements = getUnitStarPlacements(
      unit,
      board,
      puzzle.starsPerUnit,
      puzzle.size,
    );
    if (placements.length === 0) continue;

    const forcedCell = placements[0].find((cell) =>
      placements.every((placement) => placement.some((other) => sameCell(cell, other))),
    );
    if (forcedCell) {
      return {
        kind: "forced-star",
        message: `Every valid way to fit ${starsNeeded === 1 ? "the remaining star" : `the remaining ${starsNeeded} stars`} in ${unit.label} uses the gold space. Add a star there.`,
        cells: [{ ...forcedCell, color: "gold" }],
        moves: [{ ...forcedCell, state: "star" }],
      };
    }
  }
  return null;
}

function findLockedIntersectionHint({ puzzle, board, units }) {
  const houses = units.filter((unit) => unit.kind === "house");
  const lines = units.filter((unit) => unit.kind === "row" || unit.kind === "column");

  for (const house of houses) {
    const placements = getUnitStarPlacements(
      house,
      board,
      puzzle.starsPerUnit,
      puzzle.size,
    ).filter((placement) => placementFitsUnitCapacities(
      placement,
      board,
      puzzle.starsPerUnit,
      units,
    ));
    if (placements.length < 2) continue;

    const houseKeys = new Set(house.cells.map(cellKey));
    for (const line of lines) {
      const lineStars = line.cells.filter(({ row, col }) => board[row][col] === "star");
      const lineCapacity = puzzle.starsPerUnit - lineStars.length;
      if (lineCapacity <= 0) continue;

      const intersectionKeys = new Set(
        line.cells.filter((cell) => houseKeys.has(cellKey(cell))).map(cellKey),
      );
      if (intersectionKeys.size === 0) continue;

      const reservedInEveryPlacement = placements.every((placement) =>
        placement.filter((cell) => intersectionKeys.has(cellKey(cell))).length === lineCapacity,
      );
      if (!reservedInEveryPlacement) continue;

      const lockedCells = uniqueCells(placements.flat())
        .filter((cell) => intersectionKeys.has(cellKey(cell)))
        .sort(compareCells);
      if (lockedCells.length < 2) continue;

      const competingCell = line.cells.find(({ row, col }) =>
        board[row][col] === "empty" && !houseKeys.has(cellKey({ row, col })),
      );
      if (!competingCell) continue;

      const reservedStars = lineCapacity === 1 ? "remaining star" : `remaining ${lineCapacity} stars`;
      return {
        kind: "locked-intersection",
        message: `Every valid placement for ${house.label} reserves ${line.label}'s ${reservedStars} for the gray spaces where they intersect. The competing blue space in ${line.label} cannot contain a star, so mark it with an X.`,
        cells: [
          ...lockedCells.map((cell) => ({ ...cell, color: "gray" })),
          { ...competingCell, color: "blue" },
        ],
        moves: [{ ...competingCell, state: "mark" }],
      };
    }
  }
  return null;
}

function findMultiUnitCapacityHint({ puzzle, board, units }) {
  const unitFamilies = ["house", "row", "column"].map((kind) =>
    units.filter((unit) => unit.kind === kind),
  );
  const placementCache = new Map();

  function placementsFor(unit) {
    if (!placementCache.has(unit)) {
      placementCache.set(unit, getUnitStarPlacements(
        unit,
        board,
        puzzle.starsPerUnit,
        puzzle.size,
      ).filter((placement) => placementFitsUnitCapacities(
        placement,
        board,
        puzzle.starsPerUnit,
        units,
      )));
    }
    return placementCache.get(unit);
  }

  for (const sourceFamily of unitFamilies) {
    for (let leftIndex = 0; leftIndex < sourceFamily.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < sourceFamily.length; rightIndex += 1) {
        const sourceUnits = [sourceFamily[leftIndex], sourceFamily[rightIndex]];
        const leftPlacements = placementsFor(sourceUnits[0]);
        const rightPlacements = placementsFor(sourceUnits[1]);
        if (leftPlacements.length === 0 || rightPlacements.length === 0) continue;

        const combinedPlacements = [];
        for (const leftPlacement of leftPlacements) {
          for (const rightPlacement of rightPlacements) {
            const combined = [...leftPlacement, ...rightPlacement];
            if (hasTouchingPair(combined)) continue;
            if (!placementFitsUnitCapacities(combined, board, puzzle.starsPerUnit, units)) continue;
            combinedPlacements.push(combined);
          }
        }
        if (combinedPlacements.length === 0) continue;

        const sourceKeys = new Set(sourceUnits.flatMap((unit) => unit.cells).map(cellKey));
        for (const targetFamily of unitFamilies) {
          if (targetFamily[0]?.kind === sourceUnits[0].kind) continue;
          for (let firstIndex = 0; firstIndex < targetFamily.length; firstIndex += 1) {
            for (let secondIndex = firstIndex + 1; secondIndex < targetFamily.length; secondIndex += 1) {
              const targetUnits = [targetFamily[firstIndex], targetFamily[secondIndex]];
              const capacities = targetUnits.map((unit) =>
                puzzle.starsPerUnit - unit.cells.filter(({ row, col }) => board[row][col] === "star").length,
              );
              if (capacities.some((capacity) => capacity <= 0)) continue;

              const targetKeys = new Set(targetUnits.flatMap((unit) => unit.cells).map(cellKey));
              const totalCapacity = capacities[0] + capacities[1];
              const reservesAllCapacity = combinedPlacements.every((placement) =>
                placement.filter((cell) => targetKeys.has(cellKey(cell))).length === totalCapacity,
              );
              if (!reservesAllCapacity) continue;

              const competingCell = targetUnits
                .flatMap((unit) => unit.cells)
                .find(({ row, col }) =>
                  board[row][col] === "empty" && !sourceKeys.has(cellKey({ row, col })),
                );
              if (!competingCell) continue;

              const lockedCells = uniqueCells(combinedPlacements.flat())
                .filter((cell) => targetKeys.has(cellKey(cell)))
                .sort(compareCells);
              if (lockedCells.length < 2) continue;

              return {
                kind: "multi-unit-capacity",
                message: `Together, ${joinUnitLabels(sourceUnits)} must fill all remaining star spaces in ${joinUnitLabels(targetUnits)}. The gray spaces show that reserved capacity, so the competing blue space cannot contain a star. Mark it with an X.`,
                cells: [
                  ...lockedCells.map((cell) => ({ ...cell, color: "gray" })),
                  { ...competingCell, color: "blue" },
                ],
                unitCells: uniqueCells(sourceUnits.flatMap((unit) => unit.cells)),
                moves: [{ ...competingCell, state: "mark" }],
              };
            }
          }
        }
      }
    }
  }
  return null;
}

function placementFitsUnitCapacities(placement, board, required, units) {
  return units.every((unit) => {
    const unitKeys = new Set(unit.cells.map(cellKey));
    const placedStars = unit.cells.filter(({ row, col }) => board[row][col] === "star").length;
    const addedStars = placement.filter((cell) => unitKeys.has(cellKey(cell))).length;
    return placedStars + addedStars <= required;
  });
}

function joinUnitLabels(units) {
  return `${units[0].label} and ${units[1].label}`;
}

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

function cellKey({ row, col }) {
  return `${row}:${col}`;
}

globalThis.StarsRemixHints = { findHint, applyHint };
