'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

type Mark = 'island' | 'water';

type Puzzle = {
  id: string;
  title: string;
  size: number;
  target: number;
  rows: string[];
};

type Analysis = {
  complete: boolean;
  conflicts: Set<number>;
  message: string;
  solved: boolean;
};

const PUZZLES: Puzzle[] = [
  {
    id: 'first-light',
    title: 'First Light',
    size: 5,
    target: 2,
    rows: ['#2...', '..2.#', '?.#.2', '.....', '#2.2#'],
  },
  {
    id: 'six-bays',
    title: 'Six Bays',
    size: 6,
    target: 3,
    rows: ['##3.##', '.....3', '#?.#..', '3#.#.#', '...3.3', '3##..#'],
  },
  {
    id: 'blue-channel',
    title: 'Blue Channel',
    size: 7,
    target: 3,
    rows: ['##3.##3', '.......', '##3.##.', '.....3.', '#.##3.#', '3.?...3', '#.3##.#'],
  },
  {
    id: 'tideline',
    title: 'Tideline',
    size: 7,
    target: 4,
    rows: ['4#.4###', '##....?', '..#4.##', '4.##.4#', '#......', '#.##.4#', '#.#4.##'],
  },
];

const MARK_LABELS: Record<Mark, string> = {
  island: 'island',
  water: 'not island',
};

const isNumber = (value: string) => /\d/.test(value);
const flatten = (puzzle: Puzzle) => puzzle.rows.join('').split('');
const randomItem = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const edgeDistance = (index: number, size: number) => {
  const row = Math.floor(index / size);
  const column = index % size;
  return Math.min(row, column, size - 1 - row, size - 1 - column);
};

function tryRandomLayout(size: number, target: number, desiredIslands: number) {
  let best: { cells: string[]; islands: number[][]; interiorIslands: number } | null = null;
  const requiredInteriorIslands = Math.ceil(desiredIslands / 2);

  for (let restart = 0; restart < 24; restart += 1) {
    const cells = Array<string>(size * size).fill('.');
    const islands: number[][] = [];

    for (let attempt = 0; attempt < 800 && islands.length < desiredIslands; attempt += 1) {
      const available = cells
        .map((value, index) => ({ value, index }))
        .filter(({ value, index }) => value === '.' && neighborIndexes(index, size).every((neighbor) => cells[neighbor] === '.'))
        .map(({ index }) => index);
      if (!available.length) break;

      const island = [randomItem(available)];
      while (island.length < target) {
        const frontier = [...new Set(island.flatMap((index) => neighborIndexes(index, size)))]
          .filter((index) => !island.includes(index) && cells[index] === '.')
          .filter((index) => neighborIndexes(index, size).every((neighbor) => cells[neighbor] === '.' || island.includes(neighbor)));
        if (!frontier.length) break;
        island.push(randomItem(frontier));
      }
      if (island.length !== target) continue;

      island.forEach((index) => { cells[index] = '#'; });
      const testBoard: Mark[] = cells.map((value) => value === '#' ? 'island' : 'water');
      if (componentsFor('water', testBoard, size).length !== 1) {
        island.forEach((index) => { cells[index] = '.'; });
        continue;
      }
      islands.push(island);
    }

    const interiorIslands = islands.filter((island) => island.some((index) => edgeDistance(index, size) > 0)).length;
    if (
      !best
      || islands.length > best.islands.length
      || (islands.length === best.islands.length && interiorIslands > best.interiorIslands)
    ) best = { cells, islands, interiorIslands };
    if (islands.length >= desiredIslands && interiorIslands >= requiredInteriorIslands) return { cells, islands };
  }

  return best && best.islands.length >= desiredIslands && best.interiorIslands >= requiredInteriorIslands ? best : null;
}

