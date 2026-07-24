import { neon } from "@neondatabase/serverless";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

loadEnvironment();
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env.local and connect your Neon branch.");
}

const sql = neon(process.env.DATABASE_URL);
await sql.query(`
  CREATE TABLE IF NOT EXISTS starsremix_migrations (
    filename text PRIMARY KEY,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
  )
`);

const appliedRows = await sql.query("SELECT filename FROM starsremix_migrations");
const applied = new Set(appliedRows.map(({ filename }) => filename));
const directory = join(process.cwd(), "drizzle");
const filenames = (await readdir(directory))
  .filter((filename) => filename.endsWith(".sql"))
  .sort();

for (const filename of filenames) {
  if (applied.has(filename)) continue;
  const source = await readFile(join(directory, filename), "utf8");
  const statements = source
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  await sql.transaction((transaction) => [
    ...statements.map((statement) => transaction.query(statement)),
    transaction.query(
      "INSERT INTO starsremix_migrations (filename) VALUES ($1)",
      [filename],
    ),
  ]);
  console.log(`Applied ${filename}.`);
}

console.log("Neon database is up to date.");

function loadEnvironment() {
  for (const filename of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(join(process.cwd(), filename));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}
