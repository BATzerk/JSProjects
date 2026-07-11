(() => {
const { BUILTIN_PUZZLE } = window.CollectionsBuiltin;
const { fetchPuzzle, isConfigured } = window.CollectionsDb;
const { flip } = window.CollectionsFlip;
const { toast } = window.CollectionsToast;
const {
  decodePayload,
  fitLabel,
  isValidId,
  normalizePuzzle,
  setButtonDisabled,
  sleep,
} = window.CollectionsUtil;

const WIN_MESSAGES = ['Perfect!', 'Great!', 'Solid!', 'Phew!'];
const LOSS_MESSAGE = 'Next Time!';
const GROUP_EMOJI = ['🟨', '🟩', '🟦', '🟪'];
const MAX_MISTAKES = 4;
const PROGRESS_KEY = 'collections-puzzle-progress';
const GAME_STATE_KEY = 'collections-game-state';

const els = {
  status: document.getElementById('status'),
  browse: document.getElementById('browse'),
  puzzleList: document.getElementById('puzzle-list'),
  game: document.getElementById('game'),
  title: document.getElementById('puzzle-title'),
  byline: document.getElementById('puzzle-byline'),
  notice: document.getElementById('notice'),
  solved: document.getElementById('solved-groups'),
  grid: document.getElementById('card-grid'),
  dots: document.getElementById('mistake-dots'),
  mistakesWrap: document.getElementById('mistakes'),
  controls: document.getElementById('controls'),
  shuffle: document.getElementById('shuffle-btn'),
  deselect: document.getElementById('deselect-btn'),
  submit: document.getElementById('submit-btn'),
  postGame: document.getElementById('post-game'),
  viewResults: document.getElementById('view-results-btn'),
  modalOverlay: document.getElementById('results-overlay'),
  modalContent: document.getElementById('results-content'),
  modalClose: document.getElementById('results-close'),
};

const state = {
  puzzle: null, // normalized puzzle
  source: 'builtin', // 'builtin' | 'supabase' | 'preview'
  shareUrl: '',
  cards: [], // { id, group, word }
  order: [], // unsolved card ids, in grid order
  solved: [], // group indices, in solve order
  selection: new Set(),
  guesses: [], // arrays of 4 group indices, per submitted guess
  guessedKeys: new Set(),
  mistakes: MAX_MISTAKES,
  busy: false,
  finished: false,
  won: false,
};

const cardEls = new Map(); // card id -> button element
let modalLocked = false;

// ---------- Loading ----------

async function init() {
  window.__collectionsBooted = true;
  bindControls();
  try {
    const { puzzle, source, shareUrl } = await resolvePuzzle();
    if (!puzzle) return;
    state.puzzle = puzzle;
    state.source = source;
    state.shareUrl = shareUrl;
  } catch (err) {
    showError(err.message);
    return;
  }
  startGame();
}

async function resolvePuzzle() {
  const hashParams = new URLSearchParams(location.hash.slice(1));
  if (hashParams.has('preview')) {
    let data;
    try {
      data = decodePayload(hashParams.get('preview'));
    } catch {
      throw new Error('This preview link is malformed.');
    }
    return { puzzle: normalizePuzzle(data), source: 'preview', shareUrl: '' };
  }

  const params = new URLSearchParams(location.search);
  if (params.has('sample')) {
    return { puzzle: normalizePuzzle(BUILTIN_PUZZLE), source: 'builtin', shareUrl: '' };
  }

  const id = params.get('p');
  if (id) {
    if (!isValidId(id)) throw new Error('That puzzle link doesn’t look right.');
    if (!isConfigured()) {
      throw new Error(
        'This is a link to a custom puzzle, but Supabase isn’t configured yet. Add your project credentials in src/config.js.'
      );
    }
    showLoading();
    const row = await fetchPuzzle(id);
    if (!row) throw new Error('No puzzle exists at this link. It may have been mistyped.');
    return { puzzle: normalizePuzzle(row), source: 'supabase', shareUrl: location.href };
  }

  await showBrowser();
  return { puzzle: null, source: 'browse', shareUrl: '' };
}

function showLoading() {
  els.game.hidden = true;
  els.status.hidden = false;
  els.status.innerHTML = `
    <div class="status-card">
      <div class="spinner"></div>
      <p>Loading puzzle…</p>
    </div>`;
}

function showError(message) {
  els.game.hidden = true;
  els.status.hidden = false;
  els.status.innerHTML = `
    <div class="status-card">
      <h2>Couldn’t load this puzzle</h2>
      <p></p>
      <a class="btn btn-primary" href="index.html">Play the sample puzzle</a>
    </div>`;
  els.status.querySelector('p').textContent = message;
}

async function showBrowser() {
  els.game.hidden = true;
  els.status.hidden = true;
  els.browse.hidden = false;

  const rows = await loadPuzzleRows();
  renderPuzzleList(rows);
}

async function loadPuzzleRows() {
  const sample = [{
    id: 'sample',
    title: BUILTIN_PUZZLE.title,
    author: 'Built in',
    href: 'index.html?sample=1',
    created_at: '',
  }];

  if (!isConfigured()) return sample;

  els.puzzleList.innerHTML = `
    <div class="status-card">
      <div class="spinner"></div>
      <p>Loading puzzles...</p>
    </div>`;

  try {
    const rows = await window.CollectionsDb.fetchPuzzleList();
    return sample.concat(rows.map((row) => ({
      ...row,
      href: `index.html?p=${encodeURIComponent(row.id)}`,
    })));
  } catch (err) {
    toast(err.message || 'Could not load puzzles.');
    return sample;
  }
}

function renderPuzzleList(rows) {
  els.puzzleList.innerHTML = '';
  if (rows.length === 1) {
    const empty = document.createElement('p');
    empty.className = 'empty-list';
    empty.textContent = 'No published puzzles yet.';
    els.puzzleList.appendChild(empty);
  }

  for (const row of rows) {
    const link = document.createElement('a');
    link.className = 'puzzle-list-item';
    link.href = row.href;

    const text = document.createElement('span');
    text.className = 'puzzle-list-text';

    const title = document.createElement('strong');
    title.textContent = row.title || 'Untitled Puzzle';

    const meta = document.createElement('span');
    meta.textContent = row.author ? `by ${row.author}` : 'Custom puzzle';

    const badge = document.createElement('span');
    badge.className = `progress-badge ${progressFor(row.id).replaceAll(' ', '-')}`;
    badge.textContent = progressLabel(row.id);

    text.append(title, meta);
    link.append(text, badge);
    els.puzzleList.appendChild(link);
  }
}

function progressMap() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
  } catch {
    return {};
  }
}

