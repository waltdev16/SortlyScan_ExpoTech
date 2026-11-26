"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/client";
import type { Me, Role } from "@/lib/api/types";

export type PanelRole = Role | "admin";

interface PanelContext {
  api: Api;
  me: Me;
  role: PanelRole;
  base: string;
  /** Siempre verdadero en SortlyScan Interactive Demo (datos ficticios locales). */
  demo: boolean;
}
const Ctx = createContext<PanelContext | null>(null);

/** Contexto de los paneles. En esta edición la API es siempre la local de la demostración. */
export function PanelProvider({ role, me, api, children }: { role: PanelRole; me: Me; api: Api; children: React.ReactNode }) {
  const value = useMemo<PanelContext>(() => {
    const slug = { student: "estudiante", teacher: "docente", director: "director", admin: "admin" }[role];
    return { api, me, role, base: `/panel/${slug}`, demo: true };
  }, [role, me, api]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePanel() {
  const value = useContext(Ctx);
  if (!value) throw new Error("usePanel debe usarse dentro de PanelProvider");
  return value;
}

/** Carga datos con estados de carga/error y recarga explícita. Se recarga sola si los datos cambian en otra pestaña. */
export function useData<R>(load: (api: Api) => Promise<R>, deps: unknown[] = []) {
  const { api } = usePanel();
  const [state, setState] = useState<{ data: R | null; error: ApiError | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const loader = useRef(load);
  loader.current = load;
  const reload = useCallback(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader
      .current(api)
      .then((data) => active && setState({ data, error: null, loading: false }))
      .catch((error: unknown) => {
        if (!active) return;
        const e = error instanceof ApiError ? error : new ApiError(0, "error", "Ocurrió un error inesperado.");
        setState({ data: null, error: e, loading: false });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, ...deps]);
  useEffect(() => reload(), [reload]);
  return { ...state, reload };
}

/** Ejecuta una acción (envío de formulario, botón) y expone su estado. */
export function useAction() {
  const { api } = usePanel();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const run = useCallback(
    async <R,>(action: (api: Api) => Promise<R>): Promise<R | null> => {
      setPending(true);
      setError(null);
      try {
        return await action(api);
      } catch (e) {
        setError(e instanceof ApiError ? e : new ApiError(0, "error", "Ocurrió un error inesperado."));
        return null;
      } finally {
        setPending(false);
      }
    },
    [api],
  );
  return { run, pending, error, setError };
}
