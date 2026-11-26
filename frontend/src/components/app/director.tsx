"use client";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import type { SortingRule, StaffRow } from "@/lib/api/types";
import { useAction, useData, usePanel } from "./api-context";
import { AnimatedNumber } from "./charts";
import { InfoTip, SidePanel } from "./overlay";
import { AccountSettings } from "./settings";
import { ChallengesView, groupLabel, GroupsView, StudentsView } from "./staff";
import { AnalyticsPanel, ImpactView, ReportsCatalog, ReviewsView } from "./staff-extra";
import { DataTable } from "./table";
import { DirectorPrivacy, InstitutionHistory } from "./school";
import { Bento, Chip, EmptyState, ErrorState, Field, Notice, PageHeader, SeeAll, Skeleton, Tile, ViewFade } from "./ui";

type Query = Record<string, string | undefined>;

// 01. MethodologyNote
export function MethodologyNote() {
  return (
    <InfoTip label="Metodología">
      Aprendizaje y participación se calculan con actividades registradas en el servidor. El impacto ambiental usa solo registros
      verificados por la dirección. Un escaneo no significa que un residuo se haya reciclado, y no se calculan equivalencias de CO₂.
    </InfoTip>
  );
}

// 02. DirectorApp
export function DirectorApp({ section, query }: { section: string[]; query: Query }) {
  const [view] = section;
  const views: Record<string, React.ReactNode> = {
    "": <DirectorOverview />,
    docentes: <TeachersView />,
    estudiantes: <StudentsView query={query} />,
    grupos: <GroupsView />,
    aprendizaje: <LearningView />,
    participacion: <ParticipationView query={query} />,
    impacto: <ImpactView />,
    verificacion: <ReviewsView />,
    reportes: <ReportsCatalog />,
    configuracion: <InstitutionSettings />,
  };
  return <ViewFade viewKey={section.join("/")}>{views[view ?? ""] ?? <EmptyState title="Esta sección no existe." />}</ViewFade>;
}

// 03. DirectorOverview
function DirectorOverview() {
  const { base } = usePanel();
  const overview = useData((api) => api.directorOverview());
  const stats = useData((api) => api.analytics({}));
  const data = overview.data;
  if (overview.loading && !data) return <Skeleton lines={8} block />;
  if (overview.error) return <ErrorState error={overview.error} onRetry={overview.reload} />;
  if (!data) return null;
  const s = stats.data?.summary;
  const env = stats.data?.environment;
  const reinforce = stats.data?.byMaterial.filter((m) => m.needsReinforcement) ?? [];
  const n = (v: number | null | undefined, suffix = "") => (v === null || v === undefined ? "—" : `${v.toLocaleString("es-SV")}${suffix}`);
  return (
    <>
      <PageHeader eyebrow={`${data.institution.department} · ${data.institution.district}`} title={data.institution.name} actions={<MethodologyNote />} />
      <div className="kpis">
        <div className="kpi"><p className="kpi-label">Estudiantes</p><p className="kpi-value"><AnimatedNumber value={data.counts.students} /></p><p className="kpi-hint">{data.counts.groups} grupos activos</p></div>
        <div className="kpi"><p className="kpi-label">Docentes</p><p className="kpi-value"><AnimatedNumber value={data.counts.teachers} /></p><p className="kpi-hint">registrados en la institución</p></div>
        <div className="kpi"><p className="kpi-label">Participación (90 días)</p><p className="kpi-value">{n(s?.participationPct, " %")}</p><p className="kpi-hint">{s ? `${s.active} de ${s.enrolled} estudiantes` : ""}</p></div>
        <div className="kpi"><p className="kpi-label">Lecciones completadas (90 días)</p><p className="kpi-value">{n(s?.lessonsCompleted)}</p><p className="kpi-hint">finalización {n(s?.completionRatePct, " %")}</p></div>
      </div>
      <ErrorState error={stats.error} onRetry={stats.reload} />
      <Bento>
        <Tile span={4} title="Aprendizaje" action={<SeeAll href={`${base}/aprendizaje`}>Ver detalle</SeeAll>}>
          <dl className="facts">
            <div><dt>Promedio del primer intento</dt><dd>{n(s?.firstAttemptPct, " %")}</dd></div>
            <div><dt>Estudiantes evaluados</dt><dd>{n(s?.studentsEvaluated)}</dd></div>
            <div><dt>Evaluación inicial → final</dt><dd>{stats.data?.assessment.overall.pairs ? `${stats.data.assessment.overall.prePct} % → ${stats.data.assessment.overall.postPct} % (${stats.data.assessment.overall.pairs} pares)` : "Sin pares todavía"}</dd></div>
          </dl>
          {reinforce.length > 0 && <p className="tile-note">Reforzar: {reinforce.map((m) => m.name).join(", ")}</p>}
        </Tile>
        <Tile span={4} title="Participación" action={<SeeAll href={`${base}/participacion`}>Ver detalle</SeeAll>}>
          <dl className="facts">
            <div><dt>Estudiantes activos</dt><dd>{n(s?.active)}</dd></div>
            <div><dt>Retos completados</dt><dd>{n(s?.challengesCompleted)}</dd></div>
            <div><dt>Actividades verificadas</dt><dd>{n(s?.verifiedActions)}{s?.pendingReviews ? ` · ${s.pendingReviews} pendientes` : ""}</dd></div>
          </dl>
          {!!s?.groupsWithoutRecords && <p className="tile-note">{s.groupsWithoutRecords} {s.groupsWithoutRecords === 1 ? "grupo" : "grupos"} sin registros en el periodo.</p>}
        </Tile>
        <Tile span={4} tone="sage" title="Impacto ambiental verificado" action={<SeeAll href={`${base}/impacto`}>Ver detalle</SeeAll>}>
          {env && env.byMaterial.length > 0 ? (
            <dl className="facts">
              <div><dt>Kilogramos verificados</dt><dd>{env.totals.kg.toLocaleString("es-SV")} kg</dd></div>
              <div><dt>Objetos verificados</dt><dd>{env.totals.items.toLocaleString("es-SV")}</dd></div>
              <div><dt>Registros por verificar</dt><dd>{env.pendingRecords}</dd></div>
            </dl>
          ) : (
            <p className="tile-empty">Sin registros verificados en los últimos 90 días. Registra un pesaje o una entrega para empezar.</p>
          )}
        </Tile>
      </Bento>
    </>
  );
}

