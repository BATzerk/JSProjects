(() => {
const { isConfigured, publishPuzzle } = window.CollectionsDb;
const { flip } = window.CollectionsFlip;
const { toast } = window.CollectionsToast;
const {
  clamp,
  encodePayload,
  fitLabel,
  generateId,
  setButtonDisabled,
  shuffleArray,
} = window.CollectionsUtil;

const GROUP_COLORS = ['Yellow', 'Green', 'Blue', 'Purple'];
const EXAMPLE_TITLES = [
  'Title Goes Here',
  'Best Puzzle Ever',
  'Okayest Puzzle Ever',
  'Most Puzzle Ever',
  '16 Random Words GLHF',
  "Baby's First Puzzle",
  "Baby's Second Puzzle",
  'Putting Baby in a Corner',
  'Cool puzzle bro',
  'Masterpiece vs Mr. Peace',
  'Tiny Hats, Big Questions',
  'Daggy Babbit and the Forty Felons',
  'Unnecessary Polish',
  'Snack Attack',
];
const EXAMPLE_AUTHORS = [
  'Okay Thatsnotarealname',
  'Romeo McGnomeo',
  'Bucky Thrucket',
  'Appsy Doysie',
  'Raverta Hempstein',
  'Picky Cump',
  'Fances Devista',
  'Hermphry Hermlernd',
  'Rickety Bidness',
  'Amolia Fackjot',
  'Hooboy Atsameatball',
  'Perjinal Reckjoy',
  'Feengermee Timbers',
  'Arabetta Flapjap',
  'Laughlong Arabetic',
  'Oozer Mouthfeel',
  'Any Murphy',
  'Egregious Philbin',
  'Rob Boss',
  'Soyboy',
  'Jennigeg Albacoss',
  'Saltino Cabrero',
  'Car Michael Carmichael',
];

const DRAFT_KEY = 'collections-creator-draft';

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

function uppercaseInput(input) {
  const uppercased = input.value.toUpperCase();
  if (input.value !== uppercased) {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = uppercased;
    if (start != null && end != null) input.setSelectionRange(start, end);
  }
  return uppercased;
}

function setUppercaseValue(input, value) {
  const limit = input.maxLength > 0 ? input.maxLength : Infinity;
  input.value = String(value).trim().toUpperCase().slice(0, limit);
  input.classList.remove('invalid');
  return input.value;
}

function randomExample(examples) {
  return examples[Math.floor(Math.random() * examples.length)];
}

// ---------- Setup ----------

function init() {
  els.title.placeholder = `E.G. ${randomExample(EXAMPLE_TITLES).toUpperCase()}`;
  els.author.placeholder = `E.G. ${randomExample(EXAMPLE_AUTHORS).toUpperCase()}`;

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
    state.title = uppercaseInput(els.title);
    els.title.classList.remove('invalid');
    saveDraft();
  });
  els.author.addEventListener('input', () => {
    state.author = uppercaseInput(els.author);
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

  updateDraftStatus();
  setInterval(updateDraftStatus, 15000);

  window.__collectionsBooted = true;
}

// The editors and tiles live in static HTML; wire them to state.
function bindGroupEditors() {
  document.querySelectorAll('#groups-wrap .group-editor').forEach((section, gi) => {
    const nameInput = section.querySelector('.group-name-input');
    nameInput.value = state.groups[gi].name;
    nameInput.addEventListener('input', () => {
      state.groups[gi].name = uppercaseInput(nameInput);
      nameInput.classList.remove('invalid');
      saveDraft();
    });
    nameInput.addEventListener('paste', (event) => {
      if (pasteWholeGroups(event, gi)) return;
      if (!pasteLinesAcrossFields(event, gi, 0)) pasteWholeGroup(event, gi);
    });
    inputs.groupNames.push(nameInput);

    inputs.words.push([]);
    section.querySelectorAll('.word-row .text-input').forEach((wordInput, wi) => {
      wordInput.value = state.groups[gi].words[wi];
      wordInput.addEventListener('input', () => {
        state.groups[gi].words[wi] = uppercaseInput(wordInput);
        wordInput.classList.remove('invalid');
        updateTile(gi * 4 + wi);
        saveDraft();
      });
      wordInput.addEventListener('paste', (event) => {
        if (!pasteLinesAcrossFields(event, gi, wi + 1)) pasteCards(event, gi, wi);
      });
      inputs.words[gi].push(wordInput);
    });
  });
}

function parseWholeGroup(text) {
  const colonIndex = text.indexOf(':');
  if (colonIndex < 1) return null;

  const groupName = text.slice(0, colonIndex).trim();
  const cards = text.slice(colonIndex + 1).split(',').map((card) => card.trim());
  if (!groupName || cards.length < 2) return null;
  return { groupName, cards };
}

function pasteWholeGroups(event, startGroupIndex) {
  const pasted = event.clipboardData?.getData('text/plain') ?? '';
  const lines = pasted.split(/\r\n?|\n/).filter((line) => line.trim());
  if (lines.length < 2) return false;

  const groups = lines.map(parseWholeGroup);
  if (groups.some((group) => !group)) return false;

  event.preventDefault();
  groups.slice(0, state.groups.length - startGroupIndex).forEach((group, offset) => {
    const groupIndex = startGroupIndex + offset;
    state.groups[groupIndex].name = setUppercaseValue(
      inputs.groupNames[groupIndex],
      group.groupName
    );
    fillCardsFrom(groupIndex, 0, group.cards);
  });
  saveDraft();
  return true;
}

function pasteLinesAcrossFields(event, startGroupIndex, startFieldIndex) {
  const pasted = event.clipboardData?.getData('text/plain') ?? '';
  const lines = pasted.split(/\r\n?|\n/);

  // A trailing newline is common when copying a list and should not erase the
  // field after the last real line.
  while (lines.length > 1 && !lines[lines.length - 1].trim()) {
    lines.pop();
  }
  if (lines.length < 2) return false;

  event.preventDefault();
  let groupIndex = startGroupIndex;
  let fieldIndex = startFieldIndex;

  for (const line of lines) {
    if (groupIndex >= state.groups.length) break;

    if (fieldIndex === 0) {
      state.groups[groupIndex].name = setUppercaseValue(inputs.groupNames[groupIndex], line);
    } else {
      const wordIndex = fieldIndex - 1;
      state.groups[groupIndex].words[wordIndex] = setUppercaseValue(
        inputs.words[groupIndex][wordIndex],
        line
      );
      updateTile(groupIndex * 4 + wordIndex);
    }

    fieldIndex += 1;
    if (fieldIndex > 4) {
      groupIndex += 1;
      fieldIndex = 0;
    }
  }

  saveDraft();
  return true;
}

function pasteWholeGroup(event, groupIndex) {
  const pasted = event.clipboardData?.getData('text/plain') ?? '';
  const group = parseWholeGroup(pasted);
  if (!group) return;

  event.preventDefault();
  state.groups[groupIndex].name = setUppercaseValue(
    inputs.groupNames[groupIndex],
    group.groupName
  );
  fillCardsFrom(groupIndex, 0, group.cards);
  saveDraft();
}

function pasteCards(event, groupIndex, startIndex) {
  const pasted = event.clipboardData?.getData('text/plain') ?? '';
  if (!pasted.includes(',')) return;

  event.preventDefault();
  fillCardsFrom(groupIndex, startIndex, pasted.split(','));
  saveDraft();
}

function fillCardsFrom(groupIndex, startIndex, cards) {
  cards.slice(0, 4 - startIndex).forEach((card, offset) => {
    const wordIndex = startIndex + offset;
    const input = inputs.words[groupIndex][wordIndex];
    state.groups[groupIndex].words[wordIndex] = setUppercaseValue(input, card);
    updateTile(groupIndex * 4 + wordIndex);
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
    els.draftStatus.textContent = 'No draft saved yet.';
    return;
  }
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - savedAt) / 1000));
  let relativeTime = 'just now';
  if (elapsedSeconds >= 86400) {
    const days = Math.floor(elapsedSeconds / 86400);
    relativeTime = `${days} day${days === 1 ? '' : 's'} ago`;
  } else if (elapsedSeconds >= 3600) {
    const hours = Math.floor(elapsedSeconds / 3600);
    relativeTime = `${hours} hour${hours === 1 ? '' : 's'} ago`;
  } else if (elapsedSeconds >= 60) {
    const minutes = Math.floor(elapsedSeconds / 60);
    relativeTime = `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  els.draftStatus.textContent = `Last saved ${relativeTime}.`;
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (Number.isFinite(draft.savedAt)) savedAt = draft.savedAt;
    if (typeof draft.title === 'string') state.title = draft.title.toUpperCase();
    if (typeof draft.author === 'string') state.author = draft.author.toUpperCase();
    if (
      Array.isArray(draft.groups) &&
      draft.groups.length === 4 &&
      draft.groups.every((g) => typeof g?.name === 'string' && Array.isArray(g.words) && g.words.length === 4)
    ) {
      state.groups = draft.groups.map((g) => ({
        name: g.name.toUpperCase(),
        words: g.words.map((w) => String(w ?? '').toUpperCase()),
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
