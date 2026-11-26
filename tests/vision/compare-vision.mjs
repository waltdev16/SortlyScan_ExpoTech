// Compara SortlyScan Vision en el navegador con el backend FastAPI sobre los mismos archivos.
// Requiere: las imágenes en /tmp/visioncmp/imgs y las probabilidades del backend en /tmp/visioncmp/backend.json
// (generadas con tests/vision/backend_ref.py, que necesita el backend del proyecto completo, rama development-v2).
// Uso: npm run dev  →  BASE_URL=http://localhost:3000/vision node tests/vision/compare-vision.mjs
import { chromium } from "playwright-core";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const dir = "/tmp/visioncmp/imgs";
const ref = JSON.parse(readFileSync("/tmp/visioncmp/backend.json", "utf8"));
const types = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome" });
const page = await browser.newPage();
await page.goto(process.env.BASE_URL ?? "http://localhost:3000/vision");
await page.waitForFunction(() => window.__sortlyVision);
await page.evaluate(() => window.__sortlyVision.load());
const rows = [];
for (const name of readdirSync(dir).sort()) {
  const type = types[name.split(".").pop().toLowerCase()];
  const b64 = readFileSync(`${dir}/${name}`).toString("base64");
  const r = await page.evaluate(async ([b64, type]) => {
    const blob = new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type });
    const p = await window.__sortlyVision.predict(blob);
    const c = await window.__sortlyVision.classify(blob);
    return { probs: p.probabilities, status: c.status, category: c.category, confidence: c.confidence, reason: c.reason, ms: c.processingMs };
  }, [b64, type]);
  const b = ref[name];
  const maxDiff = Math.max(...r.probs.map((p, i) => Math.abs(p - b.probs[i])));
  rows.push({
    name, maxDiff, sameDecision: r.status === b.status && r.category === b.category && (r.reason ?? null) === (b.reason ?? null),
    browser: { category: r.category, confidence: r.confidence, reason: r.reason }, backend: { category: b.category, confidence: b.confidence, reason: b.reason }, ms: r.ms
  });
}
await browser.close();
const by = (prefix) => rows.filter((r) => r.name.startsWith(prefix));
const summary = (list) => ({
  imagenes: list.length, decision_identica: list.filter((r) => r.sameDecision).length,
  max_diferencia_probabilidad: Math.max(...list.map((r) => r.maxDiff)), mediana_diferencia: list.map((r) => r.maxDiff).sort((a, b) => a - b)[Math.floor(list.length / 2)]
});
const result = {
  fecha: new Date().toISOString(), navegador: "Chrome (Playwright)", nota: "Mismo archivo en el backend FastAPI (VisionEngine, Pillow + ONNX Runtime CPU) y en el navegador (ONNX Runtime Web, WebAssembly).",
  total: summary(rows), trashnet_prueba: summary(by("trashnet_")), realwaste: summary(by("realwaste_")), externas: summary(by("externa_")),
  formatos_exif_calidad: summary(rows.filter((r) => /^(formato|exif|grande|calidad)_/.test(r.name))),
  latencia_ms_mediana: rows.map((r) => r.ms).sort((a, b) => a - b)[Math.floor(rows.length / 2)],
  diferencias: rows.filter((r) => !r.sameDecision), casos_especiales: rows.filter((r) => /^(formato|exif|grande|calidad)_/.test(r.name))
};
writeFileSync(process.env.OUT ?? "/tmp/visioncmp/result.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, diferencias: result.diferencias.length, casos_especiales: undefined }, null, 1));
for (const r of result.diferencias) console.log("DIFERENCIA", JSON.stringify(r));
for (const r of result.casos_especiales) console.log("ESPECIAL", r.name, JSON.stringify(r.browser), JSON.stringify(r.backend), r.maxDiff.toExponential(2));
