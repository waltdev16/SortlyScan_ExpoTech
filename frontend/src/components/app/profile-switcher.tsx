"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ensureSeeded } from "@/lib/demo/demo-api";
import { type DemoRole, getActor, getDb, setActor } from "@/lib/demo/db";
import { PILOT_ID } from "@/lib/demo/seed";
import { homeOf, listProfiles, ROLE_LABEL } from "@/lib/demo/profiles";
import { ResetDemoButton, StorageNote } from "../demo-controls";
import { SidePanel } from "./overlay";

/** Cambio rápido de perfil dentro de los paneles (sin volver a la página de inicio). */
export function ProfileSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const current = open ? getActor() : null;
  const data = useMemo(() => (open ? (ensureSeeded(), listProfiles(getDb())) : null), [open]);
  const [role, setRole] = useState<DemoRole>(current?.role ?? "student");
  const [institutionId, setInstitutionId] = useState(current && current.role !== "admin" ? current.institutionId : PILOT_ID);
  const [person, setPerson] = useState("");
  const inst = data?.institutions.find((i) => i.id === institutionId) ?? data?.institutions[0];
  const people = !inst ? [] : role === "student" ? inst.students.map((s) => ({ id: s.id, label: `${s.name} · ${s.group} · ${s.level}` }))
    : role === "teacher" ? inst.teachers.map((t) => ({ id: t.id, label: `${t.name}${t.groups.length ? ` · ${t.groups.join(", ")}` : ""}` }))
      : role === "director" ? inst.directors.map((d) => ({ id: d.id, label: d.name })) : [];
  const chosen = role === "admin" ? data?.admin.id ?? "" : people.some((p) => p.id === person) ? person : people[0]?.id ?? "";

  function go() {
    if (!data || !inst || !chosen) return;
    setActor({ role, personId: chosen, institutionId: role === "admin" ? PILOT_ID : inst.id });
    onClose();
    router.push(homeOf(role));
  }

  return (
    <SidePanel open={open} onClose={onClose} title="Cambiar perfil" description="Explora la misma información desde otra perspectiva. Todos los perfiles comparten los datos de esta demostración.">
      {data && inst && (
        <div className="switcher">
          <fieldset className="switcher-roles">
            <legend className="ui-field-label">Perfil</legend>
            {(["student", "teacher", "director", "admin"] as DemoRole[]).map((r) => (
              <label key={r} className={`switcher-role${role === r ? " is-active" : ""}`}>
                <input type="radio" name="switch-role" value={r} checked={role === r} onChange={() => { setRole(r); setPerson(""); }} />
                {ROLE_LABEL[r]}
              </label>
            ))}
          </fieldset>
          {role !== "admin" && data.institutions.length > 1 && (
            <label className="ui-field">
              <span className="ui-field-label">Institución ficticia</span>
              <select value={inst.id} onChange={(e) => { setInstitutionId(e.target.value); setPerson(""); }}>
                {data.institutions.map((i) => <option key={i.id} value={i.id}>{i.name}{i.status === "suspended" ? " (suspendida)" : ""}</option>)}
              </select>
            </label>
          )}
          {role !== "admin" && (
            <label className="ui-field">
              <span className="ui-field-label">Persona ficticia</span>
              <select value={chosen} onChange={(e) => setPerson(e.target.value)} disabled={!people.length}>
                {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              {!people.length && <span className="ui-field-hint">No hay personas con este perfil en la institución.</span>}
            </label>
          )}
          <div className="ui-form-actions">
            <button type="button" className="ui-button ui-button-dark" onClick={go} disabled={!chosen || (role !== "admin" && inst.status === "suspended")}>
              Entrar como {ROLE_LABEL[role].toLowerCase()}
            </button>
            <Link className="ui-button ui-button-quiet" href="/acceso" onClick={onClose}>Ver todos los perfiles</Link>
          </div>
          <hr className="switcher-rule" />
          <StorageNote compact />
          <div className="switcher-footer">
            <ResetDemoButton className="ui-button ui-button-quiet ui-button-small" onDone={() => { onClose(); router.push("/acceso"); }} />
            <button type="button" className="ui-button ui-button-quiet ui-button-small" onClick={() => { setActor(null); onClose(); router.push("/"); }}>
              Salir de la demostración
            </button>
          </div>
        </div>
      )}
    </SidePanel>
  );
}
