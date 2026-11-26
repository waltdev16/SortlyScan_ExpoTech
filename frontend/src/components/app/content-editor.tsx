"use client";
import { useEffect, useState } from "react";
import type { ActivityInput, ActivityKind, AdminActivity, AdminLessonDetail, AdminQuestion, LessonContent } from "@/lib/api/types";
import { useAction, useData } from "./api-context";
import { Chip, ErrorState, Field, Notice, Section, Skeleton } from "./ui";

/**
 * Editor de lecciones para superadministración. Las respuestas correctas viajan solo en esta vista
 * (protegida por rol en el servidor). Si una pregunta o actividad ya tiene respuestas de estudiantes,
 * guardar crea una versión nueva y retira la anterior: los resultados históricos no cambian.
 */
const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);
const joined = (v?: string[]) => (v ?? []).join("\n");
const KINDS: Record<ActivityKind, string> = { choice: "Selección múltiple", truefalse: "Verdadero o falso", sort: "Clasificación", image: "Identificación con imagen", match: "Asociación" };
const MATERIALS = ["plastic", "paper", "cardboard", "metal", "glass", "organic"];

// 01. LessonEditor
export function LessonEditor({ lessonId, onChanged }: { lessonId: string; onChanged: () => void }) {
  const lesson = useData((api) => api.adminLesson(lessonId), [lessonId]);
  const action = useAction();
  const [data, setData] = useState<AdminLessonDetail | null>(null);
  useEffect(() => setData(lesson.data), [lesson.data]);
  async function apply(promise: (api: Parameters<Parameters<typeof action.run>[0]>[0]) => Promise<AdminLessonDetail>) {
    const r = await action.run(promise);
    if (r) { setData(r); onChanged(); }
    return !!r;
  }
  if (lesson.loading && !data) return <Skeleton lines={8} />;
  if (!data) return <ErrorState error={lesson.error} onRetry={lesson.reload} />;
  const nextQuestion = Math.max(0, ...data.questions.map((q) => q.position)) + 1;
  const nextActivity = Math.max(0, ...data.activities.map((a) => a.position)) + 1;
  return (
    <div className="ed-grid">
      <p className="ui-small ui-muted">
        Versión {data.version} · cuestionario v{data.quiz_version} · {data.attempts} intentos registrados
        {data.retired > 0 ? ` · ${data.retired} elementos retirados conservados para el historial` : ""}
      </p>
      <ErrorState error={action.error} />
      <SectionsForm data={data} pending={action.pending} onSave={(body) => apply((api) => api.updateLesson(data.id, body))} />
      <Section title={`Cuestionario (${data.questions.length})`}>
        {data.questions.map((q) => (
          <QuestionItem key={q.id} q={q} pending={action.pending}
            onSave={(body) => apply((api) => api.saveQuestion(data.id, q.position, body))}
            onRetire={() => window.confirm("¿Retirar esta pregunta? Los intentos anteriores se conservan.") && apply((api) => api.retireQuestion(data.id, q.position))} />
        ))}
        {nextQuestion <= 20 && <QuestionItem pending={action.pending} onSave={(body) => apply((api) => api.saveQuestion(data.id, nextQuestion, body))} />}
      </Section>
      <Section title={`Actividades (${data.activities.length})`}>
        {data.activities.map((a) => (
          <ActivityItem key={a.id} a={a} pending={action.pending}
            onSave={(body) => apply((api) => api.saveActivity(data.id, a.position, body))}
            onRetire={() => window.confirm("¿Retirar esta actividad? Los resultados anteriores se conservan.") && apply((api) => api.retireActivity(data.id, a.position))} />
        ))}
        {nextActivity <= 20 && <ActivityItem pending={action.pending} onSave={(body) => apply((api) => api.saveActivity(data.id, nextActivity, body))} />}
      </Section>
    </div>
  );
}

