(() => {
const { NEON_DATA_API_URL, NEON_AUTH_URL } = window.CollectionsConfig;
const apiUrl = String(NEON_DATA_API_URL || '').replace(/\/+$/, '');
const authUrl = String(NEON_AUTH_URL || '').replace(/\/+$/, '');
let anonymousToken = '';
let tokenExpiresAt = 0;
let tokenRequest = null;

function isConfigured() {
  return /^https:\/\//.test(apiUrl) && /^https:\/\//.test(authUrl);
}

async function readError(res, fallback) {
  try {
    const body = await res.json();
    return body.message || body.hint || body.details || body.error || fallback;
  } catch {
    return fallback;
  }
}

async function getAnonymousToken() {
  const now = Math.floor(Date.now() / 1000);
  if (anonymousToken && tokenExpiresAt > now + 30) return anonymousToken;
  if (tokenRequest) return tokenRequest;

  tokenRequest = (async () => {
    const res = await fetch(`${authUrl}/token/anonymous`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(await readError(res, `Could not authorize database access (HTTP ${res.status}).`));
    }
    const body = await res.json();
    if (!body.token) throw new Error('Neon did not return an anonymous access token.');
    anonymousToken = body.token;
    tokenExpiresAt = Number(body.expires_at) || now + 300;
    return anonymousToken;
  })();

  try {
    return await tokenRequest;
  } finally {
    tokenRequest = null;
  }
}

async function apiFetch(url, options = {}) {
  const request = async () => fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${await getAnonymousToken()}`,
    },
  });

  let res = await request();
  if (res.status === 401) {
    anonymousToken = '';
    tokenExpiresAt = 0;
    res = await request();
  }
  return res;
}

// Returns the puzzle row, or null if no puzzle has that id.
async function fetchPuzzle(id) {
  const url = `${apiUrl}/puzzles?id=eq.${encodeURIComponent(id)}&select=id,title,author,groups,board&limit=1`;
  const res = await apiFetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(await readError(res, `Could not reach the puzzle database (HTTP ${res.status}).`));
  }
  const rows = await res.json();
  return rows[0] ?? null;
}

async function fetchPuzzleList() {
  const url = `${apiUrl}/puzzles?select=id,title,author,created_at&order=created_at.desc&limit=100`;
  const res = await apiFetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(await readError(res, `Could not load the puzzle list (HTTP ${res.status}).`));
  }
  return res.json();
}

// Inserts a puzzle row; returns the stored row.
async function publishPuzzle(puzzle) {
  const res = await apiFetch(`${apiUrl}/puzzles`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(puzzle),
  });
  if (!res.ok) {
    throw new Error(await readError(res, `Publishing failed (HTTP ${res.status}).`));
  }
  const rows = await res.json();
  return rows[0];
}

window.CollectionsDb = {
  isConfigured,
  fetchPuzzle,
  fetchPuzzleList,
  publishPuzzle,
};
})();
