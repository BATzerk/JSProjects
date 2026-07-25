import { createClient } from "@neondatabase/neon-js";

const eventName = "starsremix:community-auth";
const dataApiUrl = __NEON_DATA_API_URL__.replace(/\/+$/, "");
const authUrl = __NEON_AUTH_BASE_URL__.replace(/\/+$/, "");
const configured = /^https:\/\//.test(dataApiUrl) && /^https:\/\//.test(authUrl);
let publicClient = null;
let userClient = null;
let auth = null;
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
    publicClient = createClient({
      auth: { url: authUrl, allowAnonymous: true },
      dataApi: { url: dataApiUrl },
    });
    userClient = createClient({
      auth: { url: authUrl, allowAnonymous: false },
      dataApi: { url: dataApiUrl },
    });
    auth = userClient.auth;
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
  const user = result?.data?.user ?? null;
  setState({
    status: "ready",
    enabled: true,
    user,
    message: user ? "Signed in" : "Sign in when you are ready to publish.",
  });
  return state;
}

async function signInWithGoogle(callbackURL = window.location.href) {
  await ready;
  if (!auth) throw new Error("Google sign-in is not configured yet.");
  const result = await auth.signIn.social({
    provider: "google",
    callbackURL: new URL(callbackURL, window.location.href).href,
    disableRedirect: true,
  });
  if (result?.error) {
    throw new Error(result.error.message || "Google sign-in could not be started.");
  }
  const redirect = result?.data?.url;
  if (!redirect) throw new Error("Google sign-in did not return a redirect.");
  window.location.assign(redirect);
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
  await requireAuthenticatedSession();

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

  const result = await userClient.rpc("starsremix_publish_community_board", {
    candidate_id: id,
    candidate_author_name: authorName,
    candidate_title: title,
    candidate_puzzle: puzzle,
    candidate_solution: solution,
    candidate_difficulty: difficulty,
    candidate_fingerprint: fingerprint,
  });
  const rows = readDataResult(result, "publish");
  const board = toClientBoard(rows?.[0]);
  if (!board) throw new Error("Neon accepted the board but returned an invalid record.");
  return { board };
}

async function listPublicBoards() {
  await ready;
  if (!configured) return { boards: [] };
  const result = await publicClient
    .from("community_boards")
    .select("id,author_name,puzzle,solution,difficulty,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = readDataResult(result, "load");
  return { boards: rows.map(toClientBoard).filter(Boolean) };
}

async function listMyBoards() {
  await ready;
  const user = await requireAuthenticatedSession();
  const result = await userClient
    .from("community_boards")
    .select("id,author_name,puzzle,solution,difficulty,created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(25);
  const rows = readDataResult(result, "load");
  return { boards: rows.map(toClientBoard).filter(Boolean) };
}

async function deleteBoard(id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("Invalid board ID.");
  }
  await requireAuthenticatedSession();
  const result = await userClient.rpc("starsremix_delete_community_board", {
    candidate_id: id,
  });
  readDataResult(result, "delete");
  return { deleted: true };
}

async function requireAuthenticatedSession() {
  if (!auth) throw new Error("Google sign-in is not configured yet.");
  let result;
  try {
    result = await auth.getSession();
  } catch {
    throw new Error("Your Google session could not be verified. Sign out, sign in again, and retry.");
  }
  const user = result?.data?.user ?? null;
  const token = result?.data?.session?.token;
  const claims = readJwtClaims(token);
  if (!user || claims?.role !== "authenticated" || !claims?.sub || claims.sub === "anonymous") {
    throw new Error(
      "Google signed you in, but Neon did not issue authenticated database access. Sign out and retry.",
    );
  }
  return user;
}

function readJwtClaims(token) {
  try {
    if (typeof token !== "string") return null;
    const encoded = token.split(".")[1];
    if (!encoded) return null;
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/")
      .padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function readDataResult(result, action) {
  if (!result?.error) return result?.data ?? [];
  const code = String(result.error.code ?? "");
  const status = Number(result.status ?? 0);
  const serverMessage = result.error.message || result.error.details || result.error.hint || "";
  let message = serverMessage || `Community board request failed${status ? ` (HTTP ${status})` : ""}.`;
  if (code === "23505") {
    message = "That exact board has already been published.";
  } else if (/25 boards/i.test(serverMessage)) {
    message = "Each player may publish up to 25 boards.";
  } else if (code === "42501" || status === 401 || status === 403) {
    const verb = action === "delete"
      ? "delete boards"
      : action === "load"
        ? "load community boards"
        : "publish boards";
    message =
      `Neon rejected your signed-in session's permission to ${verb} ` +
      `(HTTP ${status || 403}${code ? `, ${code}` : ""}).`;
  }
  const error = new Error(message);
  error.code = code || null;
  error.status = status || null;
  error.serverMessage = serverMessage || null;
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
