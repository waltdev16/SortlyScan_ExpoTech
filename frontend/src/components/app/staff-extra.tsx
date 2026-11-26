"use client";
// Estadísticas, actividades y reportes del personal.
import { useMemo, useState } from "react";
import { Check, Download, FileSpreadsheet, FileText, Info, Plus } from "lucide-react";
import type {
  AnalyticsOverview, EnvironmentalAction, EnvironmentalRecord, EnvironmentalRecordInput, MetricDef, RecordKind, ReportFormat,
  ReportKind, StatsFilters,
} from "@/lib/api/types";
import { useAction, useData, usePanel } from "./api-context";
import { BarChart, CHART, LineChart } from "./charts";
import { InfoTip, SidePanel } from "./overlay";
import { DataTable, Tabs } from "./table";
import { BarList, Chip, downloadBlob, EmptyState, ErrorState, Field, formatDate, formatDateTime, Notice, PageHeader, Skeleton, today } from "./ui";

const MATERIALS: [string, string][] = [["plastic", "Plástico"], ["paper", "Papel"], ["cardboard", "Cartón"], ["metal", "Metal"],
["glass", "Vidrio"], ["organic", "Orgánico"], ["other", "Otros residuos"]];
const MATERIAL_NAME = Object.fromEntries(MATERIALS) as Record<string, string>;
const UNIT = { kg: "kg", items: "objetos" } as const;
const shortWeek = (w: string) => new Intl.DateTimeFormat("es-SV", { day: "numeric", month: "short" }).format(new Date(`${w}T12:00:00`));
const fmt = (v: number | null | undefined, suffix = "") => (v === null || v === undefined ? "—" : `${v.toLocaleString("es-SV")}${suffix}`);

/* Filtros */
type Preset = "30" | "90" | "365" | "custom";

// 01. useStatsFilters
export function useStatsFilters() {
  const [preset, setPreset] = useState<Preset>("90");
  const [custom, setCustom] = useState({ start: today(-89), end: today() });
  const [group, setGroup] = useState("");
  const [material, setMaterial] = useState("");
  const filters: StatsFilters = useMemo(() => {
    const range = preset === "custom" ? custom : { start: today(-(Number(preset) - 1)), end: today() };
    return { ...range, group: group || undefined, material: material || undefined };
  }, [preset, custom, group, material]);
  return { filters, preset, setPreset, custom, setCustom, group, setGroup, material, setMaterial };
}

