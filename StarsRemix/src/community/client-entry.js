import { createInternalNeonAuth } from "@neondatabase/auth";

const eventName = "starsremix:community-auth";
const dataApiUrl = __NEON_DATA_API_URL__.replace(/\/+$/, "");
const authUrl = __NEON_AUTH_BASE_URL__.replace(/\/+$/, "");
const configured = /^https:\/\//.test(dataApiUrl) && /^https:\/\//.test(authUrl);
let auth = null;
let getJWTToken = null;
let state = {
  status: "loading",
  enabled: false,
  user: null,
  message: "Checking publishing setup…",
};

const ready = initialize();

async function initialize() {
  if (!configured) {
    setState({
      status: "ready",
      enabled: false,
      user: null,
      message: "Community publishing has not been set up for this site.",
    });
    return state;
  }

  try {
    const neonAuth = createInternalNeonAuth(authUrl, { allowAnonymous: true });
    auth = neonAuth.adapter;
    getJWTToken = neonAuth.getJWTToken;
    await refreshSession();
    return state;
  } catch {
    setState({
      status: "ready",
      enabled: false,
      user: null,
      message: "Community publishing could not be reached.",
    });
    return state;
  }
}

async function refreshSession() {
  if (!auth) return state;
  const result = await auth.getSession();
  setState({
    status: "ready",
    enabled: true,
    user: result?.data?.user ?? null,
    message: result?.data?.user ? "Signed in" : "Sign in when you are ready to publish.",
  });
  return state;
}

async function signInWithGoogle(callbackURL = window.location.href) {
  await ready;
  if (!auth) throw new Error("Google sign-in is not configured yet.");
  return auth.signIn.social({
    provider: "google",
    callbackURL: new URL(callbackURL, window.location.href).href,
  });
}

async function signOut() {
  await ready;
  if (!auth) return;
  await auth.signOut();
  await refreshSession();
}

async function publishBoard(entry) {
  await ready;
  if (!state.user) throw new Error("Sign in with Google to publish a board.");

  const title = String(entry?.puzzle?.title ?? "").trim();
  if (!title || title.length > 80) {
    throw new Error("Board title must be between 1 and 80 characters.");
  }

  const candidate = { ...entry.puzzle, title };
  const engine = globalThis.StarsRemixEngine;
  engine.validatePuzzleShape(candidate);
  if (![9, 10, 11].includes(candidate.size) || candidate.starsPerUnit !== 2) {
    throw new Error("Community boards must be 9×9, 10×10, or 11×11 two-star boards.");
  }

  const solved = engine.solvePuzzle(candidate, { limit: 2 });
  if (solved.count !== 1) {
    throw new Error("Published boards must have exactly one solution.");
  }
  const report = await globalThis.StarsRemixHints.analyzeDifficulty(candidate);
  if (!report.solved || report.label === "Incalculable") {
    throw new Error("Published boards must be solvable by the difficulty analyzer.");
  }

  const id = crypto.randomUUID();
  const puzzle = { ...candidate, id: `community-${id}` };
  const solution = solved.solutions[0];
  const difficulty = {
    label: report.label,
    score: report.score,
    bigTicketCount: report.bigTicketCount,
    highestTier: report.highestTier,
    logicalSteps: report.steps.length,
  };
  const fingerprint = await puzzleFingerprint(puzzle);
  const authorName = String(state.user.name ?? "StarsRemix maker").trim().slice(0, 80)
    || "StarsRemix maker";

  const rows = await dataRequest("/community_boards", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: JSON.stringify({
      id,
      author_name: authorName,
      title,
      puzzle,
      solution,
      difficulty,
      fingerprint,
    }),
  }, { requireUser: true });
  const board = toClientBoard(rows?.[0]);
  if (!board) throw new Error("Neon accepted the board but returned an invalid record.");
  return { board };
}

async function listPublicBoards() {
  await ready;
  if (!configured) return { boards: [] };
  const query =
    "?select=id,author_name,puzzle,solution,difficulty,created_at" +
    "&order=created_at.desc&limit=100";
  const rows = await dataRequest(`/community_boards${query}`);
  return { boards: rows.map(toClientBoard).filter(Boolean) };
}

