// SortlyScan Vision en el navegador (ONNX Runtime Web, WebAssembly, solo CPU).
//
// Replica `backend/app/services/vision.py` (VisionEngine.classify) paso a paso:
//   validación del archivo → decodificación con orientación EXIF → controles de luz y detalle →
//   redimensionado bilineal de Pillow (lado corto a 256) → recorte central 224 → normalización →
//   inferencia → softmax → umbrales elegidos en validación.
// Nada de esto es una simulación: si el modelo no carga, el escáner dice «no disponible» y no adivina.
// La foto se procesa en memoria y nunca sale del navegador.
//
// Los archivos se descargan solo la primera vez que alguien usa el escáner (carga diferida):
//   /vision/ort/*            ONNX Runtime Web (copiado desde node_modules por scripts/prepare-vision.mjs)
//   /vision/models/*.onnx    Vision v1 y su metadato .json (umbral, orden de clases, normalización, SHA-256)

import guidanceJson from "@/data/vision-guidance.json";
import type { VisionCategory, VisionResult } from "@/lib/api/types";
import { BICUBIC, BILINEAR, resample, toGray } from "./pillow";

/** Modelo activo. Vision v2 no se activa hasta aclarar la licencia de RealWaste (ver docs). */
export const ACTIVE_MODEL = "sortlyscan-vision-v1";
const BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/vision`;

// Mismos límites que el backend.
const MIN_BRIGHTNESS = 18.0;
const MIN_DETAIL = 0.5;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface ModelMeta {
  version: string;
  file: string;
  sha256: string;
  categories: VisionCategory[];
  unsupported_categories?: VisionCategory[];
  input: { name: string; size: number; resize: number; mean: number[]; std: number[] };
  thresholds: { min_confidence: number; min_margin: number };
  evaluation: Record<string, number>;
  architecture: string;
  datasets: string[];
}

export interface RawPrediction {
  probabilities: number[];
  categories: VisionCategory[];
  quality: string | null;
  width: number;
  height: number;
}

export class VisionError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

type OrtModule = typeof import("onnxruntime-web");
let loading: Promise<{ ort: OrtModule; session: import("onnxruntime-web").InferenceSession; meta: ModelMeta }> | null = null;

/** Python `round()` usa redondeo bancario (mitades al par); Math.round no. */
const pyRound = (x: number) => {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
};

// 01. sha256
async function sha256(buffer: ArrayBuffer) {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Carga ONNX Runtime y el modelo una sola vez. Verifica el SHA-256 como el backend. */
// 02. loadVision
export function loadVision(onProgress?: (step: "runtime" | "model" | "ready") => void) {
  loading ??= (async () => {
    onProgress?.("runtime");
    // Import dinámico desde /public: el bundle principal no incluye ONNX Runtime.
    const ort: OrtModule = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${BASE}/ort/ort.wasm.min.mjs`);
    ort.env.wasm.wasmPaths = `${BASE}/ort/`;
    ort.env.wasm.numThreads = 1; // sin SharedArrayBuffer: funciona en cualquier hosting estático
    ort.env.wasm.proxy = false;
    const meta: ModelMeta = await (await fetch(`${BASE}/models/${ACTIVE_MODEL}.json`)).json();
    onProgress?.("model");
    const response = await fetch(`${BASE}/models/${meta.file}`);
    if (!response.ok) throw new VisionError("model_missing", "No se encontró el archivo del modelo.");
    const buffer = await response.arrayBuffer();
    if ((await sha256(buffer)) !== meta.sha256) {
      throw new VisionError("model_integrity", "El archivo del modelo no coincide con su huella SHA-256.");
    }
    const session = await ort.InferenceSession.create(new Uint8Array(buffer), { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
    onProgress?.("ready");
    return { ort, session, meta };
  })();
  loading.catch(() => {
    loading = null; // permite reintentar después de un fallo de red
  });
  return loading;
}

export const visionLoaded = () => loading !== null;

