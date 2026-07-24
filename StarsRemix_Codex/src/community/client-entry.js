import { createAuthClient } from "@neondatabase/auth";

const eventName = "starsremix:community-auth";
let auth = null;
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
        message: "Connect Neon to enable community publishing.",
      });
      return state;
    }

    auth = createAuthClient(configuration.authUrl);
    await refreshSession();
    return state;
  } catch {
    setState({
      status: "ready",
      enabled: false,
      user: null,
      message: "Community publishing is unavailable. JSON download still works.",
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
  const token = await auth.getJWTToken?.();
  if (!token) {
    await refreshSession();
    throw new Error("Sign in with Google to continue.");
  }
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) await refreshSession();
  return readResponse(response);
}

async function readResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Something went wrong. Please try again.");
  return body;
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