// 02. SectionsForm
function SectionsForm({ data, pending, onSave }: { data: AdminLessonDetail; pending: boolean; onSave: (b: { title: string; summary: string; estimated_minutes: number; pass_score_pct: number; content: LessonContent }) => Promise<boolean> }) {
  const c = data.content;
  const [f, setF] = useState({
    title: data.title, summary: data.summary, minutes: data.estimated_minutes, pass: data.pass_score_pct, intro: c.intro ?? "",
    what: c.what, identify: joined(c.identify), classify: joined(c.classify), mistakes: joined(c.mistakes), tips: joined(c.tips), examples: joined(c.examples)
  });
  const [ok, setOk] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setOk(await onSave({
      title: f.title.trim(), summary: f.summary.trim(), estimated_minutes: Number(f.minutes), pass_score_pct: Number(f.pass),
      content: {
        intro: f.intro.trim() || undefined, what: f.what.trim(), identify: lines(f.identify), classify: lines(f.classify),
        mistakes: lines(f.mistakes), tips: lines(f.tips), examples: lines(f.examples)
      }
    }));
  }
  const area = (key: keyof typeof f, label: string, hint = "Un punto por línea.") => (
    <Field label={label} hint={hint}><textarea rows={4} value={String(f[key])} onChange={(e) => setF({ ...f, [key]: e.target.value })} /></Field>
  );
  return (
    <Section title="Secciones de la lección">
      <form className="ui-form" onSubmit={submit}>
        <Field label="Título"><input value={f.title} minLength={3} maxLength={120} onChange={(e) => setF({ ...f, title: e.target.value })} required /></Field>
        <Field label="Resumen"><textarea rows={2} value={f.summary} minLength={10} maxLength={400} onChange={(e) => setF({ ...f, summary: e.target.value })} required /></Field>
        <div className="ui-form-row">
          <Field label="Minutos estimados"><input type="number" min={1} max={60} value={f.minutes} onChange={(e) => setF({ ...f, minutes: Number(e.target.value) })} /></Field>
          <Field label="Aprobación del cuestionario (%)"><input type="number" min={50} max={100} value={f.pass} onChange={(e) => setF({ ...f, pass: Number(e.target.value) })} /></Field>
        </div>
        {area("intro", "Introducción", "Una o dos oraciones.")}
        {area("what", "¿Qué es?", "Párrafo breve.")}
        {area("identify", "Cómo identificarlo")}
        {area("classify", "Cómo prepararlo")}
        {area("mistakes", "Errores frecuentes")}
        {area("tips", "Consejos")}
        {area("examples", "Ejemplos")}
        {ok && <p className="ui-success" role="status">Lección guardada.</p>}
        <button className="ui-button ui-button-dark" disabled={pending}>Guardar secciones</button>
      </form>
    </Section>
  );
}

// 03. QuestionItem
function QuestionItem({ q, pending, onSave, onRetire }: { q?: AdminQuestion; pending: boolean; onSave: (b: { prompt: string; options: string[]; correct: number; explanation: string }) => Promise<boolean>; onRetire?: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ prompt: q?.prompt ?? "", options: joined(q?.options), correct: q?.correct ?? 0, explanation: q?.explanation ?? "" });
  const opts = lines(f.options);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (await onSave({ prompt: f.prompt.trim(), options: opts, correct: Number(f.correct), explanation: f.explanation.trim() })) setOpen(false);
  }
  if (!open) {
    return (
      <article className="ed-item">
        <header>
          <strong>{q ? `${q.position}. ${q.prompt}` : "Nueva pregunta"}</strong>
          <span className="ed-actions">
            {q?.has_answers && <Chip tone="muted">Con respuestas</Chip>}
            <button className="ui-link-button" onClick={() => setOpen(true)}>{q ? "Editar" : "Agregar pregunta"}</button>
            {q && onRetire && <button className="ui-link-button ui-danger" onClick={onRetire}>Retirar</button>}
          </span>
        </header>
        {q && <ol className="ed-opts">{q.options.map((o, i) => <li key={i} className={i === q.correct ? "is-correct" : undefined}>{o}{i === q.correct ? " ✓" : ""}</li>)}</ol>}
      </article>
    );
  }
  return (
    <form className="ed-item ui-form" onSubmit={submit}>
      {q?.has_answers && <Notice>Esta pregunta ya tiene respuestas: al guardar se creará una versión nueva y la anterior se conservará.</Notice>}
      <Field label="Pregunta"><input value={f.prompt} minLength={5} maxLength={300} onChange={(e) => setF({ ...f, prompt: e.target.value })} required /></Field>
      <Field label="Opciones" hint="De 2 a 5, una por línea."><textarea rows={4} value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} /></Field>
      <Field label="Respuesta correcta">
        <select value={f.correct} onChange={(e) => setF({ ...f, correct: Number(e.target.value) })}>{opts.map((o, i) => <option key={i} value={i}>{o}</option>)}</select>
      </Field>
      <Field label="Retroalimentación" hint="Se muestra después de responder."><textarea rows={2} value={f.explanation} minLength={5} maxLength={400} onChange={(e) => setF({ ...f, explanation: e.target.value })} required /></Field>
      <div className="ui-form-actions">
        <button className="ui-button ui-button-dark" disabled={pending || opts.length < 2}>Guardar</button>
        <button type="button" className="ui-button ui-button-quiet" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </form>
  );
}

