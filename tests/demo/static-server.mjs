// Servidor de archivos que imita GitHub Pages para probar la exportación estática:
// sirve archivos, carpeta/index.html, redirige carpetas sin «/» final y responde 404.html (estado 404).
// Uso: node tests/demo/static-server.mjs [carpeta=frontend/out] [puerto=4173] [subcarpeta=""]
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const [root = "frontend/out", port = "4173", base = ""] = process.argv.slice(2);
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".onnx": "application/octet-stream", ".webp": "image/webp", ".png": "image/png",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon", ".jpg": "image/jpeg"
};
createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (base && !path.startsWith(base)) { res.writeHead(404); return res.end(); }
  path = path.slice(base.length) || "/";
  const file = normalize(join(root, path));
  if (!file.startsWith(normalize(root))) { res.writeHead(403); return res.end(); }
  const send = (f, status = 200) => { res.writeHead(status, { "Content-Type": types[extname(f)] ?? "application/octet-stream" }); res.end(readFileSync(f)); };
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!path.endsWith("/")) { res.writeHead(301, { Location: `${base}${path}/` }); return res.end(); }
    if (existsSync(join(file, "index.html"))) return send(join(file, "index.html"));
  } else if (existsSync(file)) return send(file);
  else if (existsSync(`${file}.html`)) return send(`${file}.html`);
  return send(join(root, "404.html"), 404);
}).listen(Number(port), () => console.log(`Exportación estática en http://localhost:${port}${base}/`));
