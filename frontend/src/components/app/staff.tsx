"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, ArrowRightLeft, ClipboardList, Download, Flag, Plus, Upload, UserPlus } from "lucide-react";
import type { ActivityRow, Challenge, ChallengeKind, CreatedStudent, Group, RankingPeriod, StudentRow } from "@/lib/api/types";
import type { Api } from "@/lib/api/client";
import { useAction, useData, usePanel } from "./api-context";
import { ImportStudents, TransferStudents } from "./school";
import { AnimatedNumber, BarChart, CHART, LineChart, Meter, Ring } from "./charts";
import { ChallengeMeter } from "./gamification";
import { SidePanel } from "./overlay";
import { AnalyticsPanel, ReportsCatalog, ReviewsView } from "./staff-extra";
import { AccountSettings } from "./settings";
import { DataTable, Tabs, type Filter } from "./table";
import {
  Bento, Chip, downloadBlob, EmptyState, ErrorState, Field, formatDate, formatDateTime, Notice, PageHeader, pct,
  SeeAll, Skeleton, Tile, today, ViewFade,
} from "./ui";

export const groupLabel = (g: { grade: string; name: string }) => `${g.grade} · ${g.name}`;
type Query = Record<string, string | undefined>;

const DAY = 86_400_000;
/** Motivos de seguimiento calculados con datos reales del estudiante. */
// 01. supportReasons
export function supportReasons(s: StudentRow): string[] {
  if (s.status !== "active") return [];
  const reasons: string[] = [];
  if (!s.last_activity_at || Date.now() - new Date(s.last_activity_at).getTime() > 14 * DAY) reasons.push("Sin actividad en 14 días");
  if (s.avg_score_pct !== null && s.avg_score_pct < 60) reasons.push("Promedio menor a 60%");
  if (s.lessons_completed === 0 && s.last_activity_at) reasons.push("Sin lecciones aprobadas");
  return reasons;
}
const shortWeek = (w: string) => new Intl.DateTimeFormat("es-SV", { day: "numeric", month: "short" }).format(new Date(`${w}T12:00:00`));

/** Suma por semana (varias filas por grupo → una serie). */
// 02. weeklyTotals
export function weeklyTotals(rows: { week: string; attempts: number; students: number; avg_score_pct: number | null }[]) {
  const map = new Map<string, { attempts: number; students: number; sum: number; n: number }>();
  rows.forEach((r) => {
    const item = map.get(r.week) ?? { attempts: 0, students: 0, sum: 0, n: 0 };
    item.attempts += r.attempts;
    item.students += r.students;
    if (r.avg_score_pct !== null) { item.sum += r.avg_score_pct * r.attempts; item.n += r.attempts; }
    map.set(r.week, item);
  });
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, v]) => ({
    week, attempts: v.attempts, students: v.students, avg: v.n ? Math.round(v.sum / v.n) : null,
  }));
}

// 03. NoGroups
function NoGroups() {
  const { role, base } = usePanel();
  return (
    <EmptyState title="Todavía no hay grupos asignados.">
      {role === "teacher" ? "La dirección de tu institución debe asignarte al menos un grupo." : <>Crea uno en <Link className="ui-link" href={`${base}/grupos`}>Grupos</Link>.</>}
    </EmptyState>
  );
}

// 04. TeacherApp
export function TeacherApp({ section, query }: { section: string[]; query: Query }) {
  const [view] = section;
  const views: Record<string, React.ReactNode> = {
    "": <TeacherOverview />,
    grupos: <GroupsView />,
    estudiantes: <StudentsView query={query} />,
    actividades: <ActivitiesView query={query} />,
    retos: <ChallengesView query={query} />,
    estadisticas: <StatsView query={query} />,
    verificacion: <ReviewsView />,
    reportes: <ReportsCatalog />,
    cuenta: <AccountSettings />,
  };
  return <ViewFade viewKey={section.join("/")}>{views[view ?? ""] ?? <EmptyState title="Esta sección no existe." />}</ViewFade>;
}

