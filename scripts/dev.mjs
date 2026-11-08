import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const root = resolve(projectRoot, args.includes("dist") ? "dist" : ".");
const portIndex = args.indexOf("--port");
const port = Number(portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || 5173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    const path = resolve(root, relative);
    const allowed = relative === "index.html" || relative === "favicon.svg" || relative.startsWith("src/");
    if (!allowed || !path.startsWith(root + sep) || !(await stat(path)).isFile()) {
      res.writeHead(404);
      res.end("Introuvable");
      return;
    }
    const body = await readFile(path);
    res.writeHead(200, {
      "Content-Type": mime[extname(path)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(404);
    res.end("Introuvable");
  }
});

server.on("error", error => {
  console.error(`Impossible de démarrer le serveur : ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, "0.0.0.0", () => {
  console.log(`Local: http://localhost:${port}`);
});
