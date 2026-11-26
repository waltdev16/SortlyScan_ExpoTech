"use client";
import { useMemo, useState } from "react";
import { Download, Upload } from "lucide-react";
import type { Group, HistoryItem, ImportPreview, ImportResult, ImportRowInput, PrivacyKind, PrivacyRequest, StudentRow } from "@/lib/api/types";
import { useAction, useData, usePanel } from "./api-context";
import { Chip, downloadBlob, EmptyState, ErrorState, Field, formatDate, formatDateTime, Notice, Section, Skeleton } from "./ui";

const groupLabel = (g: { grade: string; name: string }) => `${g.grade} ${g.name}`;
const MAX_ROWS = 150;

/* CSV */
/** Lector CSV pequeño (comillas, coma o punto y coma). Suficiente para la plantilla; sin dependencias. */
// 01. parseCsv
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

// 02. csvBlob
function csvBlob(lines: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v);
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // evita fórmulas al abrirlo en hojas de cálculo
    return /[",;\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return new Blob(["﻿" + lines.map((l) => l.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
}

/** Importación masiva: plantilla → archivo → vista previa validada en el servidor → confirmación → credenciales. */
// 03. ImportStudents
export function ImportStudents({ groups, onCreated }: { groups: Group[]; onCreated: () => void }) {
  const action = useAction();
  const [defaultGroup, setDefaultGroup] = useState(groups[0]?.id ?? "");
  const [rows, setRows] = useState<ImportRowInput[] | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [msg, setMsg] = useState("");

  function template() {
    const example = groups.slice(0, 2).map(groupLabel);
    downloadBlob(csvBlob([["nombre_visible", "grupo"], ["Ana M.", example[0] ?? "7.º grado A"], ["Carlos R.", example[1] ?? example[0] ?? "7.º grado A"]]),
      "plantilla-estudiantes-sortlyscan.csv");
  }
  async function read(file: File | undefined) {
    setMsg(""); setPreview(null); setResult(null);
    if (!file) return;
    if (file.size > 200_000) return setMsg("El archivo es demasiado grande. Usa como máximo 150 filas.");
    const table = parseCsv(await file.text());
    if (table.length < 2) return setMsg("El archivo no tiene filas de estudiantes.");
    const header = table[0].map((h) => h.trim().toLowerCase());
    const nameCol = header.findIndex((h) => h.startsWith("nombre"));
    const groupCol = header.findIndex((h) => h.startsWith("grupo"));
    if (nameCol < 0) return setMsg("Falta la columna «nombre_visible». Descarga la plantilla.");
    const body = table.slice(1);
    if (body.length > MAX_ROWS) return setMsg(`Importa como máximo ${MAX_ROWS} estudiantes por archivo.`);
    const parsed = body.map((r, i) => {
      const label = groupCol >= 0 ? (r[groupCol] ?? "").trim() : "";
      return { line: i + 2, display_name: (r[nameCol] ?? "").slice(0, 200), ...(label ? { group_label: label } : { group_id: defaultGroup }) };
    });
    setRows(parsed);
    const p = await action.run((api) => api.importStudents(parsed, false));
    if (p) setPreview(p);
  }
  async function accept(line: number, value: boolean) {
    if (!rows) return;
    const next = rows.map((r) => (r.line === line ? { ...r, accept_duplicate: value } : r));
    setRows(next);
    const p = await action.run((api) => api.importStudents(next, false));
    if (p) setPreview(p);
  }
  async function commit() {
    if (!rows || !preview?.canCommit) return;
    const okCount = preview.summary.ok;
    if (!window.confirm(`Se registrarán ${okCount} estudiantes ficticios. Las filas con advertencia no aceptadas no se registran. ¿Continuar?`)) return;
    const r = await action.run((api) => api.importStudents(rows.filter((x) => preview.rows.find((p) => p.line === x.line)?.status === "ok"), true));
    if (r?.created) {
      setResult({ created: r.created, failed: r.failed ?? [], summary: r.summary });
      setPreview(null); setRows(null);
      onCreated();
    }
  }

  if (result) {
    return (
      <div className="ui-form">
        <Notice tone="success" title={`${result.created.length} estudiantes registrados`}>
          <p>Ya aparecen en «Cambiar perfil». En la demostración no se generan usuarios, contraseñas ni códigos.</p>
        </Notice>
        {result.failed.length > 0 && (
          <Notice tone="warn" title={`${result.failed.length} filas no se registraron`}>
            <ul>{result.failed.map((f) => <li key={f.line}>Fila {f.line}: {f.message}</li>)}</ul>
          </Notice>
        )}
        <ul className="rows">{result.created.map((c) => (
          <li key={c.userId}><span className="rows-main">{c.displayName}<small>{c.groupLabel}</small></span></li>
        ))}</ul>
        <div className="ui-form-actions">
          <button className="ui-button ui-button-quiet" onClick={() => setResult(null)}>Importar otro archivo</button>
        </div>
      </div>
    );
  }
  return (
    <div className="ui-form">
      <p className="ui-muted">
        Usa nombre e inicial del apellido o un seudónimo. No incluyas correos, fechas de nacimiento, documentos ni fotografías.
        Revisarás cada fila antes de registrar.
      </p>
      <div className="ui-form-actions">
        <button type="button" className="ui-button ui-button-quiet" onClick={template}><Download size={17} aria-hidden /> Descargar plantilla</button>
      </div>
      <Field label="Grupo para filas sin columna «grupo»">
        <select value={defaultGroup} onChange={(e) => setDefaultGroup(e.target.value)}>
          {groups.map((g) => <option key={g.id} value={g.id}>{groupLabel(g)}</option>)}
        </select>
      </Field>
      <Field label="Archivo CSV" hint={`Hasta ${MAX_ROWS} filas. Columnas: nombre_visible y, opcionalmente, grupo (por ejemplo «7.º grado A»).`}>
        <input type="file" accept=".csv,text/csv" onChange={(e) => read(e.target.files?.[0])} />
      </Field>
      {msg && <p className="ui-field-error" role="alert">{msg}</p>}
      <ErrorState error={action.error} />
      {action.pending && <Skeleton lines={3} />}
      {preview && (
        <>
          <p role="status">
            <strong>{preview.summary.ok}</strong> listas · <strong>{preview.summary.warning}</strong> con advertencia ·{" "}
            <strong>{preview.summary.error}</strong> con errores
          </p>
          <div className="dt-wrap">
            <table className="dt-table imp-table">
              <caption className="sr-only">Vista previa de la importación</caption>
              <thead><tr><th scope="col">Fila</th><th scope="col">Nombre</th><th scope="col">Grupo</th><th scope="col">Estado</th></tr></thead>
              <tbody>{preview.rows.map((r) => (
                <tr key={r.line}>
                  <td>{r.line}</td>
                  <th scope="row">{r.displayName || "—"}</th>
                  <td>{r.groupLabel || "—"}</td>
                  <td>
                    <span className={`imp-status is-${r.status}`}>{r.status === "ok" ? "Lista" : r.status === "warning" ? "Advertencia" : "Error"}</span>
                    {r.messages.length > 0 && <ul className="imp-msgs">{r.messages.map((m) => <li key={m}>{m}</li>)}</ul>}
                    {(r.status === "warning" || r.acceptDuplicate) && (
                      <label className="ui-check"><input type="checkbox" checked={r.acceptDuplicate} onChange={(e) => accept(r.line, e.target.checked)} /> Es otra persona: registrar</label>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {preview.summary.error > 0 && <p className="ui-field-error">Corrige las filas con error en el archivo y vuelve a cargarlo.</p>}
          <button className="ui-button ui-button-dark" onClick={commit} disabled={!preview.canCommit || action.pending}>
            <Upload size={17} aria-hidden /> Registrar {preview.summary.ok} estudiantes
          </button>
        </>
      )}
    </div>
  );
}

/* Transferencias */
/** Transferencia entre grupos y cambio de año lectivo (solo dirección). Conserva el historial. */
// 04. TransferStudents
export function TransferStudents({ groups, onDone }: { groups: Group[]; onDone: () => void }) {
  const active = groups.filter((g) => g.status === "active");
  const [source, setSource] = useState(active[0]?.id ?? "");
  const [target, setTarget] = useState(active[1]?.id ?? "");
  const [reason, setReason] = useState<"transfer" | "school_year">("transfer");
  const [selected, setSelected] = useState<string[] | null>(null);
  const [done, setDone] = useState("");
  const action = useAction();
  const students = useData((api) => (source ? api.groupStudents(source) : Promise.resolve([] as StudentRow[])), [source]);
  const list = (students.data ?? []).filter((s) => s.status === "active");
  const chosen = selected ?? list.map((s) => s.user_id);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setDone("");
    if (!target || target === source || chosen.length === 0) return;
    const to = active.find((g) => g.id === target);
    if (!window.confirm(`¿Mover ${chosen.length} estudiantes a ${to ? groupLabel(to) : "otro grupo"}? Su aprendizaje se conserva.`)) return;
    const r = await action.run((api) => api.transferStudents(source, target, chosen.length === list.length ? [] : chosen, reason));
    if (r) {
      setDone(`${r.moved} estudiantes movidos.`);
      setSelected(null);
      students.reload();
      onDone();
    }
  }
  return (
    <form className="ui-form" onSubmit={submit}>
      <p className="ui-muted">
        Para el cambio de año lectivo: crea primero los grupos del nuevo año, mueve a cada grupo y luego archiva los grupos anteriores.
        Las lecciones, los puntos y el historial se conservan.
      </p>
      <div className="ui-form-row">
        <Field label="Desde">
          <select value={source} onChange={(e) => { setSource(e.target.value); setSelected(null); }}>
            {active.map((g) => <option key={g.id} value={g.id}>{groupLabel(g)} · {g.school_year}</option>)}
          </select>
        </Field>
        <Field label="Hacia">
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            {active.filter((g) => g.id !== source).map((g) => <option key={g.id} value={g.id}>{groupLabel(g)} · {g.school_year}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Motivo">
        <select value={reason} onChange={(e) => setReason(e.target.value as "transfer" | "school_year")}>
          <option value="transfer">Cambio de grupo</option>
          <option value="school_year">Cambio de año lectivo</option>
        </select>
      </Field>
      <fieldset className="ui-fieldset">
        <legend>Estudiantes ({chosen.length} de {list.length})</legend>
        {students.loading && !students.data ? <Skeleton lines={3} /> : list.length === 0 ? <p className="ui-muted">El grupo no tiene estudiantes activos.</p> : (
          <ul className="ui-checklist">{list.map((s) => (
            <li key={s.user_id}>
              <label className="ui-check">
                <input type="checkbox" checked={chosen.includes(s.user_id)}
                  onChange={(e) => setSelected(e.target.checked ? [...chosen, s.user_id] : chosen.filter((x) => x !== s.user_id))} />
                {s.display_name}
              </label>
            </li>
          ))}</ul>
        )}
      </fieldset>
      <ErrorState error={action.error ?? students.error} />
      {done && <p className="ui-success" role="status">{done}</p>}
      <button className="ui-button ui-button-dark" disabled={action.pending || !target || chosen.length === 0}>Mover estudiantes</button>
    </form>
  );
}

/* Historial */
const ACTION_LABELS: Record<string, string> = {
  "group.create": "Creó un grupo", "group.update": "Modificó un grupo", "group.assign_teacher": "Asignó un docente a un grupo",
  "group.unassign_teacher": "Quitó un docente de un grupo", "student.create": "Registró un estudiante", "student.import": "Importó estudiantes",
  "student.reset_code": "Generó un nuevo código", "student.revoke": "Desactivó una cuenta", "student.reactivate": "Reactivó una cuenta",
  "student.transfer": "Transfirió estudiantes", "student.school_year": "Cambio de año lectivo", "activity.create": "Asignó una actividad",
  "challenge.create": "Creó un reto", "invitation.create": "Invitó a una persona", "invitation.revoke": "Revocó una invitación",
  "membership.revoke": "Revocó un acceso", "institution.update": "Actualizó datos de la institución", "privacy.request": "Registró una solicitud de privacidad",
  "privacy.completed": "Atendió una solicitud de privacidad", "privacy.rejected": "Rechazó una solicitud de privacidad",
  "privacy.escalated": "Escaló una eliminación", "privacy.export": "Exportó datos de un estudiante", "privacy.erase": "Eliminó datos (superadministración)",
  "environmental_action.approved": "Aprobó una acción ambiental", "environmental_action.rejected": "Rechazó una acción ambiental",
  "environmental_action.changes_requested": "Pidió cambios en una acción ambiental",
};
export const actionLabel = (a: string) => ACTION_LABELS[a] ?? a;

// 05. InstitutionHistory
export function InstitutionHistory() {
  const [pages, setPages] = useState<HistoryItem[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const first = useData(async (api) => {
    const p = await api.history();
    setPages(p.items);
    setNext(p.nextBefore);
    return p;
  });
  const more = useAction();
  async function loadMore() {
    const p = await more.run((api) => api.history(next));
    if (p) { setPages((x) => [...x, ...p.items]); setNext(p.nextBefore); }
  }
  return (
    <Section title="Historial institucional">
      <p className="ui-muted">Acciones administrativas registradas en tu institución. No se pueden modificar.</p>
      <ErrorState error={first.error ?? more.error} onRetry={first.reload} />
      {first.loading && !first.data ? <Skeleton lines={4} /> : pages.length === 0 ? <EmptyState title="Aún no hay acciones registradas." /> : (
        <ul className="rows">{pages.map((h) => (
          <li key={h.id}>
            <span className="rows-main">{actionLabel(h.action)}<small>{h.actor_name ?? "Persona eliminada"} · {formatDateTime(h.created_at)}</small></span>
          </li>
        ))}</ul>
      )}
      {next && <button className="ui-button ui-button-quiet" onClick={loadMore} disabled={more.pending}>Ver más</button>}
    </Section>
  );
}

/* Privacidad */
const KIND_LABELS: Record<PrivacyKind, string> = { correction: "Corrección de datos", access: "Acceso a los datos", anonymization: "Anonimización", deletion: "Eliminación" };
const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "muted" | "neutral" }> = {
  pending: { label: "Pendiente", tone: "warn" }, completed: { label: "Atendida", tone: "ok" }, rejected: { label: "Rechazada", tone: "muted" },
  escalated: { label: "En superadministración", tone: "neutral" },
};

/** Solicitudes propias (cualquier rol): corrección o acceso; el personal también puede pedir anonimización o eliminación. */
// 06. MyPrivacy
export function MyPrivacy() {
  const { role, demo } = usePanel();
  const list = useData((api) => api.privacyRequests());
  const action = useAction();
  const kinds: PrivacyKind[] = role === "student" ? ["correction", "access"] : ["correction", "access", "anonymization", "deletion"];
  const [kind, setKind] = useState<PrivacyKind>("correction");
  const [details, setDetails] = useState("");
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (details.trim().length < 5) return setMsg("Describe brevemente qué necesitas.");
    if (await action.run((api) => api.createPrivacyRequest({ kind, details: details.trim() }))) {
      setDetails("");
      setMsg("Solicitud enviada a la dirección.");
      list.reload();
    }
  }
  return (
    <Section title="Mis datos">
      <p className="ui-muted">Pide corregir tu información o saber qué datos guarda SortlyScan. La dirección de tu institución la atiende.</p>
      <form className="ui-form ui-form-narrow" onSubmit={submit}>
        <Field label="Tipo de solicitud">
          <select value={kind} onChange={(e) => setKind(e.target.value as PrivacyKind)}>{kinds.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}</select>
        </Field>
        <Field label="Detalle" hint="Por ejemplo: «Mi nombre está escrito como Ana M. y es Anna M.». No escribas contraseñas ni datos de otras personas.">
          <textarea rows={3} value={details} maxLength={500} onChange={(e) => setDetails(e.target.value)} />
        </Field>
        <ErrorState error={action.error} />
        {msg && <p className={msg.startsWith("Solicitud") ? "ui-success" : "ui-field-error"} role="status">{msg}</p>}
        <button className="ui-button ui-button-dark" disabled={action.pending || demo}>Enviar solicitud</button>
      </form>
      {list.data && list.data.length > 0 && (
        <ul className="rows">{list.data.map((r) => (
          <li key={r.id}>
            <span className="rows-main">{KIND_LABELS[r.kind]}<small>{formatDate(r.created_at)}{r.resolution_note ? ` · ${r.resolution_note}` : ""}</small></span>
            <Chip tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Chip>
          </li>
        ))}</ul>
      )}
    </Section>
  );
}

/** Dirección: atiende solicitudes y registra las de estudiantes (por ejemplo, a pedido de la familia). */
// 07. DirectorPrivacy
export function DirectorPrivacy() {
  const list = useData((api) => api.privacyRequests());
  const students = useData((api) => api.students());
  const action = useAction();
  const [form, setForm] = useState({ student: "", kind: "correction" as PrivacyKind, details: "" });
  const [resolving, setResolving] = useState<{ r: PrivacyRequest; name: string; note: string } | null>(null);
  const pending = useMemo(() => (list.data ?? []).filter((r) => r.status === "pending"), [list.data]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.student || form.details.trim().length < 5) return;
    if (await action.run((api) => api.createPrivacyRequest({ kind: form.kind, details: form.details.trim(), subject_user_id: form.student }))) {
      setForm({ ...form, details: "" });
      list.reload();
    }
  }
  async function resolve(decision: "completed" | "rejected" | "escalated") {
    if (!resolving) return;
    const { r } = resolving;
    if (decision === "completed" && r.kind === "anonymization" &&
      !window.confirm("La anonimización reemplaza el nombre, cierra el acceso y no se puede deshacer. El aprendizaje queda solo en estadísticas agregadas. ¿Continuar?")) return;
    const ok = await action.run((api) => api.resolvePrivacyRequest(r.id, {
      decision, note: resolving.note.trim() || null, new_display_name: r.kind === "correction" && decision === "completed" ? resolving.name.trim() : null
    }));
    if (ok) { setResolving(null); list.reload(); students.reload(); }
  }
  async function exportData(r: PrivacyRequest) {
    if (!r.subject_user_id) return;
    const data = await action.run((api) => api.exportStudent(r.subject_user_id!));
    if (data) downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `datos-${(r.subject_name ?? "estudiante").replace(/\W+/g, "-")}.json`);
  }
  return (
    <Section title="Privacidad y datos personales">
      <p className="ui-muted">Corrección, acceso, anonimización y eliminación. La eliminación completa la ejecuta superadministración. Todo queda registrado.</p>
      <ErrorState error={list.error ?? action.error} onRetry={list.reload} />
      {list.loading && !list.data ? <Skeleton lines={3} /> : (list.data ?? []).length === 0 ? <p className="ui-muted">No hay solicitudes.</p> : (
        <ul className="rows">{(list.data ?? []).map((r) => (
          <li key={r.id}>
            <span className="rows-main">{KIND_LABELS[r.kind]} · {r.subject_name ?? "Cuenta eliminada"}<small>{r.details} · {formatDate(r.created_at)}</small></span>
            <span className="ed-actions">
              <Chip tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Chip>
              {r.kind === "access" && r.subject_role === "student" && <button className="ui-link-button" onClick={() => exportData(r)}>Exportar datos</button>}
              {r.status === "pending" && <button className="ui-link-button" onClick={() => setResolving({ r, name: r.subject_name ?? "", note: "" })}>Atender</button>}
            </span>
          </li>
        ))}</ul>
      )}
      {resolving && (
        <div className="ui-form ui-form-narrow" role="group" aria-label="Atender solicitud">
          <p><strong>{KIND_LABELS[resolving.r.kind]}</strong> · {resolving.r.subject_name}</p>
          {resolving.r.kind === "correction" && (
            <Field label="Nombre visible corregido"><input value={resolving.name} maxLength={80} onChange={(e) => setResolving({ ...resolving, name: e.target.value })} /></Field>
          )}
          <Field label="Observación" hint="Obligatoria al rechazar o escalar.">
            <textarea rows={2} value={resolving.note} maxLength={500} onChange={(e) => setResolving({ ...resolving, note: e.target.value })} />
          </Field>
          <div className="ui-form-actions">
            {resolving.r.kind === "deletion"
              ? <button className="ui-button ui-button-dark" onClick={() => resolve("escalated")} disabled={action.pending}>Escalar a superadministración</button>
              : <button className="ui-button ui-button-dark" onClick={() => resolve("completed")} disabled={action.pending}>Marcar como atendida</button>}
            <button className="ui-button ui-button-quiet" onClick={() => resolve("rejected")} disabled={action.pending}>Rechazar</button>
            <button className="ui-button ui-button-quiet" onClick={() => setResolving(null)}>Cancelar</button>
          </div>
        </div>
      )}
      <form className="ui-form ui-form-narrow" onSubmit={create}>
        <h3 className="detail-h">Registrar una solicitud de un estudiante</h3>
        <div className="ui-form-row">
          <Field label="Estudiante">
            <select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })}>
              <option value="">Elige…</option>
              {(students.data ?? []).map((s) => <option key={s.enrollment_id} value={s.user_id}>{s.display_name} · {s.grade} {s.group_name}</option>)}
            </select>
          </Field>
          <Field label="Tipo">
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as PrivacyKind })}>
              {(Object.keys(KIND_LABELS) as PrivacyKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Detalle" hint="Quién lo pidió y por qué medio (por ejemplo, nota firmada por la familia).">
          <textarea rows={2} value={form.details} maxLength={500} onChange={(e) => setForm({ ...form, details: e.target.value })} />
        </Field>
        <button className="ui-button ui-button-quiet" disabled={action.pending || !form.student}>Registrar solicitud</button>
      </form>
      {pending.length > 0 && <p className="ui-small ui-muted">{pending.length} solicitudes pendientes.</p>}
    </Section>
  );
}