function progressFor(id) {
  return progressMap()[id]?.status || 'not started';
}

function progressLabel(id) {
  const status = progressFor(id);
  return status[0].toUpperCase() + status.slice(1);
}

function setProgress(status) {
  const id = progressId();
  if (!id) return;
  const progress = progressMap();
  if (progress[id]?.status === 'completed' && status !== 'completed') return;
  progress[id] = { status, updatedAt: Date.now() };
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Progress labels are nice-to-have; gameplay should continue if storage is blocked.
  }
}

function progressId() {
  if (state.source === 'builtin') return 'sample';
  if (state.source !== 'supabase') return '';
  return new URLSearchParams(location.search).get('p') || '';
}

function gameStateMap() {
  try {
    return JSON.parse(localStorage.getItem(GAME_STATE_KEY)) || {};
  } catch {
    return {};
  }
}

function puzzleSignature() {
  if (!state.puzzle) return '';
  return JSON.stringify({
    title: state.puzzle.title,
    groups: state.puzzle.groups,
    boardIds: state.puzzle.boardIds,
  });
}

function savedGameState() {
  const id = progressId();
  if (!id) return null;
  const saved = gameStateMap()[id];
  if (!saved || saved.signature !== puzzleSignature()) return null;
  return saved;
}

function saveGameState() {
  const id = progressId();
  if (!id) return;
  const games = gameStateMap();
  games[id] = {
    signature: puzzleSignature(),
    order: state.order,
    solved: state.solved,
    guesses: state.guesses,
    guessedKeys: [...state.guessedKeys],
    mistakes: state.mistakes,
    finished: state.finished,
    won: state.won,
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(games));
  } catch {
    // Saved games are helpful, but blocked storage should not interrupt play.
  }
}

