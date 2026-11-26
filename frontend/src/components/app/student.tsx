"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ClipboardCheck, RefreshCw, ScanLine, X } from "lucide-react";
import type {
  ActivityAnswer, ActivityCheck, AttemptResult, Challenge, LessonActivity, LessonDetail, LessonSummary, MaterialId, RankingPeriod,
} from "@/lib/api/types";
import { clearDraft, draftKey, loadDraft, saveDraft } from "@/lib/offline";
import { useAction, useData, usePanel } from "./api-context";
import { AnimatedNumber, BarChart, CHART, LineChart, Meter, Ring } from "./charts";
import { AchievementList, ChallengeMeter, LevelPanel, LevelPath, RewardNote } from "./gamification";
// Carga el escáner al abrirlo.
const Scanner = dynamic(() => import("./scanner").then((m) => m.Scanner), { loading: () => <Skeleton lines={4} block /> });
import { AssessmentView, StudentActions } from "./student-extra";
import { AccountSettings } from "./settings";
import { DataTable, Tabs } from "./table";
import {
  Bento, Chip, EmptyState, ErrorState, formatDate, formatDateTime, MaterialImage, Notice, PageHeader, pct, SeeAll, Skeleton, Tile,
  ViewFade,
} from "./ui";

// 01. newIdempotencyKey
export function newIdempotencyKey(): string {
  const c: Crypto = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// 02. StudentApp
export function StudentApp({ section, query }: { section: string[]; query: Record<string, string | undefined> }) {
  const [view, slug] = section;
  let content: React.ReactNode;
  switch (view) {
    case undefined:
      content = <StudentHome />;
      break;
    case "escanear":
      content = <Scanner />;
      break;
    case "aprender":
      content = slug ? <LessonView slug={slug} activityId={query.actividad} /> : <LessonCatalog />;
      break;
    case "retos":
      content = <StudentChallenges />;
      break;
    case "ranking":
      content = <StudentRanking />;
      break;
    case "progreso":
      content = <StudentProgress />;
      break;
    case "acciones":
      content = <StudentActions />;
      break;
    case "evaluacion":
      content = <AssessmentView />;
      break;
    case "configuracion":
      content = <AccountSettings />;
      break;
    default:
      content = <EmptyState title="Esta sección no existe." />;
  }
  return <ViewFade viewKey={section.join("/")}>{content}</ViewFade>;
}

const daysLeft = (end: string) => Math.ceil((new Date(`${end}T23:59:59`).getTime() - Date.now()) / 86_400_000);
const timeProgress = (c: Challenge) => {
  const start = new Date(`${c.starts_on}T00:00:00`).getTime();
  const end = new Date(`${c.ends_on}T23:59:59`).getTime();
  return Math.max(0, Math.min(100, ((Date.now() - start) / (end - start)) * 100));
};
const MATERIAL_ORDER: MaterialId[] = ["plastic", "paper", "cardboard", "metal", "glass", "organic"];

// 03. lessonAction
function lessonAction(l: LessonSummary) {
  return l.progress_status === "completed" ? "Repasar" : l.progress_status === "started" ? "Continuar" : "Comenzar";
}

// 04. LessonCard
function LessonCard({ lesson, href, compact = false }: { lesson: LessonSummary; href: string; compact?: boolean }) {
  const status =
    lesson.progress_status === "completed" ? <Chip tone="ok">Completada</Chip> : lesson.progress_status === "started" ? <Chip tone="warn">En curso</Chip> : <Chip tone="muted">Nueva</Chip>;
  return (
    <Link href={href} className={`lesson-card${compact ? " is-compact" : ""}`}>
      <MaterialImage material={lesson.material} className="lesson-card-img" />
      <span className="lesson-card-body">
        <span className="lesson-card-top">
          <span className="mat-tag">{lesson.material_name}</span>
          {status}
        </span>
        <strong>{lesson.title}</strong>
        <span className="lesson-card-meta">
          {lesson.estimated_minutes} min
          {lesson.best_score_pct !== null && <> · Mejor resultado {lesson.best_score_pct}%</>}
        </span>
        <Meter value={lesson.best_score_pct ?? 0} label={`Progreso en ${lesson.title}: ${lesson.best_score_pct ?? 0}%`} />
        <span className="lesson-card-cta">
          {lessonAction(lesson)} <ArrowRight size={16} aria-hidden />
        </span>
      </span>
    </Link>
  );
}

// 05. StudentHome
function StudentHome() {
  const { base } = usePanel();
  const { data, error, loading, reload } = useData((api) => api.studentOverview());
  if (loading && !data) return <HomeSkeleton />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;
  const firstName = data.displayName.split(" ")[0];
  const next = data.activities.find((a) => !a.completed);
  const featured = data.challenges.find((c) => c.state === "active" && !c.completed) ?? data.challenges[0];
  const lessonsPct = data.lessons.total ? (data.lessons.completed / data.lessons.total) * 100 : 0;
  return (
    <>
      <PageHeader
        eyebrow={data.group ? `${data.group.grade} · Grupo ${data.group.name}` : undefined}
        title={`Hola, ${firstName}.`}
      />
      {data.assessment?.available && (
        <div className="assessment-banner">
          <ClipboardCheck size={22} aria-hidden />
          <p>
            <strong>{data.assessment.available === "pre" ? "Evaluación inicial" : "Evaluación final"}</strong>
            {data.assessment.available === "pre"
              ? " · 12 preguntas para saber qué conoces hoy. No da ni quita puntos."
              : " · Las mismas 12 preguntas, para ver cuánto aprendiste."}
          </p>
          <Link className="ui-button ui-button-dark ui-button-small" href={`${base}/evaluacion`}>Responder</Link>
        </div>
      )}
      <Bento>
        <Tile span={5} tone="dark" label="Puntos y nivel" className="tile-level">
          <LevelPanel level={data.level} />
          <div className="tile-level-text">
            <p className="kpi-label">Puntos acumulados</p>
            <p className="kpi-value"><AnimatedNumber value={data.points} /></p>
            {data.achievements.length > 0 && (
              <Link className="tile-note tile-link" href={`${base}/progreso#logros`}>
                <Check size={14} aria-hidden /> {data.achievements.length} {data.achievements.length === 1 ? "logro" : "logros"}
              </Link>
            )}
          </div>
        </Tile>
        <Tile span={4} tone="lime" label="Escáner" className="tile-scan">
          <Link href={`${base}/escanear`} className="tile-scan-link">
            <span className="tile-scan-frame" aria-hidden="true"><ScanLine size={34} /></span>
            <span>
              <strong>Escanear un residuo</strong>
              <small>Toma una foto y practica cómo separarlo.</small>
            </span>
            <ArrowUpRight size={22} aria-hidden className="tile-scan-arrow" />
          </Link>
        </Tile>
        <Tile span={3} label="Lecciones completadas" className="tile-lessons">
          <Ring value={lessonsPct} size={108} label={`${data.lessons.completed} de ${data.lessons.total} lecciones`}>
            <strong>{data.lessons.completed}<span>/{data.lessons.total}</span></strong>
          </Ring>
          <p className="kpi-label">Lecciones completadas</p>
        </Tile>

        <Tile span={4} title="Próxima actividad" action={<SeeAll href={`${base}/aprender#asignadas`} />}>
          {next ? (
            <div className="next-item">
              <p className="next-title">{next.title}</p>
              <p className="ui-muted ui-small">{next.lesson_title}</p>
              {next.due_on && <Chip tone={daysLeft(next.due_on) <= 2 ? "warn" : "neutral"}>Entrega: {formatDate(next.due_on)}</Chip>}
              <Link className="ui-button ui-button-dark ui-button-small" href={`${base}/aprender/${next.lesson_slug}?actividad=${next.id}`}>
                Empezar <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          ) : (
            <p className="tile-empty">{data.activities.length ? "Completaste tus actividades asignadas." : "No tienes actividades asignadas."}</p>
          )}
        </Tile>
        <Tile span={4} title="Reto destacado" action={<SeeAll href={`${base}/retos`} />}>
          {featured ? (
            <div className="next-item">
              <p className="next-title">{featured.title}</p>
              <p className="ui-muted ui-small">
                {featured.completed ? "¡Logrado!" : featured.state === "upcoming" ? `Empieza el ${formatDate(featured.starts_on)}` : `${Math.max(0, daysLeft(featured.ends_on))} días restantes`}
                {featured.institutional ? " · Toda la escuela" : " · Tu grupo"}
              </p>
              <ChallengeMeter progress={featured.progress} completed={featured.completed} />
            </div>
          ) : (
            <p className="tile-empty">No hay retos activos por ahora.</p>
          )}
        </Tile>
        <Tile span={4} title="Actividad reciente" action={<SeeAll href={`${base}/progreso`} />}>
          {data.recentAttempts.length === 0 ? (
            <p className="tile-empty">Aún no respondes cuestionarios.</p>
          ) : (
            <ul className="rows">
              {data.recentAttempts.slice(0, 3).map((a) => (
                <li key={a.id}>
                  <span className="rows-main">{a.lesson_title}<small>{formatDateTime(a.created_at)}</small></span>
                  <span className={`score-pill${a.passed ? " is-ok" : ""}`}>{pct(a.score, a.max_score)}%</span>
                </li>
              ))}
            </ul>
          )}
        </Tile>

        <Tile span={12} tone="open" title="Recomendado para ti" action={<SeeAll href={`${base}/aprender`}>Todas las lecciones</SeeAll>}>
          {data.lessons.next.length === 0 ? (
            <p className="tile-empty">Completaste todas las lecciones. Puedes repasarlas cuando quieras.</p>
          ) : (
            <div className="card-row">
              {data.lessons.next.slice(0, 3).map((l) => (
                <LessonCard key={l.slug} lesson={l} href={`${base}/aprender/${l.slug}`} compact />
              ))}
            </div>
          )}
        </Tile>
      </Bento>
    </>
  );
}

// 06. HomeSkeleton
function HomeSkeleton() {
  return (
    <div className="bento" aria-busy="true">
      <span className="sr-only">Cargando…</span>
      {[5, 4, 3, 4, 4, 4, 12].map((s, i) => (
        <div key={i} className={`tile span-${s} sk-tile`} />
      ))}
    </div>
  );
}

type LessonFilter = "all" | "started" | "completed" | "new";

// 07. LessonCatalog
function LessonCatalog() {
  const { base } = usePanel();
  const lessons = useData((api) => api.lessons());
  const overview = useData((api) => api.studentOverview());
  const [filter, setFilter] = useState<LessonFilter>("all");
  const list = lessons.data ?? [];
  const count = (f: LessonFilter) => list.filter((l) => matches(l, f)).length;
  function matches(l: LessonSummary, f: LessonFilter) {
    if (f === "all") return true;
    if (f === "new") return !l.progress_status;
    return l.progress_status === f;
  }
  const assigned = (overview.data?.activities ?? []).filter((a) => !a.completed);
  return (
    <>
      <PageHeader title="Aprender" description="Seis materiales. Lee la lección y demuestra lo aprendido en el cuestionario." />
      {assigned.length > 0 && (
        <section id="asignadas" className="assigned" aria-label="Asignadas por tu docente">
          <p className="assigned-label">Asignadas por tu docente</p>
          <ul>
            {assigned.slice(0, 3).map((a) => (
              <li key={a.id}>
                <Link href={`${base}/aprender/${a.lesson_slug}?actividad=${a.id}`}>
                  <span><strong>{a.title}</strong><small>{a.lesson_title}{a.due_on ? ` · ${formatDate(a.due_on)}` : ""}</small></span>
                  <ArrowRight size={16} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Tabs
        label="Filtrar lecciones"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "Todas", count: list.length },
          { value: "started", label: "En curso", count: count("started") },
          { value: "new", label: "Sin empezar", count: count("new") },
          { value: "completed", label: "Completadas", count: count("completed") },
        ]}
      />
      {lessons.loading && !lessons.data && <Skeleton lines={6} block />}
      <ErrorState error={lessons.error} onRetry={lessons.reload} />
      <div className="card-grid">
        {list.filter((l) => matches(l, filter)).map((l) => (
          <LessonCard key={l.slug} lesson={l} href={`${base}/aprender/${l.slug}`} />
        ))}
      </div>
      {lessons.data && list.filter((l) => matches(l, filter)).length === 0 && <EmptyState title="No hay lecciones en este estado." />}
    </>
  );
}

type Step = { id: string; label: string; kind: "read" | "activity" | "quiz"; activity?: LessonActivity };

// 08. LessonView
function LessonView({ slug, activityId }: { slug: string; activityId?: string }) {
  const { base, api, role } = usePanel();
  const { data, error, loading, reload } = useData((a) => a.lesson(slug), [slug]);
  const [step, setStep] = useState(0);
  const [solved, setSolved] = useState<Record<number, boolean>>({});
  const reduce = useReducedMotion();
  useEffect(() => {
    if (data && role === "student") api.startLesson(slug).catch(() => undefined);
  }, [data, api, slug, role]);
  useEffect(() => {
    if (data) setSolved(Object.fromEntries(data.activities.map((a) => [a.position, a.solved])));
  }, [data]);
  // Las actividades asignadas por el docente llevan directo al cuestionario.
  useEffect(() => {
    if (data && activityId) setStep(4 + data.activities.length);
  }, [data, activityId]);
  if (loading && !data) return <Skeleton lines={8} block />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;
  const steps: Step[] = [
    { id: "intro", label: "Introducción", kind: "read" },
    { id: "identificar", label: "Identificar", kind: "read" },
    { id: "preparar", label: "Preparar", kind: "read" },
    { id: "errores", label: "Errores frecuentes", kind: "read" },
    ...data.activities.map((a) => ({ id: `actividad-${a.position}`, label: `Actividad ${a.position}`, kind: "activity" as const, activity: a })),
    { id: "cuestionario", label: "Cuestionario final", kind: "quiz" },
  ];
  const current = steps[Math.min(step, steps.length - 1)];
  const doneActivities = data.activities.filter((a) => solved[a.position]).length;
  const go = (n: number) => {
    setStep(Math.max(0, Math.min(steps.length - 1, n)));
    document.querySelector(".lesson-stage")?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  };
  const list = (items: string[]) => (
    <ol className="lesson-list">{items.map((item, i) => <li key={item}><span aria-hidden>{i + 1}</span>{item}</li>)}</ol>
  );
  return (
    <article className="lesson">
      <Link href={`${base}/aprender`} className="back-link"><ArrowLeft size={16} aria-hidden /> Lecciones</Link>
      <header className="lesson-hero is-compact">
        <div>
          <p className="ui-eyebrow">{data.material_name} · {data.estimated_minutes} min · {steps.length} pasos</p>
          <h1>{data.title}</h1>
          <p className="ui-small ui-muted">
            Actividades resueltas: {doneActivities}/{data.activities.length} · Cuestionario: {data.quizPassed ? "aprobado" : "pendiente"}
            {data.progress?.status === "completed" && " · Lección completada"}
          </p>
        </div>
        <MaterialImage material={data.material} className="lesson-hero-img" priority />
      </header>
      <nav className="lesson-stepper" aria-label="Pasos de la lección">
        <ol>
          {steps.map((st, i) => {
            const done = st.kind === "activity" ? solved[st.activity!.position] : st.kind === "quiz" ? data.quizPassed : i < step;
            return (
              <li key={st.id}>
                <button type="button" onClick={() => go(i)} aria-current={i === step ? "step" : undefined}
                  className={`${i === step ? "is-current" : ""}${done ? " is-done" : ""}`}>
                  <span className="sr-only">{st.label}{done ? " (hecho)" : ""}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p aria-live="polite">Paso {step + 1} de {steps.length} · <strong>{current.label}</strong></p>
      </nav>
      <AnimatePresence mode="wait">
        <motion.section key={current.id} className="lesson-stage" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }} transition={{ duration: 0.18 }} aria-labelledby={`h-${current.id}`}>
          {current.id === "intro" && (
            <>
              <h2 id="h-intro">¿Qué es?</h2>
              {data.content.intro && <p className="lesson-lead">{data.content.intro}</p>}
              <p>{data.content.what}</p>
              {!!data.content.examples?.length && (
                <>
                  <h3>Ejemplos comunes</h3>
                  <ul className="example-chips">{data.content.examples.map((e) => <li key={e}>{e}</li>)}</ul>
                </>
              )}
            </>
          )}
          {current.id === "identificar" && (<><h2 id="h-identificar">Cómo identificarlo</h2>{list(data.content.identify)}</>)}
          {current.id === "preparar" && (
            <>
              <h2 id="h-preparar">Cómo prepararlo</h2>
              {list(data.content.classify)}
              <p className="ui-small ui-muted">Confirma con tu institución qué materiales recibe su punto de acopio y dónde se depositan.</p>
            </>
          )}
          {current.id === "errores" && (
            <>
              <h2 id="h-errores">Errores frecuentes</h2>
              {list(data.content.mistakes)}
              <h3>Recomendaciones</h3>
              {list(data.content.tips)}
            </>
          )}
          {current.kind === "activity" && (
            <ActivityStep key={current.id} slug={slug} activity={current.activity!} total={data.activities.length}
              onSolved={() => setSolved((prev) => ({ ...prev, [current.activity!.position]: true }))} />
          )}
          {current.kind === "quiz" && (
            <Quiz lesson={data} activityId={activityId} activitiesPending={data.activities.length - doneActivities} onDone={reload} />
          )}
        </motion.section>
      </AnimatePresence>
      <div className="lesson-nav">
        <button className="ui-button ui-button-quiet" onClick={() => go(step - 1)} disabled={step === 0}>
          <ArrowLeft size={16} aria-hidden /> Anterior
        </button>
        {step < steps.length - 1 && (
          <button className="ui-button ui-button-dark" onClick={() => go(step + 1)}>
            Siguiente <ArrowRight size={16} aria-hidden />
          </button>
        )}
      </div>
    </article>
  );
}

const LETTERS = "ABCDEF";
const MATERIAL_NAMES: Record<string, string> = { plastic: "plástico", paper: "papel", cardboard: "cartón", metal: "metal", glass: "vidrio", organic: "orgánico" };

// 09. ActivityStep
function ActivityStep({ slug, activity, total, onSolved }: { slug: string; activity: LessonActivity; total: number; onSolved: () => void }) {
  const { role } = usePanel();
  const { run, pending, error } = useAction();
  const p = activity.payload;
  const size = activity.kind === "sort" ? p.items!.length : activity.kind === "match" ? p.left!.length : 0;
  const [single, setSingle] = useState<number | boolean | null>(null);
  const [multi, setMulti] = useState<(number | null)[]>(() => Array.from({ length: size }, () => null));
  const [result, setResult] = useState<ActivityCheck | null>(null);
  const complete = activity.kind === "sort" || activity.kind === "match" ? multi.every((v) => v !== null) : single !== null;
  const kindLabel = { choice: "Selección múltiple", truefalse: "Verdadero o falso", sort: "Clasificación", image: "Identificación con imágenes", match: "Asociación" }[activity.kind];

  async function check() {
    const answer: ActivityAnswer = activity.kind === "sort" || activity.kind === "match" ? (multi as number[]) : (single as number | boolean);
    const response = await run((api) => api.checkActivity(slug, activity.position, answer));
    if (response) {
      setResult(response);
      if (response.correct) onSolved();
    }
  }
  function retry() {
    setResult(null);
    if (result?.items) setMulti((prev) => prev.map((v, i) => (result.items![i] ? v : null)));
    else setSingle(null);
  }
  const locked = pending || (result?.correct ?? false);
  const mark = (i: number) => (result?.items ? (result.items[i] ? " is-ok" : " is-bad") : "");
  return (
    <div className="activity">
      <p className="ui-eyebrow">Actividad {activity.position} de {total} · {kindLabel}{activity.solved && !result ? " · ya resuelta" : ""}</p>
      <h2 id={`h-actividad-${activity.position}`}>{activity.prompt}</h2>
      <fieldset className="activity-body" disabled={locked}>
        <legend className="sr-only">{activity.prompt}</legend>
        {activity.kind === "choice" && (
          <div className="quiz-options">
            {p.options!.map((o, i) => (
              <label key={o} className={`quiz-option${single === i ? " is-chosen" : ""}`}>
                <input type="radio" name={`a-${activity.id}`} checked={single === i} onChange={() => setSingle(i)} aria-label={o} />
                <span className="quiz-letter" aria-hidden>{LETTERS[i]}</span><span>{o}</span>
              </label>
            ))}
          </div>
        )}
        {activity.kind === "truefalse" && (
          <div className="tf-options">
            {[true, false].map((v) => (
              <label key={String(v)} className={`quiz-option${single === v ? " is-chosen" : ""}`}>
                <input type="radio" name={`a-${activity.id}`} checked={single === v} onChange={() => setSingle(v)} aria-label={v ? "Verdadero" : "Falso"} />
                <span>{v ? "Verdadero" : "Falso"}</span>
              </label>
            ))}
          </div>
        )}
        {activity.kind === "image" && (
          <div className="image-options">
            {p.options!.map((m, i) => (
              <label key={m} className={`image-option${single === i ? " is-chosen" : ""}`}>
                <input type="radio" name={`a-${activity.id}`} checked={single === i} onChange={() => setSingle(i)}
                  aria-label={`Imagen ${LETTERS[i]}: ilustración de ${MATERIAL_NAMES[m] ?? m}`} />
                <MaterialImage material={m as MaterialId} className="image-option-img" />
                <span aria-hidden>Imagen {LETTERS[i]}</span>
              </label>
            ))}
          </div>
        )}
        {activity.kind === "sort" && (
          <ul className="sort-list">
            {p.items!.map((item, i) => (
              <li key={item} className={mark(i)}>
                <span className="sort-item">{item}</span>
                <span className="sort-bins" role="radiogroup" aria-label={`¿Dónde va «${item}»?`}>
                  {p.bins!.map((bin, b) => (
                    <label key={bin} className={multi[i] === b ? "is-chosen" : undefined}>
                      <input type="radio" name={`s-${activity.id}-${i}`} checked={multi[i] === b}
                        onChange={() => setMulti((prev) => prev.map((v, k) => (k === i ? b : v)))} />
                      {bin}
                    </label>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
        {activity.kind === "match" && (
          <ul className="match-list">
            {p.left!.map((left, i) => (
              <li key={left} className={mark(i)}>
                <label htmlFor={`m-${activity.id}-${i}`}>{left}</label>
                <select id={`m-${activity.id}-${i}`} value={multi[i] ?? ""}
                  onChange={(e) => setMulti((prev) => prev.map((v, k) => (k === i ? (e.target.value === "" ? null : Number(e.target.value)) : v)))}>
                  <option value="">Elige una opción</option>
                  {p.right!.map((r, ri) => <option key={r} value={ri}>{r}</option>)}
                </select>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      <ErrorState error={error} />
      {result ? (
        <div className={`activity-feedback${result.correct ? " is-ok" : " is-bad"}`} role="status">
          <p className="activity-verdict">
            {result.correct ? <><Check size={18} aria-hidden /> ¡Correcto!</> : <><X size={18} aria-hidden /> Todavía no.</>}
            {!result.correct && result.items && ` ${result.items.filter(Boolean).length} de ${result.items.length} bien ubicados.`}
          </p>
          <p>{result.explanation}</p>
          {result.lessonCompleted && <p><strong>Completaste la lección.</strong></p>}
          {!result.correct && <button className="ui-button ui-button-quiet ui-button-small" onClick={retry}><RefreshCw size={15} aria-hidden /> Intentar de nuevo</button>}
          {result.recorded === false && role !== "student" && <p className="ui-small ui-muted">Vista de práctica: no se registra.</p>}
          <RewardNote outcome={result} />
        </div>
      ) : (
        <button className="ui-button ui-button-dark" onClick={check} disabled={!complete || pending}>{pending ? "Revisando…" : "Comprobar"}</button>
      )}
      {!result && <p className="ui-small ui-muted">Puedes repetir las actividades las veces que quieras. Los puntos se otorgan una sola vez al completar la lección.</p>}
    </div>
  );
}

// 10. Quiz
function Quiz({ lesson, activityId, activitiesPending = 0, onDone }: { lesson: LessonDetail; activityId?: string; activitiesPending?: number; onDone?: () => void }) {
  const { role, me } = usePanel();
  const { run, pending, error } = useAction();
  const reduce = useReducedMotion();
  const total = lesson.questions.length;
  // Guarda el borrador de respuestas.
  const draft = draftKey(me.id, `quiz:${lesson.quiz_id}:${lesson.questions.map((x) => x.id).join(",")}`);
  const [saved] = useState(() => loadDraft<{ answers: (number | null)[]; key: string }>(draft));
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    saved?.answers?.length === total ? saved.answers : lesson.questions.map(() => null));
  const [step, setStep] = useState(0);
  const [key, setKey] = useState(() => saved?.key ?? newIdempotencyKey());
  const [result, setResult] = useState<AttemptResult | null>(null);
  useEffect(() => {
    if (role !== "student" || result) return;
    if (answers.some((a) => a !== null)) saveDraft(draft, { answers, key });
  }, [answers, key, draft, role, result]);
  const canSubmit = role === "student";
  const q = lesson.questions[step];
  const answered = answers.filter((a) => a !== null).length;

  async function submit() {
    if (answers.some((a) => a === null)) return;
    // Evita duplicar puntos al reintentar.
    const response = await run((api) => api.submitAttempt(lesson.quiz_id, answers as number[], key, activityId));
    if (response) {
      clearDraft(draft);
      setResult(response);
    }
  }
  function retry() {
    setAnswers(lesson.questions.map(() => null));
    setResult(null);
    setStep(0);
    setKey(newIdempotencyKey());
  }

  return (
    <section className="quiz" id="cuestionario" aria-labelledby="quiz-title">
      <div className="quiz-head">
        <div>
          <p className="ui-eyebrow">Cuestionario · aprobación con {lesson.pass_score_pct}%</p>
          <h2 id="quiz-title">{lesson.quiz_title}</h2>
        </div>
        {!result && <span className="quiz-count">{answered}/{total} respondidas</span>}
      </div>
      {!canSubmit && <Notice>Vista de lectura: solo los estudiantes envían cuestionarios evaluados.</Notice>}

      {!result ? (
        <>
          <div className="quiz-steps" aria-hidden="true">
            {lesson.questions.map((qq, i) => (
              <button key={qq.id} tabIndex={-1} className={`${i === step ? "is-current" : ""}${answers[i] !== null ? " is-done" : ""}`} onClick={() => setStep(i)} />
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.fieldset
              key={q.id}
              className="quiz-question"
              disabled={pending || !canSubmit}
              initial={reduce ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              <legend>
                <span className="quiz-n">Pregunta {step + 1} de {total}</span>
                {q.prompt}
              </legend>
              <div className="quiz-options">
                {q.options.map((option, oi) => (
                  <label key={oi} className={`quiz-option${answers[step] === oi ? " is-chosen" : ""}`}>
                    <input
                      type="radio"
                      name={`q-${step}`}
                      aria-label={option}
                      checked={answers[step] === oi}
                      onChange={() => setAnswers((prev) => prev.map((v, i) => (i === step ? oi : v)))}
                    />
                    <span className="quiz-letter" aria-hidden>{String.fromCharCode(65 + oi)}</span>
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </motion.fieldset>
          </AnimatePresence>
          <ErrorState error={error} />
          <div className="quiz-nav">
            <button className="ui-button ui-button-quiet" onClick={() => setStep(step - 1)} disabled={step === 0}>
              <ArrowLeft size={16} aria-hidden /> Anterior
            </button>
            {step < total - 1 ? (
              <button className="ui-button ui-button-dark" onClick={() => setStep(step + 1)} disabled={answers[step] === null}>
                Siguiente <ArrowRight size={16} aria-hidden />
              </button>
            ) : (
              canSubmit && (
                <button className="ui-button ui-button-dark" onClick={submit} disabled={pending || answered < total}>
                  {pending ? "Revisando…" : "Enviar respuestas"}
                </button>
              )
            )}
          </div>
          {step === total - 1 && answered < total && canSubmit && (
            <p className="ui-small ui-muted" role="status">Responde todas las preguntas para enviar.</p>
          )}
        </>
      ) : (
        <div role="status">
          <motion.div className={`quiz-result${result.passed ? " is-passed" : ""}`} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Ring value={result.scorePct} size={112} color={result.passed ? CHART.forest : "#B38A1F"} label={`Resultado ${result.scorePct}%`}>
              <strong>{result.scorePct}%</strong>
            </Ring>
            <div>
              <p className="quiz-result-title">{result.passed ? "¡Aprobaste!" : "Casi lo logras"}</p>
              <p>
                {result.score} de {result.maxScore} correctas.{" "}
                {result.passed
                  ? result.pointsAwarded > 0
                    ? `Sumaste ${result.pointsAwarded} puntos. Total: ${result.totalPoints}.`
                    : "Ya habías recibido los puntos de esta lección; repasar también cuenta."
                  : `Necesitas ${result.passScorePct}% para aprobar. Revisa las explicaciones e inténtalo de nuevo.`}
              </p>
              {result.lessonCompleted && <p><strong>Completaste la lección.</strong></p>}
              {result.passed && activitiesPending > 0 && !result.lessonCompleted && (
                <p className="ui-small">Para completar la lección, resuelve también {activitiesPending === 1 ? "la actividad pendiente" : `las ${activitiesPending} actividades pendientes`}.</p>
              )}
              <RewardNote outcome={{ ...result, pointsAwarded: 0 }} />
              <button className="ui-button ui-button-quiet" onClick={() => { retry(); onDone?.(); }}><RefreshCw size={16} aria-hidden /> Practicar de nuevo</button>
            </div>
          </motion.div>
          <ol className="quiz-review">
            {lesson.questions.map((qq, i) => {
              const fb = result.questions[i];
              return (
                <li key={qq.id} className={fb.correct ? "is-ok" : "is-bad"}>
                  <p className="quiz-review-q">{qq.prompt}</p>
                  <p className="ui-small">
                    Tu respuesta: {fb.selected !== null ? qq.options[fb.selected] : "—"}
                    {fb.correctOption !== null && !fb.correct && <> · Correcta: {qq.options[fb.correctOption]}</>}
                  </p>
                  <p className="ui-small"><strong>{fb.correct ? "Correcto." : "Por repasar."}</strong> {fb.explanation}</p>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}

type ChallengeTab = "active" | "upcoming" | "done";

// 11. StudentChallenges
function StudentChallenges() {
  const { base } = usePanel();
  const { data, error, loading, reload } = useData((api) => api.studentChallenges());
  const lessons = useData((api) => api.lessons());
  const [tab, setTab] = useState<ChallengeTab>("active");
  const list = data ?? [];
  const groups: Record<ChallengeTab, Challenge[]> = {
    active: list.filter((c) => c.state === "active" && !c.completed),
    upcoming: list.filter((c) => c.state === "upcoming"),
    done: list.filter((c) => c.completed || c.state === "ended"),
  };
  const featured = groups.active[0];
  void lessons;
  const reward = (c: Challenge) => (c.completed ? `Obtuviste ${c.reward ?? 0} puntos` : `${c.reward ?? 0} puntos al cumplirlo`);
  const objective = (c: Challenge) =>
    c.lesson_title ? `${c.kind === "quiz" ? "Aprobar el cuestionario de" : "Completar"} «${c.lesson_title}»`
      : c.kind === "group_participation" ? `Que participe al menos el ${c.goal_count} % ${c.institutional ? "de la escuela" : "del grupo"}`
        : `${c.goal_count} ${c.progress?.unit || c.kindLabel.toLowerCase()}`;
  return (
    <>
      <PageHeader title="Retos" description="Cumple la meta antes de la fecha final. El avance se calcula con tus actividades registradas." />
      {loading && !data && <Skeleton lines={5} block />}
      <ErrorState error={error} onRetry={reload} />
      {featured && (
        <section className="challenge-hero" aria-label="Reto destacado">
          <div>
            <p className="ui-eyebrow">Reto destacado · {featured.institutional ? "Toda la escuela" : "Tu grupo"}</p>
            <h2>{featured.title}</h2>
            {featured.description && <p className="challenge-hero-text">{featured.description}</p>}
            <dl className="challenge-facts">
              <div><dt>Objetivo</dt><dd>{objective(featured)}</dd></div>
              <div><dt>Finaliza</dt><dd>{formatDate(featured.ends_on)} · {Math.max(0, daysLeft(featured.ends_on))} días</dd></div>
              <div><dt>Recompensa</dt><dd>{reward(featured)}</dd></div>
              <div><dt>Verificación</dt><dd>{featured.verification}</dd></div>
            </dl>
            <ChallengeMeter progress={featured.progress} completed={featured.completed} />
          </div>
          <div className="challenge-hero-side">
            <Ring value={timeProgress(featured)} size={120} color={CHART.lime} track="#26302a" label="Tiempo transcurrido del reto">
              <strong>{Math.max(0, daysLeft(featured.ends_on))}</strong>
              <small>días</small>
            </Ring>
            {featured.lesson_slug && (
              <Link className="ui-button ui-button-lime" href={`${base}/aprender/${featured.lesson_slug}`}>Ir a la lección <ArrowRight size={16} aria-hidden /></Link>
            )}
          </div>
        </section>
      )}
      {data && (
        <Tabs
          label="Estado de los retos"
          value={tab}
          onChange={setTab}
          options={[
            { value: "active", label: "Activos", count: groups.active.length },
            { value: "upcoming", label: "Próximos", count: groups.upcoming.length },
            { value: "done", label: "Completados y finalizados", count: groups.done.length },
          ]}
        />
      )}
      {data && groups[tab].length === 0 && <EmptyState title="No hay retos en este estado." />}
      <div className="card-grid">
        {groups[tab].map((c) => (
          <article key={c.id} className="challenge-card">
            <div className="challenge-card-top">
              {c.completed ? <Chip tone="ok">Logrado</Chip> : <Chip tone={c.state === "active" ? "lime" : "muted"}>{c.state === "active" ? "En curso" : c.state === "upcoming" ? "Próximo" : "Finalizado"}</Chip>}
              <span className="ui-small ui-muted">{c.kindLabel} · {c.institutional ? "Toda la escuela" : "Tu grupo"}</span>
            </div>
            <h3>{c.title}</h3>
            <p className="ui-small">Objetivo: {objective(c)}</p>
            {c.state !== "upcoming" && <ChallengeMeter progress={c.progress} completed={c.completed} />}
            <p className="ui-small ui-muted">{formatDate(c.starts_on)} – {formatDate(c.ends_on)} · {reward(c)}</p>
            {c.lesson_slug && c.state === "active" && !c.completed && (
              <Link className="see-all" href={`${base}/aprender/${c.lesson_slug}`}>Ir a la lección <ArrowRight size={15} aria-hidden /></Link>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

// 12. StudentRanking
function StudentRanking() {
  const [period, setPeriod] = useState<RankingPeriod>("week");
  const [scope, setScope] = useState<"group" | "institution">("group");
  const { data, error, loading, reload } = useData((api) => api.studentRanking(period, scope), [period, scope]);
  const shortDate = (v: string) => new Intl.DateTimeFormat("es-SV", { day: "numeric", month: "short" }).format(new Date(`${v}T12:00:00`));
  const periodLabel = { week: "esta semana", month: "este mes", all: "en total" }[period];
  const effort = data?.effort;
  return (
    <>
      <PageHeader title="Ranking" description="Lo más importante es tu propio avance. Las clasificaciones son privadas de tu institución." />
      <div className="ranking-controls">
        <Tabs label="Periodo" value={period} onChange={setPeriod}
          options={[{ value: "week", label: "Semana" }, { value: "month", label: "Mes" }, { value: "all", label: "Acumulado" }]} />
        {data?.rankingScope === "institution" && (
          <Tabs label="Alcance" value={scope} onChange={setScope} options={[{ value: "group", label: "Mi grupo" }, { value: "institution", label: "Institución" }]} />
        )}
      </div>
      {loading && !data && <Skeleton lines={5} block />}
      <ErrorState error={error} onRetry={reload} />
      {data && !data.group && <EmptyState title="Aún no perteneces a un grupo." />}
      {data?.group && (
        <>
          <Bento>
            <Tile span={5} tone="dark" label="Tu avance" className="tile-rank">
              <p className="kpi-label">Tus puntos {periodLabel}</p>
              <p className="kpi-value"><AnimatedNumber value={data.myPoints ?? 0} /></p>
              {data.visibility !== "off" && data.position && (
                <p className="tile-note">Posición {data.position} de {data.participants} {scope === "group" ? "en tu grupo" : "en la institución"}</p>
              )}
              {effort && (
                <p className="tile-note">
                  {effort.thisWeek > effort.lastWeek ? `¡Más actividad que la semana pasada! (${effort.thisWeek} frente a ${effort.lastWeek})`
                    : effort.thisWeek > 0 ? `Llevas ${effort.thisWeek} actividades de aprendizaje esta semana.`
                      : "Esta semana es buen momento para una lección corta."}
                </p>
              )}
            </Tile>
            <Tile span={7} title="Tu evolución" label="Puntos y actividades por semana">
              <LineChart caption="Tus puntos y actividades de aprendizaje por semana (últimas 8 semanas)" labels={data.evolution.map((e) => e.week)}
                formatLabel={shortDate} height={170}
                series={[{ name: "Puntos", values: data.evolution.map((e) => e.points), color: CHART.forest },
                { name: "Actividades", values: data.evolution.map((e) => e.activities), color: CHART.limeDeep }]} />
            </Tile>
          </Bento>
          {data.visibility === "off" && <Notice title="Clasificaciones desactivadas">Tu institución decidió no mostrar posiciones individuales. Sigue tu propio avance y el de los grupos.</Notice>}
          {data.visibility === "private" && <Notice title="Ranking privado">Tu docente mantiene ocultos los nombres. Solo ves tu propio avance.</Notice>}
          {data.visibility === "visible" && data.entries.length > 0 && (
            <section className="ui-section">
              <div className="ui-section-head"><h2>{scope === "group" ? "Tu grupo" : "Los 10 primeros de la institución"}</h2></div>
              <DataTable
                caption={`Ranking ${scope === "group" ? "del grupo" : "institucional"} ${periodLabel}`}
                rows={data.entries}
                rowKey={(e) => String(e.position)}
                pageSize={10}
                rowClass={(e) => (e.isMe ? "is-me" : undefined)}
                columns={[
                  { key: "rank", header: "#", render: (e) => <span className="rank-n">{e.position}</span> },
                  { key: "name", header: "Estudiante", primary: true, render: (e) => <>{e.displayName}{e.isMe && <Chip tone="lime">Tú</Chip>}</> },
                  ...(scope === "institution" ? [{ key: "group", header: "Grupo", render: (e: (typeof data.entries)[number]) => e.groupName }] : []),
                  { key: "points", header: "Puntos", align: "right" as const, render: (e) => e.points },
                ]}
              />
              {scope === "institution" && !data.entries.some((e) => e.isMe) && (
                <p className="ui-small ui-muted">Solo se listan los 10 primeros. Tu avance personal está arriba.</p>
              )}
            </section>
          )}
          <section className="ui-section">
            <div className="ui-section-head"><h2>Grupos de la institución</h2></div>
            <BarChart caption={`Promedio de puntos por estudiante ${periodLabel}, por grupo`} height={190} unit=" pts"
              labels={data.groupComparison.map((g) => `${g.grade} ${g.name}${g.isMine ? " (tu grupo)" : ""}`)}
              series={[{ name: "Promedio de puntos", values: data.groupComparison.map((g) => g.avgPoints), color: CHART.forest }]} />
            <p className="ui-small ui-muted">Comparar grupos invita a colaborar: el promedio no muestra a ningún estudiante.</p>
          </section>
        </>
      )}
    </>
  );
}

// 13. StudentProgress
function StudentProgress() {
  const { base } = usePanel();
  const { data, error, loading, reload } = useData((api) => api.studentProgress());
  if (loading && !data) return <Skeleton lines={8} block />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;
  const chrono = [...data.history].reverse().slice(-20);
  let acc = 0;
  const pointsLine = [...data.ledger].reverse().map((p) => ({ label: p.created_at, value: (acc += p.delta) }));
  const byMaterial = MATERIAL_ORDER.map((m) => data.lessons.find((l) => l.material === m)).filter((l): l is LessonSummary => !!l);
  const completed = data.lessons.filter((l) => l.progress_status === "completed").length;
  const earned = data.achievements.filter((a) => a.awarded_at).length;
  const shortDate = (v: string) => new Intl.DateTimeFormat("es-SV", { day: "numeric", month: "short" }).format(new Date(v));
  return (
    <>
      <PageHeader title="Mi progreso" />
      <div className="kpis">
        <div className="kpi"><p className="kpi-label">Puntos</p><p className="kpi-value"><AnimatedNumber value={data.points} /></p></div>
        <div className="kpi"><p className="kpi-label">Nivel</p><p className="kpi-value">{data.level.number}<small> {data.level.name}</small></p></div>
        <div className="kpi"><p className="kpi-label">Lecciones</p><p className="kpi-value">{completed}<small>/{data.lessons.length}</small></p></div>
        <div className="kpi"><p className="kpi-label">Logros</p><p className="kpi-value">{earned}<small>/{data.achievements.length}</small></p></div>
      </div>
      <Bento>
        <Tile span={8} title="Evolución del aprendizaje">
          <LineChart
            caption="Resultado de cada cuestionario en orden cronológico"
            labels={chrono.map((a) => a.created_at)}
            formatLabel={shortDate}
            series={[{ name: "Resultado", values: chrono.map((a) => pct(a.score, a.max_score)), color: CHART.forest }]}
            unit="%"
            max={100}
          />
        </Tile>
        <Tile span={4} title="Tu nivel">
          <LevelPanel level={data.level} compact />
        </Tile>
        <Tile span={6} title="Puntos acumulados">
          <LineChart
            caption="Puntos acumulados en el tiempo"
            labels={pointsLine.map((p) => p.label)}
            formatLabel={shortDate}
            series={[{ name: "Puntos", values: pointsLine.map((p) => p.value), color: CHART.limeDeep }]}
            unit=" pts"
            height={200}
          />
        </Tile>
        <Tile span={6} title="Resultados por material">
          <BarChart
            caption="Mejor resultado por material"
            labels={byMaterial.map((l) => l.material_name)}
            series={[{ name: "Mejor resultado", values: byMaterial.map((l) => l.best_score_pct), color: CHART.forest }]}
            unit="%"
            max={100}
            height={200}
          />
        </Tile>
        <Tile span={12} title="Lecciones completadas" action={<SeeAll href={`${base}/aprender`}>Ir a Aprender</SeeAll>}>
          <ul className="mat-grid">
            {byMaterial.map((l) => (
              <li key={l.slug} className={l.progress_status === "completed" ? "is-done" : undefined}>
                <Link href={`${base}/aprender/${l.slug}`}>
                  <MaterialImage material={l.material} className="mat-grid-img" />
                  <span><strong>{l.material_name}</strong><small>{l.progress_status === "completed" ? "Completada" : l.progress_status === "started" ? "En curso" : "Sin empezar"}</small></span>
                </Link>
              </li>
            ))}
          </ul>
        </Tile>
      </Bento>
      <section className="ui-section" id="logros">
        <div className="ui-section-head"><h2>Logros</h2><span className="ui-small ui-muted">{earned} de {data.achievements.length}</span></div>
        <AchievementList achievements={data.achievements} />
      </section>
      <section className="ui-section">
        <div className="ui-section-head"><h2>Niveles</h2></div>
        <LevelPath levels={data.levels} current={data.level.number} />
      </section>
      <section className="ui-section">
        <div className="ui-section-head"><h2>Historial de puntos</h2></div>
        <DataTable
          caption="Historial de puntos"
          rows={data.ledger.map((t, i) => ({ ...t, key: `${t.created_at}-${i}` }))}
          rowKey={(t) => t.key}
          pageSize={6}
          empty="Todavía no tienes puntos."
          columns={[
            { key: "reason", header: "Motivo", primary: true, render: (t) => <>{t.reason}{t.validation === "teacher_verified" && <Chip tone="ok">Verificado</Chip>}</> },
            { key: "delta", header: "Puntos", align: "right", render: (t) => `+${t.delta}`, sortValue: (t) => t.delta },
            { key: "date", header: "Fecha", render: (t) => formatDateTime(t.created_at), sortValue: (t) => t.created_at },
          ]}
        />
      </section>
      <section className="ui-section">
        <div className="ui-section-head"><h2>Historial de cuestionarios</h2></div>
        <DataTable
          caption="Historial de cuestionarios"
          rows={data.history}
          rowKey={(a) => a.id}
          pageSize={5}
          empty="Todavía no respondes cuestionarios."
          columns={[
            { key: "lesson", header: "Lección", primary: true, render: (a) => a.lesson_title, sortValue: (a) => a.lesson_title },
            { key: "score", header: "Resultado", align: "right", render: (a) => <span className={`score-pill${a.passed ? " is-ok" : ""}`}>{pct(a.score, a.max_score)}%</span>, sortValue: (a) => a.score / a.max_score },
            { key: "date", header: "Fecha", render: (a) => formatDateTime(a.created_at), sortValue: (a) => a.created_at },
          ]}
        />
      </section>
    </>
  );
}
