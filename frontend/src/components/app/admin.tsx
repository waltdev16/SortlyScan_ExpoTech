"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminInstitution, AdminLesson, AdminPerson, ApplicationRow, PointRule } from "@/lib/api/types";
import { getDb, setActor } from "@/lib/demo/db";
import { useAction, useData } from "./api-context";
import { SidePanel } from "./overlay";
import { DataTable, Tabs } from "./table";
import { Chip, EmptyState, ErrorState, Field, formatDate, formatDateTime, Notice, PageHeader, Section, Skeleton, ViewFade } from "./ui";
// El editor de contenidos solo se descarga al abrir una lección.
const LessonEditor = dynamic(() => import("./content-editor").then((m) => m.LessonEditor), { loading: () => <Skeleton lines={6} /> });

const TYPE: Record<string, string> = { public: "Pública", private: "Privada", subsidized: "Subvencionada", other: "Otra" };

// 01. AdminApp
export function AdminApp({ section }: { section: string[] }) {
  const [view] = section;
  const views: Record<string, React.ReactNode> = {
    "": <Applications />,
    instituciones: <Institutions />,
    personas: <People />,
    contenidos: <Contents />,
    privacidad: <PrivacyAdmin />,
    auditoria: <Audit />,
  };
  return <ViewFade viewKey={section.join("/")}>{views[view ?? ""] ?? <EmptyState title="Esta sección no existe." />}</ViewFade>;
}

type Status = "pending" | "approved" | "rejected";

