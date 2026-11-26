"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { createDemoApi } from "@/lib/demo/demo-api";
import { type DemoRole, getActor, getDb, getVersion, subscribe } from "@/lib/demo/db";
import { actorMe, actorValid, ROLE_LABEL, ROLE_SLUG } from "@/lib/demo/profiles";
import { PanelProvider } from "./api-context";
import { Shell } from "./shell";

const noop = () => () => { };

/**
 * Panel de SortlyScan Interactive Demo. No hay sesión: el perfil elegido en «Tu espacio para aprender»
 * se guarda en este navegador. Si los datos cambian en otra pestaña (o se restablece la demo), el panel
 * se vuelve a construir con los datos nuevos.
 */
export function DemoPanel({ role, children }: { role: DemoRole; children: React.ReactNode }) {
  const version = useSyncExternalStore(subscribe, getVersion, () => -1);
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const actor = useMemo(() => (mounted ? getActor() : null), [mounted, version]);
  const valid = mounted && actorValid(actor, getDb()) && actor!.role === role;
  const inactive = valid && actor!.role !== "admin" && getDb().institutions[actor!.institutionId]?.institution.status === "suspended";
  const api = useMemo(() => (valid ? createDemoApi(actor!) : null), [valid, actor, version]);
  const me = useMemo(() => (valid ? actorMe(actor!) : null), [valid, actor, version]);
  const [title, setTitle] = useState("");
  useEffect(() => setTitle(`${ROLE_LABEL[role]} · SortlyScan Interactive Demo`), [role]);
  useEffect(() => { if (title) document.title = title; }, [title]);

  if (!mounted) return <div className="panel-boot" aria-busy="true" />;
  if (!valid || !api || !me || inactive) {
    return (
      <main id="contenido" className="auth-page">
        <div className="auth-card">
          <p className="ui-eyebrow">SortlyScan Interactive Demo</p>
          <h1>{inactive ? "Esta institución está suspendida." : `Elige un perfil de ${ROLE_LABEL[role].toLowerCase()}.`}</h1>
          <p className="ui-lead">
            {inactive
              ? "La superadministración suspendió esta institución ficticia. Reactívala desde el perfil de superadministración o elige otro perfil."
              : "Para explorar este panel, elige primero con qué persona ficticia quieres entrar."}
          </p>
          <div className="ui-form-actions">
            <Link className="ui-button ui-button-dark" href={`/acceso?rol=${ROLE_SLUG[role]}`}>Elegir perfil</Link>
            <Link className="ui-button ui-button-quiet" href="/">Volver al inicio</Link>
          </div>
        </div>
      </main>
    );
  }
  return (
    <PanelProvider key={actor!.personId} role={role} me={me} api={api}>
      <Shell>{children}</Shell>
    </PanelProvider>
  );
}
