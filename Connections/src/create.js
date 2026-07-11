(() => {
const { isConfigured, publishPuzzle } = window.ConnectionsDb;
const { flip } = window.ConnectionsFlip;
const { toast } = window.ConnectionsToast;
const {
  clamp,
  encodePayload,
  fitLabel,
  generateId,
  setButtonDisabled,
  shuffleArray,
} = window.ConnectionsUtil;

const GROUP_COLORS = ['Yellow', 'Green', 'Blue', 'Purple'];

const DRAFT_KEY = 'connections-creator-draft';

const els = {
  configBanner: document.getElementById('config-banner'),
  title: document.getElementById('puzzle-title-input'),
  author: document.getElementById('puzzle-author-input'),
  arrangeGrid: document.getElementById('arrange-grid'),
  shuffleBoard: document.getElementById('shuffle-board-btn'),
  resetBoard: document.getElementById('reset-board-btn'),
  errors: document.getElementById('form-errors'),
  preview: document.getElementById('preview-btn'),
  publish: document.getElementById('publish-btn'),
  publishSection: document.getElementById('publish-actions'),
  successPanel: document.getElementById('success-panel'),
  draftStatus: document.getElementById('draft-status'),
  clearDraft: document.getElementById('clear-draft-btn'),
};

// Card index = groupIndex * 4 + wordIndex.
const state = {
  title: '',
  author: '',
  groups: GROUP_COLORS.map(() => ({ name: '', words: ['', '', '', ''] })),
  order: shuffleArray([...Array(16).keys()]),
};

const inputs = {
  groupNames: [], // input per group
  words: [], // words[g][w] -> input
};

const tileEls = new Map(); // card index -> tile element

// ---------- Setup ----------

function init() {
  setButtonDisabled(els.preview, false);
  if (isConfigured()) {
    setButtonDisabled(els.publish, false);
  } else {
    els.configBanner.hidden = false;
    setButtonDisabled(
      els.publish,
      true,
      'Add Supabase credentials in src/config.js to enable publishing.'
    );
  }

  restoreDraft();
  bindGroupEditors();
  initArrangeGrid();

  els.title.value = state.title;
  els.author.value = state.author;
  els.title.addEventListener('input', () => {
    state.title = els.title.value;
    els.title.classList.remove('invalid');
    saveDraft();
  });
  els.author.addEventListener('input', () => {
    state.author = els.author.value;
    saveDraft();
  });

  els.shuffleBoard.addEventListener('click', () => reorderBoard(shuffleArray(state.order)));
  els.resetBoard.addEventListener('click', () => reorderBoard([...Array(16).keys()]));
  els.preview.addEventListener('click', onPreview);
  els.publish.addEventListener('click', onPublish);
  els.clearDraft.addEventListener('click', () => {
    if (!confirm('Clear the whole form and start over?')) return;
    localStorage.removeItem(DRAFT_KEY);
    location.reload();
  });

  window.__connectionsBooted = true;
}

// The editors and tiles live in static HTML; wire them to state.
function bindGroupEditors() {
  document.querySelectorAll('#groups-wrap .group-editor').forEach((section, gi) => {
    const nameInput = section.querySelector('.group-name-input');
    nameInput.value = state.groups[gi].name;
    nameInput.addEventListener('input', () => {
      state.groups[gi].name = nameInput.value;
      nameInput.classList.remove('invalid');
      saveDraft();
    });
    inputs.groupNames.push(nameInput);

    inputs.words.push([]);
    section.querySelectorAll('.word-row .text-input').forEach((wordInput, wi) => {
      wordInput.value = state.groups[gi].words[wi];
      wordInput.addEventListener('input', () => {
        state.groups[gi].words[wi] = wordInput.value;
        wordInput.classList.remove('invalid');
        updateTile(gi * 4 + wi);
        saveDraft();
      });
      inputs.words[gi].push(wordInput);
    });
  });
}

// ---------- Arrange grid ----------

function initArrangeGrid() {
  for (const tile of els.arrangeGrid.querySelectorAll('.tile')) {
    const cardIdx = Number(tile.dataset.card);
    tile.addEventListener('pointerdown', (e) => onTilePointerDown(e, tile));
    tileEls.set(cardIdx, tile);
  }
  for (const cardIdx of state.order) {
    els.arrangeGrid.appendChild(tileEls.get(cardIdx));
    updateTile(cardIdx);
  }
}

function cardWord(cardIdx) {
  return state.groups[Math.floor(cardIdx / 4)].words[cardIdx % 4].trim();
}

function updateTile(cardIdx) {
  const tile = tileEls.get(cardIdx);
  if (!tile) return;
  const label = tile.querySelector('.tile-label');
  const word = cardWord(cardIdx);
  tile.classList.toggle('empty', !word);
  label.textContent = word || `Card ${cardIdx % 4 + 1}`;
  fitLabel(label, { max: 15, min: 9 });
}

function reorderBoard(newOrder) {
  state.order = newOrder;
  flip(tileEls.values(), () => {
    for (const cardIdx of newOrder) els.arrangeGrid.appendChild(tileEls.get(cardIdx));
  });
  saveDraft();
}

// ---------- Drag to reorder ----------

let drag = null;

// Window-level listeners track the drag: the tile itself gets re-inserted
// into the grid while reordering, which would cancel pointer capture on it.
function onTilePointerDown(e, tile) {
  if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault();
  const rect = tile.getBoundingClientRect();
  drag = {
    pointerId: e.pointerId,
    tile,
    cardIdx: Number(tile.dataset.card),
    startX: e.clientX,
    startY: e.clientY,
    grabDX: e.clientX - rect.left,
    grabDY: e.clientY - rect.top,
    width: rect.width,
    height: rect.height,
    started: false,
    ghost: null,
  };
  window.addEventListener('pointermove', onTilePointerMove);
  window.addEventListener('pointerup', onTilePointerUp);
  window.addEventListener('pointercancel', onTilePointerUp);
}

function onTilePointerMove(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;

  if (!drag.started) {
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
    drag.started = true;
    drag.tile.classList.add('drag-source');

    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    const label = document.createElement('span');
    label.className = 'tile-label';
    label.textContent = drag.tile.querySelector('.tile-label').textContent;
    label.style.fontSize = drag.tile.querySelector('.tile-label').style.fontSize;
    ghost.appendChild(label);
    ghost.style.width = `${drag.width}px`;
    ghost.style.height = `${drag.height}px`;
    document.body.appendChild(ghost);
    drag.ghost = ghost;
  }

  drag.ghost.style.left = `${e.clientX - drag.grabDX}px`;
  drag.ghost.style.top = `${e.clientY - drag.grabDY}px`;

  reorderToPointer(e);
}

// Moves the dragged card to whichever grid slot the pointer is over.
function reorderToPointer(e) {
  const grid = els.arrangeGrid.getBoundingClientRect();
  const cellW = grid.width / 4;
  const cellH = grid.height / 4;
  const col = clamp(Math.floor((e.clientX - grid.left) / cellW), 0, 3);
  const row = clamp(Math.floor((e.clientY - grid.top) / cellH), 0, 3);
  const targetIndex = row * 4 + col;

  const fromIndex = state.order.indexOf(drag.cardIdx);
  if (targetIndex !== fromIndex) {
    const newOrder = state.order.slice();
    newOrder.splice(fromIndex, 1);
    newOrder.splice(targetIndex, 0, drag.cardIdx);
    state.order = newOrder;
    flip(
      [...tileEls.values()].filter((t) => t !== drag.tile),
      () => {
        for (const cardIdx of newOrder) els.arrangeGrid.appendChild(tileEls.get(cardIdx));
      },
      { duration: 220 }
    );
  }
}

function onTilePointerUp(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  if (drag.started && e.type === 'pointerup') reorderToPointer(e);
  const { tile, ghost, started } = drag;
  window.removeEventListener('pointermove', onTilePointerMove);
  window.removeEventListener('pointerup', onTilePointerUp);
  window.removeEventListener('pointercancel', onTilePointerUp);

  if (started && ghost) {
    // Ease the ghost into the tile's final slot, then clean up.
    const rect = tile.getBoundingClientRect();
    ghost.classList.add('dropping');
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    setTimeout(() => {
      ghost.remove();
      tile.classList.remove('drag-source');
    }, 190);
    saveDraft();
  }
  drag = null;
}

// ---------- Validation ----------

function validate() {
  const problems = [];
  const mark = (input) => input.classList.add('invalid');

  if (!state.title.trim()) {
    problems.push('Give your puzzle a title.');
    mark(els.title);
  }

  state.groups.forEach((g, gi) => {
    if (!g.name.trim()) {
      problems.push(`Name the ${GROUP_COLORS[gi].toLowerCase()} group.`);
      mark(inputs.groupNames[gi]);
    }
  });

  const seen = new Map(); // upper-cased word -> first input
  let missing = 0;
  let dupes = false;
  state.groups.forEach((g, gi) => {
    g.words.forEach((w, wi) => {
      const input = inputs.words[gi][wi];
      const word = w.trim();
      if (!word) {
        missing++;
        mark(input);
        return;
      }
      const key = word.toUpperCase();
      if (seen.has(key)) {
        dupes = true;
        mark(input);
        mark(seen.get(key));
      } else {
        seen.set(key, input);
      }
    });
  });
  if (missing) problems.push(`Fill in all 16 cards (${missing} still empty).`);
  if (dupes) problems.push('Every card must be unique — duplicates are highlighted.');

  els.errors.innerHTML = '';
  for (const p of problems) {
    const li = document.createElement('li');
    li.textContent = p;
    els.errors.appendChild(li);
  }
  if (problems.length) {
    document.querySelector('.text-input.invalid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  return problems.length === 0;
}

function buildPayload() {
  return {
    title: state.title.trim(),
    author: state.author.trim(),
    groups: state.groups.map((g) => ({
      name: g.name.trim(),
      words: g.words.map((w) => w.trim()),
    })),
    board: state.order.map((cardIdx) => [Math.floor(cardIdx / 4), cardIdx % 4]),
  };
}

// ---------- Preview & publish ----------

function onPreview() {
  if (!validate()) return;
  const url = `index.html#preview=${encodePayload(buildPayload())}`;
  // Fall back to same-tab navigation if the popup is blocked; the draft
  // autosave means nothing is lost by leaving the page.
  const win = window.open(url, '_blank');
  if (!win) location.href = url;
}

async function onPublish() {
  if (!validate()) return;

  setButtonDisabled(els.publish, true, 'Publishing your puzzle...');
  els.publish.textContent = 'Publishing…';
  try {
    const payload = { id: generateId(), ...buildPayload() };
    const row = await publishPuzzle(payload);
    showSuccess(row.id);
  } catch (err) {
    toast(err.message || 'Publishing failed.');
    setButtonDisabled(els.publish, false);
    els.publish.textContent = 'Publish';
  }
}

function showSuccess(id) {
  const link = new URL(`index.html?p=${id}`, location.href).toString();
  els.publishSection.hidden = true;
  els.successPanel.hidden = false;
  els.successPanel.innerHTML = `
    <h3>Your puzzle is live! 🎉</h3>
    <p>Anyone with this link can play it.</p>
    <div class="share-row">
      <input class="text-input" id="share-link" readonly />
      <button class="btn btn-primary" id="copy-link-btn" type="button">Copy Link</button>
      <a class="btn" id="open-link" target="_blank">Play It</a>
    </div>
    <div class="success-footer">
      <a href="create.html" id="create-another">Create another puzzle →</a>
    </div>`;
  const input = els.successPanel.querySelector('#share-link');
  input.value = link;
  els.successPanel.querySelector('#open-link').href = link;
  els.successPanel.querySelector('#copy-link-btn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copied to clipboard!');
    } catch {
      input.select();
      toast('Press ⌘C to copy the selected link.');
    }
  });
  els.successPanel.querySelector('#create-another').addEventListener('click', () => {
    localStorage.removeItem(DRAFT_KEY);
  });
  els.successPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------- Draft persistence ----------

let saveTimer = null;
let savedAt = null;
let saveFailed = false;

function saveDraft() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeDraft, 250);
}