// 03. startsWith
async function startsWith(blob: Blob, type: string) {
  const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const eq = (sig: number[], at = 0) => sig.every((b, i) => head[at + i] === b);
  if (type === "image/jpeg") return eq([0xff, 0xd8, 0xff]);
  if (type === "image/png") return eq([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return eq([0x52, 0x49, 0x46, 0x46]) && eq([0x57, 0x45, 0x42, 0x50], 8); // RIFF....WEBP
}

/** Decodifica como el backend: valida tipo, tamaño y firma; aplica la orientación EXIF; RGB sin alfa. */
// 04. decode
export async function decode(blob: Blob): Promise<{ rgb: Uint8Array; width: number; height: number }> {
  if (!ALLOWED.has(blob.type)) throw new VisionError("unsupported_media", "Usa una imagen JPG, PNG o WebP.");
  if (!blob.size) throw new VisionError("empty_file", "La imagen está vacía.");
  if (blob.size > MAX_BYTES) throw new VisionError("file_too_large", "La imagen supera el tamaño máximo de 5 MB.");
  if (!(await startsWith(blob, blob.type))) throw new VisionError("unsupported_media", "El archivo no parece una imagen válida.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: "from-image", colorSpaceConversion: "none", premultiplyAlpha: "none" });
  } catch {
    throw new VisionError("unsupported_media", "No se pudo leer la imagen.");
  }
  const { width, height } = bitmap;
  if (Math.min(width, height) < 64) throw new VisionError("image_too_small", "La imagen es demasiado pequeña. Usa una foto de al menos 64 píxeles.");
  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }
  return { rgb, width, height };
}

/** VisionEngine._quality: brillo medio y detalle sobre una versión gris de 128×128 (bicúbico de Pillow). */
// 05. quality
export function quality(rgb: Uint8Array, width: number, height: number): string | null {
  const gray = resample(toGray(rgb, width * height), width, height, 1, 128, 128, BICUBIC);
  let sum = 0;
  for (const v of gray) sum += v;
  if (sum / gray.length < MIN_BRIGHTNESS) return "too_dark";
  let dy = 0;
  let dx = 0;
  for (let y = 0; y < 127; y++) for (let x = 0; x < 128; x++) dy += Math.abs(gray[(y + 1) * 128 + x] - gray[y * 128 + x]);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 127; x++) dx += Math.abs(gray[y * 128 + x + 1] - gray[y * 128 + x]);
  const detail = (dy / (127 * 128) + dx / (128 * 127)) / 2;
  return detail < MIN_DETAIL ? "low_detail" : null;
}

/** VisionEngine._tensor: lado corto a `resize` (bilineal de Pillow), recorte central `size`, normalización, NCHW. */
// 06. tensor
export function tensor(rgb: Uint8Array, width: number, height: number, input: ModelMeta["input"]): Float32Array {
  const { size, resize, mean, std } = input;
  const scale = resize / Math.min(width, height);
  const w = Math.max(size, pyRound(width * scale));
  const h = Math.max(size, pyRound(height * scale));
  const resized = resample(rgb, width, height, 3, w, h, BILINEAR);
  const left = Math.floor((w - size) / 2);
  const top = Math.floor((h - size) / 2);
  const out = new Float32Array(3 * size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const p = ((y + top) * w + (x + left)) * 3;
      for (let c = 0; c < 3; c++) {
        // Misma aritmética float32 que numpy: (x / 255 - mean) / std.
        const v = Math.fround(Math.fround(resized[p + c] / 255) - Math.fround(mean[c]));
        out[c * size * size + y * size + x] = Math.fround(v / Math.fround(std[c]));
      }
    }
  }
  return out;
}

/** Probabilidades del modelo para una imagen (sin decidir). Útil para comparar con el backend. */
// 07. predict
export async function predict(blob: Blob): Promise<RawPrediction & { meta: ModelMeta }> {
  const { ort, session, meta } = await loadVision();
  const { rgb, width, height } = await decode(blob);
  const issue = quality(rgb, width, height);
  const input = new ort.Tensor("float32", tensor(rgb, width, height, meta.input), [1, 3, meta.input.size, meta.input.size]);
  const output = await session.run({ [session.inputNames[0]]: input });
  const logits = Array.from(output[session.outputNames[0]].data as Float32Array);
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const total = exps.reduce((a, b) => a + b, 0);
  return { probabilities: exps.map((e) => e / total), categories: meta.categories, quality: issue, width, height, meta };
}

const G = guidanceJson as unknown as {
  labels: Record<string, string>;
  retryTips: Record<string, string>;
};

/** Igual que VisionEngine.classify: decide con los umbrales del modelo y arma la misma respuesta. */
// 08. classify
export async function classify(blob: Blob): Promise<VisionResult> {
  const start = performance.now();
  const { probabilities: probs, categories: cats, quality: issue, meta } = await predict(blob);
  const order = probs.map((_, i) => i).sort((a, b) => probs[b] - probs[a]);
  const top = probs[order[0]];
  const second = probs[order[1]];
  let reason: string | null = issue;
  if (reason === null && top < meta.thresholds.min_confidence) reason = "low_confidence";
  else if (reason === null && top - second < meta.thresholds.min_margin) reason = "ambiguous";
  const category = cats[order[0]];
  const round4 = (v: number) => Math.round(v * 10000) / 10000;
  const alternatives = order.slice(0, Math.min(3, order.length)).map((i) => ({ category: cats[i], label: G.labels[cats[i]], confidence: round4(probs[i]) }));
  const result: VisionResult = {
    status: reason === null ? "identified" : "unknown",
    category: reason === null ? category : "unknown",
    label: reason === null ? G.labels[category] : G.labels.unknown,
    confidence: round4(top),
    alternatives: reason === null ? alternatives.slice(1).filter((a) => a.confidence >= 0.05) : alternatives.slice(0, 2),
    reason,
    modelVersion: meta.version,
    processingMs: Math.round((performance.now() - start) * 10) / 10,
    unsupportedCategories: (meta.unsupported_categories ?? []).map((c) => G.labels[c]),
  };
  if (reason !== null) result.retry = G.retryTips[reason];
  return result;
}

/** Estado del modelo para la pantalla del escáner (sin descargarlo). */
// 09. modelInfo
export async function modelInfo(): Promise<ModelMeta> {
  return (await fetch(`${BASE}/models/${ACTIVE_MODEL}.json`)).json();
}