// 02. StatsFilterBar
export function StatsFilterBar({ state, showMaterial = true }: { state: ReturnType<typeof useStatsFilters>; showMaterial?: boolean }) {
  const groups = useData((api) => api.groups());
  return (
    <div className="filter-bar" role="group" aria-label="Filtros de las estadísticas">
      <Field label="Periodo">
        <select value={state.preset} onChange={(e) => state.setPreset(e.target.value as Preset)}>
          <option value="30">Últimos 30 días</option>
          <option value="90">Últimos 90 días</option>
          <option value="365">Último año</option>
          <option value="custom">Personalizado</option>
        </select>
      </Field>
      {state.preset === "custom" && (
        <>
          <Field label="Desde"><input type="date" value={state.custom.start} max={state.custom.end} onChange={(e) => state.setCustom({ ...state.custom, start: e.target.value })} /></Field>
          <Field label="Hasta"><input type="date" value={state.custom.end} min={state.custom.start} max={today()} onChange={(e) => state.setCustom({ ...state.custom, end: e.target.value })} /></Field>
        </>
      )}
      <Field label="Grupo">
        <select value={state.group} onChange={(e) => state.setGroup(e.target.value)}>
          <option value="">Todos {groups.data && `(${groups.data.filter((g) => g.status === "active").length})`}</option>
          {groups.data?.filter((g) => g.status === "active").map((g) => <option key={g.id} value={g.id}>{g.grade} · {g.name}</option>)}
        </select>
      </Field>
      {showMaterial && (
        <Field label="Material">
          <select value={state.material} onChange={(e) => state.setMaterial(e.target.value)}>
            <option value="">Todos</option>
            {MATERIALS.slice(0, 6).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
      )}
    </div>
  );
}

// 03. Kpi
function Kpi({ def, value, hint }: { def?: MetricDef; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="kpi">
      <p className="kpi-label">
        {def?.label}
        {def && <InfoTip iconOnly label={`Cómo se calcula: ${def.label}`}><strong>{def.label}.</strong> {def.formula} <em>Fuente: {def.source}.</em></InfoTip>}
      </p>
      <p className="kpi-value">{value}</p>
      {hint && <p className="kpi-hint">{hint}</p>}
    </div>
  );
}

/* Panel de estadísticas */
type AnalyticsTab = "learning" | "participation" | "assessment";

const TAB_LABELS: Record<AnalyticsTab, string> = { learning: "Aprendizaje", participation: "Participación", assessment: "Evaluaciones" };

// 04. AnalyticsPanel
export function AnalyticsPanel({ tabs = ["learning", "participation", "assessment"] }: { tabs?: AnalyticsTab[] }) {
  const state = useStatsFilters();
  const [tab, setTab] = useState<AnalyticsTab>(tabs[0]);
  const { data, error, loading, reload } = useData((api) => api.analytics(state.filters), [JSON.stringify(state.filters)]);
  return (
    <section className="analytics">
      <StatsFilterBar state={state} />
      {tabs.length > 1 && (
        <Tabs label="Categoría" value={tab} onChange={setTab} options={tabs.map((t) => ({ value: t, label: TAB_LABELS[t] }))} />
      )}
      <ErrorState error={error} onRetry={reload} />
      {loading && !data && <Skeleton lines={6} block />}
      {data && (tab === "learning" ? <LearningStats data={data} /> : tab === "participation" ? <ParticipationStats data={data} /> : <AssessmentStats data={data} />)}
    </section>
  );
}

// 05. LearningStats
function LearningStats({ data }: { data: AnalyticsOverview }) {
  const s = data.summary;
  const d = data.definitions;
  const reinforce = data.byMaterial.filter((m) => m.needsReinforcement);
  return (
    <>
      <div className="kpis">
        <Kpi def={d.lessons_completed} value={fmt(s.lessonsCompleted)} hint={`${s.lessonsStarted} iniciadas`} />
        <Kpi def={d.completion_rate} value={fmt(s.completionRatePct, " %")} />
        <Kpi def={d.first_attempt_score} value={fmt(s.firstAttemptPct, " %")} hint={`${s.studentsEvaluated} estudiantes evaluados`} />
        <Kpi def={d.quiz_attempts} value={fmt(s.quizAttempts)} hint="envíos, no estudiantes" />
      </div>
      {reinforce.length > 0 && (
        <Notice title="Materiales que necesitan refuerzo">
          {reinforce.map((m) => `${m.name} (aprobación ${fmt(m.passRatePct, " %")}, primer intento ${fmt(m.first_attempt_pct, " %")})`).join(" · ")}
        </Notice>
      )}
      <div className="split">
        <section className="ui-section">
          <div className="ui-section-head"><h2>Resultados por material</h2></div>
          <BarChart caption="Promedio del primer intento y aprobación por estudiante, por material" unit="%" max={100} height={230}
            labels={data.byMaterial.map((m) => m.name)}
            series={[{ name: "Primer intento", values: data.byMaterial.map((m) => m.first_attempt_pct), color: CHART.forest },
            { name: "Aprobación", values: data.byMaterial.map((m) => m.passRatePct), color: CHART.lime }]} />
        </section>
        <section className="ui-section">
          <div className="ui-section-head"><h2>Evolución del aprendizaje</h2></div>
          <LineChart caption="Promedio semanal del primer intento" labels={data.weekly.map((w) => w.week)} formatLabel={shortWeek} unit="%" max={100} height={230}
            series={[{ name: "Primer intento", values: data.weekly.map((w) => w.first_attempt_pct), color: CHART.forest }]} />
        </section>
      </div>
      <GroupTable data={data} />
    </>
  );
}

// 06. GroupTable
function GroupTable({ data }: { data: AnalyticsOverview }) {
  return (
    <section className="ui-section">
      <div className="ui-section-head"><h2>Comparación por grupo</h2>
        {data.summary.groupsWithoutRecords > 0 && <Chip tone="muted">{data.summary.groupsWithoutRecords} sin registros</Chip>}</div>
      <DataTable
        caption="Indicadores por grupo en el periodo"
        rows={data.byGroup}
        rowKey={(g) => g.id}
        pageSize={8}
        columns={[
          { key: "group", header: "Grupo", primary: true, render: (g) => <>{g.grade} · {g.name}{g.noRecords && <Chip tone="muted">Sin registros</Chip>}</>, sortValue: (g) => `${g.grade}${g.name}` },
          { key: "part", header: "Participación", align: "right", render: (g) => fmt(g.participationPct, " %"), sortValue: (g) => g.participationPct ?? -1 },
          { key: "done", header: "Lecciones completadas", align: "right", render: (g) => g.lessons_completed, sortValue: (g) => g.lessons_completed, hideOnMobile: true },
          { key: "rate", header: "Finalización", align: "right", render: (g) => fmt(g.completionRatePct, " %"), sortValue: (g) => g.completionRatePct ?? -1, hideOnMobile: true },
          { key: "first", header: "Primer intento", align: "right", render: (g) => fmt(g.first_attempt_pct, " %"), sortValue: (g) => g.first_attempt_pct ?? -1 },
          { key: "verified", header: "Verificadas", align: "right", render: (g) => g.verified_actions, sortValue: (g) => g.verified_actions, hideOnMobile: true },
        ]}
      />
    </section>
  );
}

// 07. ParticipationStats
function ParticipationStats({ data }: { data: AnalyticsOverview }) {
  const s = data.summary;
  const d = data.definitions;
  return (
    <>
      <div className="kpis">
        <Kpi def={d.active} value={fmt(s.active)} hint={`de ${s.enrolled} matriculados`} />
        <Kpi def={d.participation} value={fmt(s.participationPct, " %")} />
        <Kpi def={d.challenges_completed} value={fmt(s.challengesCompleted)} />
        <Kpi def={d.verified_actions} value={fmt(s.verifiedActions)} hint={s.pendingReviews ? `${s.pendingReviews} pendientes de revisión` : undefined} />
      </div>
      <div className="split">
        <section className="ui-section">
          <div className="ui-section-head"><h2>Estudiantes activos por semana</h2></div>
          <LineChart caption="Estudiantes distintos con actividad de aprendizaje por semana" labels={data.weekly.map((w) => w.week)} formatLabel={shortWeek} height={220}
            series={[{ name: "Estudiantes activos", values: data.weekly.map((w) => w.active_students), color: CHART.limeDeep }]} />
        </section>
        <section className="ui-section">
          <div className="ui-section-head"><h2>Distribución de puntos</h2>
            <InfoTip iconOnly label="Cómo se calcula la distribución de puntos">{d.points_distribution.formula}</InfoTip></div>
          <BarChart caption="Estudiantes según los puntos obtenidos en el periodo" height={220} unit=" est."
            labels={data.pointsDistribution.map((b) => `${b.range} pts`)}
            series={[{ name: "Estudiantes", values: data.pointsDistribution.map((b) => b.students), color: CHART.forest }]} />
        </section>
      </div>
      <section className="ui-section">
        <div className="ui-section-head"><h2>Participación por grupo</h2></div>
        <BarList label="Participación por grupo" suffix=" %" max={100}
          items={data.byGroup.map((g) => ({ label: `${g.grade} · ${g.name}`, value: g.participationPct, note: g.noRecords ? "sin registros" : `${g.active}/${g.enrolled}` }))} />
      </section>
    </>
  );
}

// 08. AssessmentStats
function AssessmentStats({ data }: { data: AnalyticsOverview }) {
  const a = data.assessment;
  return (
    <>
      <div className="kpis">
        <div className="kpi"><p className="kpi-label">Pares comparables</p><p className="kpi-value">{a.overall.pairs}</p><p className="kpi-hint">{a.taken.pre} iniciales · {a.taken.post} finales</p></div>
        <div className="kpi"><p className="kpi-label">Promedio inicial</p><p className="kpi-value">{fmt(a.overall.prePct, " %")}</p></div>
        <div className="kpi"><p className="kpi-label">Promedio final</p><p className="kpi-value">{fmt(a.overall.postPct, " %")}</p></div>
        <div className="kpi"><p className="kpi-label">Variación</p><p className="kpi-value">{a.overall.changePts === null ? "—" : `${a.overall.changePts > 0 ? "+" : ""}${a.overall.changePts} pts`}</p>
          <p className="kpi-hint">{a.overall.improved} mejoraron</p></div>
      </div>
      <Notice title="Cómo leer esta comparación"><Info size={15} aria-hidden /> {a.note}</Notice>
      {a.byGroup.length === 0 ? <EmptyState title="Todavía no hay estudiantes con ambas evaluaciones." /> : (
        <section className="ui-section">
          <div className="ui-section-head"><h2>Inicio y final por grupo</h2></div>
          <BarChart caption="Promedio de la evaluación inicial y final por grupo (solo pares)" unit="%" max={100} height={220}
            labels={a.byGroup.map((g) => g.groupName)}
            series={[{ name: "Inicial", values: a.byGroup.map((g) => g.prePct), color: CHART.lime }, { name: "Final", values: a.byGroup.map((g) => g.postPct), color: CHART.forest }]} />
        </section>
      )}
    </>
  );
}

/* Verificación docente */
const STATUS_LABEL: Record<EnvironmentalAction["status"], string> = {
  pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada", changes_requested: "Cambios solicitados",
};

// 09. ReviewsView
export function ReviewsView() {
  const { role } = usePanel();
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const { data, error, loading, reload } = useData((api) => api.reviews(status), [status]);
  const [open, setOpen] = useState<EnvironmentalAction | null>(null);
  return (
    <>
      <PageHeader title="Verificación" description="Actividades ambientales que registraron tus estudiantes. Aprobar otorga la recompensa una sola vez." />
      <Tabs label="Estado" value={status} onChange={setStatus} options={[{ value: "pending", label: "Pendientes", count: status === "pending" ? data?.length : undefined }, { value: "all", label: "Todas" }]} />
      <ErrorState error={error} onRetry={reload} />
      {loading && !data && <Skeleton lines={4} block />}
      {data && (
        <DataTable
          caption="Actividades para verificar"
          rows={data}
          rowKey={(a) => a.id}
          pageSize={8}
          empty={status === "pending" ? "No hay actividades pendientes." : "No hay actividades."}
          searchText={(a) => `${a.display_name} ${a.description}`}
          searchLabel="Buscar"
          onOpen={setOpen}
          openLabel={() => "Revisar actividad"}
          columns={[
            { key: "who", header: "Estudiante", primary: true, render: (a) => <>{a.display_name}<small className="dt-sub">{a.group_name}</small></> },
            { key: "what", header: "Actividad", render: (a) => a.kindLabel, hideOnMobile: true },
            { key: "date", header: "Fecha", render: (a) => formatDate(a.occurred_on), sortValue: (a) => a.occurred_on },
            { key: "status", header: "Estado", render: (a) => <Chip tone={a.status === "approved" ? "ok" : a.status === "pending" ? "neutral" : "warn"}>{STATUS_LABEL[a.status]}</Chip> },
          ]}
        />
      )}
      <SidePanel open={!!open} title="Revisar actividad" onClose={() => setOpen(null)}>
        {open && <ReviewForm action={open} onDone={() => { setOpen(null); reload(); }} />}
      </SidePanel>
      {role === "teacher" && <RecordsSection embedded />}
    </>
  );
}

// 10. ReviewForm
function ReviewForm({ action, onDone }: { action: EnvironmentalAction; onDone: () => void }) {
  const { run, pending, error } = useAction();
  const [note, setNote] = useState("");
  const [result, setResult] = useState<string>("");
  async function decide(decision: "approved" | "rejected" | "changes_requested") {
    const r = await run((api) => api.reviewAction(action.id, decision, note));
    if (r) {
      setResult(decision === "approved" ? (r.limited ? "Aprobada. El estudiante alcanzó el límite semanal: esta vez no suma puntos." : `Aprobada. +${r.pointsAwarded} puntos para el estudiante.`) : "Decisión registrada.");
      setTimeout(onDone, 900);
    }
  }
  return (
    <div className="ui-form">
      <dl className="detail-list">
        <div><dt>Estudiante</dt><dd>{action.display_name} · {action.group_name}</dd></div>
        <div><dt>Actividad</dt><dd>{action.kindLabel}{action.material ? ` · ${MATERIAL_NAME[action.material] ?? action.material}` : ""}</dd></div>
        <div><dt>Fecha</dt><dd>{formatDate(action.occurred_on)}</dd></div>
        <div><dt>Descripción</dt><dd>{action.description}</dd></div>
        {action.quantity !== null && <div><dt>Cantidad declarada</dt><dd>{action.quantity} {action.unit ? UNIT[action.unit] : ""}</dd></div>}
        {action.review_note && <div><dt>Observación anterior</dt><dd>{action.review_note}</dd></div>}
      </dl>
      {action.status === "pending" ? (
        <>
          <Field label="Observación para el estudiante" hint="Obligatoria si rechazas o pides cambios.">
            <textarea rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <ErrorState error={error} />
          {result && <p className="ui-success" role="status">{result}</p>}
          <div className="ui-form-actions">
            <button className="ui-button ui-button-dark" onClick={() => decide("approved")} disabled={pending}><Check size={16} aria-hidden /> Aprobar</button>
            <button className="ui-button ui-button-quiet" onClick={() => decide("changes_requested")} disabled={pending || !note.trim()}>Pedir cambios</button>
            <button className="ui-button ui-button-quiet" onClick={() => decide("rejected")} disabled={pending || !note.trim()}>Rechazar</button>
          </div>
          <p className="ui-small ui-muted">Verifica la acción con lo que observaste en clase. No se solicitan fotografías de estudiantes.</p>
        </>
      ) : (
        <p>Estado: <strong>{STATUS_LABEL[action.status]}</strong>{action.reviewer_name ? ` por ${action.reviewer_name}` : ""}{action.reviewed_at ? ` el ${formatDateTime(action.reviewed_at)}` : ""}.</p>
      )}
    </div>
  );
}

/* Registros ambientales */
const RECORD_KINDS: [RecordKind, string][] = [["weighing", "Pesaje"], ["delivery", "Entrega en centro de acopio"], ["campaign", "Jornada de reciclaje"], ["reception", "Recepción de material clasificado"]];

// 11. RecordsSection
export function RecordsSection({ embedded = false, canVerify = false }: { embedded?: boolean; canVerify?: boolean }) {
  const { data, error, loading, reload } = useData((api) => api.environmentalRecords());
  const [creating, setCreating] = useState(false);
  const [verifying, setVerifying] = useState<EnvironmentalRecord | null>(null);
  return (
    <section className="ui-section">
      <div className="ui-section-head">
        <h2>{embedded ? "Registros ambientales de la institución" : "Registros"}</h2>
        <button className="ui-button ui-button-dark ui-button-small" onClick={() => setCreating(true)}><Plus size={16} aria-hidden /> Registrar</button>
      </div>
      <p className="ui-small ui-muted">Pesajes, entregas, jornadas y recepciones reales. Solo la dirección los verifica; las estadísticas usan únicamente los verificados.</p>
      <ErrorState error={error} onRetry={reload} />
      {loading && !data && <Skeleton lines={3} />}
      {data && (
        <DataTable
          caption="Registros ambientales"
          rows={data}
          rowKey={(r) => r.id}
          pageSize={6}
          empty="Todavía no hay registros. Registra el primer pesaje o entrega."
          onOpen={canVerify ? (r) => r.status === "pending" && setVerifying(r) : undefined}
          openLabel={() => "Verificar"}
          columns={[
            { key: "date", header: "Fecha", render: (r) => formatDate(r.occurred_on), sortValue: (r) => r.occurred_on },
            { key: "kind", header: "Tipo", primary: true, render: (r) => <>{r.kindLabel}{r.supersedes_id && <small className="dt-sub">Reemplaza un pesaje previo</small>}</> },
            { key: "mat", header: "Material", render: (r) => MATERIAL_NAME[r.material] ?? r.material },
            { key: "qty", header: "Cantidad", align: "right", render: (r) => `${r.quantity.toLocaleString("es-SV")} ${UNIT[r.unit]}` },
            {
              key: "status", header: "Estado", render: (r) => <Chip tone={r.status === "verified" ? (r.superseded ? "muted" : "ok") : r.status === "pending" ? "neutral" : "warn"}>
                {r.status === "verified" ? (r.superseded ? "Reemplazado" : "Verificado") : r.status === "pending" ? "Pendiente" : "Rechazado"}</Chip>
            },
          ]}
        />
      )}
      <SidePanel open={creating} title="Nuevo registro ambiental" onClose={() => setCreating(false)}>
        <RecordForm records={data ?? []} onDone={() => { setCreating(false); reload(); }} />
      </SidePanel>
      <SidePanel open={!!verifying} title="Verificar registro" onClose={() => setVerifying(null)}>
        {verifying && <VerifyRecord record={verifying} onDone={() => { setVerifying(null); reload(); }} />}
      </SidePanel>
    </section>
  );
}

// 12. RecordForm
function RecordForm({ records, onDone }: { records: EnvironmentalRecord[]; onDone: () => void }) {
  const groups = useData((api) => api.groups());
  const { run, pending, error } = useAction();
  const [form, setForm] = useState<EnvironmentalRecordInput>({
    kind: "weighing", material: "plastic", quantity: 0, unit: "kg", occurred_on: today(),
    responsible: "", notes: null, group_id: null, supersedes_id: null
  });
  const replaceable = records.filter((r) => r.kind === "weighing" && r.status !== "rejected" && r.material === form.material && r.unit === form.unit
    && !records.some((x) => x.supersedes_id === r.id && x.status !== "rejected"));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (await run((api) => api.createEnvironmentalRecord({ ...form, notes: form.notes?.trim() || null }))) onDone();
  }
  const set = (patch: Partial<EnvironmentalRecordInput>) => setForm({ ...form, ...patch });
  return (
    <form className="ui-form" onSubmit={submit}>
      <Field label="Tipo de registro">
        <select value={form.kind} onChange={(e) => set({ kind: e.target.value as RecordKind, supersedes_id: null })}>
          {RECORD_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <div className="ui-form-row">
        <Field label="Material">
          <select value={form.material} onChange={(e) => set({ material: e.target.value, supersedes_id: null })}>
            {MATERIALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Fecha"><input type="date" value={form.occurred_on} max={today()} onChange={(e) => set({ occurred_on: e.target.value })} required /></Field>
      </div>
      <div className="ui-form-row">
        <Field label="Cantidad"><input type="number" inputMode="decimal" min="0.01" step="0.01" required value={form.quantity || ""} onChange={(e) => set({ quantity: Number(e.target.value) })} /></Field>
        <Field label="Unidad" hint="Kilogramos y objetos nunca se suman.">
          <select value={form.unit} onChange={(e) => set({ unit: e.target.value as "kg" | "items", supersedes_id: null })}>
            <option value="kg">Kilogramos</option><option value="items">Objetos</option>
          </select>
        </Field>
      </div>
      {form.kind === "delivery" && (
        <Field label="¿Corresponde a un pesaje ya registrado?" hint="Si eliges uno, ese pesaje deja de contarse cuando esta entrega se verifique: así no se cuenta dos veces.">
          <select value={form.supersedes_id ?? ""} onChange={(e) => set({ supersedes_id: e.target.value || null })}>
            <option value="">No, es un material distinto</option>
            {replaceable.map((r) => <option key={r.id} value={r.id}>Pesaje del {formatDate(r.occurred_on)} · {r.quantity} {UNIT[r.unit]}</option>)}
          </select>
        </Field>
      )}
      <Field label="Grupo (opcional)">
        <select value={form.group_id ?? ""} onChange={(e) => set({ group_id: e.target.value || null })}>
          <option value="">Toda la institución</option>
          {groups.data?.filter((g) => g.status === "active").map((g) => <option key={g.id} value={g.id}>{g.grade} · {g.name}</option>)}
        </select>
      </Field>
      <Field label="Responsable (persona adulta)"><input value={form.responsible} minLength={3} maxLength={120} onChange={(e) => set({ responsible: e.target.value })} required /></Field>
      <Field label="Notas (opcional)" hint="Por ejemplo, número de comprobante del centro de acopio."><textarea rows={2} maxLength={400} value={form.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} /></Field>
      <ErrorState error={error} />
      <button className="ui-button ui-button-dark" disabled={pending || form.quantity <= 0 || form.responsible.trim().length < 3}>Guardar para verificación</button>
    </form>
  );
}

// 13. VerifyRecord
function VerifyRecord({ record, onDone }: { record: EnvironmentalRecord; onDone: () => void }) {
  const { run, pending, error } = useAction();
  const [note, setNote] = useState("");
  async function decide(decision: "verified" | "rejected") {
    if (await run((api) => api.verifyEnvironmentalRecord(record.id, decision, note))) onDone();
  }
  return (
    <div className="ui-form">
      <dl className="detail-list">
        <div><dt>Tipo</dt><dd>{record.kindLabel}</dd></div>
        <div><dt>Material</dt><dd>{MATERIAL_NAME[record.material] ?? record.material}</dd></div>
        <div><dt>Cantidad</dt><dd>{record.quantity} {UNIT[record.unit]}</dd></div>
        <div><dt>Fecha</dt><dd>{formatDate(record.occurred_on)}</dd></div>
        <div><dt>Responsable</dt><dd>{record.responsible}</dd></div>
        <div><dt>Registrado por</dt><dd>{record.recorded_by_name ?? "—"}</dd></div>
        {record.notes && <div><dt>Notas</dt><dd>{record.notes}</dd></div>}
      </dl>
      <Field label="Nota de verificación (opcional)"><textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <ErrorState error={error} />
      <div className="ui-form-actions">
        <button className="ui-button ui-button-dark" onClick={() => decide("verified")} disabled={pending}><Check size={16} aria-hidden /> Verificar</button>
        <button className="ui-button ui-button-quiet" onClick={() => decide("rejected")} disabled={pending}>Rechazar</button>
      </div>
    </div>
  );
}

/* Impacto verificado */
// 14. ImpactView
export function ImpactView() {
  const state = useStatsFilters();
  const { data, error, loading, reload } = useData((api) => api.analytics(state.filters), [JSON.stringify(state.filters)]);
  const env = data?.environment;
  return (
    <>
      <PageHeader title="Impacto ambiental verificado" description="Cantidades reales registradas y verificadas por la dirección. Sin estimaciones ni equivalencias." />
      <StatsFilterBar state={state} />
      <ErrorState error={error} onRetry={reload} />
      {loading && !data && <Skeleton lines={4} block />}
      {env && (
        env.byMaterial.length === 0 ? (
          <EmptyState title="Aún no hay registros ambientales verificados en este periodo.">
            Registra el primer pesaje o entrega en «Registros» (abajo) y verifícalo. Los escaneos no cuentan como material reciclado.
          </EmptyState>
        ) : (
          <>
            <div className="kpis">
              <div className="kpi"><p className="kpi-label">Kilogramos verificados</p><p className="kpi-value">{env.totals.kg.toLocaleString("es-SV")}<small> kg</small></p></div>
              <div className="kpi"><p className="kpi-label">Objetos verificados</p><p className="kpi-value">{env.totals.items.toLocaleString("es-SV")}<small> objetos</small></p></div>
              <div className="kpi"><p className="kpi-label">Actividades de estudiantes</p><p className="kpi-value">{env.actions.approved}</p><p className="kpi-hint">verificadas por docentes</p></div>
              <div className="kpi"><p className="kpi-label">Registros por verificar</p><p className="kpi-value">{env.pendingRecords}</p></div>
            </div>
            <div className="split">
              <section className="ui-section">
                <div className="ui-section-head"><h2>Kilogramos por material</h2></div>
                <BarChart caption="Kilogramos verificados por material" unit=" kg" height={220}
                  labels={env.byMaterial.filter((m) => m.unit === "kg").map((m) => MATERIAL_NAME[m.material] ?? m.material)}
                  series={[{ name: "Kilogramos", values: env.byMaterial.filter((m) => m.unit === "kg").map((m) => m.quantity), color: CHART.forest }]} />
              </section>
              <section className="ui-section">
                <div className="ui-section-head"><h2>Objetos por material</h2></div>
                <BarChart caption="Objetos verificados por material" unit=" obj." height={220}
                  labels={env.byMaterial.filter((m) => m.unit === "items").map((m) => MATERIAL_NAME[m.material] ?? m.material)}
                  series={[{ name: "Objetos", values: env.byMaterial.filter((m) => m.unit === "items").map((m) => m.quantity), color: CHART.limeDeep }]} />
              </section>
            </div>
          </>
        )
      )}
      {env && <p className="ui-small ui-muted">{env.note}</p>}
      <RecordsSection canVerify />
    </>
  );
}

/* Reportes */
const REPORTS: { kind: ReportKind; title: string; text: string; director?: boolean }[] = [
  { kind: "progreso-estudiantil", title: "Progreso estudiantil", text: "Lecciones, intentos, puntos y actividades verificadas de cada estudiante (solo nombre visible)." },
  { kind: "rendimiento-grupos", title: "Rendimiento de grupos", text: "Participación, finalización y primer intento por grupo." },
  { kind: "participacion", title: "Participación", text: "Estudiantes activos y promedio del primer intento por semana." },
  { kind: "actividades-educativas", title: "Actividades educativas", text: "Resultados por material y materiales que necesitan refuerzo." },
  { kind: "retos", title: "Retos", text: "Retos del periodo, su tipo, meta y cuántos estudiantes los completaron." },
  { kind: "reciclaje-verificado", title: "Reciclaje verificado", text: "Actividades aprobadas por docentes y, para la dirección, registros ambientales verificados." },
  { kind: "resumen-institucional", title: "Resumen institucional", text: "Indicadores principales con notas metodológicas.", director: true },
];

// 15. ReportsCatalog
export function ReportsCatalog() {
  const { role, demo } = usePanel();
  const state = useStatsFilters();
  const { run, pending, error } = useAction();
  const [busy, setBusy] = useState("");
  async function download(kind: ReportKind, format: ReportFormat) {
    setBusy(`${kind}.${format}`);
    const blob = await run((api) => api.report(kind, format, state.filters));
    setBusy("");
    if (blob) downloadBlob(blob, `sortlyscan-${kind}-${state.filters.start}-${state.filters.end}.${format}`);
  }
  const icon = { csv: <Download size={15} aria-hidden />, xlsx: <FileSpreadsheet size={15} aria-hidden />, pdf: <FileText size={15} aria-hidden /> };
  return (
    <>
      <PageHeader title="Reportes" description="CSV, Excel y PDF con fechas, filtros, unidades y notas metodológicas. Respetan tus permisos." />
      {demo && <p className="ui-small ui-muted">En la demostración se descargan datos ficticios y solo en CSV.</p>}
      <StatsFilterBar state={state} />
      <ErrorState error={error} />
      <div className="card-grid">
        {REPORTS.filter((r) => !r.director || role === "director").map((r) => (
          <article key={r.kind} className={`report-card${r.director ? " is-featured" : ""}`}>
            <h3>{r.title}</h3>
            <p className="ui-small">{r.text}</p>
            <div className="report-formats">
              {(["csv", "xlsx", "pdf"] as ReportFormat[]).map((f) => (
                <button key={f} className="ui-button ui-button-quiet ui-button-small" onClick={() => download(r.kind, f)} disabled={pending}
                  aria-label={`Descargar ${r.title} en ${f === "xlsx" ? "Excel" : f.toUpperCase()}`}>
                  {icon[f]} {busy === `${r.kind}.${f}` ? "Generando…" : f === "xlsx" ? "Excel" : f.toUpperCase()}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