function restoreGameState(saved) {
  const allIds = new Set(state.cards.map((card) => card.id));
  const solved = Array.isArray(saved.solved)
    ? saved.solved.filter((g, i, arr) => Number.isInteger(g) && g >= 0 && g < 4 && arr.indexOf(g) === i)
    : [];
  const solvedIds = new Set(
    state.cards.filter((card) => solved.includes(card.group)).map((card) => card.id)
  );
  const order = Array.isArray(saved.order)
    ? saved.order.filter((id, i, arr) => allIds.has(id) && !solvedIds.has(id) && arr.indexOf(id) === i)
    : [];
  const expectedRemaining = state.cards
    .map((card) => card.id)
    .filter((id) => !solvedIds.has(id));

  state.solved = solved;
  state.order = order.length === expectedRemaining.length ? order : expectedRemaining;
  state.selection.clear();
  state.guesses = Array.isArray(saved.guesses)
    ? saved.guesses.filter((guess) => Array.isArray(guess) && guess.length === 4)
    : [];
  state.guessedKeys = new Set(Array.isArray(saved.guessedKeys) ? saved.guessedKeys : []);
  state.mistakes = Number.isInteger(saved.mistakes)
    ? Math.max(0, Math.min(MAX_MISTAKES, saved.mistakes))
    : MAX_MISTAKES;
  state.finished = Boolean(saved.finished);
  state.won = Boolean(saved.won);
}

// ---------- Setup ----------

function startGame() {
  const { puzzle, source } = state;
  state.cards = puzzle.groups.flatMap((g, gi) =>
    g.words.map((w, wi) => ({ id: gi * 4 + wi, group: gi, word: w }))
  );
  state.order = puzzle.boardIds.slice();
  state.solved = [];
  state.selection.clear();
  state.guesses = [];
  state.guessedKeys.clear();
  state.mistakes = MAX_MISTAKES;
  state.finished = false;
  state.won = false;

  els.status.hidden = true;
  els.game.hidden = false;
  els.solved.innerHTML = '';
  els.mistakesWrap.hidden = false;
  els.controls.hidden = false;
  els.postGame.hidden = true;

  els.title.textContent = puzzle.title;
  if (source === 'builtin') {
    els.byline.textContent = 'The built-in sample puzzle';
  } else if (puzzle.author) {
    els.byline.textContent = `by ${puzzle.author}`;
  } else {
    els.byline.textContent = 'A custom puzzle';
  }

  if (source === 'preview') {
    els.notice.hidden = false;
    els.notice.textContent = 'Preview mode — this puzzle hasn’t been published yet.';
  }

  const saved = savedGameState();
  if (saved) {
    restoreGameState(saved);
  }
  setProgress(state.finished ? 'completed' : 'in progress');

  renderSolvedGroups();
  renderGrid();
  renderDots();
  if (state.finished) {
    els.mistakesWrap.hidden = true;
    els.controls.hidden = true;
    els.postGame.hidden = false;
  }
  updateControls();
}

function bindControls() {
  els.shuffle.addEventListener('click', shuffleBoard);
  els.deselect.addEventListener('click', deselectAll);
  els.submit.addEventListener('click', submitGuess);
  els.viewResults.addEventListener('click', () => openResults());
  els.modalClose.addEventListener('click', closeResults);
  els.modalOverlay.addEventListener('click', (e) => {
    if (e.target === els.modalOverlay && !modalLocked) closeResults();
  });
  window.addEventListener('resize', () => {
    for (const el of cardEls.values()) fitCard(el);
  });
}

