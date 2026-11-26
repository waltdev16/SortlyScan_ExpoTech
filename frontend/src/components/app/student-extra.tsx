"use client";
// Estudiante: actividades ambientales para verificación docente y evaluaciones diagnóstica/posterior.
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ActionKind, AssessmentResult, EnvironmentalAction } from "@/lib/api/types";
import { clearDraft, draftKey, loadDraft, saveDraft } from "@/lib/offline";
import { useAction, useData, usePanel } from "./api-context";
import { newIdempotencyKey } from "./student";
import { Chip, EmptyState, ErrorState, Field, formatDate, Notice, PageHeader, Skeleton, today } from "./ui";

const KINDS: [ActionKind, string][] = [
  ["separation", "Separación en el aula"], ["delivery", "Entrega en centro de acopio"], ["cleanup", "Limpieza"],
  ["compost", "Compostaje"], ["campaign", "Jornada o campaña"], ["other", "Otra actividad"],
];
const MATERIALS: [string, string][] = [
  ["", "Varios o no aplica"], ["plastic", "Plástico"], ["paper", "Papel"], ["cardboard", "Cartón"], ["metal", "Metal"],
  ["glass", "Vidrio"], ["organic", "Orgánico"], ["other", "Otros residuos"],
];
const STATUS: Record<EnvironmentalAction["status"], { label: string; tone: "ok" | "warn" | "muted" | "neutral" }> = {
  pending: { label: "Esperando revisión", tone: "neutral" }, approved: { label: "Verificada", tone: "ok" },
  rejected: { label: "No aprobada", tone: "muted" }, changes_requested: { label: "Requiere cambios", tone: "warn" },
};

