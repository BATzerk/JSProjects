import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("community publishing contract", () => {
  it("uses separate public and authenticated Neon clients", async () => {
    const client = await readFile(new URL("../community/client-entry.js", import.meta.url), "utf8");
    const server = await readFile(new URL("../../scripts/dev-server.ts", import.meta.url), "utf8");

    assert.doesNotMatch(client, /DATABASE_URL/);
    assert.match(client, /createClient/);
    assert.match(client, /publicClient = createClient/);
    assert.match(client, /userClient = createClient/);
    assert.match(client, /allowAnonymous:\s*true/);
    assert.match(client, /allowAnonymous:\s*false/);
    assert.match(client, /claims\?\.role !== ["']authenticated["']/);
    assert.doesNotMatch(client, /createInternalNeonAuth|authorization.*Bearer|getJWTToken/);
    assert.match(client, /provider:\s*["']google["']/);
    assert.match(client, /disableRedirect:\s*true/);
    assert.match(client, /Community publishing has not been set up for this site/);
    assert.doesNotMatch(client, /Connect Neon/);
    assert.match(client, /solvePuzzle\(candidate,\s*\{\s*limit:\s*2\s*\}\)/);
    assert.match(client, /analyzeDifficulty\(candidate\)/);
    assert.match(client, /\.from\(["']community_boards["']\)/);
    assert.match(client, /\.rpc\(["']starsremix_publish_community_board["']/);
    assert.match(client, /\.rpc\(["']starsremix_delete_community_board["']/);
    assert.match(client, /crypto\.subtle\.digest\(["']SHA-256/);
    assert.match(client, /Neon did not issue authenticated database access/);
    assert.match(client, /result\.error\.message/);
    assert.doesNotMatch(server, /\/api\/community/);
  });

  it("ships Data API RLS, ownership, validation, limits, and deduplication", async () => {
    const initialMigration = await readFile(
      new URL("../../drizzle/0000_flat_scalphunter.sql", import.meta.url), "utf8");
    const dataApiMigration = await readFile(
      new URL("../../drizzle/0001_static_data_api.sql", import.meta.url), "utf8");
    const insertGrantMigration = await readFile(
      new URL("../../drizzle/0002_fix_data_api_insert_grant.sql", import.meta.url), "utf8");
    const writeRpcMigration = await readFile(
      new URL("../../drizzle/0003_community_write_rpc.sql", import.meta.url), "utf8");

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
    assert.match(insertGrantMigration, /GRANT INSERT ON TABLE community_boards TO authenticated/);
    assert.match(insertGrantMigration, /NEW\.created_at := now\(\)/);
    assert.match(writeRpcMigration, /SECURITY DEFINER/);
    assert.match(writeRpcMigration, /starsremix_publish_community_board/);
    assert.match(writeRpcMigration, /starsremix_delete_community_board/);
    assert.match(writeRpcMigration, /GRANT EXECUTE[\s\S]+TO authenticated/);
    assert.match(writeRpcMigration, /REVOKE INSERT, DELETE ON TABLE community_boards FROM authenticated/);
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
    assert.doesNotMatch(editor, /keep-editing|Keep editing|Edit this completion/);
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
    assert.match(
      persistence,
      /selectedLibrarySource === "community"[\s\S]+selectedLibraryDifficulty = libraryDifficulties\.find/,
    );
  });
});