function renderGrid() {
  els.grid.innerHTML = '';
  cardEls.clear();
  for (const id of state.order) {
    const card = state.cards[id];
    const btn = document.createElement('button');
    btn.className = 'card';
    btn.type = 'button';
    btn.dataset.id = String(id);
    btn.setAttribute('aria-pressed', 'false');
    const label = document.createElement('span');
    label.className = 'card-label';
    label.textContent = card.word;
    btn.appendChild(label);
    btn.addEventListener('click', () => onCardClick(id));
    els.grid.appendChild(btn);
    cardEls.set(id, btn);
  }
  requestAnimationFrame(() => {
    for (const el of cardEls.values()) fitCard(el);
  });
}

function renderSolvedGroups() {
  els.solved.innerHTML = '';
  for (const groupIndex of state.solved) {
    els.solved.appendChild(createGroupBanner(groupIndex));
  }
}

function fitCard(btn) {
  const label = btn.querySelector('.card-label');
  const max = window.innerWidth <= 560 ? 14 : 16;
  fitLabel(label, { max, min: 9 });
}

function renderDots() {
  els.dots.innerHTML = '';
  for (let i = 0; i < MAX_MISTAKES; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    if (i >= state.mistakes) dot.classList.add('lost');
    els.dots.appendChild(dot);
  }
}

// ---------- Interaction ----------

function onCardClick(id) {
  if (state.busy || state.finished) return;
  const btn = cardEls.get(id);
  if (state.selection.has(id)) {
    state.selection.delete(id);
    btn.classList.remove('selected');
    btn.setAttribute('aria-pressed', 'false');
  } else {
    if (state.selection.size >= 4) return;
    state.selection.add(id);
    btn.classList.add('selected');
    btn.setAttribute('aria-pressed', 'true');
  }
  updateControls();
}

function updateControls() {
  const { selection, busy, finished } = state;
  const waitReason = busy ? 'Wait for the current animation to finish.' : '';
  const finishedReason = finished ? 'This game is over.' : '';
  setButtonDisabled(els.shuffle, busy || finished, waitReason || finishedReason);
  setButtonDisabled(
    els.deselect,
    busy || finished || selection.size === 0,
    waitReason || finishedReason || 'Select at least one card first.'
  );
  setButtonDisabled(
    els.submit,
    busy || finished || selection.size !== 4,
    waitReason || finishedReason || `Select ${4 - selection.size} more card${selection.size === 3 ? '' : 's'}.`
  );
  els.submit.classList.toggle('btn-primary', selection.size === 4 && !busy && !finished);
}

async function shuffleBoard() {
  if (state.busy || state.finished) return;
  state.busy = true;
  updateControls();
  const shuffled = state.order.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  await applyOrder(shuffled);
  saveGameState();
  state.busy = false;
  updateControls();
}

function deselectAll() {
  if (state.busy || state.finished) return;
  state.selection.clear();
  for (const el of cardEls.values()) {
    el.classList.remove('selected');
    el.setAttribute('aria-pressed', 'false');
  }
  updateControls();
}

// Reorders the grid with a FLIP animation.
function applyOrder(newOrder) {
  state.order = newOrder;
  return flip(cardEls.values(), () => {
    for (const id of newOrder) els.grid.appendChild(cardEls.get(id));
  });
}

// ---------- Guessing ----------