// 05. TeacherOverview
function TeacherOverview() {
  const { base } = usePanel();
  const { data, error, loading, reload } = useData((api) => api.teacherOverview());
  const students = useData((api) => api.students());
  const pendingReviews = useData((api) => api.reviews("pending"));
  if (loading && !data) return <Skeleton lines={8} block />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;
  const totalStudents = data.groups.reduce((s, g) => s + g.students, 0);
  const active = data.metrics.reduce((s, m) => s + m.active_30d, 0);
  const attempts = data.metrics.reduce((s, m) => s + m.attempts, 0);
  const avg = attempts ? Math.round(data.metrics.reduce((s, m) => s + (m.avg_score_pct ?? 0) * m.attempts, 0) / attempts) : null;
  const weekly = weeklyTotals(data.weekly);
  const support = (students.data ?? []).map((s) => ({ s, reasons: supportReasons(s) })).filter((x) => x.reasons.length);
  return (
    <>
      <PageHeader eyebrow={data.institution ?? undefined} title={`Hola, ${data.displayName.split(" ")[0]}.`} />
      {data.groups.length === 0 ? <NoGroups /> : (
        <>
          <div className="kpis">
            <div className="kpi"><p className="kpi-label">Estudiantes</p><p className="kpi-value"><AnimatedNumber value={totalStudents} /></p><p className="kpi-hint">{data.groups.length} grupos</p></div>
            <div className="kpi"><p className="kpi-label">Activos en 30 días</p><p className="kpi-value"><AnimatedNumber value={totalStudents ? Math.round((active / totalStudents) * 100) : 0} suffix="%" /></p><p className="kpi-hint">{active} estudiantes</p></div>
            <div className="kpi"><p className="kpi-label">Promedio de cuestionarios</p><p className="kpi-value">{avg === null ? "—" : <AnimatedNumber value={avg} suffix="%" />}</p><p className="kpi-hint">{attempts} enviados</p></div>
            <div className="kpi"><p className="kpi-label">Requieren seguimiento</p><p className="kpi-value"><AnimatedNumber value={support.length} /></p><p className="kpi-hint">según actividad y promedio</p></div>
          </div>
          <Bento>
            <Tile span={8} title="Participación semanal">
              <LineChart
                caption="Cuestionarios enviados y estudiantes participantes por semana"
                labels={weekly.map((w) => w.week)}
                formatLabel={shortWeek}
                series={[
                  { name: "Cuestionarios", values: weekly.map((w) => w.attempts), color: CHART.forest },
                  { name: "Estudiantes", values: weekly.map((w) => w.students), color: CHART.limeDeep },
                ]}
              />
            </Tile>
            <Tile span={4} tone="dark" title="Accesos rápidos" className="quick">
              <Link href={`${base}/actividades?nuevo=1`}><ClipboardList size={18} aria-hidden /> Nueva actividad</Link>
              <Link href={`${base}/estudiantes?nuevo=1`}><UserPlus size={18} aria-hidden /> Agregar estudiantes</Link>
              <Link href={`${base}/retos?nuevo=1`}><Flag size={18} aria-hidden /> Nuevo reto</Link>
              <Link href={`${base}/verificacion`}><ClipboardList size={18} aria-hidden /> Verificar actividades{pendingReviews.data?.length ? ` (${pendingReviews.data.length})` : ""}</Link>
              <Link href={`${base}/reportes`}><Download size={18} aria-hidden /> Descargar reportes</Link>
            </Tile>
            <Tile span={6} title="Rendimiento por grupo" action={<SeeAll href={`${base}/estadisticas`}>Estadísticas</SeeAll>}>
              <BarChart
                caption="Promedio de cuestionarios y porcentaje de estudiantes activos por grupo"
                labels={data.metrics.map((m) => groupLabel(m))}
                series={[
                  { name: "Promedio", values: data.metrics.map((m) => m.avg_score_pct), color: CHART.forest },
                  { name: "Activos 30 días", values: data.metrics.map((m) => (m.students ? Math.round((m.active_30d / m.students) * 100) : 0)), color: CHART.lime },
                ]}
                unit="%"
                max={100}
                height={220}
              />
            </Tile>
            <Tile span={6} title="Estudiantes que requieren seguimiento" action={<SeeAll href={`${base}/estudiantes?filtro=seguimiento`} />}>
              {students.loading && !students.data ? <Skeleton lines={3} /> : support.length === 0 ? (
                <p className="tile-empty">Nadie requiere seguimiento con los criterios actuales.</p>
              ) : (
                <ul className="rows">
                  {support.slice(0, 5).map(({ s, reasons }) => (
                    <li key={s.user_id}>
                      <span className="rows-main">{s.display_name}<small>{groupLabel({ grade: s.grade, name: s.group_name })}</small></span>
                      <Chip tone="warn">{reasons[0]}</Chip>
                    </li>
                  ))}
                </ul>
              )}
            </Tile>
            <Tile span={6} title="Actividades próximas" action={<SeeAll href={`${base}/actividades`} />}>
              {data.upcomingActivities.length === 0 ? <p className="tile-empty">No hay actividades con entrega próxima.</p> : (
                <ul className="rows">
                  {data.upcomingActivities.slice(0, 4).map((a) => (
                    <li key={a.id}>
                      <span className="rows-main">{a.title}<small>Grupo {a.group_name} · {a.lesson_title}</small></span>
                      <span className="ui-small ui-muted">{a.due_on ? formatDate(a.due_on) : "Sin fecha"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Tile>
            <Tile span={6} title="Actividad reciente" action={<SeeAll href={`${base}/estadisticas#recientes`} />}>
              {data.recentAttempts.length === 0 ? <p className="tile-empty">Sin cuestionarios enviados todavía.</p> : (
                <ul className="rows">
                  {data.recentAttempts.slice(0, 4).map((a) => (
                    <li key={a.id}>
                      <span className="rows-main">{a.display_name}<small>{a.lesson_title} · {formatDateTime(a.created_at)}</small></span>
                      <span className={`score-pill${a.passed ? " is-ok" : ""}`}>{pct(a.score, a.max_score)}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </Tile>
          </Bento>
        </>
      )}
    </>
  );
}

/* Grupos */
// 06. GroupsView
export function GroupsView() {
  const { role, base } = usePanel();
  const router = useRouter();
  const director = role === "director";
  const { data, error, loading, reload } = useData((api) => api.groups());
  const metrics = useData((api) => api.teacherOverview().then((o) => o.metrics).catch(() => []));
  const action = useAction();
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState<Group | null>(null);
  const [moving, setMoving] = useState(false);
  async function setVisibility(group: Group, value: "private" | "group") {
    if (await action.run((api) => api.updateGroup(group.id, { ranking_visibility: value }))) reload();
  }
  async function archive(group: Group) {
    if (!window.confirm(`¿Archivar ${groupLabel(group)}? Sus estudiantes dejarán de verlo.`)) return;
    if (await action.run((api) => api.updateGroup(group.id, { status: "revoked" }))) reload();
  }
  const metric = (id: string) => metrics.data?.find((m) => m.id === id);
  return (
    <>
      <PageHeader
        title={director ? "Grupos" : "Mis grupos"}
        description={director ? "Grupos por año lectivo y sus docentes." : "Tus grupos y la visibilidad de su ranking."}
        actions={director && <>
          <button className="ui-button ui-button-quiet" onClick={() => setMoving(true)} disabled={(data ?? []).filter((g) => g.status === "active").length < 2}><ArrowRightLeft size={17} aria-hidden /> Transferir estudiantes</button>
          <button className="ui-button ui-button-dark" onClick={() => setCreating(true)}><Plus size={17} aria-hidden /> Nuevo grupo</button>
        </>}
      />
      {loading && !data && <Skeleton lines={5} block />}
      <ErrorState error={error ?? action.error} onRetry={reload} />
      {data && data.length === 0 && <NoGroups />}
      {data && data.length > 0 && !director && (
        <div className="card-grid">
          {data.map((g) => {
            const m = metric(g.id);
            return (
              <article key={g.id} className="group-card">
                <div className="group-card-head">
                  <div><p className="ui-eyebrow">{g.school_year}</p><h3>{groupLabel(g)}</h3></div>
                  <Ring value={m?.avg_score_pct ?? 0} size={72} stroke={8} label={`Promedio ${m?.avg_score_pct ?? 0}%`}><strong className="ring-sm">{m?.avg_score_pct ?? "—"}{m?.avg_score_pct !== null && m ? "%" : ""}</strong></Ring>
                </div>
                <dl className="group-card-facts">
                  <div><dt>Estudiantes</dt><dd>{g.students}</dd></div>
                  <div><dt>Activos 30 días</dt><dd>{m?.active_30d ?? 0}</dd></div>
                  <div><dt>Lecciones aprobadas</dt><dd>{m?.lessons_completed ?? 0}</dd></div>
                </dl>
                <div className="segmented" role="radiogroup" aria-label={`Ranking de ${groupLabel(g)}`}>
                  {(["private", "group"] as const).map((v) => (
                    <button key={v} role="radio" aria-checked={g.ranking_visibility === v} className={g.ranking_visibility === v ? "is-active" : undefined} disabled={action.pending} onClick={() => setVisibility(g, v)}>
                      {v === "private" ? "Ranking privado" : "Nombres visibles"}
                    </button>
                  ))}
                </div>
                <div className="group-card-links">
                  <Link className="see-all" href={`${base}/estudiantes?grupo=${g.id}`}>Estudiantes <ArrowRight size={15} aria-hidden /></Link>
                  <Link className="see-all" href={`${base}/estadisticas?grupo=${g.id}`}>Estadísticas <ArrowRight size={15} aria-hidden /></Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {data && data.length > 0 && director && (
        <DataTable
          caption="Grupos de la institución"
          rows={data}
          rowKey={(g) => g.id}
          searchText={(g) => `${groupLabel(g)} ${g.teachers.map((t) => t.name).join(" ")}`}
          searchLabel="Buscar grupo o docente"
          filters={[{ key: "status", label: "Estado", initial: "active", options: [{ value: "active", label: "Activos" }, { value: "revoked", label: "Archivados" }, { value: "", label: "Todos" }], test: (g, v) => g.status === v }]}
          onOpen={(g) => setManaging(g)}
          openLabel={() => "Gestionar"}
          actions={(g) => [
            { label: "Gestionar docentes", onSelect: () => setManaging(g), hidden: g.status !== "active" },
            { label: g.ranking_visibility === "group" ? "Hacer ranking privado" : "Mostrar nombres en ranking", onSelect: () => setVisibility(g, g.ranking_visibility === "group" ? "private" : "group"), hidden: g.status !== "active" },
            { label: "Ver estudiantes", onSelect: () => router.push(`${base}/estudiantes?grupo=${g.id}`) },
            { label: "Archivar grupo", danger: true, onSelect: () => archive(g), hidden: g.status !== "active" },
          ]}
          columns={[
            { key: "name", header: "Grupo", primary: true, render: (g) => groupLabel(g), sortValue: (g) => `${String(g.grade_level_id).padStart(2, "0")}${g.name}` },
            { key: "year", header: "Año", render: (g) => g.school_year, sortValue: (g) => g.school_year, hideOnMobile: true },
            { key: "students", header: "Estudiantes", align: "right", render: (g) => g.students, sortValue: (g) => g.students },
            { key: "teachers", header: "Docentes", render: (g) => g.teachers.map((t) => t.name).join(", ") || <span className="ui-muted">Sin asignar</span> },
            { key: "ranking", header: "Ranking", render: (g) => <Chip tone={g.ranking_visibility === "group" ? "lime" : "muted"}>{g.ranking_visibility === "group" ? "Nombres visibles" : "Privado"}</Chip>, hideOnMobile: true },
            { key: "status", header: "Estado", render: (g) => <Chip tone={g.status === "active" ? "ok" : "muted"}>{g.status === "active" ? "Activo" : "Archivado"}</Chip> },
          ]}
        />
      )}
      {director && (
        <>
          <SidePanel open={moving} title="Transferir estudiantes" description="Cambio de grupo o de año lectivo. No se pierde ningún registro." onClose={() => setMoving(false)} wide>
            {data && <TransferStudents groups={data} onDone={reload} />}
          </SidePanel>
          <SidePanel open={creating} title="Nuevo grupo" onClose={() => setCreating(false)}>
            <CreateGroupForm onCreated={() => { setCreating(false); reload(); }} />
          </SidePanel>
          <SidePanel open={!!managing} title={managing ? `Docentes de ${groupLabel(managing)}` : ""} description="Los docentes asignados ven y gestionan este grupo." onClose={() => setManaging(null)}>
            {managing && <AssignTeachers group={managing} onChange={async () => { reload(); }} />}
          </SidePanel>
        </>
      )}
    </>
  );
}

// 07. CreateGroupForm
function CreateGroupForm({ onCreated }: { onCreated: () => void }) {
  const grades = useData((api) => api.gradeLevels());
  const action = useAction();
  const [grade, setGrade] = useState("7");
  const [name, setName] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const ok = await action.run((api) => api.createGroup({ grade_level_id: Number(grade), name: name.trim(), school_year: Number(year) }));
    if (ok) onCreated();
  }
  return (
    <form className="ui-form" onSubmit={submit}>
      <Field label="Grado">
        <select value={grade} onChange={(e) => setGrade(e.target.value)}>
          {grades.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </Field>
      <Field label="Sección o nombre"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required placeholder="A" /></Field>
      <Field label="Año lectivo"><input type="number" value={year} min={2024} max={2100} onChange={(e) => setYear(e.target.value)} required /></Field>
      <ErrorState error={action.error} />
      <button className="ui-button ui-button-dark" disabled={action.pending}><Plus size={17} aria-hidden /> Crear grupo</button>
    </form>
  );
}

// 08. AssignTeachers
function AssignTeachers({ group, onChange }: { group: Group; onChange: () => void }) {
  const staff = useData((api) => api.staff());
  const action = useAction();
  const [assigned, setAssigned] = useState(group.teachers);
  const available = (staff.data ?? []).filter((s) => s.status === "active" && !assigned.some((t) => t.id === s.user_id));
  return (
    <div className="ui-form">
      <ul className="rows">
        {assigned.length === 0 && <li className="ui-muted">Sin docentes asignados.</li>}
        {assigned.map((t) => (
          <li key={t.id}>
            <span className="rows-main">{t.name}</span>
            <button className="ui-link-button ui-danger" onClick={async () => {
              if (await action.run((api) => api.unassignTeacher(group.id, t.id))) { setAssigned(assigned.filter((x) => x.id !== t.id)); onChange(); }
            }}>Quitar</button>
          </li>
        ))}
      </ul>
      {available.length > 0 && (
        <Field label="Asignar docente">
          <select value="" onChange={async (e) => {
            const id = e.target.value;
            const person = available.find((s) => s.user_id === id);
            if (id && person && (await action.run((api) => api.assignTeacher(group.id, id)))) { setAssigned([...assigned, { id, name: person.display_name }]); onChange(); }
          }}>
            <option value="">Elige un docente</option>
            {available.map((s) => <option key={s.user_id} value={s.user_id}>{s.display_name}</option>)}
          </select>
        </Field>
      )}
      <ErrorState error={action.error} />
    </div>
  );
}

/* Estudiantes */
// 09. StudentsView
export function StudentsView({ query = {} }: { query?: Query }) {
  const { role } = usePanel();
  const groups = useData((api) => api.groups());
  const students = useData((api) => api.students());
  const action = useAction();
  const [adding, setAdding] = useState(query.nuevo === "1");
  const [importing, setImporting] = useState(false);
  const [detail, setDetail] = useState<StudentRow | null>(null);
  const activeGroups = (groups.data ?? []).filter((g) => g.status === "active");

  async function reactivate(s: StudentRow) {
    if (await action.run((api) => api.reactivateStudent(s.group_id, s.user_id))) students.reload();
  }
  async function exportData(s: StudentRow) {
    const data = await action.run((api) => api.exportStudent(s.user_id));
    if (data) downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `datos-${s.username ?? "estudiante"}.json`);
  }
  async function revoke(s: StudentRow) {
    if (!window.confirm(`¿Retirar a ${s.display_name} del grupo? Su perfil dejará de aparecer en el selector (puedes reactivarlo).`)) return;
    if (await action.run((api) => api.revokeStudent(s.group_id, s.user_id))) students.reload();
  }
  const filters: Filter<StudentRow>[] = [
    { key: "group", label: "Grupo", initial: query.grupo ?? "", options: [{ value: "", label: "Todos los grupos" }, ...activeGroups.map((g) => ({ value: g.id, label: groupLabel(g) }))], test: (s, v) => s.group_id === v },
    { key: "status", label: "Estado", initial: "active", options: [{ value: "active", label: "Activos" }, { value: "revoked", label: "Retirados" }, { value: "", label: "Todos" }], test: (s, v) => s.status === v },
    { key: "support", label: "Seguimiento", initial: query.filtro === "seguimiento" ? "yes" : "", options: [{ value: "", label: "Todo el seguimiento" }, { value: "yes", label: "Requieren seguimiento" }], test: (s) => supportReasons(s).length > 0 },
  ];
  return (
    <>
      <PageHeader
        title="Estudiantes"
        description={role === "director" ? "Matrícula de la institución." : "Estudiantes ficticios de tus grupos. Solo se registra un nombre o seudónimo: sin correos, contraseñas ni códigos."}
        actions={<>
          <button className="ui-button ui-button-quiet" onClick={() => setImporting(true)} disabled={activeGroups.length === 0}><Upload size={17} aria-hidden /> Importar CSV</button>
          <button className="ui-button ui-button-dark" onClick={() => setAdding(true)} disabled={activeGroups.length === 0}><UserPlus size={17} aria-hidden /> Agregar estudiantes</button>
        </>}
      />
      {groups.data?.length === 0 && <NoGroups />}
      <ErrorState error={students.error ?? action.error} onRetry={students.reload} />
      {students.loading && !students.data && <Skeleton lines={6} />}
      {students.data && groups.data && (
        <DataTable
          caption="Estudiantes"
          rows={students.data}
          rowKey={(s) => s.enrollment_id}
          searchText={(s) => s.display_name}
          searchLabel="Buscar por nombre"
          filters={filters}
          onOpen={(s) => setDetail(s)}
          openLabel={() => "Ver detalle"}
          rowClass={(s) => (s.status !== "active" ? "is-muted" : undefined)}
          empty="Ningún estudiante coincide con los filtros."
          actions={(s) => [
            { label: "Ver detalle", onSelect: () => setDetail(s) },
            { label: "Retirar del grupo", danger: true, onSelect: () => revoke(s), hidden: s.status !== "active" },
            { label: "Reactivar", onSelect: () => reactivate(s), hidden: s.status === "active" },
            { label: "Exportar sus datos (JSON)", onSelect: () => exportData(s), hidden: role !== "director" },
          ]}
          columns={[
            { key: "name", header: "Estudiante", primary: true, render: (s) => s.display_name, sortValue: (s) => s.display_name.toLowerCase() },
            { key: "group", header: "Grupo", render: (s) => groupLabel({ grade: s.grade, name: s.group_name }), sortValue: (s) => `${s.grade}${s.group_name}`, hideOnMobile: true },
            { key: "lessons", header: "Lecciones", render: (s) => <span className="cell-meter"><Meter value={(s.lessons_completed / 6) * 100} label={`${s.lessons_completed} de 6`} /><small>{s.lessons_completed}/6</small></span>, sortValue: (s) => s.lessons_completed },
            { key: "avg", header: "Promedio", align: "right", render: (s) => (s.avg_score_pct === null ? "—" : <span className={`score-pill${s.avg_score_pct >= 70 ? " is-ok" : ""}`}>{s.avg_score_pct}%</span>), sortValue: (s) => s.avg_score_pct },
            { key: "points", header: "Puntos", align: "right", render: (s) => s.points, sortValue: (s) => s.points, hideOnMobile: true },
            { key: "last", header: "Última actividad", render: (s) => formatDate(s.last_activity_at), sortValue: (s) => s.last_activity_at, hideOnMobile: true },
            { key: "state", header: "Estado", render: (s) => (s.status !== "active" ? <Chip tone="muted">Retirado</Chip> : supportReasons(s).length ? <Chip tone="warn">Seguimiento</Chip> : <Chip tone="ok">Al día</Chip>) },
          ]}
        />
      )}
      <SidePanel open={importing} title="Importar estudiantes" description="Desde un archivo CSV. Revisa la vista previa antes de registrar." onClose={() => setImporting(false)} wide>
        <ImportStudents groups={activeGroups} onCreated={() => students.reload()} />
      </SidePanel>
      <SidePanel open={adding} title="Agregar estudiantes" description="Solo nombres o seudónimos ficticios. Cada estudiante aparece de inmediato en «Cambiar perfil»." onClose={() => setAdding(false)} wide>
        <AddStudents groups={activeGroups} initialGroup={query.grupo} onCreated={() => students.reload()} />
      </SidePanel>
      <SidePanel open={!!detail} title={detail?.display_name ?? ""} description={detail ? groupLabel({ grade: detail.grade, name: detail.group_name }) : undefined} onClose={() => setDetail(null)} wide>
        {detail && <StudentDetail student={detail} onRevoke={() => { setDetail(null); revoke(detail); }} />}
      </SidePanel>
    </>
  );
}

// 10. StudentDetail
function StudentDetail({ student, onRevoke }: { student: StudentRow; onRevoke: () => void }) {
  const results = useData((api) => api.results(student.group_id), [student.group_id]);
  const cells = results.data?.lessons.map((l) => ({ lesson: l, cell: results.data!.cells.find((c) => c.user_id === student.user_id && c.lesson_id === l.id) })) ?? [];
  const reasons = supportReasons(student);
  return (
    <div className="detail">
      <div className="kpis kpis-3">
        <div className="kpi"><p className="kpi-label">Lecciones</p><p className="kpi-value">{student.lessons_completed}<small>/6</small></p></div>
        <div className="kpi"><p className="kpi-label">Promedio</p><p className="kpi-value">{student.avg_score_pct ?? "—"}{student.avg_score_pct !== null && <small>%</small>}</p></div>
        <div className="kpi"><p className="kpi-label">Puntos</p><p className="kpi-value">{student.points}</p></div>
      </div>
      <p className="ui-small ui-muted">Estudiante ficticio · Última actividad: {formatDate(student.last_activity_at)}</p>
      {reasons.length > 0 && <div className="chips">{reasons.map((r) => <Chip key={r} tone="warn">{r}</Chip>)}</div>}
      <h3 className="detail-h">Resultados por lección</h3>
      {results.loading && !results.data ? <Skeleton lines={4} /> : (
        <BarChart
          caption={`Mejor resultado de ${student.display_name} por material`}
          labels={cells.map((c) => c.lesson.material)}
          series={[{ name: "Mejor resultado", values: cells.map((c) => c.cell?.best_pct ?? null), color: CHART.forest }]}
          unit="%"
          max={100}
          height={200}
        />
      )}
      <ul className="rows">
        {cells.map(({ lesson, cell }) => (
          <li key={lesson.id}>
            <span className="rows-main">{lesson.title}<small>{cell ? `${cell.attempts} intentos · ${formatDate(cell.last_at)}` : "Sin intentos"}</small></span>
            {cell ? <span className={`score-pill${cell.passed ? " is-ok" : ""}`}>{cell.best_pct}%</span> : <span className="ui-muted">—</span>}
          </li>
        ))}
      </ul>
      {student.status === "active" && (
        <div className="ui-form-actions">
          <button className="ui-button ui-button-quiet ui-danger" onClick={onRevoke}>Retirar del grupo</button>
        </div>
      )}
    </div>
  );
}

// 11. AddStudents
function AddStudents({ groups, initialGroup, onCreated }: { groups: Group[]; initialGroup?: string; onCreated: () => void }) {
  const [group, setGroup] = useState(initialGroup && groups.some((g) => g.id === initialGroup) ? initialGroup : groups[0]?.id ?? "");
  const [names, setNames] = useState("");
  const [msg, setMsg] = useState("");
  const [created, setCreated] = useState<CreatedStudent[] | null>(null);
  const action = useAction();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const list = names.split("\n").map((n) => n.trim()).filter(Boolean);
    if (!group) return setMsg("Elige un grupo.");
    if (list.length === 0) return setMsg("Escribe al menos un nombre.");
    if (list.length > 40) return setMsg("Agrega como máximo 40 estudiantes por vez.");
    if (list.some((n) => n.length > 80)) return setMsg("Cada nombre debe tener como máximo 80 caracteres.");
    setMsg("");
    const result = await action.run((api) => api.createStudents(group, list));
    if (result) {
      setNames("");
      setCreated(result);
      onCreated();
    }
  }
  if (created) {
    return (
      <div className="ui-form">
        <Notice tone="success" title={`${created.length === 1 ? "Estudiante registrado" : `${created.length} estudiantes registrados`}`}>
          <p>{created.map((c) => c.displayName).join(", ")}. Ya aparecen en «Cambiar perfil»: no hay usuarios, contraseñas ni códigos que entregar.</p>
        </Notice>
        <div className="ui-form-actions">
          <button className="ui-button ui-button-quiet" onClick={() => setCreated(null)}>Agregar más</button>
        </div>
      </div>
    );
  }
  const groupName = groups.find((g) => g.id === group);
  return (
    <form className="ui-form" onSubmit={submit}>
      <Field label="Grupo">
        <select value={group} onChange={(e) => setGroup(e.target.value)}>
          {groups.map((g) => <option key={g.id} value={g.id}>{groupLabel(g)}</option>)}
        </select>
      </Field>
      <Field label={`Nombres para ${groupName ? groupLabel(groupName) : "el grupo"}`} hint="Uno por línea: nombre e inicial del apellido o un seudónimo. Sin correos, fechas de nacimiento ni documentos.">
        <textarea rows={8} value={names} onChange={(e) => setNames(e.target.value)} placeholder={"Ana M.\nCarlos R."} />
      </Field>
      {msg && <p className="ui-field-error" role="alert">{msg}</p>}
      <ErrorState error={action.error} />
      <button className="ui-button ui-button-dark" disabled={action.pending}>{action.pending ? "Registrando…" : "Registrar estudiantes"}</button>
    </form>
  );
}

/* Actividades */
type ActivityWithGroup = ActivityRow & { group_id: string; group_label: string };
type StateTab = "pending" | "active" | "done";

// 12. activityState
function activityState(a: ActivityWithGroup): StateTab {
  const t = today();
  const complete = a.students > 0 && a.completed === a.students;
  if ((a.due_on && a.due_on < t) || complete) return "done";
  const soon = a.due_on && new Date(`${a.due_on}T12:00:00`).getTime() - Date.now() < 7 * DAY;
  if (soon && a.completed < a.students / 2) return "pending";
  return "active";
}

// 13. loadActivities
async function loadActivities(api: Api): Promise<ActivityWithGroup[]> {
  const groups = (await api.groups()).filter((g) => g.status === "active");
  const lists = await Promise.all(groups.map(async (g) => (await api.activities(g.id)).map((a) => ({ ...a, group_id: g.id, group_label: groupLabel(g) }))));
  return lists.flat();
}

// 14. ActivitiesView
export function ActivitiesView({ query = {} }: { query?: Query }) {
  const list = useData(loadActivities);
  const groups = useData((api) => api.groups());
  const [tab, setTab] = useState<StateTab>("active");
  const [creating, setCreating] = useState(query.nuevo === "1");
  const rows = list.data ?? [];
  const by = (s: StateTab) => rows.filter((a) => activityState(a) === s);
  return (
    <>
      <PageHeader
        title="Actividades"
        description="Asigna lecciones. Se completan al aprobar el cuestionario."
        actions={<button className="ui-button ui-button-dark" onClick={() => setCreating(true)} disabled={!groups.data?.length}><Plus size={17} aria-hidden /> Nueva actividad</button>}
      />
      {groups.data?.length === 0 && <NoGroups />}
      <ErrorState error={list.error} onRetry={list.reload} />
      {list.loading && !list.data && <Skeleton lines={5} block />}
      {list.data && (
        <>
          <Tabs
            label="Estado de las actividades"
            value={tab}
            onChange={setTab}
            options={[
              { value: "pending", label: "Pendientes", count: by("pending").length },
              { value: "active", label: "Activas", count: by("active").length },
              { value: "done", label: "Finalizadas", count: by("done").length },
            ]}
          />
          {tab === "pending" && <p className="ui-small ui-muted tab-note">Entrega en menos de 7 días y menos de la mitad del grupo la completó.</p>}
          {by(tab).length === 0 ? <EmptyState title="No hay actividades en este estado." /> : (
            <div className="card-grid">
              {by(tab).map((a) => (
                <article key={a.id} className="activity-card">
                  <div className="activity-card-head">
                    <div>
                      <p className="ui-eyebrow">{a.group_label}</p>
                      <h3>{a.title}</h3>
                      <p className="ui-small ui-muted">{a.lesson_title}</p>
                    </div>
                    <Ring value={a.students ? (a.completed / a.students) * 100 : 0} size={64} stroke={7} label={`${a.completed} de ${a.students} completaron`}>
                      <strong className="ring-sm">{a.students ? Math.round((a.completed / a.students) * 100) : 0}%</strong>
                    </Ring>
                  </div>
                  {a.instructions && <p className="ui-small activity-instr">{a.instructions}</p>}
                  <div className="activity-card-foot">
                    <span className="ui-small">{a.completed} de {a.students} completaron</span>
                    <Chip tone={tab === "pending" ? "warn" : "neutral"}>{a.due_on ? `Entrega ${formatDate(a.due_on)}` : "Sin fecha"}</Chip>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
      <SidePanel open={creating} title="Nueva actividad" onClose={() => setCreating(false)}>
        <ActivityForm groups={(groups.data ?? []).filter((g) => g.status === "active")} onCreated={() => { setCreating(false); list.reload(); }} />
      </SidePanel>
    </>
  );
}

// 15. ActivityForm
function ActivityForm({ groups, onCreated }: { groups: Group[]; onCreated: () => void }) {
  const lessons = useData((api) => api.lessons());
  const action = useAction();
  const [form, setForm] = useState({ group: groups[0]?.id ?? "", lesson_slug: "", title: "", instructions: "", due_on: "" });
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!form.group || !form.lesson_slug || form.title.trim().length < 3) return setMsg("Elige grupo y lección, y escribe un título de al menos 3 caracteres.");
    if (form.due_on && form.due_on < today()) return setMsg("La fecha de entrega no puede estar en el pasado.");
    const ok = await action.run((api) => api.createActivity(form.group, { lesson_slug: form.lesson_slug, title: form.title.trim(), instructions: form.instructions.trim() || null, due_on: form.due_on || null }));
    if (ok) onCreated();
  }
  return (
    <form className="ui-form" onSubmit={submit}>
      <Field label="Grupo">
        <select value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })}>
          {groups.map((g) => <option key={g.id} value={g.id}>{groupLabel(g)}</option>)}
        </select>
      </Field>
      <Field label="Lección">
        <select value={form.lesson_slug} onChange={(e) => {
          const lesson = lessons.data?.find((l) => l.slug === e.target.value);
          setForm({ ...form, lesson_slug: e.target.value, title: form.title || (lesson ? lesson.title : "") });
        }}>
          <option value="">Elige una lección</option>
          {lessons.data?.map((l) => <option key={l.slug} value={l.slug}>{l.material_name} — {l.title}</option>)}
        </select>
      </Field>
      <Field label="Título"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} /></Field>
      <Field label="Instrucciones (opcional)"><textarea rows={3} value={form.instructions} maxLength={1000} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></Field>
      <Field label="Fecha de entrega (opcional)"><input type="date" value={form.due_on} min={today()} onChange={(e) => setForm({ ...form, due_on: e.target.value })} /></Field>
      {msg && <p className="ui-field-error" role="alert">{msg}</p>}
      <ErrorState error={action.error} />
      <button className="ui-button ui-button-dark" disabled={action.pending}>Asignar actividad</button>
    </form>
  );
}

/* Retos */
type ChallengeTab = "upcoming" | "active" | "ended";

// 16. ChallengesView
export function ChallengesView({ query = {}, embedded = false }: { query?: Query; embedded?: boolean }) {
  const { role } = usePanel();
  const director = role === "director";
  const groups = useData((api) => api.groups());
  const list = useData((api) => api.challenges());
  const [tab, setTab] = useState<ChallengeTab>("active");
  const [creating, setCreating] = useState(query.nuevo === "1");
  const rows = list.data ?? [];
  const by = (s: ChallengeTab) => rows.filter((c) => c.state === s);
  const header = embedded ? (
    <div className="ui-section-head">
      <h2>Retos institucionales</h2>
      <button className="ui-button ui-button-dark ui-button-small" onClick={() => setCreating(true)}><Plus size={16} aria-hidden /> Nuevo reto</button>
    </div>
  ) : (
    <PageHeader
      title="Retos"
      description="Metas con fecha: aprendizaje, cuestionarios, identificación, participación o reciclaje verificado. El avance se calcula en el servidor."
      actions={<button className="ui-button ui-button-dark" onClick={() => setCreating(true)}><Plus size={17} aria-hidden /> Nuevo reto</button>}
    />
  );
  return (
    <section className={embedded ? "ui-section" : undefined}>
      {header}
      <ErrorState error={list.error} onRetry={list.reload} />
      {list.loading && !list.data && <Skeleton lines={4} block />}
      {list.data && (
        <>
          <Tabs
            label="Estado de los retos"
            value={tab}
            onChange={setTab}
            options={[
              { value: "upcoming", label: "Pendientes", count: by("upcoming").length },
              { value: "active", label: "Activos", count: by("active").length },
              { value: "ended", label: "Finalizados", count: by("ended").length },
            ]}
          />
          {by(tab).length === 0 ? <EmptyState title="No hay retos en este estado." /> : (
            <div className="card-grid">
              {by(tab).map((c) => <ChallengeStaffCard key={c.id} c={c} />)}
            </div>
          )}
        </>
      )}
      <SidePanel open={creating} title={director ? "Nuevo reto" : "Nuevo reto para un grupo"} onClose={() => setCreating(false)}>
        <ChallengeForm director={director} groups={(groups.data ?? []).filter((g) => g.status === "active")} onCreated={() => { setCreating(false); list.reload(); }} />
      </SidePanel>
    </section>
  );
}

// 17. ChallengeStaffCard
function ChallengeStaffCard({ c }: { c: Challenge }) {
  const rate = c.eligible ? ((c.participants ?? 0) / c.eligible) * 100 : 0;
  return (
    <article className="challenge-card">
      <div className="challenge-card-top">
        <Chip tone={c.state === "active" ? "lime" : "muted"}>{c.state === "active" ? "Activo" : c.state === "upcoming" ? "Pendiente" : "Finalizado"}</Chip>
        <span className="ui-small ui-muted">{c.kindLabel} · {c.group_name ? `Grupo ${c.group_name}` : "Toda la institución"}</span>
      </div>
      <h3>{c.title}</h3>
      <p className="ui-small">
        Meta: {c.kind === "group_participation" ? `${c.goal_count} % participa` : `${c.goal_count}${c.lesson_title ? ` · «${c.lesson_title}»` : ""}`} · {c.reward ?? 0} puntos
      </p>
      {c.groupProgress ? <ChallengeMeter progress={c.groupProgress} /> : (
        <div className="challenge-part">
          <Meter value={rate} label={`Completaron ${Math.round(rate)}%`} />
          <span className="ui-small"><strong>{c.participants ?? 0}</strong> de {c.eligible ?? 0} lo completaron</span>
        </div>
      )}
      <p className="ui-small ui-muted">{formatDate(c.starts_on)} – {formatDate(c.ends_on)} · {c.verification}</p>
    </article>
  );
}

const CHALLENGE_KINDS: [ChallengeKind, string, string][] = [
  ["learning", "Aprendizaje", "Lecciones completadas (actividades + cuestionario)"],
  ["quiz", "Cuestionarios", "Cuestionarios aprobados"],
  ["identification", "Identificación de materiales", "Preguntas de escaneo respondidas bien"],
  ["group_participation", "Participación grupal", "% del grupo con actividad de aprendizaje"],
  ["verified_recycling", "Reciclaje verificado", "Actividades ambientales aprobadas por un docente"],
  ["institutional_activity", "Actividad institucional", "Jornadas o campañas aprobadas"],
];

// 18. ChallengeForm
function ChallengeForm({ director, groups, onCreated }: { director: boolean; groups: Group[]; onCreated: () => void }) {
  const lessons = useData((api) => api.lessons());
  const action = useAction();
  const [form, setForm] = useState({
    scope: director ? "institution" : groups[0]?.id ?? "", title: "", description: "", kind: "learning" as ChallengeKind,
    goal: 1, lesson_slug: "", starts_on: today(), ends_on: today(7)
  });
  const [msg, setMsg] = useState("");
  const usesLesson = form.kind === "learning" || form.kind === "quiz";
  const percent = form.kind === "group_participation";
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (form.title.trim().length < 3) return setMsg("Escribe un título de al menos 3 caracteres.");
    if (form.ends_on < form.starts_on) return setMsg("La fecha final debe ser igual o posterior a la inicial.");
    if (!form.scope) return setMsg("Elige un grupo.");
    const lesson = usesLesson && form.lesson_slug ? form.lesson_slug : null;
    const body = {
      title: form.title.trim(), description: form.description.trim() || null, kind: form.kind, goal_count: lesson ? 1 : form.goal,
      lesson_slug: lesson, starts_on: form.starts_on, ends_on: form.ends_on
    };
    if (await action.run((api) => api.createChallenge(body, form.scope === "institution" ? null : form.scope))) onCreated();
  }
  return (
    <form className="ui-form" onSubmit={submit}>
      <Field label="Alcance">
        <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
          {director && <option value="institution">Toda la institución</option>}
          {groups.map((g) => <option key={g.id} value={g.id}>Grupo {groupLabel(g)}</option>)}
        </select>
      </Field>
      <Field label="Título"><input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
      <Field label="Descripción (opcional)"><textarea rows={2} maxLength={600} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <Field label="Tipo de reto" hint={CHALLENGE_KINDS.find(([k]) => k === form.kind)?.[2]}>
        <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ChallengeKind, goal: e.target.value === "group_participation" ? 60 : 1, lesson_slug: "" })}>
          {CHALLENGE_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      {usesLesson && (
        <Field label="Lección específica (opcional)" hint="Con una lección, la meta es esa lección.">
          <select value={form.lesson_slug} onChange={(e) => setForm({ ...form, lesson_slug: e.target.value })}>
            <option value="">Cualquier lección</option>
            {lessons.data?.map((l) => <option key={l.slug} value={l.slug}>{l.material_name} — {l.title}</option>)}
          </select>
        </Field>
      )}
      {!(usesLesson && form.lesson_slug) && (
        <Field label={percent ? "Meta (% de participación)" : "Meta (cantidad)"}>
          <input type="number" min={1} max={percent ? 100 : 30} value={form.goal} onChange={(e) => setForm({ ...form, goal: Number(e.target.value) })} />
        </Field>
      )}
      <div className="ui-form-row">
        <Field label="Inicio"><input type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} required /></Field>
        <Field label="Fin"><input type="date" value={form.ends_on} min={form.starts_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} required /></Field>
      </div>
      <p className="ui-small ui-muted">Recompensa según las reglas: {form.scope === "institution" ? "100" : "50"} puntos al cumplirlo, una vez por estudiante.</p>
      {msg && <p className="ui-field-error" role="alert">{msg}</p>}
      <ErrorState error={action.error} />
      <button className="ui-button ui-button-dark" disabled={action.pending}>Crear reto</button>
    </form>
  );
}

/* Estadísticas */
// 19. StatsView
function StatsView({ query = {} }: { query?: Query }) {
  const groups = useData((api) => api.groups());
  const active = (groups.data ?? []).filter((g) => g.status === "active");
  const [chosen, setChosen] = useState(query.grupo ?? "");
  const selected = active.find((g) => g.id === chosen)?.id ?? active[0]?.id ?? "";
  const results = useData((api) => (selected ? api.results(selected) : Promise.resolve(null)), [selected]);
  const [period, setPeriod] = useState<RankingPeriod>("all");
  const ranking = useData((api) => (selected ? api.groupRanking(selected, period) : Promise.resolve(null)), [selected, period]);
  const data = results.data;
  const cell = (u: string, l: string) => data?.cells.find((c) => c.user_id === u && c.lesson_id === l);
  return (
    <>
      <PageHeader title="Estadísticas" description="Primero lo esencial; abre cada categoría para ver el detalle. Pasa el cursor por el ícono de información para ver cómo se calcula cada indicador." />
      {groups.data?.length === 0 && <NoGroups />}
      {active.length > 0 && <AnalyticsPanel />}
      {active.length > 0 && (
        <div className="ui-section-head stats-detail-head">
          <h2>Detalle de un grupo</h2>
          <Field label="Grupo">
            <select value={selected} onChange={(e) => setChosen(e.target.value)}>
              {active.map((g) => <option key={g.id} value={g.id}>{groupLabel(g)}</option>)}
            </select>
          </Field>
        </div>
      )}
      <ErrorState error={results.error} onRetry={results.reload} />
      {results.loading && !data && selected && <Skeleton lines={6} block />}
      {data && (
        <>
          <section className="ui-section">
            <div className="ui-section-head"><h2>Mejor resultado por estudiante y lección</h2></div>
            {data.students.length === 0 ? <EmptyState title="El grupo no tiene estudiantes activos." /> : (
              <div className="dt-wrap">
                <table className="dt-table heat">
                  <caption className="sr-only">Mejor resultado por estudiante y lección</caption>
                  <thead><tr><th scope="col">Estudiante</th>{data.lessons.map((l) => <th scope="col" key={l.id} className="is-center">{l.material}</th>)}</tr></thead>
                  <tbody>
                    {data.students.map((s) => (
                      <tr key={s.user_id}>
                        <th scope="row">{s.display_name}</th>
                        {data.lessons.map((l) => {
                          const c = cell(s.user_id, l.id);
                          return (
                            <td key={l.id} className={`is-center ${c ? (c.passed ? "heat-ok" : "heat-try") : "heat-none"}`} title={c ? `${c.attempts} intentos` : "Sin intentos"}>
                              {c ? `${c.best_pct}%` : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="heat-legend ui-small"><span className="heat-ok" /> Aprobado <span className="heat-try" /> En intento <span className="heat-none" /> Sin intentos</p>
          </section>
          <div className="split">
            <section className="ui-section">
              <div className="ui-section-head"><h2>Ranking privado</h2><Chip tone="muted">{ranking.data?.visibility === "group" ? "Nombres visibles al grupo" : "Estudiantes solo ven su posición"}</Chip></div>
              <Tabs label="Periodo del ranking" value={period} onChange={setPeriod} options={[{ value: "week", label: "Semana" }, { value: "month", label: "Mes" }, { value: "all", label: "Acumulado" }]} />
              {ranking.data && (
                <DataTable
                  caption="Ranking del grupo"
                  rows={ranking.data.entries}
                  rowKey={(e) => e.user_id}
                  pageSize={8}
                  columns={[
                    { key: "pos", header: "#", render: (e) => <span className="rank-n">{e.position}</span>, sortValue: (e) => e.position },
                    { key: "name", header: "Estudiante", primary: true, render: (e) => e.display_name, sortValue: (e) => e.display_name },
                    { key: "points", header: "Puntos", align: "right", render: (e) => e.points, sortValue: (e) => e.points },
                    { key: "lessons", header: "Lecciones", align: "right", render: (e) => e.lessons_completed, sortValue: (e) => e.lessons_completed },
                  ]}
                />
              )}
            </section>
            <section className="ui-section" id="recientes">
              <div className="ui-section-head"><h2>Cuestionarios recientes</h2></div>
              <DataTable
                caption="Cuestionarios recientes"
                rows={data.recent}
                rowKey={(a) => a.id}
                pageSize={8}
                searchText={(a) => `${a.display_name} ${a.lesson_title}`}
                searchLabel="Buscar"
                columns={[
                  { key: "name", header: "Estudiante", primary: true, render: (a) => a.display_name },
                  { key: "lesson", header: "Lección", render: (a) => a.lesson_title, hideOnMobile: true },
                  { key: "score", header: "Resultado", align: "right", render: (a) => <span className={`score-pill${a.passed ? " is-ok" : ""}`}>{pct(a.score, a.max_score)}%</span>, sortValue: (a) => a.score / a.max_score },
                  { key: "date", header: "Fecha", render: (a) => formatDateTime(a.created_at), sortValue: (a) => a.created_at, hideOnMobile: true },
                ]}
              />
            </section>
          </div>
        </>
      )}
    </>
  );
}
