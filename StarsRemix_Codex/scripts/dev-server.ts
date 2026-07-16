import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { stripTypeScriptTypes } from "node:module";
import { publishHandmadeBoard, readHandmadeBoards } from "./board-library-files.js";
import "../src/game/engine.js";
import "../src/game/hints/core.js";
import "../src/game/hints/strategies-basic.js";
import "../src/game/hints/strategies-advanced.js";
import "../src/game/hints/difficulty.js";
import "../src/game/hints/registry.js";

const root = process.cwd();
const port = Number(process.env.PORT ?? 5173);
const host = "127.0.0.1";

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
      logicalSteps: report.steps.length,
    },
  });
  sendJson(response, 201, result);
}

function readJsonBody(request) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
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
