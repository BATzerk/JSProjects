const techniqueDefinitions = Object.freeze([
  {
    kind: "rule-conflict",
    title: "Rule Check",
    tier: "Basic",
    weight: 0,
    bigTicket: false,
    nudge: "Something on the board breaks one of the puzzle rules.",
    strategy: findRuleConflictHint,
  },
  {
    kind: "surround-star",
    title: "Star Halo",
    tier: "Basic",
    weight: 0,
    bigTicket: false,
    nudge: "There are missing Xs around a star.",
    strategy: findSurroundStarHint,
  },
  {
    kind: "complete-unit",
    title: "Complete Unit",
    tier: "Basic",
    weight: 0,
    bigTicket: false,
    nudge: "A row, column, or house already has all of its stars.",
    strategy: findCompleteUnitHint,
  },
  {
    kind: "forced-star",
    title: "Only Place",
    tier: "Basic",
    weight: 0,
    bigTicket: false,
    nudge: "There is only one valid location for a remaining star in a unit.",
    strategy: findForcedStarHint,
  },
  {
    kind: "locked-intersection",
    title: "Locked Intersection",
    tier: "Intermediate",
    weight: 1,
    bigTicket: false,
    nudge: "A house's remaining stars are confined to one row or column.",
    strategy: findLockedIntersectionHint,
  },
  {
    kind: "locked-star-group",
    title: "Star Barrier",
    tier: "Intermediate",
    weight: 1,
    bigTicket: false,
    nudge: "One space touches every possible location for a star in a unit.",
    strategy: findLockedStarGroupHint,
  },
  {
    kind: "impossible-star",
    title: "Impossible Star",
    tier: "Advanced",
    weight: 2,
    bigTicket: true,
    nudge: "A star in one space would leave another unit without enough room.",
    strategy: findImpossibleStarHint,
  },
  {
    kind: "multi-unit-capacity",
    title: "Capacity Lock",
    tier: "Advanced",
    weight: 3,
    bigTicket: true,
    nudge: "Several units together use all of the remaining star capacity elsewhere.",
    strategy: findMultiUnitCapacityHint,
  },
  {
    kind: "triple-unit-capacity",
    title: "Triple Capacity Lock",
    tier: "Expert",
    weight: 4,
    bigTicket: true,
    nudge: "Three units together use all of the remaining star capacity in three other units.",
  },
  {
    kind: "placement-propagation",
    title: "Placement Crosscheck",
    tier: "Expert",
    weight: 5,
    bigTicket: true,
    nudge: "The remaining row, column, and house patterns constrain one another.",
    strategy: findPlacementPropagationHint,
  },
  {
    kind: "shallow-propagation",
    title: "Contradiction Chain",
    tier: "Expert",
    weight: 6,
    bigTicket: true,
    nudge: "One possible move leads to a contradiction after a short chain.",
    strategy: findShallowPropagationHint,
  },
]);

const hintStrategies = techniqueDefinitions.filter(({ strategy }) => strategy);

