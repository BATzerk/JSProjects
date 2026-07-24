import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { publishHandmadeBoard, readHandmadeBoards } from "./board-library-files.js";
import {
  createCommunityBoard,
  deleteCommunityBoard,
  getCommunityConfiguration,
  listPlayerCommunityBoards,
  listPublishedCommunityBoards,
  requireCommunityUser,
} from "../src/server/community-boards.ts";
import "../src/game/engine.js";
import "../src/game/hints/core.js";
import "../src/game/hints/strategies-basic.js";
import "../src/game/hints/strategies-advanced.js";
import "../src/game/hints/difficulty.js";
import "../src/game/hints/registry.js";

const root = process.cwd();
loadEnvironment();
const port = Number(process.env.PORT ?? 5173);
const host = "127.0.0.1";
const publishAttempts = new Map();

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".ts", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);
    if (url.pathname === "/api/handmade-boards") {
      await handleHandmadeBoards(request, response);
      return;
    }
    if (url.pathname === "/api/community/config") {
      if (request.method !== "GET") throw httpError(405, "Method not allowed.");
      sendJson(response, 200, getCommunityConfiguration());
      return;
    }
    if (url.pathname === "/api/community-boards" || url.pathname === "/api/community-boards/mine") {
      await handleCommunityBoards(request, response, url);
      return;
    }
    if (url.pathname.startsWith("/api/community-boards/")) {
      await handleCommunityBoard(request, response, url);
      return;
    }
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = normalize(join(root, path));

    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const extension = extname(filePath);
    const source = await readFile(filePath);
    const body =
      extension === ".ts"
        ? stripTypeScriptTypes(source.toString("utf8"), { mode: "strip" })
        : source;

    response.writeHead(200, {
      "content-type": mimeTypes.get(extension) ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(body);
  } catch (error) {
    const status = Number(error?.status) || 404;
    response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Not found" }));
  }
});

async function handleCommunityBoards(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/community-boards") {
    sendJson(response, 200, { boards: await listPublishedCommunityBoards() });
    return;
  }

  const user = await requireCommunityUser(request);
  if (request.method === "GET" && url.pathname === "/api/community-boards/mine") {
    sendJson(response, 200, { boards: await listPlayerCommunityBoards(user.id) });
    return;
  }
  if (request.method !== "POST" || url.pathname !== "/api/community-boards") {
    throw httpError(405, "Method not allowed.");
  }

  enforcePublishRateLimit(user.id);
  const body = await readJsonBody(request, 250_000);
  const title = String(body?.puzzle?.title ?? "").trim();
  if (!title || title.length > 80) {
    throw httpError(400, "Board title must be between 1 and 80 characters.");
  }

  const id = randomUUID();
  const puzzle = {
    id: `community-${id}`,
    title,
    size: body?.puzzle?.size,
    starsPerUnit: body?.puzzle?.starsPerUnit,
    houses: body?.puzzle?.houses,
  };
  const engine = globalThis.StarsRemixEngine;
  try {
    engine.validatePuzzleShape(puzzle);
  } catch (error) {
    throw httpError(400, error instanceof Error ? error.message : "Invalid puzzle.");
  }
  if (![9, 10, 11].includes(puzzle.size)) {
    throw httpError(400, "Community boards must be 9×9, 10×10, or 11×11.");
  }

  const solved = engine.solvePuzzle(puzzle, { limit: 2 });
  if (solved.count !== 1) {
    throw httpError(400, "Published boards must have exactly one solution.");
  }
  const solution = solved.solutions[0];
  const report = await globalThis.StarsRemixHints.analyzeDifficulty(puzzle);
  if (!report.solved || report.label === "Incalculable") {
    throw httpError(400, "Published boards must be solvable by the difficulty analyzer.");
  }

  const difficulty = {
    label: report.label,
    score: report.score,
    bigTicketCount: report.bigTicketCount,
    highestTier: report.highestTier,
    logicalSteps: report.steps.length,
  };
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({
      size: puzzle.size,
      starsPerUnit: puzzle.starsPerUnit,
      houses: puzzle.houses,
    }))
    .digest("hex");
  const board = await createCommunityBoard({
    id,
    owner: user,
    puzzle,
    solution,
    difficulty,
    fingerprint,
  });
  sendJson(response, 201, { board });
}

async function handleCommunityBoard(request, response, url) {
  if (request.method !== "DELETE") throw httpError(405, "Method not allowed.");
  const user = await requireCommunityUser(request);
  const id = decodeURIComponent(url.pathname.slice("/api/community-boards/".length));
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw httpError(400, "Invalid board ID.");
  }
  await deleteCommunityBoard(id, user.id);
  sendJson(response, 200, { deleted: true });
}

async function handleHandmadeBoards(request, response) {
  if (request.method === "GET") {
    sendJson(response, 200, { boards: await readHandmadeBoards() });
    return;
  }
  if (request.method !== "POST") throw httpError(405, "Method not allowed.");

  const body = await readJsonBody(request);
  const title = String(body?.puzzle?.title ?? "").trim();
  if (!title || title.length > 80) throw httpError(400, "Board title must be between 1 and 80 characters.");

  const puzzle = {
    id: "handmade-draft",
    title,
    size: body?.puzzle?.size,
    starsPerUnit: body?.puzzle?.starsPerUnit,
    houses: body?.puzzle?.houses,
  };
  const engine = globalThis.StarsRemixEngine;
  try {
    engine.validatePuzzleShape(puzzle);
  } catch (error) {
    throw httpError(400, error instanceof Error ? error.message : "Invalid puzzle.");
  }

  const solved = engine.solvePuzzle(puzzle, { limit: 2 });
  if (solved.count !== 1) throw httpError(400, "Published boards must have exactly one solution.");
  const solution = solved.solutions[0];
  const report = await globalThis.StarsRemixHints.analyzeDifficulty(puzzle);
  if (!report.solved || report.label === "Incalculable") {
    throw httpError(400, "Published boards must be solvable by the difficulty analyzer.");
  }
  const result = await publishHandmadeBoard({
    puzzle,
    solution,
    difficulty: {
      label: report.label,
      score: report.score,
      bigTicketCount: report.bigTicketCount,
      highestTier: report.highestTier,
      logicalSteps: report.steps.length,
    },
  });
  sendJson(response, 201, result);
}

function readJsonBody(request, maximumSize = 1_000_000) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maximumSize) {
        rejectPromise(httpError(413, "Request is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        rejectPromise(httpError(400, "Request must contain valid JSON."));
      }
    });
    request.on("error", rejectPromise);
  });
}

function enforcePublishRateLimit(userId) {
  const now = Date.now();
  const windowStart = now - 60 * 60 * 1000;
  const recent = (publishAttempts.get(userId) ?? []).filter((time) => time > windowStart);
  if (recent.length >= 10) {
    throw httpError(429, "You have published several boards recently. Please try again a little later.");
  }
  recent.push(now);
  publishAttempts.set(userId, recent);
}

function loadEnvironment() {
  for (const filename of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(join(root, filename));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

function sendJson(response, status, value) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

server.listen(port, host, () => {
  console.log(`StarsRemix Codex running at http://${host}:${port}`);
});
