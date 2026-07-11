(() => {
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.ConnectionsConfig;

function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function headers() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function readError(res, fallback) {
  try {
    const body = await res.json();
    return body.message || body.hint || fallback;
  } catch {
    return fallback;
  }
}

// Returns the puzzle row, or null if no puzzle has that id.
async function fetchPuzzle(id) {
  const url = `${SUPABASE_URL}/rest/v1/puzzles?id=eq.${encodeURIComponent(id)}&select=id,title,author,groups,board&limit=1`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(await readError(res, `Could not reach the puzzle database (HTTP ${res.status}).`));
  }
  const rows = await res.json();
  return rows[0] ?? null;
}

async function fetchPuzzleList() {
  const url = `${SUPABASE_URL}/rest/v1/puzzles?select=id,title,author,created_at&order=created_at.desc&limit=100`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(await readError(res, `Could not load the puzzle list (HTTP ${res.status}).`));
  }
  return res.json();
}

// Inserts a puzzle row; returns the stored row.
async function publishPuzzle(puzzle) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/puzzles`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'return=representation' },
    body: JSON.stringify(puzzle),
  });
  if (!res.ok) {
    throw new Error(await readError(res, `Publishing failed (HTTP ${res.status}).`));
  }
  const rows = await res.json();
  return rows[0];
}

window.ConnectionsDb = {
  isConfigured,
  fetchPuzzle,
  fetchPuzzleList,
  publishPuzzle,
};
})();