function findHint(puzzle, board) {
  const context = {
    puzzle,
    board,
    units: getUnits(puzzle),
  };

  for (const technique of hintStrategies) {
    const hint = technique.strategy(context);
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

function findSoftHint(puzzle, board, solution) {
  const mistake = findBoardMistake(puzzle, board, solution);
  if (mistake) return mistake;

  const units = getUnits(puzzle);
  const hasConflict = Boolean(findRuleConflictHint({ puzzle, board, units }));
  const isSolved = !hasConflict && units.every((unit) =>
    unit.cells.filter(({ row, col }) => board[row][col] === "star").length === puzzle.starsPerUnit,
  );
  if (isSolved) {
    return createSoftHint({
      kind: "solved",
      message: "The puzzle is solved — no hint needed!",
      cells: [],
    });
  }
  return createSoftHint(findHint(puzzle, board));
}

function findSoftHintByKind(puzzle, board, techniqueKind, solution) {
  if (techniqueKind === "board-error") return findBoardMistake(puzzle, board, solution);

  const technique = techniqueDefinitions.find(({ kind }) => kind === techniqueKind);
  const strategy = techniqueKind === "triple-unit-capacity"
    ? findMultiUnitCapacityHint
    : technique?.strategy;
  if (!strategy) return null;

  const hint = strategy({ puzzle, board, units: getUnits(puzzle) });
  return hint?.kind === techniqueKind ? createSoftHint(hint) : null;
}

function findBoardMistake(puzzle, board, solution) {
  if (!Array.isArray(solution) || solution.length === 0) return null;
  const solutionKeys = new Set(solution.map(cellKey));

  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      const state = board[row][col];
      const shouldBeStar = solutionKeys.has(cellKey({ row, col }));
      if ((state === "star" && shouldBeStar) || (state === "mark" && !shouldBeStar) || state === "empty") {
        continue;
      }

      const message = state === "star"
        ? "The highlighted star cannot be here. Remove it or replace it with an X."
        : "The highlighted X covers a space that must contain a star. Clear it or place a star.";
      return {
        kind: "board-error",
        title: "Board Error",
        stages: [
          { message: "There is an error somewhere on the board.", cells: [] },
          { message: `The error is somewhere in Row ${row + 1}.`, cells: [] },
          { message, cells: [{ row, col, color: "red" }] },
        ],
      };
    }
  }
  return null;
}

function checkBoardForErrors(puzzle, board, solution) {
  return Boolean(findBoardMistake(puzzle, board, solution));
}

function isSoftHintTechniqueSatisfied(puzzle, previousBoard, nextBoard, solution, techniqueKind) {
  if (findBoardMistake(puzzle, nextBoard, solution)) return false;

  if (techniqueKind === "board-error") {
    return !findBoardMistake(puzzle, nextBoard, solution);
  }

  const changedCells = collectCells(puzzle.size, ({ row, col }) =>
    previousBoard[row][col] !== nextBoard[row][col],
  );
  if (changedCells.length !== 1) return false;

  const changedCell = changedCells[0];
  const intendedMove = {
    ...changedCell,
    state: nextBoard[changedCell.row][changedCell.col],
  };
  const technique = techniqueDefinitions.find(({ kind }) => kind === techniqueKind);
  const strategy = techniqueKind === "triple-unit-capacity"
    ? findMultiUnitCapacityHint
    : technique?.strategy;
  if (!strategy) return false;

  let techniqueBoard = previousBoard.map((row) => [...row]);
  if (
    previousBoard[changedCell.row][changedCell.col] === "mark"
    && intendedMove.state === "star"
  ) {
    techniqueBoard[changedCell.row][changedCell.col] = "empty";
  }
  for (let step = 0; step < puzzle.size * puzzle.size; step += 1) {
    const hint = strategy({
      puzzle,
      board: techniqueBoard,
      units: getUnits(puzzle),
    });
    if (!hint?.moves?.length) return false;
    if (hint.kind === techniqueKind && hint.moves.some((move) =>
      move.row === intendedMove.row
      && move.col === intendedMove.col
      && move.state === intendedMove.state,
    )) {
      return true;
    }
    techniqueBoard = applyHint(techniqueBoard, hint);
  }
  return false;
}

function createSoftHint(hint) {
  const technique = getTechniqueDefinition(hint.kind);
  const focusCells = (hint.cells ?? [])
    .filter((cell) => cell.color !== "blue" || hint.kind === "rule-conflict")
    .map(({ previewState, ...cell }) => cell);
  const unitLabels = [...new Set(
    (hint.message.match(/\b(?:Row|Column|House) \d+\b/g) ?? []),
  )];
  const locationMessage = unitLabels.length > 0
    ? `Look closely at ${joinLabels(unitLabels)}.`
    : hint.kind === "surround-star"
      ? "Look around the highlighted star."
      : "Look closely at the highlighted part of the board.";

  return {
    kind: hint.kind,
    title: technique.title,
    stages: [
      { message: technique.nudge, cells: [] },
      { message: locationMessage, cells: [] },
      { message: locationMessage, cells: focusCells },
      {
        message: hint.message,
        cells: hint.cells ?? [],
        assumption: hint.assumption,
      },
    ],
  };
}

