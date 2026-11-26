"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpenCheck, Building2, GraduationCap, ShieldCheck } from "lucide-react";
import { ensureSeeded } from "@/lib/demo/demo-api";
import { type DemoRole, getDb, getVersion, setActor, subscribe } from "@/lib/demo/db";
import { PILOT_ID } from "@/lib/demo/seed";
import { homeOf, listProfiles, ROLE_SLUG } from "@/lib/demo/profiles";
import { ResetDemoButton, StorageNote } from "./demo-controls";

const CARDS: { role: DemoRole; title: string; text: string; icon: React.ReactNode }[] = [
  { role: "student", title: "Estudiante", text: "Aprende a reciclar, escanea residuos, completa actividades y gana puntos.", icon: <GraduationCap size={22} aria-hidden /> },
  { role: "teacher", title: "Docente", text: "Gestiona grupos, asigna actividades y supervisa el aprendizaje.", icon: <BookOpenCheck size={22} aria-hidden /> },
  { role: "director", title: "Dirección", text: "Administra la institución y consulta sus resultados educativos y ambientales.", icon: <Building2 size={22} aria-hidden /> },
  { role: "admin", title: "Superadministración", text: "Explora la gestión general de instituciones y contenidos educativos.", icon: <ShieldCheck size={22} aria-hidden /> },
];

const noop = () => () => { };

/** Selector de perfiles: reemplaza el inicio de sesión en SortlyScan Interactive Demo. */
export function ProfilePicker() {
  const router = useRouter();
  const params = useSearchParams();
  const focus = Object.entries(ROLE_SLUG).find(([, slug]) => slug === params.get("rol"))?.[0] as DemoRole | undefined;
  const version = useSyncExternalStore(subscribe, getVersion, () => -1);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const data = useMemo(() => (mounted ? (ensureSeeded(), listProfiles(getDb())) : null), [mounted, version]);
  const [institution, setInstitution] = useState(PILOT_ID);
  const [choice, setChoice] = useState<Record<DemoRole, string>>({ student: "s-0-1", teacher: "t-1", director: "d-1", admin: "" });
  const inst = data?.institutions.find((i) => i.id === institution) ?? data?.institutions[0];

  // Si la institución elegida cambia (o se restableció la demo), se ajustan las personas elegidas.
  useEffect(() => {
    if (!inst) return;
    setChoice((c) => ({
      ...c,
      student: inst.students.some((s) => s.id === c.student) ? c.student : inst.students[0]?.id ?? "",
      teacher: inst.teachers.some((s) => s.id === c.teacher) ? c.teacher : inst.teachers[0]?.id ?? "",
      director: inst.directors.some((s) => s.id === c.director) ? c.director : inst.directors[0]?.id ?? "",
    }));
  }, [inst]);

  useEffect(() => {
    if (focus) document.getElementById(`perfil-${focus}`)?.scrollIntoView({ block: "center" });
  }, [focus, mounted]);

  function enter(role: DemoRole) {
    if (!data || !inst) return;
    const personId = role === "admin" ? data.admin.id : choice[role];
    if (!personId) return;
    setActor({ role, personId, institutionId: role === "admin" ? PILOT_ID : inst.id });
    router.push(homeOf(role));
  }

  if (!data || !inst) return <div className="profile-grid" aria-busy="true" />;
  const groups = [...new Set(inst.students.map((s) => s.group))].sort();
  const suspended = inst.status === "suspended";

  return (
    <div className="profile-picker">
      {data.institutions.length > 1 && (
        <label className="ui-field profile-institution">
          <span className="ui-field-label">Institución ficticia</span>
          <select value={inst.id} onChange={(e) => setInstitution(e.target.value)}>
            {data.institutions.map((i) => (
              <option key={i.id} value={i.id}>{i.name}{i.status === "suspended" ? " (suspendida)" : ""}</option>
            ))}
          </select>
        </label>
      )}
      {data.institutions.length === 1 && (
        <p className="profile-institution-name"><strong>{inst.name}</strong> · {inst.place} · <span>institución ficticia</span></p>
      )}
      {suspended && <p className="ui-notice ui-notice-warn">Esta institución está suspendida: sus perfiles no pueden entrar hasta que la superadministración la reactive.</p>}

      <div className="profile-grid">
        {CARDS.map((card) => {
          const people = card.role === "teacher" ? inst.teachers : card.role === "director" ? inst.directors : [];
          const disabled = card.role !== "admin" && (suspended || (card.role === "student" ? !inst.students.length : !people.length));
          return (
            <section key={card.role} id={`perfil-${card.role}`} className={`profile-card${focus === card.role ? " is-focused" : ""}`} aria-labelledby={`perfil-${card.role}-t`}>
              <div className="profile-card-head">
                <span className="profile-icon">{card.icon}</span>
                <h2 id={`perfil-${card.role}-t`}>{card.title}</h2>
              </div>
              <p>{card.text}</p>
              {card.role === "student" && (
                <label className="ui-field">
                  <span className="ui-field-label">Estudiante ficticio</span>
                  <select value={choice.student} onChange={(e) => setChoice({ ...choice, student: e.target.value })} disabled={!inst.students.length}>
                    {groups.map((g) => (
                      <optgroup key={g} label={g}>
                        {inst.students.filter((s) => s.group === g).map((s) => (
                          <option key={s.id} value={s.id}>{s.name} · {s.level}, {s.points} pts{s.tag ? ` · ${s.tag}` : ""}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {!inst.students.length && <span className="ui-field-hint">Esta institución aún no tiene estudiantes. Regístralos desde Dirección o Docente.</span>}
                </label>
              )}
              {(card.role === "teacher" || card.role === "director") && (
                <label className="ui-field">
                  <span className="ui-field-label">{card.role === "teacher" ? "Docente ficticio" : "Dirección ficticia"}</span>
                  <select value={choice[card.role]} onChange={(e) => setChoice({ ...choice, [card.role]: e.target.value })} disabled={!people.length}>
                    {card.role === "teacher"
                      ? inst.teachers.map((t) => <option key={t.id} value={t.id}>{t.name}{t.groups.length ? ` · ${t.groups.join(", ")}` : " · sin grupo"}</option>)
                      : inst.directors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {!people.length && <span className="ui-field-hint">Aún no hay docentes. La dirección puede registrarlos.</span>}
                </label>
              )}
              {card.role === "admin" && <p className="ui-small ui-muted">Equipo SortlyScan (ficticio) · todas las instituciones de la demostración.</p>}
              <button type="button" className="ui-button ui-button-dark profile-enter" onClick={() => enter(card.role)} disabled={disabled}>
                Entrar como {card.title.toLowerCase()} <ArrowRight size={16} aria-hidden />
              </button>
            </section>
          );
        })}
      </div>
      <StorageNote />
      <div className="profile-reset"><ResetDemoButton /></div>
    </div>
  );
}
