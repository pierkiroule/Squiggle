import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const path of ["index.html", "favicon.svg", "src"]) {
  await cp(new URL(path, root), new URL(path, dist), { recursive: true });
}
console.log(`Application prête : ${fileURLToPath(dist)}`);