// 04. TeachersView
function TeachersView() {
  const staff = useData((api) => api.staff());
  const action = useAction();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const result = await action.run((api) => api.createTeacher(name));
    if (result) {
      setCreated(result.name);
      setName("");
      staff.reload();
    }
  }
  async function revokeTeacher(s: StaffRow) {
    if (!window.confirm(`¿Retirar a ${s.display_name}? Dejará de tener grupos asignados y su perfil ya no aparecerá en el selector.`)) return;
    if (await action.run((api) => api.revokeStaff(s.membership_id))) staff.reload();
  }
  return (
    <>
      <PageHeader
        title="Docentes"
        description="Registra docentes con un nombre ficticio y asígnalos a grupos. En la demostración no hay invitaciones, correos ni contraseñas."
        actions={<button className="ui-button ui-button-dark" onClick={() => { setCreated(null); setAdding(true); }}><Plus size={17} aria-hidden /> Registrar docente</button>}
      />
      <ErrorState error={action.error ?? staff.error} onRetry={staff.reload} />
      {staff.loading && !staff.data ? <Skeleton lines={5} /> : staff.data && (
        <DataTable
          caption="Personal de la institución"
          rows={staff.data}
          rowKey={(s) => s.membership_id}
          searchText={(s) => s.display_name}
          searchLabel="Buscar docente"
          filters={[{ key: "status", label: "Estado", initial: "active", options: [{ value: "active", label: "Activos" }, { value: "revoked", label: "Retirados" }, { value: "", label: "Todos" }], test: (s, v) => s.status === v }]}
          rowClass={(s) => (s.status !== "active" ? "is-muted" : undefined)}
          openLabel={() => "Ver detalle"}
          actions={(s) => [{ label: "Retirar docente", danger: true, onSelect: () => revokeTeacher(s), hidden: s.role !== "teacher" || s.status !== "active" }]}
          columns={[
            { key: "name", header: "Nombre", primary: true, render: (s) => s.display_name, sortValue: (s) => s.display_name },
            { key: "role", header: "Rol", render: (s) => (s.role === "director" ? "Dirección" : "Docente") },
            { key: "groups", header: "Grupos", render: (s) => (s.groups.length ? s.groups.map((g) => groupLabel(g)).join(", ") : <span className="ui-muted">Sin grupos</span>), sortValue: (s) => s.groups.length },
            { key: "status", header: "Estado", render: (s) => <Chip tone={s.status === "active" ? "ok" : "muted"}>{s.status === "active" ? "Activo" : "Retirado"}</Chip> },
          ]}
        />
      )}
      <SidePanel open={adding} title="Registrar docente" description="Solo se pide un nombre ficticio. Asígnale grupos desde «Grupos»." onClose={() => setAdding(false)}>
        {created ? (
          <div className="ui-form">
            <Notice tone="success" title="Docente registrado">
              <p>{created} ya aparece en «Cambiar perfil». Asígnale un grupo desde la sección Grupos para que pueda trabajar con estudiantes.</p>
            </Notice>
            <button className="ui-button ui-button-quiet" onClick={() => setCreated(null)}>Registrar a otra persona</button>
          </div>
        ) : (
          <form className="ui-form" onSubmit={add}>
            <Field label="Nombre del docente" hint="Usa un nombre inventado."><input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={80} required autoComplete="off" /></Field>
            <ErrorState error={action.error} />
            <button className="ui-button ui-button-dark" disabled={action.pending}>Registrar docente</button>
          </form>
        )}
      </SidePanel>
    </>
  );
}

