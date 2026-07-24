// Part of the StarsRemix hint runtime (classic script, no build step).
// Basic technique strategies (rule conflicts through multi-unit capacity).
// Top-level functions here are global and shared across the hints/*.js
// files; load order is fixed in index.html and hints.test.ts. The
// technique registry and public StarsRemixHints export live in registry.js,
// which loads last.

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

// Publish to the shared global scope so the other hints/*.js files (and the
// Node test harness, which loads each file as a module) can resolve these by name.
Object.assign(globalThis, { findRuleConflictHint,findSurroundStarHint,findCompleteUnitHint,findForcedStarHint,findLockedIntersectionHint,findMultiUnitCapacityHint,chooseUnitGroups,combineUnitPlacements,placementFitsUnitCapacities,joinUnitLabels });