// 04. ActivityItem
function ActivityItem({ a, pending, onSave, onRetire }: { a?: AdminActivity; pending: boolean; onSave: (b: ActivityInput) => Promise<boolean>; onRetire?: () => void }) {
  const [open, setOpen] = useState(false);
  const p = a?.payload ?? {};
  const [f, setF] = useState({
    kind: (a?.kind ?? "truefalse") as ActivityKind, prompt: a?.prompt ?? "", explanation: a?.explanation ?? "",
    options: joined(p.options), bins: joined(p.bins), items: joined(p.items), left: joined(p.left), right: joined(p.right),
    answer: a?.answer ?? true as boolean | number | number[],
  });
  const list = (k: "options" | "bins" | "items" | "left" | "right") => lines(f[k]);
  const arr = (n: number) => (Array.isArray(f.answer) ? f.answer : []).slice(0, n).concat(Array(Math.max(0, n - (Array.isArray(f.answer) ? f.answer.length : 0))).fill(0));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const base = { kind: f.kind, prompt: f.prompt.trim(), explanation: f.explanation.trim() };
    const body: ActivityInput =
      f.kind === "truefalse" ? { ...base, answer: f.answer === true }
        : f.kind === "choice" || f.kind === "image" ? { ...base, options: list("options"), answer: typeof f.answer === "number" ? f.answer : 0 }
          : f.kind === "sort" ? { ...base, bins: list("bins"), items: list("items"), answer: arr(list("items").length) }
            : { ...base, left: list("left"), right: list("right"), answer: arr(list("left").length) };
    if (await onSave(body)) setOpen(false);
  }
  if (!open) {
    return (
      <article className="ed-item">
        <header>
          <strong>{a ? `${a.position}. ${a.prompt}` : "Nueva actividad"}</strong>
          <span className="ed-actions">
            {a && <Chip tone="neutral">{KINDS[a.kind]}</Chip>}
            {a?.has_answers && <Chip tone="muted">Con respuestas</Chip>}
            <button className="ui-link-button" onClick={() => setOpen(true)}>{a ? "Editar" : "Agregar actividad"}</button>
            {a && onRetire && <button className="ui-link-button ui-danger" onClick={onRetire}>Retirar</button>}
          </span>
        </header>
      </article>
    );
  }
  const pickers = (labels: string[], targets: string[]) => (
    <div className="ed-grid">{labels.map((label, i) => (
      <Field key={i} label={label}>
        <select value={arr(labels.length)[i]} onChange={(e) => { const next = arr(labels.length); next[i] = Number(e.target.value); setF({ ...f, answer: next }); }}>
          {targets.map((t, j) => <option key={j} value={j}>{t}</option>)}
        </select>
      </Field>
    ))}</div>
  );
  return (
    <form className="ed-item ui-form" onSubmit={submit}>
      {a?.has_answers && <Notice>Esta actividad ya tiene respuestas: al guardar se creará una versión nueva y la anterior se conservará.</Notice>}
      <Field label="Tipo">
        <select value={f.kind} onChange={(e) => { const kind = e.target.value as ActivityKind; setF({ ...f, kind, answer: kind === "truefalse" ? true : kind === "choice" || kind === "image" ? 0 : [] }); }}>
          {(Object.keys(KINDS) as ActivityKind[]).map((k) => <option key={k} value={k}>{KINDS[k]}</option>)}
        </select>
      </Field>
      <Field label="Enunciado"><input value={f.prompt} minLength={5} maxLength={300} onChange={(e) => setF({ ...f, prompt: e.target.value })} required /></Field>
      {f.kind === "truefalse" && (
        <Field label="Respuesta correcta">
          <select value={f.answer === true ? "1" : "0"} onChange={(e) => setF({ ...f, answer: e.target.value === "1" })}><option value="1">Verdadero</option><option value="0">Falso</option></select>
        </Field>
      )}
      {(f.kind === "choice" || f.kind === "image") && (
        <>
          <Field label="Opciones" hint={f.kind === "image" ? `Materiales, uno por línea: ${MATERIALS.join(", ")}.` : "Una por línea."}>
            <textarea rows={4} value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} />
          </Field>
          <Field label="Respuesta correcta">
            <select value={typeof f.answer === "number" ? f.answer : 0} onChange={(e) => setF({ ...f, answer: Number(e.target.value) })}>
              {list("options").map((o, i) => <option key={i} value={i}>{o}</option>)}
            </select>
          </Field>
        </>
      )}
      {f.kind === "sort" && (
        <>
          <div className="ui-form-row">
            <Field label="Categorías" hint="De 2 a 4, una por línea."><textarea rows={3} value={f.bins} onChange={(e) => setF({ ...f, bins: e.target.value })} /></Field>
            <Field label="Elementos" hint="De 2 a 8, uno por línea."><textarea rows={3} value={f.items} onChange={(e) => setF({ ...f, items: e.target.value })} /></Field>
          </div>
          {pickers(list("items"), list("bins"))}
        </>
      )}
      {f.kind === "match" && (
        <>
          <div className="ui-form-row">
            <Field label="Columna izquierda" hint="Uno por línea."><textarea rows={3} value={f.left} onChange={(e) => setF({ ...f, left: e.target.value })} /></Field>
            <Field label="Columna derecha" hint="Misma cantidad, uno por línea."><textarea rows={3} value={f.right} onChange={(e) => setF({ ...f, right: e.target.value })} /></Field>
          </div>
          {pickers(list("left"), list("right"))}
        </>
      )}
      <Field label="Retroalimentación"><textarea rows={2} value={f.explanation} minLength={5} maxLength={400} onChange={(e) => setF({ ...f, explanation: e.target.value })} required /></Field>
      <div className="ui-form-actions">
        <button className="ui-button ui-button-dark" disabled={pending}>Guardar</button>
        <button type="button" className="ui-button ui-button-quiet" onClick={() => setOpen(false)}>Cancelar</button>
      </div>
    </form>
  );
}
