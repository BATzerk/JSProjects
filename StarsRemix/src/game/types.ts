export type CellState = "empty" | "star" | "mark";

export type Position = {
  row: number;
  col: number;
};

export type Puzzle = {
  id: string;
  title: string;
  size: number;
  starsPerUnit: number;
  houses: number[][];
};

export type BoardState = CellState[][];

export type UnitKind = "row" | "column" | "house";

export type UnitStatus = {
  kind: UnitKind;
  index: number;
  count: number;
  required: number;
  complete: boolean;
  overfilled: boolean;
};

export type Conflict = {
  cells: Position[];
  reason: string;
};

export type Validation = {
  solved: boolean;
  conflicts: Conflict[];
  unitStatuses: UnitStatus[];
};