async function listMyBoards() {
  await ready;
  if (!state.user?.id) throw new Error("Sign in with Google to view your boards.");
  const owner = encodeURIComponent(state.user.id);
  const query =
    `?owner_id=eq.${owner}` +
    "&select=id,author_name,puzzle,solution,difficulty,created_at" +
    "&order=created_at.desc&limit=25";
  const rows = await dataRequest(`/community_boards${query}`, {}, { requireUser: true });
  return { boards: rows.map(toClientBoard).filter(Boolean) };
}

async function deleteBoard(id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("Invalid board ID.");
  }
  const boardId = encodeURIComponent(id);
  await dataRequest(`/community_boards?id=eq.${boardId}`, {
    method: "DELETE",
    headers: { prefer: "return=minimal" },
  }, { requireUser: true });
  return { deleted: true };
}

async function dataRequest(path, options = {}, { requireUser = false } = {}) {
  await ready;
  if (!configured || !getJWTToken) {
    throw new Error("Community publishing has not been set up for this site.");
  }
  if (requireUser && !state.user) {
    throw new Error("Sign in with Google to continue.");
  }

  let token;
  try {
    token = await getJWTToken();
  } catch {
    throw new Error("Your Neon session could not be verified. Sign out, sign in again, and retry.");
  }
  if (!token) {
    await refreshSession();
    throw new Error("Neon could not authorize this request. Sign out, sign in again, and retry.");
  }

  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  headers.set("authorization", `Bearer ${token}`);
  let response;
  try {
    response = await fetch(`${dataApiUrl}${path}`, { ...options, headers });
  } catch {
    throw new Error("The community board database could not be reached. Check your connection and retry.");
  }
  if (response.status === 401) await refreshSession();
  return readResponse(response);
}

async function readResponse(response) {
  const body = await response.json().catch(() => null);
  if (response.ok) return body ?? [];

  const code = String(body?.code ?? "");
  let message = body?.message || body?.details || body?.hint || `Publishing failed (HTTP ${response.status}).`;
  if (code === "23505") message = "That exact board has already been published.";
  else if (code === "42501" || response.status === 401 || response.status === 403) {
    message = "Your account is not allowed to make that change.";
  } else if (/25 boards/i.test(message)) {
    message = "Each player may publish up to 25 boards.";
  }
  const error = new Error(message);
  error.code = code || null;
  error.status = response.status;
  throw error;
}

function toClientBoard(row) {
  try {
    if (!row || typeof row !== "object") return null;
    const puzzle = row.puzzle;
    globalThis.StarsRemixEngine.validatePuzzleShape(puzzle);
    if (!/^community-[0-9a-f-]{36}$/i.test(puzzle.id) || ![9, 10, 11].includes(puzzle.size)) return null;
    if (!Array.isArray(row.solution) || row.solution.length !== puzzle.size * puzzle.starsPerUnit) return null;
    if (row.solution.some(({ row: boardRow, col }) =>
      !Number.isInteger(boardRow) || !Number.isInteger(col) ||
      boardRow < 0 || col < 0 || boardRow >= puzzle.size || col >= puzzle.size)) return null;
    if (!row.difficulty || typeof row.difficulty !== "object") return null;
    const label = String(row.difficulty.label ?? "");
    if (!["Easy", "Moderate", "Hard", "Very Hard", "Expert"].includes(label)) return null;
    return {
      id: row.id,
      entry: {
        puzzle,
        solution: row.solution,
        difficulty: row.difficulty,
        source: "community",
        author: { name: String(row.author_name ?? "StarsRemix maker").slice(0, 80) },
        publishedAt: row.created_at,
      },
    };
  } catch {
    return null;
  }
}

async function puzzleFingerprint(puzzle) {
  const canonical = JSON.stringify({
    size: puzzle.size,
    starsPerUnit: puzzle.starsPerUnit,
    houses: puzzle.houses,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function setState(nextState) {
  state = Object.freeze({ ...nextState });
  window.dispatchEvent(new CustomEvent(eventName, { detail: state }));
}

globalThis.StarsRemixCommunity = Object.freeze({
  ready,
  getState: () => state,
  refreshSession,
  signInWithGoogle,
  signOut,
  publishBoard,
  listPublicBoards,
  listMyBoards,
  deleteBoard,
});