// 05. LearningView
function LearningView() {
  return (
    <>
      <PageHeader title="Aprendizaje" description="Resultados por material y por grupo, y comparación de evaluaciones inicial y final." actions={<MethodologyNote />} />
      <AnalyticsPanel tabs={["learning", "assessment"]} />
    </>
  );
}

// 06. ParticipationView
function ParticipationView({ query }: { query: Query }) {
  return (
    <>
      <PageHeader title="Participación" description="Constancia, retos y actividades verificadas por grupo." actions={<MethodologyNote />} />
      <AnalyticsPanel tabs={["participation"]} />
      <div id="retos">
        <ChallengesView query={query} embedded />
      </div>
    </>
  );
}

// 07. InstitutionSettings
function InstitutionSettings() {
  const { data, error, loading, reload } = useData((api) => api.institution());
  const action = useAction();
  const [form, setForm] = useState({ district: "", contact_email: "", contact_phone: "" });
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (data) setForm({ district: data.district, contact_email: data.contact_email ?? "", contact_phone: data.contact_phone ?? "" });
  }, [data]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (form.contact_phone && !/^[0-9+() -]{7,20}$/.test(form.contact_phone)) return setMsg("Teléfono no válido.");
    const ok = await action.run((api) => api.updateInstitution({ district: form.district.trim(), contact_email: form.contact_email.trim() || null, contact_phone: form.contact_phone.trim() || null }));
    if (ok) {
      setMsg("Datos actualizados.");
      reload();
    }
  }
  return (
    <>
      <PageHeader title="Configuración" />
      {loading && !data && <Skeleton lines={4} />}
      <ErrorState error={error ?? action.error} onRetry={reload} />
      {data && (
        <Bento>
          <Tile span={5} tone="sage" title="Institución">
            <dl className="facts">
              <div><dt>Nombre</dt><dd>{data.name}</dd></div>
              <div><dt>Código institucional</dt><dd>{data.official_code ?? "—"}</dd></div>
              <div><dt>Departamento</dt><dd>{data.department}</dd></div>
            </dl>
            <p className="tile-note">Nombre, código y departamento los corrige la superadministración para evitar suplantaciones.</p>
          </Tile>
          <Tile span={7} title="Contacto">
            <form className="ui-form" onSubmit={save}>
              <Field label="Distrito"><input value={form.district} minLength={2} maxLength={80} onChange={(e) => setForm({ ...form, district: e.target.value })} required /></Field>
              <div className="ui-form-row">
                <Field label="Correo de contacto"><input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></Field>
                <Field label="Teléfono de contacto"><input type="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></Field>
              </div>
              {msg && <p className={msg.startsWith("Datos") ? "ui-success" : "ui-field-error"} role="status">{msg}</p>}
              <button className="ui-button ui-button-dark" disabled={action.pending}>Guardar cambios</button>
            </form>
          </Tile>
          <RankingSetting value={data.ranking_scope ?? "group"} onSaved={reload} />
          <SortingRules />
        </Bento>
      )}
      <DirectorPrivacy />
      <InstitutionHistory />
      <AccountSettings embedded />
    </>
  );
}

