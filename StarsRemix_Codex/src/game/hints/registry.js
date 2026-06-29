// Part of the StarsRemix hint runtime (classic script, no build step).
// Technique registry + public StarsRemixHints export. Loads last so every strategy function is already defined.
// Top-level functions here are global and shared across the hints/*.js
// files; load order is fixed in index.html and hints.test.ts. The
// technique registry and public StarsRemixHints export live in registry.js,
// which loads last.

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

// Publish the technique tables for the other hints/*.js files.
Object.assign(globalThis, { techniqueDefinitions, hintStrategies });