// 01. StudentActions
export function StudentActions() {
  const { data, error, loading, reload } = useData((api) => api.myActions());
  const [editing, setEditing] = useState<EnvironmentalAction | null>(null);
  return (
    <>
      <PageHeader title="Acciones ambientales"
        description="Registra algo que hiciste de verdad: tu docente lo revisa. Un escaneo no cuenta como reciclaje; una acción verificada, sí." />
      <ActionForm onDone={reload} />
      <section className="ui-section">
        <div className="ui-section-head"><h2>Mis registros</h2></div>
        {loading && !data && <Skeleton lines={4} />}
        <ErrorState error={error} onRetry={reload} />
        {data && data.length === 0 && <EmptyState title="Todavía no registras acciones." />}
        <ul className="action-list">
          {data?.map((a) => (
            <li key={a.id}>
              <div className="action-head">
                <strong>{a.kindLabel}</strong>
                <Chip tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Chip>
              </div>
              <p>{a.description}</p>
              <p className="ui-small ui-muted">
                {formatDate(a.occurred_on)}
                {a.quantity !== null && ` · ${a.quantity} ${a.unit === "kg" ? "kg" : "objetos"} (declarado)`}
              </p>
              {a.review_note && <p className="ui-small"><strong>{a.reviewer_name ?? "Docente"}:</strong> {a.review_note}</p>}
              {a.status === "changes_requested" && editing?.id !== a.id && (
                <button className="ui-button ui-button-quiet ui-button-small" onClick={() => setEditing(a)}>Corregir y reenviar</button>
              )}
              {editing?.id === a.id && <ResubmitForm action={a} onDone={() => { setEditing(null); reload(); }} />}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

// 02. ActionForm
function ActionForm({ onDone }: { onDone: () => void }) {
  const { run, pending, error } = useAction();
  const [kind, setKind] = useState<ActionKind>("separation");
  const [material, setMaterial] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<"kg" | "items">("items");
  const [date, setDate] = useState(today());
  const [key, setKey] = useState(newIdempotencyKey);
  const [sent, setSent] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSent(false);
    const q = quantity.trim() ? Number(quantity) : null;
    const response = await run((api) => api.submitAction({
      kind, material: material || null, description: description.trim(),
      quantity: q, unit: q ? unit : null, occurred_on: date, idempotency_key: key
    }));
    if (response) {
      setSent(true);
      setDescription("");
      setQuantity("");
      setKey(newIdempotencyKey());
      onDone();
    }
  }
  return (
    <form className="ui-form action-form" onSubmit={submit}>
      <div className="form-grid">
        <Field label="¿Qué hiciste?">
          <select value={kind} onChange={(e) => setKind(e.target.value as ActionKind)}>
            {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Material">
          <select value={material} onChange={(e) => setMaterial(e.target.value)}>
            {MATERIALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Fecha">
          <input type="date" value={date} max={today()} min={today(-60)} onChange={(e) => setDate(e.target.value)} required />
        </Field>
      </div>
      <Field label="Describe la acción" hint="Sin nombres de otras personas. No se suben fotografías.">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} minLength={5} maxLength={300} rows={3} required />
      </Field>
      <div className="form-grid">
        <Field label="Cantidad (opcional)">
          <input type="number" inputMode="decimal" min="0.1" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        <Field label="Unidad">
          <select value={unit} onChange={(e) => setUnit(e.target.value as "kg" | "items")} disabled={!quantity}>
            <option value="items">Objetos</option>
            <option value="kg">Kilogramos</option>
          </select>
        </Field>
      </div>
      <ErrorState error={error} />
      {sent && <p className="ui-success" role="status">Enviado. Tu docente lo revisará.</p>}
      <button className="ui-button ui-button-dark" disabled={pending || description.trim().length < 5}>{pending ? "Enviando…" : "Enviar para verificación"}</button>
    </form>
  );
}

// 03. ResubmitForm
function ResubmitForm({ action, onDone }: { action: EnvironmentalAction; onDone: () => void }) {
  const { run, pending, error } = useAction();
  const [description, setDescription] = useState(action.description);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (await run((api) => api.resubmitAction(action.id, { description: description.trim(), quantity: action.quantity, unit: action.unit }))) onDone();
  }
  return (
    <form className="ui-form" onSubmit={submit}>
      <Field label="Descripción corregida">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} minLength={5} maxLength={300} rows={3} required />
      </Field>
      <ErrorState error={error} />
      <button className="ui-button ui-button-dark ui-button-small" disabled={pending}>Reenviar</button>
    </form>
  );
}

const MATERIAL_LABEL: Record<string, string> = { plastic: "Plástico", paper: "Papel", cardboard: "Cartón", metal: "Metal", glass: "Vidrio", organic: "Orgánico" };

// 04. AssessmentView
export function AssessmentView() {
  const { base, role, me } = usePanel();
  const { data, error, loading, reload } = useData((api) => api.assessment());
  const { run, pending, error: sendError } = useAction();
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  // Conserva el borrador de la evaluación.
  const draft = data?.state?.available && role === "student"
    ? draftKey(me.id, `assessment:${data.id}:${data.version}:${data.state.available}`) : null;
  useEffect(() => {
    if (!draft || !data) return;
    const saved = loadDraft<(number | null)[]>(draft);
    if (saved?.length === data.questions.length) setAnswers(saved);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (draft && !result && answers.some((a) => a !== null)) saveDraft(draft, answers);
  }, [answers, draft, result]);
  if (loading && !data) return <Skeleton lines={6} block />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;
  const phase = data.state?.available;
  const qs = data.questions;
  const current = answers.length === qs.length ? answers : qs.map(() => null);
  const q = qs[step];
  const back = <Link href={base} className="back-link"><ArrowLeft size={16} aria-hidden /> Inicio</Link>;
  if (result) {
    return (
      <>
        {back}
        <PageHeader title={result.phase === "pre" ? "Evaluación inicial enviada" : "Evaluación final enviada"} />
        <p className="lesson-lead">{result.score} de {result.maxScore} respuestas correctas ({result.scorePct} %).</p>
        <ul className="assessment-materials">
          {Object.entries(result.byMaterial).map(([m, v]) => (
            <li key={m}><span>{MATERIAL_LABEL[m] ?? m}</span><strong>{v.correct}/{v.total}</strong></li>
          ))}
        </ul>
        <Notice>
          {result.phase === "pre"
            ? `No mostramos las respuestas correctas: volverás a ver estas preguntas al final. La evaluación final se habilita al completar ${data.state?.postAfterLessons ?? 3} lecciones.`
            : "Tu docente podrá comparar tus resultados de inicio y final. Esta evaluación no da ni quita puntos."}
        </Notice>
        <Link className="ui-button ui-button-dark" href={`${base}/aprender`}>Ir a las lecciones <ArrowRight size={16} aria-hidden /></Link>
      </>
    );
  }
  if (role !== "student" || !phase) {
    return (
      <>
        {back}
        <PageHeader title="Evaluación de materiales" />
        {data.state?.pre && data.state.post ? (
          <p>Ya respondiste ambas evaluaciones: inicio {data.state.pre.score}/{data.state.pre.max_score}, final {data.state.post.score}/{data.state.post.max_score}.</p>
        ) : data.state?.pre ? (
          <p>Completaste la evaluación inicial. La final se habilita al completar {data.state.postAfterLessons} lecciones (llevas {data.state.lessonsCompleted}).</p>
        ) : (
          <p>No hay una evaluación disponible para ti.</p>
        )}
      </>
    );
  }
  async function submit() {
    if (current.some((a) => a === null)) return;
    const response = await run((api) => api.submitAssessment(phase!, current as number[]));
    if (response) {
      if (draft) clearDraft(draft);
      setResult(response);
    }
  }
  return (
    <>
      {back}
      <PageHeader eyebrow={phase === "pre" ? "Evaluación inicial" : "Evaluación final"} title={data.title}
        description="12 preguntas sobre los seis materiales. Responde con lo que sabes hoy: no da ni quita puntos y no muestra las respuestas correctas." />
      <div className="quiz">
        <fieldset className="quiz-question">
          <legend><span className="quiz-n">Pregunta {step + 1} de {qs.length} · {MATERIAL_LABEL[q.material]}</span>{q.prompt}</legend>
          <div className="quiz-options">
            {q.options.map((o, i) => (
              <label key={o} className={`quiz-option${current[step] === i ? " is-chosen" : ""}`}>
                <input type="radio" name={`ev-${step}`} checked={current[step] === i} aria-label={o}
                  onChange={() => setAnswers(current.map((v, k) => (k === step ? i : v)))} />
                <span className="quiz-letter" aria-hidden>{String.fromCharCode(65 + i)}</span><span>{o}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <ErrorState error={sendError} />
        <div className="quiz-nav">
          <button className="ui-button ui-button-quiet" onClick={() => setStep(step - 1)} disabled={step === 0}><ArrowLeft size={16} aria-hidden /> Anterior</button>
          {step < qs.length - 1 ? (
            <button className="ui-button ui-button-dark" onClick={() => setStep(step + 1)} disabled={current[step] === null}>Siguiente <ArrowRight size={16} aria-hidden /></button>
          ) : (
            <button className="ui-button ui-button-dark" onClick={submit} disabled={pending || current.some((a) => a === null)}>{pending ? "Enviando…" : "Enviar evaluación"}</button>
          )}
        </div>
        <p className="ui-small ui-muted" aria-live="polite">{current.filter((a) => a !== null).length} de {qs.length} respondidas</p>
      </div>
    </>
  );
}
