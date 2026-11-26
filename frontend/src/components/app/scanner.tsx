"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Check, ImageUp, RefreshCw, RotateCcw, ScanLine, X } from "lucide-react";
import type { ApiError } from "@/lib/api/client";
import type { LessonDetail, MaterialId, ScanAnswerResult, VisionResult } from "@/lib/api/types";
import { useAction, useData, usePanel } from "./api-context";
import { loadVision, visionLoaded } from "@/lib/vision/engine";
import { RewardNote } from "./gamification";
import { Bento, Chip, ErrorState, Field, MaterialImage, Notice, PageHeader, Progress, Tile } from "./ui";

type CameraState = "idle" | "requesting" | "live" | "denied" | "unsupported" | "error";
type Shot = { blob: Blob; url: string; source: "camera" | "upload" };
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
// El modelo trabaja a 224 px: enviar más de 640 px solo gasta datos y batería.
const SEND_SIDE = 640;
const MATERIAL_IDS = ["plastic", "paper", "cardboard", "metal", "glass", "organic"];

/** Reduce la foto y la recodifica como JPEG. También elimina los metadatos EXIF (ubicación, dispositivo). */
// 01. compress
async function compress(source: CanvasImageSource & { width: number; height: number }): Promise<Blob | null> {
  const scale = Math.min(1, SEND_SIDE / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
}

// 02. Scanner
export function Scanner() {
  const { base } = usePanel();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<CameraState>("idle");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [shot, setShot] = useState<Shot | null>(null);
  const [fileError, setFileError] = useState("");
  const [result, setResult] = useState<VisionResult | null>(null);
  const { run, pending, error } = useAction();
  const status = useData((api) => api.visionStatus());
  // Carga el modelo al abrir el escáner.
  const [model, setModel] = useState<"idle" | "runtime" | "model" | "ready" | "error">(visionLoaded() ? "ready" : "idle");
  const modelReady = status.data?.status === "ready";
  useEffect(() => {
    if (!modelReady) return;
    let active = true;
    loadVision((step) => active && setModel(step)).then(() => active && setModel("ready")).catch(() => active && setModel("error"));
    return () => { active = false; };
  }, [modelReady]);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);
  useEffect(() => stop, [stop]);
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  async function start(id?: string) {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera("unsupported");
      return;
    }
    stop();
    setCamera("requesting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: id ? { deviceId: { exact: id } } : { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      stream.current = media;
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play().catch(() => undefined);
      }
      const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
      setDevices(list);
      setDeviceId(media.getVideoTracks()[0]?.getSettings().deviceId ?? id ?? "");
      setCamera("live");
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setCamera(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error");
    }
  }

  function reset() {
    setShot(null);
    setResult(null);
    setFileError("");
  }

  async function analyze(next: Shot) {
    setShot(next);
    setResult(null);
    const response = await run((api) => api.classify(next.blob, next.source));
    if (response) {
      setResult(response);
      // Muestra el resultado en pantallas pequeñas sin cambiar el foco.
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    }
  }

  async function capture() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const blob = await compress(Object.assign(v, { width: v.videoWidth, height: v.videoHeight }));
    stop();
    setCamera("idle");
    if (blob) analyze({ blob, url: URL.createObjectURL(blob), source: "camera" });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!TYPES.includes(file.type)) return setFileError("Usa una imagen JPG, PNG o WebP.");
    if (file.size > MAX_BYTES) return setFileError("La imagen supera 5 MB. Elige una más liviana.");
    setFileError("");
    stop();
    setCamera("idle");
    let blob: Blob | null = file;
    try {
      const bitmap = await createImageBitmap(file);
      blob = await compress(bitmap);
      bitmap.close();
    } catch {
      blob = file; // si el navegador no puede reducirla, se envía tal cual (el servidor la valida)
    }
    if (blob) analyze({ blob, url: URL.createObjectURL(blob), source: "upload" });
  }

  const ready = status.data?.status === "ready";
  const unsupported = status.data?.unsupportedCategories ?? [];
  const identified = result?.status === "identified" ? result : null;

  return (
    <>
      <PageHeader
        eyebrow="SortlyScan Vision"
        title="Escanear un residuo"
        actions={status.data ? (
          ready ? <Chip tone="ok">Modelo {status.data.modelVersion}</Chip> : <Chip tone="warn">Reconocimiento no disponible</Chip>
        ) : null}
      />
      {ready && model !== "ready" && (
        <p className="scan-status" role="status">
          {model === "error"
            ? "No se pudo descargar el modelo de reconocimiento. Revisa tu conexión: se volverá a intentar al analizar una foto."
            : model === "model" ? "Descargando y verificando el modelo de reconocimiento (unos 6 MB, solo la primera vez)…"
              : "Preparando el reconocimiento en este navegador…"}
        </p>
      )}
      {status.data && !ready && (
        <p className="scan-status" role="status">
          {status.data.message} No mostraremos un resultado inventado: puedes practicar la clasificación manual más abajo.
        </p>
      )}

      <Bento className="ui-scan-bento">
        <Tile span={7} label="Cámara" className="ui-scan-stage">
          <div className="ui-viewfinder" data-state={shot ? "image" : camera} data-busy={pending || undefined}>
            {/* Vista previa local. La foto se reduce y se analiza en este navegador; no se envía ni se guarda. */}
            <video ref={video} playsInline muted aria-label="Vista previa de la cámara" hidden={camera !== "live" || !!shot} />
            {shot && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shot.url} alt="Foto enviada para analizar" />
            )}
            {!shot && camera !== "live" && (
              <div className="ui-viewfinder-empty">
                <ScanLine size={30} aria-hidden />
                {camera === "requesting" && <p>Solicitando permiso de cámara…</p>}
                {camera === "idle" && <p>Coloca un solo residuo sobre una superficie clara y activa la cámara, o sube una foto.</p>}
                {camera === "denied" && <p>No se concedió el permiso de cámara. Puedes permitirlo en la configuración del navegador o subir una foto.</p>}
                {camera === "unsupported" && <p>Este navegador no permite usar la cámara aquí. Sube una foto.</p>}
                {camera === "error" && <p>No se pudo iniciar la cámara. Revisa que no esté en uso por otra aplicación.</p>}
              </div>
            )}
            <div className="ui-scan-frame" aria-hidden><span /><span /><span /><span /></div>
            {pending && (
              <div className="ui-scan-busy" role="status">
                <RefreshCw size={18} className="ui-spin" aria-hidden /> Analizando la foto…
              </div>
            )}
          </div>

          <div className="ui-scan-controls">
            {camera === "live" ? (
              <>
                <button className="ui-button ui-button-lime ui-shutter" onClick={capture} disabled={!ready}>
                  <Camera size={18} aria-hidden /> Capturar y analizar
                </button>
                {devices.length > 1 && (
                  <Field label="Cámara">
                    <select value={deviceId} onChange={(e) => { setDeviceId(e.target.value); start(e.target.value); }}>
                      {devices.map((d, i) => (
                        <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Cámara ${i + 1}`}</option>
                      ))}
                    </select>
                  </Field>
                )}
                <button className="ui-button ui-button-quiet" onClick={() => { stop(); setCamera("idle"); }}>
                  <CameraOff size={17} aria-hidden /> Apagar
                </button>
              </>
            ) : (
              <button className="ui-button ui-button-dark" disabled={!ready || pending}
                onClick={() => { reset(); start(deviceId || undefined); }}>
                <Camera size={18} aria-hidden /> {shot ? "Tomar otra foto" : "Activar cámara"}
              </button>
            )}
            <label className={`ui-button ui-button-quiet ui-file${!ready || pending ? " is-disabled" : ""}`}>
              <ImageUp size={18} aria-hidden /> Subir foto
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} disabled={!ready || pending} />
            </label>
          </div>
          {fileError && <p className="ui-field-error" role="alert">{fileError}</p>}
          <p className="ui-small ui-muted">La foto se analiza dentro de este navegador con el modelo real y se descarta: no se envía a ningún servidor ni se guarda.</p>
        </Tile>

        <Tile span={5} tone={identified ? "plain" : "sage"} className="ui-scan-result" label="Resultado">
          <div ref={resultRef} aria-live="polite" className="ui-scan-result-body">
            <ResultPanel result={result} pending={pending} error={error} unsupported={unsupported.map((c) => c.label)}
              lessonHref={(slug) => `${base}/aprender/${slug}`} onRetry={() => { reset(); if (ready) start(deviceId || undefined); }} />
          </div>
        </Tile>

        {identified?.education && <Education result={identified} lessonHref={(slug) => `${base}/aprender/${slug}`} />}

        <ManualPractice />
      </Bento>
    </>
  );
}

// 03. ResultPanel
function ResultPanel({ result, pending, error, unsupported, lessonHref, onRetry }: {
  result: VisionResult | null; pending: boolean; error: ApiError | null; unsupported: string[];
  lessonHref: (slug: string) => string; onRetry: () => void;
}) {
  if (pending) return <p className="ui-muted">Analizando la foto con el modelo…</p>;
  if (error) return <ErrorState error={error} />;
  if (!result) {
    return (
      <>
        <h2 className="ui-scan-result-title">Para una buena foto</h2>
        <ol className="ui-scan-tips">
          <li>Un solo residuo, centrado dentro del marco.</li>
          <li>Fondo claro y liso, con buena luz.</li>
          <li>Muestra etiquetas o símbolos si los tiene.</li>
          <li>No fotografíes personas ni datos personales.</li>
        </ol>
        {unsupported.length > 0 && (
          <p className="ui-small ui-muted">Este modelo todavía no reconoce: {unsupported.join(", ")}.</p>
        )}
        <p className="ui-small ui-muted">Identificar un residuo no significa que se haya reciclado y no suma puntos.</p>
      </>
    );
  }
  if (result.status === "unavailable") {
    return (
      <Notice tone="warn" title="Sin resultado automático">
        <p>{result.message} La foto se descartó.</p>
      </Notice>
    );
  }
  const pctOf = (v?: number) => Math.round((v ?? 0) * 100);
  if (result.status === "unknown") {
    return (
      <>
        <p className="ui-eyebrow">Resultado incierto</p>
        <h2 className="ui-scan-result-title">No pudimos identificarlo con seguridad</h2>
        <p>{result.retry}</p>
        {result.reason !== "too_dark" && result.reason !== "low_detail" && !!result.alternatives?.length && (
          <p className="ui-small ui-muted">
            Lo más parecido: {result.alternatives.map((a) => `${a.label} (${pctOf(a.confidence)} %)`).join(" o ")}. No es suficiente para darlo por correcto.
          </p>
        )}
        {unsupported.length > 0 && (
          <p className="ui-small ui-muted">Si es {unsupported.join(" o ").toLowerCase()}, este modelo aún no lo reconoce: usa la práctica manual.</p>
        )}
        <div className="ui-scan-actions">
          <button className="ui-button ui-button-dark" onClick={onRetry}><RotateCcw size={17} aria-hidden /> Repetir la foto</button>
        </div>
        <Meta result={result} />
      </>
    );
  }
  const category = result.category as string;
  const edu = result.education;
  return (
    <>
      <div className="ui-scan-hit">
        {MATERIAL_IDS.includes(category) && <MaterialImage material={category as MaterialId} className="ui-scan-hit-img" />}
        <div>
          <p className="ui-eyebrow">Material identificado</p>
          <h2 className="ui-scan-result-title">{result.label}</h2>
        </div>
      </div>
      <div className="ui-scan-confidence">
        <div className="ui-row-between"><span className="ui-small">Confianza del modelo</span><strong>{pctOf(result.confidence)} %</strong></div>
        <Progress value={pctOf(result.confidence)} label="Confianza del modelo" tone="forest" />
        <p className="ui-small ui-muted">Es una estimación del modelo, no una certeza. Si no coincide con lo que ves, repite la foto.</p>
      </div>
      {edu?.summary && <p>{edu.summary}</p>}
      {edu?.institutionRule && <InstitutionRule rule={edu.institutionRule} />}
      {!!result.alternatives?.length && (
        <p className="ui-small ui-muted">También se parece a: {result.alternatives.map((a) => `${a.label} (${pctOf(a.confidence)} %)`).join(", ")}.</p>
      )}
      <div className="ui-scan-actions">
        <button className="ui-button ui-button-quiet" onClick={onRetry}><RotateCcw size={17} aria-hidden /> Escanear otro</button>
        {edu?.lessonSlug && <Link className="ui-button ui-button-dark" href={lessonHref(edu.lessonSlug)}>Ver la lección</Link>}
      </div>
      <Meta result={result} />
    </>
  );
}

// 04. Meta
function Meta({ result }: { result: VisionResult }) {
  return (
    <p className="ui-scan-meta">
      Modelo {result.modelVersion} · {Math.round(result.processingMs ?? 0)} ms
      {" · analizado en este navegador"}{result.scan?.recorded ? " · registrado sin la foto" : ""}
    </p>
  );
}

// 05. InstitutionRule
function InstitutionRule({ rule }: { rule: NonNullable<NonNullable<VisionResult["education"]>["institutionRule"]> }) {
  if (rule.accepted === null && !rule.place && !rule.notes) return null;
  return (
    <div className="ui-scan-rule">
      <p className="ui-eyebrow">En tu institución</p>
      <p>
        {rule.accepted === true && "Se recibe"}
        {rule.accepted === false && "No se recibe en el punto de acopio"}
        {rule.accepted === true && rule.place ? `: ${rule.place}.` : rule.accepted !== null ? "." : rule.place}
      </p>
      {rule.notes && <p className="ui-small ui-muted">{rule.notes}</p>}
    </div>
  );
}

// 06. Education
function Education({ result, lessonHref }: { result: VisionResult; lessonHref: (slug: string) => string }) {
  const edu = result.education!;
  const sections: [string, string[]][] = [
    ["Cómo reconocerlo", edu.recognize],
    ["Cómo prepararlo", edu.prepare],
    ["Errores frecuentes", edu.mistakes],
    ["Recomendaciones", edu.tips],
  ];
  return (
    <Tile span={12} title={`Aprende sobre ${result.label?.toLowerCase()}`} className="ui-scan-learn">
      <div className="ui-scan-learn-grid">
        <div className="ui-scan-learn-main">
          {edu.what && <p>{edu.what}</p>}
          {edu.recyclable && (
            <p><strong>¿Se recicla?</strong> {edu.recyclable} Consulta siempre lo que recibe tu centro de acopio.</p>
          )}
          <div className="ui-scan-learn-cols">
            {sections.filter(([, items]) => items?.length).map(([title, items]) => (
              <section key={title}>
                <h3>{title}</h3>
                <ul>{items.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul>
              </section>
            ))}
          </div>
          {edu.lessonSlug && (
            <Link className="ui-link" href={lessonHref(edu.lessonSlug)}>Abrir la lección completa{edu.lessonTitle ? `: ${edu.lessonTitle}` : ""}</Link>
          )}
        </div>
        {edu.question && <QuickQuestion key={edu.question.id + (result.scan?.id ?? "")} question={edu.question} scanId={result.scan?.recorded ? result.scan.id : undefined} />}
      </div>
    </Tile>
  );
}

/** Pregunta educativa tras un escaneo. Una respuesta por escaneo; los puntos siguen las reglas de la plataforma. */
// 07. QuickQuestion
function QuickQuestion({ question, scanId }: { question: NonNullable<NonNullable<VisionResult["education"]>["question"]>; scanId?: string }) {
  const { role } = usePanel();
  const { run, pending, error } = useAction();
  const [choice, setChoice] = useState<number | null>(null);
  const [result, setResult] = useState<ScanAnswerResult | null>(null);
  const graded = role === "student" && !!scanId;
  async function answer(i: number) {
    setChoice(i);
    const response = await run((api) => (graded ? api.answerScan(scanId!, question.id, i) : api.practiceScanQuestion(question.id, i)));
    if (response) setResult(response);
  }
  return (
    <fieldset className="ui-quick-q" disabled={pending || !!result}>
      <legend className="ui-eyebrow">Pregunta rápida{graded ? "" : " · práctica"}</legend>
      <p className="ui-quick-q-prompt">{question.prompt}</p>
      <div className="ui-quick-q-options">
        {question.options.map((option, i) => {
          const state = !result ? "" : i === result.correctOption ? "is-correct" : i === choice ? "is-wrong" : "";
          return (
            <button key={option} type="button" className={`ui-quick-q-option ${state}`} aria-pressed={choice === i} onClick={() => answer(i)}>
              {state === "is-correct" && <Check size={16} aria-hidden />}
              {state === "is-wrong" && <X size={16} aria-hidden />}
              {option}
            </button>
          );
        })}
      </div>
      <ErrorState error={error} />
      {result && (
        <div role="status">
          <p className="ui-small"><strong>{result.correct ? "¡Correcto! " : "Casi. "}</strong>{result.explanation}</p>
          {result.limited && <p className="ui-small ui-muted">Ya sumaste los puntos de preguntas de escaneo de hoy. Seguir aprendiendo también cuenta.</p>}
          {result.correct && !result.pointsAwarded && !result.limited && <p className="ui-small ui-muted">Sin puntos esta vez.</p>}
          <RewardNote outcome={result} />
        </div>
      )}
      {!result && <p className="ui-small ui-muted">{graded ? "Una respuesta correcta suma puntos (máximo 3 por día). La foto no suma puntos." : "Práctica: no se registra ni suma puntos."}</p>}
    </fieldset>
  );
}

// 08. ManualPractice
function ManualPractice() {
  const { base } = usePanel();
  const lessons = useData((api) => api.lessons());
  const [practice, setPractice] = useState("");
  const [guide, setGuide] = useState<LessonDetail | null>(null);
  const guideAction = useAction();

  async function choose(slug: string) {
    setPractice(slug);
    setGuide(null);
    if (!slug) return;
    const detail = await guideAction.run((api) => api.lesson(slug));
    if (detail) setGuide(detail);
  }

  return (
    <Tile span={12} title="Práctica de clasificación manual" className="ui-practice-tile">
      <p className="ui-muted ui-small">
        Tú eliges el material y revisas cómo prepararlo. Funciona sin reconocimiento automático, no se califica ni suma puntos.
      </p>
      <div className="ui-practice">
        <Field label="¿De qué material crees que es?">
          <select value={practice} onChange={(e) => choose(e.target.value)}>
            <option value="">Elige un material</option>
            {lessons.data?.map((l) => <option key={l.slug} value={l.slug}>{l.material_name}</option>)}
          </select>
        </Field>
        {guideAction.pending && <p className="ui-muted">Cargando guía…</p>}
        {guide && (
          <div className="ui-practice-guide">
            <p className="ui-eyebrow">Clasificación manual · {guide.material_name}</p>
            <ol>{guide.content.classify.map((step) => <li key={step}>{step}</li>)}</ol>
            <p className="ui-small"><strong>Evita:</strong> {guide.content.mistakes[0]}</p>
            <Link className="ui-link" href={`${base}/aprender/${guide.slug}`}>Abrir la lección completa</Link>
          </div>
        )}
      </div>
    </Tile>
  );
}