async function submitGuess() {
  if (state.busy || state.finished || state.selection.size !== 4) return;

  const selected = [...state.selection];
  const key = selected.slice().sort((a, b) => a - b).join(',');
  if (state.guessedKeys.has(key)) {
    toast('Already guessed!');
    return;
  }

  state.busy = true;
  updateControls();
  state.guessedKeys.add(key);

  // Bounce the selected cards in board order, like the original.
  const inBoardOrder = state.order.filter((id) => state.selection.has(id));
  for (const [i, id] of inBoardOrder.entries()) {
    setTimeout(() => {
      const el = cardEls.get(id);
      el.classList.add('bounce');
      el.addEventListener('animationend', () => el.classList.remove('bounce'), { once: true });
    }, i * 90);
  }
  await sleep(inBoardOrder.length * 90 + 350);

  const counts = new Map();
  for (const id of selected) {
    const g = state.cards[id].group;
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  state.guesses.push(selected.map((id) => state.cards[id].group));

  const solvedGroup = [...counts.entries()].find(([, n]) => n === 4)?.[0];

  if (solvedGroup !== undefined) {
    await solveGroup(solvedGroup);
    if (state.solved.length === 4) {
      await finishGame(true);
      return;
    }
  } else {
    const oneAway = Math.max(...counts.values()) === 3;
    if (oneAway) toast('One away…');

    for (const id of selected) {
      const el = cardEls.get(id);
      el.classList.add('shake');
      el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
    }
    await sleep(420);

    state.mistakes -= 1;
    els.dots.children[state.mistakes]?.classList.add('lost');
    await sleep(350);

    if (state.mistakes === 0) {
      deselectAllQuiet();
      const keepGoing = await openSecondChance();
      if (keepGoing) {
        state.mistakes = MAX_MISTAKES;
        renderDots();
        saveGameState();
        state.busy = false;
        updateControls();
        return;
      }
      await finishGame(false);
      return;
    }
  }

  saveGameState();
  state.busy = false;
  updateControls();
}

// Moves a group's cards to the top row, then collapses them into a banner.
async function solveGroup(groupIndex) {
  const memberIds = state.order.filter((id) => state.cards[id].group === groupIndex);
  const memberSet = new Set(memberIds);

  // Swap members into the first four slots, displacing non-members.
  const newOrder = state.order.slice();
  const openTopSlots = [];
  for (let i = 0; i < 4; i++) {
    if (!memberSet.has(newOrder[i])) openTopSlots.push(i);
  }
  for (let i = 4; i < newOrder.length; i++) {
    if (memberSet.has(newOrder[i])) {
      const slot = openTopSlots.shift();
      [newOrder[slot], newOrder[i]] = [newOrder[i], newOrder[slot]];
    }
  }
  await applyOrder(newOrder);
  await sleep(80);

  // Replace the top row with the group banner.
  const banner = createGroupBanner(groupIndex);

  const survivors = [...cardEls.values()].filter((el) => !memberSet.has(Number(el.dataset.id)));
  await flip(survivors, () => {
    for (const id of memberIds) {
      cardEls.get(id).remove();
      cardEls.delete(id);
      state.selection.delete(id);
    }
    els.solved.appendChild(banner);
  });

  state.order = state.order.filter((id) => !memberSet.has(id));
  state.solved.push(groupIndex);
  saveGameState();
  await sleep(300);
}

function createGroupBanner(groupIndex) {
  const group = state.puzzle.groups[groupIndex];
  const banner = document.createElement('div');
  banner.className = `banner g${groupIndex}`;
  const name = document.createElement('div');
  name.className = 'banner-name';
  name.textContent = group.name;
  const words = document.createElement('div');
  words.className = 'banner-words';
  words.textContent = group.words.join(', ');
  banner.append(name, words);
  return banner;
}

// ---------- End of game ----------

async function finishGame(won) {
  state.finished = true;
  state.won = won;
  setProgress('completed');

  if (!won) {
    toast(LOSS_MESSAGE);
    deselectAllQuiet();
    await sleep(700);
    for (let gi = 0; gi < 4; gi++) {
      if (!state.solved.includes(gi)) {
        await solveGroup(gi);
        await sleep(250);
      }
    }
  }

  state.busy = false;
  els.mistakesWrap.hidden = true;
  els.controls.hidden = true;
  els.postGame.hidden = false;
  saveGameState();
  await sleep(600);
  openResults();
}

function deselectAllQuiet() {
  state.selection.clear();
  for (const el of cardEls.values()) {
    el.classList.remove('selected');
    el.setAttribute('aria-pressed', 'false');
  }
}

// ---------- Results ----------

function resultsHeading() {
  if (!state.won) return LOSS_MESSAGE;
  return WIN_MESSAGES[MAX_MISTAKES - state.mistakes] ?? WIN_MESSAGES[3];
}

function shareText() {
  const lines = [`Collections`, state.puzzle.title];
  for (const guess of state.guesses) {
    lines.push(guess.map((g) => GROUP_EMOJI[g]).join(''));
  }
  if (state.shareUrl) lines.push(state.shareUrl);
  return lines.join('\n');
}

function openResults() {
  modalLocked = false;
  els.modalClose.hidden = false;
  const wrap = els.modalContent;
  wrap.innerHTML = '';

  const heading = document.createElement('h2');
  heading.className = 'results-heading';
  heading.textContent = resultsHeading();

  const subtitle = document.createElement('p');
  subtitle.className = 'results-subtitle';
  subtitle.textContent = `Collections — ${state.puzzle.title}`;

  const grid = document.createElement('div');
  grid.className = 'results-grid';
  for (const guess of state.guesses) {
    const row = document.createElement('div');
    row.className = 'results-row';
    for (const g of guess) {
      const cell = document.createElement('div');
      cell.className = `results-cell g${g}`;
      row.appendChild(cell);
    }
    grid.appendChild(row);
  }

  const actions = document.createElement('div');
  actions.className = 'results-actions';

  const shareBtn = document.createElement('button');
  shareBtn.className = 'btn btn-primary';
  shareBtn.textContent = 'Share Your Results';
  shareBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareText());
      toast('Copied results to clipboard!');
    } catch {
      toast('Couldn’t copy — your browser blocked clipboard access.');
    }
  });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn';
  closeBtn.textContent = 'View Board';
  closeBtn.addEventListener('click', closeResults);

  const createLink = document.createElement('a');
  createLink.className = 'results-create-link';
  createLink.href = 'create.html';
  createLink.textContent = 'Create your own puzzle →';

  actions.append(shareBtn, closeBtn, createLink);
  wrap.append(heading, subtitle, grid, actions);

  els.modalOverlay.hidden = false;
  requestAnimationFrame(() => els.modalOverlay.classList.add('show'));
}

