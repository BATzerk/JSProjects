import { cp, mkdir, rm } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const root = process.cwd();
const output = join(root, "dist");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const name of ["index.html", "editor.html", "public"]) {
  await cp(join(root, name), join(output, name), { recursive: true });
}
await cp(join(root, "src"), join(output, "src"), {
  recursive: true,
  filter(source) {
    const name = basename(source);
    if (name === ".DS_Store" || name === "board-library-data.json") return false;
    if (extname(name) === ".ts") return false;
    if (source.includes(`${join(root, "src", "community")}`)) return false;
    return true;
  },
});

console.log("Built static DreamHost upload in dist/.");