function writeDraft() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        title: state.title,
        author: state.author,
        groups: state.groups,
        order: state.order,
        savedAt: Date.now(),
      })
    );
    savedAt = Date.now();
    saveFailed = false;
  } catch {
    saveFailed = true;
  }
  updateDraftStatus();
}

function updateDraftStatus() {
  if (saveFailed) {
    els.draftStatus.textContent = 'Draft not saved — browser storage is off.';
    return;
  }
  if (savedAt == null) {
    els.draftStatus.textContent = 'Saved automatically in this browser.';
    return;
  }
  const mins = Math.floor((Date.now() - savedAt) / 60000);
  const rel = mins < 1 ? 'just now' : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
  els.draftStatus.textContent = `Saved ${rel}.`;
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (typeof draft.title === 'string') state.title = draft.title;
    if (typeof draft.author === 'string') state.author = draft.author;
    if (
      Array.isArray(draft.groups) &&
      draft.groups.length === 4 &&
      draft.groups.every((g) => typeof g?.name === 'string' && Array.isArray(g.words) && g.words.length === 4)
    ) {
      state.groups = draft.groups.map((g) => ({
        name: g.name,
        words: g.words.map((w) => String(w ?? '')),
      }));
    }
    if (
      Array.isArray(draft.order) &&
      draft.order.length === 16 &&
      new Set(draft.order).size === 16 &&
      draft.order.every((n) => Number.isInteger(n) && n >= 0 && n < 16)
    ) {
      state.order = draft.order;
    }
  } catch {
    // Corrupt draft — start fresh.
  }
}

init();
})();
