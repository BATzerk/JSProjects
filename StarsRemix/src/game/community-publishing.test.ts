import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("community publishing contract", () => {
  it("keeps database credentials server-side and uses signed Neon Auth tokens", async () => {
    const client = await readFile(new URL("../community/client-entry.js", import.meta.url), "utf8");
    const server = await readFile(new URL("../../scripts/dev-server.ts", import.meta.url), "utf8");
    const database = await readFile(new URL("../server/community-boards.ts", import.meta.url), "utf8");

    assert.doesNotMatch(client, /DATABASE_URL/);
    assert.match(client, /getJWTToken/);
    assert.match(client, /provider:\s*["']google["']/);
    assert.match(server, /solvePuzzle\(puzzle,\s*\{\s*limit:\s*2\s*\}\)/);
    assert.match(server, /analyzeDifficulty\(puzzle\)/);
    assert.match(database, /jwtVerify/);
    assert.match(database, /eq\(communityBoards\.ownerId,\s*ownerId\)/);
  });

  it("ships a migration with ownership, deduplication, and lookup indexes", async () => {
    const migration = await readFile(
      new URL("../../drizzle/0000_flat_scalphunter.sql", import.meta.url),
      "utf8",
    );

    assert.match(migration, /"owner_id" text NOT NULL/);
    assert.match(migration, /community_boards_fingerprint_unique/);
    assert.match(migration, /community_boards_owner_created_idx/);
  });
});
