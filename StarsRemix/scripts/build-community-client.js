import { build } from "esbuild";
import { join } from "node:path";

for (const filename of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(join(process.cwd(), filename));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

await build({
  entryPoints: ["src/community/client-entry.js"],
  outfile: "public/community-client.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  sourcemap: false,
  minify: true,
  legalComments: "none",
  define: {
    __NEON_DATA_API_URL__: JSON.stringify(process.env.NEON_DATA_API_URL ?? ""),
    __NEON_AUTH_BASE_URL__: JSON.stringify(
      process.env.NEON_AUTH_BASE_URL ?? process.env.NEON_AUTH_URL ?? "",
    ),
  },
});

console.log("Built the community publishing client.");