// 02. Applications
function Applications() {
  const [status, setStatus] = useState<Status>("pending");
  const list = useData((api) => api.applications(status), [status]);
  const action = useAction();
  const [approved, setApproved] = useState<{ name: string; institutionId: string; director: { id: string; name: string } } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function approve(a: ApplicationRow) {
    if (!window.confirm(`¿Aprobar «${a.institution_name}»? Se creará la institución ficticia con ${a.representative_name} como dirección.`)) return;
    const result = await action.run((api) => api.approveApplication(a.id, notes[a.id]));
    if (result) {
      setApproved({ name: result.institution.name, institutionId: result.institution.id, director: result.director });
      list.reload();
    }
  }
  async function reject(a: ApplicationRow) {
    if (!notes[a.id]?.trim()) return window.alert("Escribe el motivo del rechazo en la nota.");
    if (await action.run((api) => api.rejectApplication(a.id, notes[a.id]))) list.reload();
  }

  return (
    <>
      <PageHeader title="Solicitudes institucionales" description="Solicitudes ficticias guardadas en este navegador. En la plataforma real se verifica la institución y a su representante antes de aprobar." />
      {approved && (
        <Notice tone="success" title={`Institución creada: ${approved.name}`}>
          <p>Su dirección, {approved.director.name}, ya aparece en «Cambiar perfil». En la demostración no se envían correos ni códigos de invitación.</p>
          <EnterAs label={`Entrar como ${approved.director.name}`} institutionId={approved.institutionId} personId={approved.director.id} />
        </Notice>
      )}
      <Tabs label="Estado" value={status} onChange={setStatus} options={[{ value: "pending", label: "Pendientes" }, { value: "approved", label: "Aprobadas" }, { value: "rejected", label: "Rechazadas" }]} />
      <ErrorState error={list.error ?? action.error} onRetry={list.reload} />
      {list.loading && !list.data && <Skeleton lines={5} block />}
      {list.data?.length === 0 && <EmptyState title="No hay solicitudes en este estado." />}
      <ul className="ui-applications">
        {list.data?.map((a) => (
          <li key={a.id}>
            <div className="ui-application-main">
              <p className="ui-list-title">
                {a.institution_name}{" "}
                <Chip tone={a.status === "pending" ? "warn" : a.status === "approved" ? "ok" : "muted"}>{{ pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada" }[a.status]}</Chip>
              </p>
              <p className="ui-small ui-muted">
                {TYPE[a.institution_type] ?? a.institution_type} · {a.department}, {a.district}
                {a.official_code ? ` · Código ${a.official_code}` : ""} · Recibida {formatDateTime(a.created_at)}
              </p>
              <p className="ui-small">{a.representative_name} ({a.representative_position}) · {a.email}{a.phone ? ` · ${a.phone}` : ""}</p>
              {a.message && <p className="ui-small ui-muted">«{a.message}»</p>}
              {a.review_note && <p className="ui-small">Nota: {a.review_note}</p>}
            </div>
            {a.status === "pending" && (
              <div className="ui-application-actions">
                <Field label="Nota de revisión">
                  <input value={notes[a.id] ?? ""} maxLength={500} onChange={(e) => setNotes({ ...notes, [a.id]: e.target.value })} />
                </Field>
                <div className="ui-form-actions">
                  <button className="ui-button ui-button-dark ui-button-small" onClick={() => approve(a)} disabled={action.pending}>Aprobar</button>
                  <button className="ui-button ui-button-quiet ui-button-small" onClick={() => reject(a)} disabled={action.pending}>Rechazar</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

// 03. Institutions
function Institutions() {
  const list = useData((api) => api.adminInstitutions());
  const action = useAction();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", department: "San Salvador", district: "", director_name: "" });
  const [created, setCreated] = useState<{ name: string; institutionId: string; director: { id: string; name: string } } | null>(null);
  async function toggle(i: AdminInstitution) {
    const next = i.status === "active" ? "suspended" : "active";
    if (next === "suspended" && !window.confirm(`¿Suspender ${i.name}? Sus perfiles ficticios no podrán entrar hasta reactivarla.`)) return;
    if (await action.run((api) => api.setInstitutionStatus(i.id, next))) list.reload();
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await action.run((api) => api.createInstitution(form));
    if (r) {
      setCreated({ name: r.institution.name, institutionId: r.institution.id, director: r.director });
      setForm({ name: "", department: "San Salvador", district: "", director_name: "" });
      list.reload();
    }
  }
  function enterDirector(i: AdminInstitution) {
    const d = getDb().institutions[i.id]?.staff.find((x) => x.role === "director" && x.status === "active");
    if (!d || i.status !== "active") return router.push("/acceso?rol=director");
    setActor({ role: "director", personId: d.user_id, institutionId: i.id });
    router.push("/panel/director");
  }
  return (
    <>
      <PageHeader title="Instituciones" description="Estado, personal y estudiantes de cada institución ficticia de la demostración."
        actions={<button className="ui-button ui-button-dark" onClick={() => { setCreating(true); setCreated(null); }}>Crear institución</button>} />
      <ErrorState error={list.error ?? action.error} onRetry={list.reload} />
      {list.loading && !list.data && <Skeleton lines={5} />}
      {list.data && (
        <DataTable
          caption="Instituciones"
          rows={list.data}
          rowKey={(i) => i.id}
          searchText={(i) => `${i.name} ${i.official_code ?? ""} ${i.department} ${i.district}`}
          searchLabel="Buscar institución"
          filters={[{ key: "status", label: "Estado", options: [{ value: "", label: "Todas" }, { value: "active", label: "Activas" }, { value: "suspended", label: "Suspendidas" }], test: (i, v) => i.status === v }]}
          openLabel={() => "Ver detalle"}
          actions={(i) => [
            { label: "Entrar como su dirección", hidden: i.status !== "active" || !i.directors, onSelect: () => enterDirector(i) },
            { label: i.status === "active" ? "Suspender" : "Reactivar", danger: i.status === "active", onSelect: () => toggle(i) },
          ]}
          columns={[
            { key: "name", header: "Institución", primary: true, render: (i) => i.name, sortValue: (i) => i.name },
            { key: "loc", header: "Ubicación", render: (i) => `${i.department}, ${i.district}`, sortValue: (i) => i.department, hideOnMobile: true },
            { key: "d", header: "Dirección", align: "right", render: (i) => i.directors, sortValue: (i) => i.directors },
            { key: "t", header: "Docentes", align: "right", render: (i) => i.teachers, sortValue: (i) => i.teachers },
            { key: "s", header: "Estudiantes", align: "right", render: (i) => i.students, sortValue: (i) => i.students },
            { key: "st", header: "Estado", render: (i) => <Chip tone={i.status === "active" ? "ok" : "warn"}>{i.status === "active" ? "Activa" : "Suspendida"}</Chip> },
          ]}
        />
      )}
      <SidePanel open={creating} title="Crear institución" description="Institución ficticia: solo existe en este navegador." onClose={() => setCreating(false)}>
        {created ? (
          <Notice tone="success" title={`Institución creada: ${created.name}`}>
            <p>Su dirección, {created.director.name}, ya puede entrar desde «Cambiar perfil» para crear grupos, docentes y estudiantes.</p>
            <EnterAs label={`Entrar como ${created.director.name}`} institutionId={created.institutionId} personId={created.director.id} />
          </Notice>
        ) : (
          <form className="ui-form" onSubmit={create}>
            <Field label="Nombre de la institución"><input value={form.name} minLength={3} maxLength={120} required onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <div className="ui-form-row">
              <Field label="Departamento"><input value={form.department} maxLength={60} required onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
              <Field label="Distrito"><input value={form.district} minLength={2} maxLength={80} required onChange={(e) => setForm({ ...form, district: e.target.value })} /></Field>
            </div>
            <Field label="Nombre de la dirección" hint="Solo un nombre ficticio. No se piden correos ni contraseñas.">
              <input value={form.director_name} minLength={2} maxLength={80} required onChange={(e) => setForm({ ...form, director_name: e.target.value })} />
            </Field>
            <ErrorState error={action.error} />
            <button className="ui-button ui-button-dark" disabled={action.pending}>Crear institución</button>
          </form>
        )}
      </SidePanel>
    </>
  );
}

/** Personas ficticias de todas las instituciones (solo lectura: cada institución gestiona las suyas). */
// 04. People
function People() {
  const list = useData((api) => api.adminPeople());
  const ROLES: Record<string, string> = { student: "Estudiante", teacher: "Docente", director: "Dirección" };
  return (
    <>
      <PageHeader title="Personas ficticias" description="Todas las personas de la demostración. Ninguna corresponde a alguien real; no tienen correo ni contraseña." />
      <ErrorState error={list.error} onRetry={list.reload} />
      {list.loading && !list.data && <Skeleton lines={6} />}
      {list.data && (
        <DataTable<AdminPerson>
          caption="Personas"
          rows={list.data}
          rowKey={(p) => p.id}
          searchText={(p) => `${p.name} ${p.institution} ${p.group ?? ""}`}
          searchLabel="Buscar persona"
          filters={[{ key: "role", label: "Perfil", options: [{ value: "", label: "Todos" }, { value: "student", label: "Estudiantes" }, { value: "teacher", label: "Docentes" }, { value: "director", label: "Dirección" }], test: (p, v) => p.role === v }]}
          columns={[
            { key: "name", header: "Nombre", primary: true, render: (p) => p.name, sortValue: (p) => p.name },
            { key: "role", header: "Perfil", render: (p) => ROLES[p.role] ?? p.role, sortValue: (p) => p.role },
            { key: "inst", header: "Institución", render: (p) => p.institution, sortValue: (p) => p.institution, hideOnMobile: true },
            { key: "group", header: "Grupo", render: (p) => p.group ?? "—", hideOnMobile: true },
            { key: "st", header: "Estado", render: (p) => <Chip tone={p.status === "active" ? "ok" : "muted"}>{p.status === "active" ? "Activa" : "Retirada"}</Chip> },
          ]}
        />
      )}
    </>
  );
}

/** Abre el panel de una persona ficticia recién creada. */
// 05. EnterAs
function EnterAs({ label, institutionId, personId }: { label: string; institutionId: string; personId: string }) {
  const router = useRouter();
  return (
    <button type="button" className="ui-button ui-button-dark ui-button-small" onClick={() => { setActor({ role: "director", personId, institutionId }); router.push("/panel/director"); }}>
      {label}
    </button>
  );
}

// 06. Contents
function Contents() {
  const list = useData((api) => api.adminLessons());
  const action = useAction();
  const [editing, setEditing] = useState<AdminLesson | null>(null);
  const [creating, setCreating] = useState(false);
  async function setStatus(l: AdminLesson, status: string) {
    if (await action.run((api) => api.updateLesson(l.id, { status }))) list.reload();
  }
  const label = { published: "Publicada", draft: "Borrador", archived: "Archivada" };
  return (
    <>
      <PageHeader title="Contenidos educativos"
        description="Edita secciones, actividades, preguntas y retroalimentación. Lo que ya tiene respuestas se versiona: los resultados históricos no cambian."
        actions={<button className="ui-button ui-button-dark" onClick={() => setCreating(true)}>Nueva lección</button>} />
      <ErrorState error={list.error ?? action.error} onRetry={list.reload} />
      {list.loading && !list.data && <Skeleton lines={6} />}
      {list.data && (
        <DataTable
          caption="Lecciones"
          rows={list.data}
          rowKey={(l) => l.id}
          searchText={(l) => `${l.title} ${l.material}`}
          searchLabel="Buscar lección"
          onOpen={(l) => setEditing(l)}
          openLabel={() => "Editar"}
          actions={(l) => [
            { label: "Editar contenido", onSelect: () => setEditing(l) },
            { label: "Publicar", hidden: l.status === "published", onSelect: () => setStatus(l, "published") },
            { label: "Pasar a borrador", hidden: l.status === "draft", onSelect: () => setStatus(l, "draft") },
            { label: "Archivar", danger: true, hidden: l.status === "archived", onSelect: () => setStatus(l, "archived") },
          ]}
          columns={[
            { key: "title", header: "Lección", primary: true, render: (l) => l.title, sortValue: (l) => l.title },
            { key: "m", header: "Material", render: (l) => l.material, sortValue: (l) => l.material },
            { key: "q", header: "Preguntas", align: "right", render: (l) => l.questions },
            { key: "v", header: "Versión", align: "right", render: (l) => `v${l.version}`, sortValue: (l) => l.version },
            { key: "s", header: "Estado", render: (l) => <Chip tone={l.status === "published" ? "ok" : "muted"}>{label[l.status]}</Chip> },
          ]}
        />
      )}
      <SidePanel open={!!editing} title={editing?.title ?? "Editar lección"} description={editing?.slug} onClose={() => setEditing(null)} wide>
        {editing && <LessonEditor lessonId={editing.id} onChanged={list.reload} />}
      </SidePanel>
      <SidePanel open={creating} title="Nueva lección" description="Se crea como borrador; publícala cuando tenga preguntas." onClose={() => setCreating(false)} wide>
        <NewLesson onCreated={(id) => { setCreating(false); list.reload(); setEditing({ id } as AdminLesson); }} />
      </SidePanel>
      <PointRules />
    </>
  );
}

// 07. NewLesson
function NewLesson({ onCreated }: { onCreated: (id: string) => void }) {
  const action = useAction();
  const [f, setF] = useState({ material: "plastic", slug: "", title: "", summary: "", what: "", identify: "", classify: "", mistakes: "" });
  const lines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await action.run((api) => api.createLesson({
      material: f.material, slug: f.slug.trim(), title: f.title.trim(), summary: f.summary.trim(),
      content: { what: f.what.trim(), identify: lines(f.identify), classify: lines(f.classify), mistakes: lines(f.mistakes), tips: [] }
    }));
    if (r) onCreated(r.id);
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="ui-form" onSubmit={submit}>
      <div className="ui-form-row">
        <Field label="Material">
          <select value={f.material} onChange={set("material")}>
            {Object.entries({ plastic: "Plástico", paper: "Papel", cardboard: "Cartón", metal: "Metal", glass: "Vidrio", organic: "Orgánicos" }).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Identificador" hint="Minúsculas, números y guiones. Ej.: plastico-avanzado"><input value={f.slug} pattern="[a-z0-9\-]{3,60}" onChange={set("slug")} required /></Field>
      </div>
      <Field label="Título"><input value={f.title} minLength={3} maxLength={120} onChange={set("title")} required /></Field>
      <Field label="Resumen"><textarea rows={2} value={f.summary} minLength={10} maxLength={400} onChange={set("summary")} required /></Field>
      <Field label="¿Qué es?"><textarea rows={3} value={f.what} minLength={10} onChange={set("what")} required /></Field>
      <Field label="Cómo identificarlo" hint="Un punto por línea."><textarea rows={3} value={f.identify} onChange={set("identify")} required /></Field>
      <Field label="Cómo prepararlo" hint="Un punto por línea."><textarea rows={3} value={f.classify} onChange={set("classify")} required /></Field>
      <Field label="Errores frecuentes" hint="Un punto por línea."><textarea rows={3} value={f.mistakes} onChange={set("mistakes")} required /></Field>
      <ErrorState error={action.error} />
      <button className="ui-button ui-button-dark" disabled={action.pending}>Crear borrador</button>
    </form>
  );
}

/** Privacidad: eliminaciones escaladas por la dirección y periodos de retención configurables. */
// 08. PrivacyAdmin
function PrivacyAdmin() {
  const escalated = useData((api) => api.escalatedPrivacy());
  const retention = useData((api) => api.retention());
  const action = useAction();
  const [days, setDays] = useState<Record<string, number>>({});
  const [ran, setRan] = useState("");
  async function erase(id: string, name: string | null) {
    const typed = window.prompt(`Esto elimina de forma permanente los datos de ${name ?? "la persona"} y su cuenta. Escribe ELIMINAR para confirmar.`);
    if (typed !== "ELIMINAR") return;
    if (await action.run((api) => api.erasePrivacy(id))) escalated.reload();
  }
  async function saveDays(key: string) {
    if (await action.run((api) => api.updateRetention(key, days[key]))) retention.reload();
  }
  async function run() {
    if (!window.confirm("Se eliminarán los registros que superan su periodo de retención. ¿Continuar?")) return;
    const r = await action.run((api) => api.runRetention(false));
    if (r) { setRan(Object.entries(r.result).map(([k, v]) => `${k}: ${v.rows}`).join(" · ")); retention.reload(); }
  }
  return (
    <>
      <PageHeader title="Privacidad y retención" description="Eliminaciones solicitadas por instituciones y periodos de conservación de datos. Todo queda en auditoría." />
      <ErrorState error={escalated.error ?? retention.error ?? action.error} onRetry={() => { escalated.reload(); retention.reload(); }} />
      <Section title="Eliminaciones escaladas">
        {escalated.loading && !escalated.data ? <Skeleton lines={3} /> : (escalated.data ?? []).length === 0 ? <p className="ui-muted">No hay eliminaciones pendientes.</p> : (
          <ul className="rows">{(escalated.data ?? []).map((r) => (
            <li key={r.id}>
              <span className="rows-main">{r.subject_name ?? "—"} · {r.institution_name}<small>{r.details} · {formatDate(r.created_at)}</small></span>
              <button className="ui-button ui-button-quiet ui-danger ui-button-small" onClick={() => erase(r.id, r.subject_name)} disabled={action.pending}>Eliminar datos</button>
            </li>
          ))}</ul>
        )}
      </Section>
      <Section title="Periodos de retención">
        <p className="ui-muted">El aprendizaje, los puntos y los registros ambientales se conservan mientras la cuenta exista; para retirarlos se usa una solicitud de anonimización o eliminación.</p>
        {retention.data && (
          <ul className="rows">{retention.data.settings.map((s) => (
            <li key={s.key}>
              <span className="rows-main">{s.description}<small>{retention.data!.preview[s.key]?.rows ?? 0} registros superan hoy este periodo</small></span>
              <span className="ed-actions">
                <label className="sr-only" htmlFor={`ret-${s.key}`}>Días para {s.description}</label>
                <input id={`ret-${s.key}`} type="number" min={30} max={3650} className="ui-input-small" value={days[s.key] ?? s.days}
                  onChange={(e) => setDays({ ...days, [s.key]: Number(e.target.value) })} />
                <span className="ui-small">días</span>
                <button className="ui-link-button" onClick={() => saveDays(s.key)} disabled={action.pending || (days[s.key] ?? s.days) === s.days}>Guardar</button>
              </span>
            </li>
          ))}</ul>
        )}
        <button className="ui-button ui-button-quiet" onClick={run} disabled={action.pending}>Aplicar retención ahora</button>
        {ran && <p className="ui-success" role="status">Registros eliminados · {ran}</p>}
      </Section>
    </>
  );
}

const PERIOD = { day: "por día", week: "por semana", month: "por mes" } as const;

/** Reglas de puntos (fuente única en la base de datos). Los cambios no alteran puntos ya otorgados y quedan auditados. */
// 09. PointRules
function PointRules() {
  const { data, error, loading, reload } = useData((api) => api.pointRules());
  const action = useAction();
  const [editing, setEditing] = useState<PointRule | null>(null);
  const [form, setForm] = useState({ points: 0, limit: "", period: "" as "" | "day" | "week" | "month", active: true });
  function open(r: PointRule) {
    setEditing(r);
    setForm({ points: r.points, limit: r.max_awards ? String(r.max_awards) : "", period: r.period ?? "", active: r.active });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const limited = form.limit !== "" && form.period !== "";
    const ok = await action.run((api) => api.updatePointRule(editing.key, {
      points: form.points, active: form.active,
      max_awards: limited ? Number(form.limit) : null, period: limited ? (form.period as "day" | "week" | "month") : null
    }));
    if (ok) { setEditing(null); reload(); }
  }
  return (
    <section className="ui-section">
      <div className="ui-section-head"><h2>Reglas de puntos y niveles</h2></div>
      <p className="ui-small ui-muted">Un cambio afecta solo a otorgamientos futuros de esta demostración. Los niveles se ajustan en lib/demo/demo-api.ts (ver la guía de edición).</p>
      <ErrorState error={error} onRetry={reload} />
      {loading && !data && <Skeleton lines={4} />}
      {data && (
        <>
          <DataTable
            caption="Reglas de puntos"
            rows={data.rules}
            rowKey={(r) => r.key}
            onOpen={open}
            openLabel={() => "Editar"}
            columns={[
              { key: "label", header: "Regla", primary: true, render: (r) => r.label },
              { key: "points", header: "Puntos", align: "right", render: (r) => r.points, sortValue: (r) => r.points },
              { key: "limit", header: "Límite", render: (r) => (r.max_awards ? `${r.max_awards} ${PERIOD[r.period!]}` : "Una vez por origen") },
              { key: "active", header: "Estado", render: (r) => <Chip tone={r.active ? "ok" : "muted"}>{r.active ? "Activa" : "Inactiva"}</Chip> },
            ]}
          />
          <p className="ui-small">Niveles: {data.levels.map((l) => `${l.name} (${l.min_points})`).join(" · ")}</p>
        </>
      )}
      <SidePanel open={!!editing} title="Editar regla" description={editing?.key} onClose={() => setEditing(null)}>
        <form className="ui-form" onSubmit={save}>
          <Field label="Puntos"><input type="number" min={0} max={1000} value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} /></Field>
          <div className="ui-form-row">
            <Field label="Límite (opcional)"><input type="number" min={1} max={1000} value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} /></Field>
            <Field label="Periodo">
              <select value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value as typeof form.period })}>
                <option value="">Sin límite</option><option value="day">Día</option><option value="week">Semana</option><option value="month">Mes</option>
              </select>
            </Field>
          </div>
          <label className="ui-check"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Regla activa</label>
          <ErrorState error={action.error} />
          <button className="ui-button ui-button-dark" disabled={action.pending}>Guardar</button>
        </form>
      </SidePanel>
    </section>
  );
}

// 10. Audit
function Audit() {
  const list = useData((api) => api.audit());
  const actions = [...new Set((list.data ?? []).map((r) => r.action))].sort();
  return (
    <>
      <PageHeader title="Registro de auditoría" description="Aprobaciones, invitaciones, altas, revocaciones y cambios de contenido." />
      <ErrorState error={list.error} onRetry={list.reload} />
      {list.loading && !list.data && <Skeleton lines={8} />}
      {list.data && (
        <DataTable
          caption="Registro de auditoría"
          rows={list.data}
          rowKey={(r) => String(r.id)}
          pageSize={15}
          searchText={(r) => `${r.action} ${r.actor_name ?? ""} ${r.institution_name ?? ""}`}
          searchLabel="Buscar acción, persona o institución"
          filters={[{ key: "a", label: "Acción", options: [{ value: "", label: "Todas las acciones" }, ...actions.map((a) => ({ value: a, label: a }))], test: (r, v) => r.action === v }]}
          columns={[
            { key: "date", header: "Fecha", render: (r) => formatDateTime(r.created_at), sortValue: (r) => r.created_at },
            { key: "action", header: "Acción", primary: true, render: (r) => <code>{r.action}</code>, sortValue: (r) => r.action },
            { key: "actor", header: "Quién", render: (r) => r.actor_name ?? "Sistema / público" },
            { key: "inst", header: "Institución", render: (r) => r.institution_name ?? "—", hideOnMobile: true },
            { key: "ref", header: "Referencia", render: (r) => r.request_id?.slice(0, 10) ?? "—", hideOnMobile: true },
          ]}
        />
      )}
    </>
  );
}
