// Busca secretos en los archivos versionados (o en una carpeta, con --dir). Sin dependencias.
// Uso: node scripts/check-secrets.mjs            → archivos que sigue Git
//      node scripts/check-secrets.mjs --dir RUTA → todos los archivos de RUTA (p. ej. el ZIP descomprimido)
// Sale con código 1 si encuentra algo. Los valores de ejemplo de la documentación están permitidos
// solo si son marcadores evidentes (vacíos, <...>, xxxx, "tu-...").
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const dirArg = process.argv.indexOf("--dir");
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", ".venv", "venv", "__pycache__", "data", "runs", "runs-v2", "logs"]);
const BINARY = /\.(png|jpe?g|webp|avif|gif|ico|onnx|pt|pth|zip|bundle|woff2?|ttf|pdf|xlsx|ipynb)$/i;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (st.size < 2_000_000) out.push(full);
  }
  return out;
}

const base = dirArg > -1 ? process.argv[dirArg + 1] : root;
const files = dirArg > -1
  ? walk(base)
  : execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean).map((f) => join(root, f));

const RULES = [
  ["Clave privada", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["JWT (posible clave de Supabase)", /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
  ["Clave secreta de Supabase", /\bsb_secret_[A-Za-z0-9_-]{16,}/],
  ["Token de GitHub", /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ["Clave de AWS", /\bAKIA[0-9A-Z]{16}\b/],
  ["Clave de API de Google", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["Clave de Stripe/Resend/SendGrid", /\b(?:sk_live_[0-9a-zA-Z]{20,}|re_[A-Za-z0-9]{20,}|SG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/],
  ["URL de base de datos con contraseña", /postgres(?:ql)?:\/\/[^:\s/@'"]+:([^@\s'"]{6,})@[^\s'"]*\b(?:supabase|pooler|render|railway|neon)\b/i],
  ["Variable secreta con valor", /^\s*(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_JWT_SECRET|SMTP_PASS(?:WORD)?)\s*=\s*([^\s#]{8,})/m],
];
const PLACEHOLDER = /^(?:<.*>|x{4,}.*|.*tu-.*|.*\.\.\..*|\$\{.*\}|changeme.*)$/i;

const findings = [];
for (const file of files) {
  const rel = relative(base, file);
  if (BINARY.test(file)) continue;
  if (/(^|\/)\.env(\.|$)/.test(rel) && !rel.endsWith(".env.example")) {
    findings.push([rel, "Archivo .env (no debe versionarse ni empaquetarse)"]);
    continue;
  }
  let text;
  try { text = readFileSync(file, "utf8"); } catch { continue; }
  if (rel.endsWith("check-secrets.mjs")) continue;
  for (const [label, re] of RULES) {
    const m = text.match(re);
    if (!m) continue;
    if (m[1] && PLACEHOLDER.test(m[1])) continue;
    const line = text.slice(0, m.index).split("\n").length;
    findings.push([`${rel}:${line}`, label]);
  }
}

if (findings.length) {
  for (const [where, label] of findings) console.error(`✗ ${where} — ${label}`);
  console.error(`\n${findings.length} posible(s) secreto(s). Revisa y elimina antes de publicar.`);
  process.exit(1);
}
console.log(`OK: sin secretos detectados en ${files.length} archivos.`);
