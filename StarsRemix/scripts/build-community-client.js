import { build } from "esbuild";

await build({
  entryPoints: ["src/community/client-entry.js"],
  outfile: "src/community/community-client.js",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  sourcemap: false,
  minify: true,
  legalComments: "none",
});

console.log("Built the community publishing client.");
