// Copia ONNX Runtime Web (solo la variante WebAssembly que usa el escáner) a public/vision/ort/.
// Se ejecuta automáticamente antes de `dev` y `build`. Así no se versionan ~15 MB de binarios y la
// versión copiada siempre coincide con la instalada en node_modules.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("onnxruntime-web/ort-wasm-simd-threaded.wasm"));
const out = join(here, "..", "public", "vision", "ort");
mkdirSync(out, { recursive: true });
for (const file of ["ort.wasm.min.mjs", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
  const target = join(out, file);
  const source = join(dist, file);
  if (!existsSync(target) || readFileSync(target).length !== readFileSync(source).length) copyFileSync(source, target);
}
const model = join(here, "..", "public", "vision", "models", "sortlyscan-vision-v1.onnx");
if (!existsSync(model)) {
  console.warn("Aviso: falta public/vision/models/sortlyscan-vision-v1.onnx; el escáner mostrará «no disponible».");
}
console.log("Vision lista: ONNX Runtime Web copiado a public/vision/ort/");