function openSecondChance() {
  modalLocked = true;
  els.modalClose.hidden = true;
  const wrap = els.modalContent;
  wrap.innerHTML = '';

  const heading = document.createElement('h2');
  heading.className = 'results-heading';
  heading.textContent = 'Out of mistakes';

  const message = document.createElement('p');
  message.className = 'results-subtitle';
  message.textContent = 'Take four more mistakes for free, or reveal the board.';

  const actions = document.createElement('div');
  actions.className = 'results-actions';

  const keepBtn = document.createElement('button');
  keepBtn.className = 'btn btn-primary';
  keepBtn.type = 'button';
  keepBtn.textContent = 'Keep guessing!';

  const giveUpBtn = document.createElement('button');
  giveUpBtn.className = 'btn';
  giveUpBtn.type = 'button';
  giveUpBtn.textContent = 'Give up';

  actions.append(keepBtn, giveUpBtn);
  wrap.append(heading, message, actions);

  els.modalOverlay.hidden = false;
  requestAnimationFrame(() => els.modalOverlay.classList.add('show'));

  return new Promise((resolve) => {
    keepBtn.addEventListener('click', () => {
      modalLocked = false;
      els.modalClose.hidden = false;
      closeResults();
      resolve(true);
    }, { once: true });

    giveUpBtn.addEventListener('click', () => {
      modalLocked = false;
      els.modalClose.hidden = false;
      closeResults();
      resolve(false);
    }, { once: true });
  });
}

function closeResults() {
  els.modalOverlay.classList.remove('show');
  setTimeout(() => {
    els.modalOverlay.hidden = true;
  }, 220);
}

init();
})();