function generateRandomPuzzle(): Puzzle {
  const configurations = [
    { size: 7, target: 2, desiredIslands: 10 },
    { size: 7, target: 3, desiredIslands: 7 },
    { size: 7, target: 4, desiredIslands: 6 },
    { size: 8, target: 4, desiredIslands: 7 },
  ];
  const configuration = randomItem(configurations);

  for (let layoutAttempt = 0; layoutAttempt < 12; layoutAttempt += 1) {
    const { size, target, desiredIslands } = configuration;
    const layout = tryRandomLayout(size, target, desiredIslands);
    if (!layout) continue;

    const { cells, islands } = layout;
    islands.forEach((island) => {
      const deepestDistance = Math.max(...island.map((index) => edgeDistance(index, size)));
      const inwardCells = island.filter((index) => edgeDistance(index, size) === deepestDistance);
      cells[randomItem(inwardCells)] = String(target);
    });

  const water = cells
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => value === '.')
    .map(({ index }) => index);
    cells[randomItem(water)] = '?';

    return {
      id: `random-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: 'Uncharted Waters',
      size,
      target,
      rows: Array.from({ length: size }, (_, row) => cells.slice(row * size, (row + 1) * size).join('')),
    };
  }

  // Dense procedural layouts are not always reachable by the greedy packer.
  // Returning a curated board is preferable to serving a sparse random one.
  const fallback = randomItem(PUZZLES.slice(1));
  return {
    ...fallback,
    id: `random-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Uncharted Waters',
  };
}

function initialBoard(puzzle: Puzzle): Mark[] {
  return flatten(puzzle).map((value) => {
    if (isNumber(value)) return 'island';
    return 'water';
  });
}

function solutionBoard(puzzle: Puzzle): Mark[] {
  return flatten(puzzle).map((value) => (value === '#' || isNumber(value) ? 'island' : 'water'));
}

function neighborIndexes(index: number, size: number): number[] {
  const row = Math.floor(index / size);
  const column = index % size;
  const result: number[] = [];
  if (row > 0) result.push(index - size);
  if (row + 1 < size) result.push(index + size);
  if (column > 0) result.push(index - 1);
  if (column + 1 < size) result.push(index + 1);
  return result;
}

function componentsFor(mark: Mark, board: Mark[], size: number): number[][] {
  const seen = new Set<number>();
  const components: number[][] = [];

  board.forEach((cellMark, index) => {
    if (cellMark !== mark || seen.has(index)) return;
    const component: number[] = [];
    const queue = [index];
    seen.add(index);

    while (queue.length) {
      const current = queue.shift()!;
      component.push(current);
      neighborIndexes(current, size).forEach((neighbor) => {
        if (board[neighbor] === mark && !seen.has(neighbor)) {
          seen.add(neighbor);
          queue.push(neighbor);
        }
      });
    }
    components.push(component);
  });

  return components;
}

function analyzeBoard(board: Mark[], puzzle: Puzzle): Analysis {
  const source = flatten(puzzle);
  const conflicts = new Set<number>();
  const islandComponents = componentsFor('island', board, puzzle.size);
  let islandProblem = false;

  islandComponents.forEach((component) => {
    const clues = component.filter((index) => isNumber(source[index])).length;
    if (component.length > puzzle.target || clues > 1) {
      islandProblem = true;
      component.forEach((index) => conflicts.add(index));
    }
  });

  const finishedIslands = islandComponents.every((component) => {
    const clues = component.filter((index) => isNumber(source[index])).length;
    return component.length === puzzle.target && clues === 1;
  });
  const waterComponents = componentsFor('water', board, puzzle.size);
  const waterConnected = waterComponents.length === 1;

  const solved = finishedIslands && waterConnected;
  return {
    complete: true,
    conflicts,
    message: solved
      ? 'Every island is complete. The sea is whole.'
      : islandProblem
        ? 'An island has broken the rules.'
        : 'Keep shaping the islands.',
    solved,
  };
}

function safeSavedBoard(value: string | null, puzzle: Puzzle): Mark[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (
      Array.isArray(parsed)
      && parsed.length === puzzle.size * puzzle.size
      && parsed.every((mark) => mark === 'unknown' || mark === 'island' || mark === 'water')
    ) {
      const source = flatten(puzzle);
      return parsed.map((mark, index) => {
        if (isNumber(source[index])) return 'island';
        if (source[index] === '?') return 'water';
        return mark === 'island' ? 'island' : 'water';
      });
    }
  } catch {
    return null;
  }
  return null;
}

