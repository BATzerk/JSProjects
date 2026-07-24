import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("community publishing contract", () => {
  it("uses signed Neon Auth tokens directly with the Data API", async () => {
    const client = await readFile(new URL("../community/client-entry.js", import.meta.url), "utf8");
    const server = await readFile(new URL("../../scripts/dev-server.ts", import.meta.url), "utf8");

    assert.doesNotMatch(client, /DATABASE_URL/);
    assert.match(client, /createInternalNeonAuth/);
    assert.match(client, /allowAnonymous:\s*true/);
    assert.match(client, /neonAuth\.getJWTToken/);
    assert.match(client, /await getJWTToken\(\)/);
    assert.match(client, /provider:\s*["']google["']/);
    assert.match(client, /Community publishing has not been set up for this site/);
    assert.doesNotMatch(client, /Connect Neon/);
    assert.match(client, /solvePuzzle\(candidate,\s*\{\s*limit:\s*2\s*\}\)/);
    assert.match(client, /analyzeDifficulty\(candidate\)/);
    assert.match(client, /\/community_boards/);
    assert.match(client, /crypto\.subtle\.digest\(["']SHA-256/);
    assert.match(client, /Sign out, sign in again, and retry/);
    assert.doesNotMatch(server, /\/api\/community/);
  });

  it("ships Data API RLS, ownership, validation, limits, and deduplication", async () => {
    const initialMigration = await readFile(
      new URL("../../drizzle/0000_flat_scalphunter.sql", import.meta.url), "utf8");
    const dataApiMigration = await readFile(
      new URL("../../drizzle/0001_static_data_api.sql", import.meta.url), "utf8");

    assert.match(initialMigration, /"owner_id" text NOT NULL/);
    assert.match(initialMigration, /community_boards_fingerprint_unique/);
    assert.match(initialMigration, /community_boards_owner_created_idx/);
    assert.match(dataApiMigration, /ENABLE ROW LEVEL SECURITY/);
    assert.match(dataApiMigration, /TO anonymous, authenticated\s+USING \(true\)/);
    assert.match(dataApiMigration, /TO authenticated\s+WITH CHECK \(owner_id = auth\.user_id\(\)\)/);
    assert.match(dataApiMigration, /FOR DELETE[\s\S]+owner_id = auth\.user_id\(\)/);
    assert.match(dataApiMigration, /REVOKE ALL ON TABLE community_boards FROM PUBLIC/);
    assert.match(dataApiMigration, /GRANT INSERT \(id, author_name, title, puzzle, solution, difficulty, fingerprint\)/);
    assert.match(dataApiMigration, /Each player may publish up to 25 boards/);
    assert.match(dataApiMigration, /starsremix_valid_solution/);
    assert.match(dataApiMigration, /digest\(convert_to\(canonical_layout/);
  });

  it("shows actionable publishing status and keeps the editor's full technique report", async () => {
    const editor = await readFile(new URL("../editor/editor.js", import.meta.url), "utf8");
    const worker = await readFile(new URL("../editor/editor-worker.js", import.meta.url), "utf8");

    assert.match(editor, /Publishing unavailable/);
    assert.match(editor, /communityState\.message/);
    assert.match(editor, /Debug tools/);
    assert.match(editor, /Download board JSON/);
    assert.match(editor, /if \(!communityState\.user\) return ""/);
    assert.match(editor, /difficulty\.techniqueCounts/);
    assert.match(editor, /Every logical move/);
    assert.doesNotMatch(editor, /Attempts <strong>/);
    assert.match(worker, /difficulty:\s*\{\s*\.\.\.report/);
  });

  it("refreshes the public board snapshot whenever the library is opened", async () => {
    const view = await readFile(new URL("../app/app-view.js", import.meta.url), "utf8");
    const persistence = await readFile(new URL("../app/persistence.js", import.meta.url), "utf8");

    assert.match(view, /boardLibraryOpen = true;\s*render\(\);\s*loadCommunityBoards\(\);/);
    assert.match(
      persistence,
      /boardLibrary\.boards\.splice\(0,\s*boardLibrary\.boards\.length,\s*\.\.\.builtInBoards,\s*\.\.\.communityBoards\)/,
    );
    assert.match(persistence, /requestId !== communityBoardsRequestId/);
  });
});
