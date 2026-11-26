// Exportación estática (GitHub Pages u otro hosting de archivos sin servidor).
// Uso: npm run build:static            → carpeta frontend/out/ para publicar en la raíz de un dominio
//      BASE_PATH=/repositorio npm run build:static → para https://usuario.github.io/repositorio
// Agrega .nojekyll (GitHub Pages ignora carpetas que empiezan con "_", como _next, sin este archivo).
import { spawnSync } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "build"], {
  cwd: root, stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, STATIC_EXPORT: "1" },
});
if (result.status !== 0) process.exit(result.status ?? 1);
const out = join(root, "out");
if (!existsSync(out)) {
  console.error("No se generó la carpeta out/.");
  process.exit(1);
}
writeFileSync(join(out, ".nojekyll"), "");
console.log(`Exportación estática lista en ${out}${process.env.BASE_PATH ? ` (subcarpeta ${process.env.BASE_PATH})` : ""}.`);