export default function Home() {
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [randomPuzzle, setRandomPuzzle] = useState<Puzzle | null>(null);
  const [board, setBoard] = useState<Mark[]>(() => initialBoard(PUZZLES[0]));
  const [boardPuzzleId, setBoardPuzzleId] = useState(PUZZLES[0].id);
  const [history, setHistory] = useState<Mark[][]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const puzzle = randomPuzzle ?? PUZZLES[puzzleIndex];
  const source = useMemo(() => flatten(puzzle), [puzzle]);
  const solution = useMemo(() => solutionBoard(puzzle), [puzzle]);
  const analysis = useMemo(() => analyzeBoard(board, puzzle), [board, puzzle]);

  useEffect(() => {
    const storedIndex = Number(window.localStorage.getItem('one-sea-current') ?? '0');
    const nextIndex = Number.isInteger(storedIndex) && storedIndex >= 0 && storedIndex < PUZZLES.length
      ? storedIndex
      : 0;
    const storedCompleted = window.localStorage.getItem('one-sea-completed');
    if (storedCompleted) {
      try {
        const parsed = JSON.parse(storedCompleted);
        if (Array.isArray(parsed)) setCompleted(parsed.filter((id) => PUZZLES.some((item) => item.id === id)));
      } catch {
        // Ignore damaged local progress and begin cleanly.
      }
    }
    setPuzzleIndex(nextIndex);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const saved = randomPuzzle
      ? null
      : safeSavedBoard(window.localStorage.getItem(`one-sea-board-${puzzle.id}`), puzzle);
    setBoard(saved ?? initialBoard(puzzle));
    setBoardPuzzleId(puzzle.id);
    setHistory([]);
    setCompleteOpen(false);
    setNotice('');
    window.localStorage.setItem('one-sea-current', String(puzzleIndex));
  }, [puzzleIndex, puzzle, randomPuzzle, ready]);

  useEffect(() => {
    if (!ready || randomPuzzle || boardPuzzleId !== puzzle.id) return;
    window.localStorage.setItem(`one-sea-board-${puzzle.id}`, JSON.stringify(board));
  }, [board, boardPuzzleId, puzzle.id, randomPuzzle, ready]);

  useEffect(() => {
    if (!analysis.solved) return;
    setCompleteOpen(true);
    if (randomPuzzle) return;
    setCompleted((current) => {
      if (current.includes(puzzle.id)) return current;
      const next = [...current, puzzle.id];
      window.localStorage.setItem('one-sea-completed', JSON.stringify(next));
      return next;
    });
  }, [analysis.solved, puzzle.id, randomPuzzle]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 2200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const isFixed = (index: number) => isNumber(source[index]) || source[index] === '?';

  const remember = () => {
    setHistory((current) => [...current.slice(-39), [...board]]);
  };

  const applyMark = (index: number, mark: Mark) => {
    if (isFixed(index) || analysis.solved) return;
    setBoard((current) => {
      if (current[index] === mark) return current;
      const next = [...current];
      next[index] = mark;
      return next;
    });
  };

  const toggleCell = (index: number) => {
    if (isFixed(index) || analysis.solved) return;
    remember();
    applyMark(index, board[index] === 'island' ? 'water' : 'island');
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setBoard(previous);
    setHistory((current) => current.slice(0, -1));
    setCompleteOpen(false);
  };

  const reset = () => {
    remember();
    setBoard(initialBoard(puzzle));
    setCompleteOpen(false);
    setNotice('Fresh tide, clean board.');
  };

  const giveHint = () => {
    const candidates = board
      .map((mark, index) => ({ index, wrong: mark !== solution[index] }))
      .filter(({ index, wrong }) => wrong && !isFixed(index));
    const choice = candidates[0];
    if (!choice) {
      setNotice('Your marks are all correct. Keep going!');
      return;
    }
    remember();
    applyMark(choice.index, solution[choice.index]);
    setNotice(solution[choice.index] === 'island' ? 'A patch of island rises.' : 'The tide claims one square.');
  };

  const goToPuzzle = (nextIndex: number) => {
    const wrapped = (nextIndex + PUZZLES.length) % PUZZLES.length;
    setRandomPuzzle(null);
    setPuzzleIndex(wrapped);
  };

  const makeRandomBoard = () => {
    setRandomPuzzle(generateRandomPuzzle());
    setCompleteOpen(false);
    setNotice('A new island chain appears.');
  };

  const boardStyle = { '--grid-size': puzzle.size } as CSSProperties;

  return (
    <main className="game-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setHelpOpen(true)} aria-label="Open One Sea rules">
          <span>ONE SEA</span>
        </button>

        <div className="puzzle-switcher">
          <button type="button" onClick={() => goToPuzzle(puzzleIndex - 1)} aria-label="Previous puzzle">‹</button>
          <div className="puzzle-label" aria-live="polite">
            <span className="eyebrow">ISLANDS OF {puzzle.target} · {randomPuzzle ? 'RANDOM' : `${puzzleIndex + 1}/${PUZZLES.length}`}</span>
            <strong>{puzzle.title}</strong>
          </div>
          <button type="button" onClick={() => goToPuzzle(puzzleIndex + 1)} aria-label="Next puzzle">›</button>
        </div>

        <button className="icon-button" type="button" onClick={() => setHelpOpen(true)} aria-label="How to play">?</button>
      </header>

      <section className="play-area">
        <div className="game-layout">
          <div className="board-column">
            <div
              className={`board${analysis.solved ? ' solved' : ''}`}
              role="grid"
              aria-label={`${puzzle.title}: ${puzzle.size} by ${puzzle.size} One Sea puzzle`}
              style={boardStyle}
            >
              {board.map((mark, index) => {
                const clue = source[index];
                const fixedWater = clue === '?';
                const fixedIsland = isNumber(clue);
                const className = [
                  'cell',
                  mark,
                  fixedWater ? 'water-clue' : '',
                  fixedIsland ? 'island-clue' : '',
                  analysis.conflicts.has(index) ? 'conflict' : '',
                  (index + 1) % puzzle.size === 0 ? 'edge-right' : '',
                  index >= board.length - puzzle.size ? 'edge-bottom' : '',
                ].filter(Boolean).join(' ');
                const row = Math.floor(index / puzzle.size) + 1;
                const column = (index % puzzle.size) + 1;
                const label = fixedWater
                  ? `Row ${row}, column ${column}, water clue`
                  : fixedIsland
                    ? `Row ${row}, column ${column}, island clue ${puzzle.target}`
                    : `Row ${row}, column ${column}, ${MARK_LABELS[mark]}`;

                return (
                  <button
                    className={className}
                    type="button"
                    role="gridcell"
                    key={index}
                    aria-label={label}
                    aria-disabled={isFixed(index) || analysis.solved}
                    aria-pressed={fixedIsland || (!fixedWater && mark === 'island')}
                    onClick={() => toggleCell(index)}
                  >
                    {fixedWater ? '?' : fixedIsland ? puzzle.target : null}
                  </button>
                );
              })}
            </div>

            <div className="board-actions" aria-label="Puzzle actions">
              <button type="button" onClick={undo} disabled={!history.length}>Undo</button>
              <button type="button" onClick={giveHint}>Hint</button>
              <button type="button" onClick={reset}>Reset</button>
              <button className="random-button" type="button" onClick={makeRandomBoard}>Random board</button>
            </div>
          </div>
        </div>
      </section>

      <footer className="game-footer">
        <div className="progress-dots" aria-label="Choose a puzzle">
          {PUZZLES.map((item, index) => (
            <button
              className={`${index === puzzleIndex ? 'active' : ''}${completed.includes(item.id) ? ' complete' : ''}`}
              type="button"
              onClick={() => goToPuzzle(index)}
              aria-label={`${item.title}${completed.includes(item.id) ? ', solved' : ''}`}
              aria-current={index === puzzleIndex ? 'step' : undefined}
              key={item.id}
            />
          ))}
        </div>
      </footer>

      {notice && <div className="toast" role="status">{notice}</div>}

      {helpOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setHelpOpen(false);
        }}>
          <section className="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
            <button className="modal-close" type="button" onClick={() => setHelpOpen(false)} aria-label="Close rules">×</button>
            <h2 id="help-title">How to play</h2>
            <p>Click to add or remove island. Each numbered island has exactly {puzzle.target} cells, separate islands never share an edge, and every remaining cell connects to the ? as one sea.</p>
            <button className="primary-button" type="button" onClick={() => setHelpOpen(false)}>Play</button>
          </section>
        </div>
      )}

      {completeOpen && analysis.solved && (
        <div className="modal-backdrop celebration" role="presentation">
          <section className="modal complete-modal" role="dialog" aria-modal="true" aria-labelledby="complete-title">
            <div className="sunburst" aria-hidden="true">✦</div>
            <h2 id="complete-title">Solved.</h2>
            <p>{source.filter(isNumber).length} islands. One sea.</p>
            <div className="completion-actions">
              <button type="button" onClick={() => setCompleteOpen(false)}>View board</button>
              <button className="primary-button" type="button" onClick={() => randomPuzzle ? makeRandomBoard() : goToPuzzle(puzzleIndex + 1)}>
                {randomPuzzle ? 'Another random board' : puzzleIndex === PUZZLES.length - 1 ? 'Sail to the first' : 'Next puzzle'} →
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
