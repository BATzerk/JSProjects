import { neon } from "@neondatabase/serverless";
import { and, count, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { communityBoards } from "./schema.ts";

const MAX_BOARDS_PER_PLAYER = 25;
let database = null;
let databaseUrl = null;
let jwks = null;
let jwksUrl = null;

function getDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) throw serviceError("Community publishing has not been connected to Neon yet.");
  if (!database || databaseUrl !== url) {
    databaseUrl = url;
    database = drizzle(neon(url), { schema: { communityBoards } });
  }
  return database;
}

function getJwks() {
  const url = process.env.NEON_AUTH_JWKS_URL;
  if (!url) throw serviceError("Google sign-in has not been connected to Neon Auth yet.");
  if (!jwks || jwksUrl !== url) {
    jwksUrl = url;
    jwks = createRemoteJWKSet(new URL(url));
  }
  return jwks;
}

export function getCommunityConfiguration() {
  const authUrl = String(
    process.env.NEON_AUTH_BASE_URL ?? process.env.NEON_AUTH_URL ?? "",
  ).trim();
  return {
    enabled: Boolean(process.env.DATABASE_URL && authUrl && process.env.NEON_AUTH_JWKS_URL),
    authUrl: authUrl || null,
  };
}

export async function requireCommunityUser(request) {
  const authorization = request.headers.authorization ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw httpError(401, "Sign in with Google to continue.");

  try {
    const { payload } = await jwtVerify(match[1], getJwks());
    const id = String(payload.sub ?? "").trim();
    if (!id) throw new Error("Token is missing its user ID.");
    const name = String(payload.name ?? payload.given_name ?? "StarsRemix maker").trim().slice(0, 80);
    return { id, name: name || "StarsRemix maker" };
  } catch (error) {
    if (error?.status) throw error;
    throw httpError(401, "Your sign-in has expired. Please sign in again.");
  }
}

export async function listPublishedCommunityBoards() {
  const rows = await getDatabase()
    .select()
    .from(communityBoards)
    .orderBy(desc(communityBoards.createdAt))
    .limit(100);
  return rows.map(toClientBoard);
}

export async function listPlayerCommunityBoards(ownerId) {
  const rows = await getDatabase()
    .select()
    .from(communityBoards)
    .where(eq(communityBoards.ownerId, ownerId))
    .orderBy(desc(communityBoards.createdAt));
  return rows.map(toClientBoard);
}

export async function createCommunityBoard({ id, owner, puzzle, solution, difficulty, fingerprint }) {
  const db = getDatabase();
  const [{ value: ownedCount }] = await db
    .select({ value: count() })
    .from(communityBoards)
    .where(eq(communityBoards.ownerId, owner.id));
  if (ownedCount >= MAX_BOARDS_PER_PLAYER) {
    throw httpError(409, `Each player may publish up to ${MAX_BOARDS_PER_PLAYER} boards.`);
  }

  try {
    const [created] = await db
      .insert(communityBoards)
      .values({
        id,
        ownerId: owner.id,
        authorName: owner.name,
        title: puzzle.title,
        puzzle,
        solution,
        difficulty,
        fingerprint,
      })
      .returning();
    return toClientBoard(created);
  } catch (error) {
    if (error?.code === "23505") {
      throw httpError(409, "That exact board has already been published.");
    }
    throw error;
  }
}

export async function deleteCommunityBoard(id, ownerId) {
  const deleted = await getDatabase()
    .delete(communityBoards)
    .where(and(eq(communityBoards.id, id), eq(communityBoards.ownerId, ownerId)))
    .returning({ id: communityBoards.id });
  if (!deleted.length) throw httpError(404, "Board not found.");
}

function toClientBoard(row) {
  return {
    id: row.id,
    entry: {
      puzzle: row.puzzle,
      solution: row.solution,
      difficulty: row.difficulty,
      source: "community",
      author: { name: row.authorName },
      publishedAt: row.createdAt.toISOString(),
    },
  };
}

function serviceError(message) {
  return httpError(503, message);
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
