import { createInternalNeonAuth } from "@neondatabase/auth";

const eventName = "starsremix:community-auth";
let auth = null;
let getJWTToken = null;
let configuration = { enabled: false, authUrl: null };
let state = {
  status: "loading",
  enabled: false,
  user: null,
  message: "Checking publishing setup…",
};

const ready = initialize();

async function initialize() {
  try {
    const response = await fetch("./api/community/config", { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("Publishing configuration is unavailable.");
    configuration = await response.json();
    if (!configuration.enabled || !configuration.authUrl) {
      setState({
        status: "ready",
        enabled: false,
        user: null,
        message: "Community publishing has not been set up for this site.",
      });
      return state;
    }

    const neonAuth = createInternalNeonAuth(configuration.authUrl);
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
  return authenticatedRequest("./api/community-boards", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ puzzle: entry.puzzle }),
  });
}

async function listPublicBoards() {
  await ready;
  if (!configuration.enabled) return { boards: [] };
  const response = await fetch("./api/community-boards", { headers: { accept: "application/json" } });
  return readResponse(response);
}

async function listMyBoards() {
  return authenticatedRequest("./api/community-boards/mine");
}

async function deleteBoard(id) {
  return authenticatedRequest(`./api/community-boards/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

async function authenticatedRequest(url, options = {}) {
  await ready;
  if (!auth) throw new Error("Google sign-in is not configured yet.");
  let token;
  try {
    token = await getJWTToken?.();
  } catch (error) {
    const status = Number(error?.status);
    if (status === 404) {
      throw new Error(
        "Neon Auth could not issue a publishing token. Sign out, sign in again, and retry. " +
        "If it continues, refresh the Neon environment settings and restart Board Workshop.",
      );
    }
    throw new Error(
      "Your Google sign-in could not be verified. Check your connection, then sign out and sign in again.",
    );
  }
  if (!token) {
    await refreshSession();
    throw new Error("Your sign-in session is missing a publishing token. Sign out, sign in again, and retry.");
  }
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  headers.set("authorization", `Bearer ${token}`);
  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new Error(
      "Board Workshop could not reach its publishing server. Make sure the local server is running, then retry.",
    );
  }
  if (response.status === 401) await refreshSession();
  return readResponse(response);
}

async function readResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body.error || fallbackResponseMessage(response.status);
    const action = body.action ? ` ${body.action}` : "";
    const reference = body.requestId ? ` Reference: ${body.requestId}.` : "";
    const error = new Error(`${message}${action}${reference}`);
    error.code = body.code ?? null;
    error.status = response.status;
    throw error;
  }
  return body;
}

function fallbackResponseMessage(status) {
  if (status === 400) return "The publishing server rejected this board. Complete it again and retry.";
  if (status === 401 || status === 403) return "Your publishing session is no longer authorized.";
  if (status === 404) return "The publishing endpoint was not found. Restart Board Workshop and retry.";
  if (status === 409) return "This board conflicts with one already in the community library.";
  if (status === 429) return "You have published too many boards recently.";
  if (status >= 500) return "The publishing service encountered a server error.";
  return `Publishing failed (HTTP ${status}).`;
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