function joinLabels(labels) {
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

function getTechniqueDefinition(kind) {
  if (kind === "solved") {
    return { kind, title: "All Done", tier: "Basic", weight: 0, bigTicket: false, nudge: "The puzzle is solved — no hint needed!" };
  }
  if (kind === "none") {
    return { kind, title: "No Technique Found", tier: "Unknown", weight: 0, bigTicket: false, nudge: "No soft hint from the current set applies yet." };
  }
  return techniqueDefinitions.find((technique) => technique.kind === kind) ?? {
    kind,
    title: "Next Step",
    tier: "Unknown",
    weight: 0,
    bigTicket: false,
    nudge: "There is a logical next step available.",
  };
}

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

  for (const groupSize of [2, 3]) {
    for (const sourceFamily of unitFamilies) {
      for (const sourceUnits of chooseUnitGroups(sourceFamily, groupSize)) {
        const combinedPlacements = combineUnitPlacements(
          sourceUnits,
          placementsFor,
          board,
          puzzle.starsPerUnit,
          units,
        );
        if (combinedPlacements.length === 0) continue;

        const sourceKeys = new Set(sourceUnits.flatMap((unit) => unit.cells).map(cellKey));
        for (const targetFamily of unitFamilies) {
          if (targetFamily[0]?.kind === sourceUnits[0].kind) continue;
          for (const targetUnits of chooseUnitGroups(targetFamily, groupSize)) {
            const capacities = targetUnits.map((unit) =>
              puzzle.starsPerUnit - unit.cells.filter(({ row, col }) => board[row][col] === "star").length,
            );
            if (capacities.some((capacity) => capacity <= 0)) continue;

            const targetKeys = new Set(targetUnits.flatMap((unit) => unit.cells).map(cellKey));
            const totalCapacity = capacities.reduce((total, capacity) => total + capacity, 0);
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
            if (lockedCells.length < groupSize) continue;

            return {
              kind: groupSize === 3 ? "triple-unit-capacity" : "multi-unit-capacity",
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
  return null;
}

function chooseUnitGroups(items, groupSize) {
  const groups = [];
  const chosen = [];

  function choose(start) {
    if (chosen.length === groupSize) {
      groups.push([...chosen]);
      return;
    }
    for (let index = start; index <= items.length - (groupSize - chosen.length); index += 1) {
      chosen.push(items[index]);
      choose(index + 1);
      chosen.pop();
    }
  }

  choose(0);
  return groups;
}

function combineUnitPlacements(sourceUnits, placementsFor, board, required, units) {
  const placementLists = sourceUnits.map(placementsFor);
  if (placementLists.some((placements) => placements.length === 0)) return [];
  const rawCombinationCount = placementLists.reduce(
    (count, placements) => count * placements.length,
    1,
  );
  if (sourceUnits.length === 3 && rawCombinationCount > 256) return [];

  const combinedPlacements = [];

  function combine(unitIndex, chosenCells) {
    if (unitIndex === sourceUnits.length) {
      combinedPlacements.push(chosenCells);
      return;
    }
    for (const placement of placementLists[unitIndex]) {
      const combined = [...chosenCells, ...placement];
      if (hasTouchingPair(combined)) continue;
      if (!placementFitsUnitCapacities(combined, board, required, units)) continue;
      combine(unitIndex + 1, combined);
    }
  }

  combine(0, []);
  return combinedPlacements;
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
  if (units.length === 2) return `${units[0].label} and ${units[1].label}`;
  return `${units.slice(0, -1).map((unit) => unit.label).join(", ")}, and ${units.at(-1).label}`;
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

async function analyzeDifficulty(puzzle, options = {}) {
  const onProgress = options.onProgress ?? (() => {});
  const yieldControl = options.yieldControl ?? (() => Promise.resolve());
  const maximumSteps = puzzle.size * puzzle.size * 2;
  let analysisBoard = Array.from(
    { length: puzzle.size },
    () => Array(puzzle.size).fill("empty"),
  );
  const steps = [];

  while (!boardIsSolved(puzzle, analysisBoard) && steps.length < maximumSteps) {
    const hint = await findHintForAnalysis(puzzle, analysisBoard, {
      onTechnique: (technique, techniqueIndex) => {
        onProgress(makeDifficultyProgress(
          puzzle,
          analysisBoard,
          steps.length,
          technique,
          techniqueIndex,
        ));
      },
      yieldControl,
    });
    const moves = (hint.moves ?? []).filter(
      (move) => analysisBoard[move.row][move.col] !== move.state,
    );
    if (moves.length === 0) break;

    const technique = getTechniqueDefinition(hint.kind);
    analysisBoard = applyHint(analysisBoard, { moves });
    steps.push({
      number: steps.length + 1,
      kind: hint.kind,
      title: technique.title,
      tier: technique.tier,
      weight: technique.weight,
      bigTicket: technique.bigTicket,
      message: hint.message,
      moves,
    });
    onProgress(makeDifficultyProgress(puzzle, analysisBoard, steps.length, technique, 0));
    await yieldControl();
  }

  const solved = boardIsSolved(puzzle, analysisBoard);
  const bigTicketCount = steps.filter(({ bigTicket }) => bigTicket).length;
  const score = steps.reduce((total, { weight }) => total + weight, 0);
  const techniqueCounts = techniqueDefinitions
    .map((technique) => ({
      kind: technique.kind,
      title: technique.title,
      tier: technique.tier,
      weight: technique.weight,
      bigTicket: technique.bigTicket,
      count: steps.filter((step) => step.kind === technique.kind).length,
    }))
    .filter(({ count }) => count > 0);

  return {
    solved,
    label: solved ? getDifficultyLabel(bigTicketCount, score) : "Incalculable",
    bigTicketCount,
    score,
    steps,
    techniqueCounts,
    starsPlaced: countBoardState(analysisBoard, "star"),
    totalStars: puzzle.size * puzzle.starsPerUnit,
  };
}

async function findHintForAnalysis(puzzle, board, { onTechnique, yieldControl }) {
  const context = { puzzle, board, units: getUnits(puzzle) };
  for (let index = 0; index < hintStrategies.length; index += 1) {
    const technique = hintStrategies[index];
    onTechnique(technique, index);
    if (technique.weight >= 2) await yieldControl();
    const hint = technique.strategy(context);
    if (hint) return hint;
  }
  return { kind: "none", message: "No technique applies.", cells: [] };
}

function makeDifficultyProgress(puzzle, board, stepsCompleted, technique, techniqueIndex) {
  const starsPlaced = countBoardState(board, "star");
  const totalStars = puzzle.size * puzzle.starsPerUnit;
  return {
    percent: Math.min(99, Math.round((starsPlaced / totalStars) * 100)),
    starsPlaced,
    totalStars,
    stepsCompleted,
    technique: technique.title,
    tier: technique.tier,
    strategyIndex: techniqueIndex,
    strategyCount: hintStrategies.length,
  };
}

function countBoardState(board, state) {
  return board.reduce(
    (total, row) => total + row.filter((cellState) => cellState === state).length,
    0,
  );
}

function boardIsSolved(puzzle, board) {
  const units = getUnits(puzzle);
  return !findRuleConflictHint({ puzzle, board, units }) && units.every((unit) =>
    unit.cells.filter(({ row, col }) => board[row][col] === "star").length === puzzle.starsPerUnit,
  );
}

function getDifficultyLabel(bigTicketCount, score) {
  if (bigTicketCount === 0 && score <= 2) return "Easy";
  if (bigTicketCount === 0) return "Moderate";
  if (bigTicketCount <= 2) return "Hard";
  if (bigTicketCount <= 4) return "Very Hard";
  return "Expert";
}

function cellKey({ row, col }) {
  return `${row}:${col}`;
}

globalThis.StarsRemixHints = {
  findHint,
  findSoftHint,
  findSoftHintByKind,
  isSoftHintTechniqueSatisfied,
  checkBoardForErrors,
  applyHint,
  analyzeDifficulty,
  techniques: techniqueDefinitions.map(({ strategy, ...technique }) => ({ ...technique })),
};
