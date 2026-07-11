(() => {
function shuffleArray(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function generateId(length = 10) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let id = '';
  for (const b of bytes) id += ID_ALPHABET[b % ID_ALPHABET.length];
  return id;
}

function isValidId(id) {
  return typeof id === 'string' && /^[a-z0-9]{4,24}$/i.test(id);
}

// Base64url helpers that survive non-ASCII text.
function encodePayload(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decodePayload(str) {
  const b64 = str.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

// Shrink a card label's font size until it fits its container.
function fitLabel(labelEl, { max = 16, min = 9 } = {}) {
  const parent = labelEl.parentElement;
  if (!parent) return;
  let size = max;
  labelEl.style.fontSize = `${size}px`;
  while (
    size > min &&
    (labelEl.scrollWidth > parent.clientWidth - 8 ||
      labelEl.scrollHeight > parent.clientHeight - 6)
  ) {
    size -= 0.5;
    labelEl.style.fontSize = `${size}px`;
  }
}

function setButtonDisabled(button, disabled, reason = '') {
  button.disabled = disabled;
  if (disabled && reason) {
    button.title = reason;
    button.dataset.disabledReason = reason;
  } else {
    button.removeAttribute('title');
    delete button.dataset.disabledReason;
  }
}

// Validate a puzzle object (from Supabase or a preview link).
// Returns a normalized copy or throws with a readable message.
function normalizePuzzle(data) {
  if (!data || typeof data !== 'object') throw new Error('Puzzle data is missing.');
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const author = typeof data.author === 'string' ? data.author.trim() : '';
  if (!Array.isArray(data.groups) || data.groups.length !== 4) {
    throw new Error('Puzzle must have exactly 4 groups.');
  }
  const seen = new Set();
  const groups = data.groups.map((g, gi) => {
    const name = typeof g?.name === 'string' ? g.name.trim() : '';
    if (!name) throw new Error(`Group ${gi + 1} is missing a name.`);
    if (!Array.isArray(g.words) || g.words.length !== 4) {
      throw new Error(`Group “${name}” must have exactly 4 words.`);
    }
    const words = g.words.map((w) => String(w ?? '').trim());
    for (const w of words) {
      if (!w) throw new Error(`Group “${name}” has an empty card.`);
      const key = w.toUpperCase();
      if (seen.has(key)) throw new Error(`“${w}” appears more than once.`);
      seen.add(key);
    }
    return { name, words };
  });

  // Board: 16 [groupIndex, wordIndex] pairs → flat card ids (g * 4 + w).
  let boardIds = null;
  if (Array.isArray(data.board) && data.board.length === 16) {
    const ids = data.board.map((pair) =>
      Array.isArray(pair) && pair.length === 2 ? pair[0] * 4 + pair[1] : -1
    );
    const valid =
      ids.every((id) => Number.isInteger(id) && id >= 0 && id < 16) &&
      new Set(ids).size === 16;
    if (valid) boardIds = ids;
  }
  if (!boardIds) {
    boardIds = shuffleArray([...Array(16).keys()]);
  }

  return { title: title || 'Untitled Puzzle', author, groups, boardIds };
}

window.ConnectionsUtil = {
  shuffleArray,
  clamp,
  sleep,
  generateId,
  isValidId,
  encodePayload,
  decodePayload,
  fitLabel,
  setButtonDisabled,
  normalizePuzzle,
};
})();