const RULE_LABELS: Record<string, string> = {
  plastic: "Plástico", paper: "Papel", cardboard: "Cartón", metal: "Metal", glass: "Vidrio", organic: "Orgánico", other: "Otros residuos",
};

/** Reglas locales que el escáner muestra a estudiantes. No existen colores de contenedor universales. */
// 08. SortingRules
function SortingRules() {
  const { data, error, reload } = useData((api) => api.sortingRules());
  const action = useAction();
  const [rules, setRules] = useState<SortingRule[]>([]);
  const [msg, setMsg] = useState("");
  useEffect(() => { if (data) setRules(data.map((r) => ({ ...r }))); }, [data]);
  const set = (i: number, patch: Partial<SortingRule>) => setRules((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const saved = await action.run((api) => api.saveSortingRules(rules));
    if (saved) {
      setMsg("Reglas guardadas. El escáner ya las muestra.");
      reload();
    }
  }
  return (
    <Tile span={12} title="Reglas de separación en la institución" className="sorting-rules">
      <p className="tile-note">
        Indica qué recibe tu punto de acopio y dónde se deposita cada material (por ejemplo, &quot;bolsa amarilla junto a la dirección&quot;).
        El escáner muestra esta información después de identificar un residuo. Deja &quot;Sin definir&quot; si aún no aplica.
      </p>
      <ErrorState error={error ?? action.error} onRetry={reload} />
      {rules.length > 0 && (
        <form className="ui-form" onSubmit={save}>
          <div className="sorting-rules-list">
            {rules.map((r, i) => (
              <fieldset key={r.material} className="sorting-rule">
                <legend>{r.label ?? RULE_LABELS[r.material]}</legend>
                <Field label="¿Se recibe?">
                  <select value={r.accepted === null ? "" : String(r.accepted)}
                    onChange={(e) => set(i, { accepted: e.target.value === "" ? null : e.target.value === "true" })}>
                    <option value="">Sin definir</option>
                    <option value="true">Sí se recibe</option>
                    <option value="false">No se recibe</option>
                  </select>
                </Field>
                <Field label="Dónde se deposita">
                  <input value={r.place ?? ""} maxLength={80} onChange={(e) => set(i, { place: e.target.value })} />
                </Field>
                <Field label="Nota (opcional)">
                  <input value={r.notes ?? ""} maxLength={300} onChange={(e) => set(i, { notes: e.target.value })} />
                </Field>
              </fieldset>
            ))}
          </div>
          {msg && <p className="ui-success" role="status">{msg}</p>}
          <button className="ui-button ui-button-dark" disabled={action.pending}>Guardar reglas</button>
        </form>
      )}
    </Tile>
  );
}

/** Clasificaciones individuales: la dirección puede desactivarlas o ampliarlas a toda la institución. */
// 09. RankingSetting
function RankingSetting({ value, onSaved }: { value: "off" | "group" | "institution"; onSaved: () => void }) {
  const action = useAction();
  const [scope, setScope] = useState(value);
  const [msg, setMsg] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (await action.run((api) => api.setRankingScope(scope))) {
      setMsg("Preferencia guardada.");
      onSaved();
    }
  }
  return (
    <Tile span={12} title="Rankings de estudiantes">
      <form className="ui-form" onSubmit={save}>
        <fieldset className="radio-list">
          <legend className="sr-only">Alcance de los rankings</legend>
          {([
            ["off", "Desactivados", "Nadie ve posiciones individuales. Se muestran el progreso personal y la comparación entre grupos."],
            ["group", "Por grupo (recomendado)", "Cada docente decide si su grupo ve nombres o solo su propia posición."],
            ["institution", "Por grupo y por institución", "Además, los 10 primeros de la institución (nombres visibles o seudónimos). Nunca se listan posiciones bajas."],
          ] as const).map(([v, label, text]) => (
            <label key={v} className={scope === v ? "is-chosen" : undefined}>
              <input type="radio" name="ranking-scope" checked={scope === v} onChange={() => setScope(v)} />
              <span><strong>{label}</strong><small>{text}</small></span>
            </label>
          ))}
        </fieldset>
        {msg && <p className="ui-success" role="status">{msg}</p>}
        <ErrorState error={action.error} />
        <button className="ui-button ui-button-dark" disabled={action.pending || scope === value}>Guardar</button>
      </form>
    </Tile>
  );
}
