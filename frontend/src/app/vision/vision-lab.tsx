"use client";
import { useEffect, useState } from "react";
import { classify, loadVision, modelInfo, predict, type ModelMeta } from "@/lib/vision/engine";

const LABELS: Record<string, string> = { plastic: "Plástico", paper: "Papel", cardboard: "Cartón", metal: "Metal", glass: "Vidrio", other: "Otros", organic: "Orgánico" };

declare global {
  interface Window {
    /** Gancho para las pruebas automatizadas (comparación con el backend). No altera nada. */
    __sortlyVision?: { predict: typeof predict; classify: typeof classify; load: typeof loadVision };
  }
}

/** Ficha del modelo y prueba con varias imágenes: muestra las probabilidades reales de cada categoría. */
export function VisionLab() {
  const [meta, setMeta] = useState<ModelMeta | null>(null);
  const [rows, setRows] = useState<{ name: string; label: string; confidence: number; probs: number[]; reason: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    modelInfo().then(setMeta).catch(() => setError("No se pudo leer la ficha del modelo."));
    window.__sortlyVision = { predict, classify, load: loadVision };
  }, []);

  async function run(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const next: typeof rows = [];
    try {
      for (const file of Array.from(files).slice(0, 20)) {
        const [p, r] = await Promise.all([predict(file), classify(file)]);
        next.push({ name: file.name, label: r.label ?? "", confidence: r.confidence ?? 0, probs: p.probabilities, reason: r.reason ?? null });
      }
      setRows(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo analizar la imagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vision-lab">
      {meta && (
        <dl className="vision-card">
          <div><dt>Modelo</dt><dd>{meta.version} · {meta.architecture}</dd></div>
          <div><dt>Categorías</dt><dd>{meta.categories.map((c) => LABELS[c]).join(", ")}</dd></div>
          <div><dt>No reconoce</dt><dd>{(meta.unsupported_categories ?? []).map((c) => LABELS[c]).join(", ") || "—"}</dd></div>
          <div><dt>Exactitud en prueba</dt><dd>{Math.round(meta.evaluation.accuracy * 1000) / 10} % ({meta.evaluation.test_images} fotos de TrashNet)</dd></div>
          <div><dt>Umbral</dt><dd>Confianza mínima {meta.thresholds.min_confidence}; por debajo responde «No identificado»</dd></div>
          <div><dt>Huella SHA-256</dt><dd className="mono">{meta.sha256.slice(0, 16)}…</dd></div>
        </dl>
      )}
      <label className="ui-field">
        <span className="ui-field-label">Prueba con una o varias fotos (máximo 20)</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => run(e.target.files)} disabled={busy} />
        <span className="ui-field-hint">Las fotos se analizan en este navegador y no se envían a ningún servidor.</span>
      </label>
      {busy && <p role="status">Cargando el modelo y analizando…</p>}
      {error && <p role="alert" className="ui-field-error">{error}</p>}
      {rows.length > 0 && meta && (
        <div className="ui-table-wrap">
          <table className="ui-table">
            <caption>Probabilidad por categoría (modelo real, sin simulación)</caption>
            <thead>
              <tr><th scope="col">Foto</th><th scope="col">Resultado</th>{meta.categories.map((c) => <th scope="col" key={c}>{LABELS[c]}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <th scope="row">{r.name}</th>
                  <td>{r.label} ({Math.round(r.confidence * 100)} %){r.reason ? ` · ${r.reason}` : ""}</td>
                  {r.probs.map((p, i) => <td key={i} className="mono">{(p * 100).toFixed(1)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
