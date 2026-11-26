"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Activity, BookOpen, Building2, ChartColumn, ChartLine, ClipboardList, FileText, Flag, GraduationCap, House, Inbox, Layers,
  Leaf, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Repeat, ScanLine, ScrollText, Settings, ShieldCheck, Trophy, Users, X,
} from "lucide-react";
import { setActor } from "@/lib/demo/db";
import { OfflineBanner } from "../offline/offline-banner";
import { NotificationBell } from "./notifications";
import { usePanel, type PanelRole } from "./api-context";
import { InfoTip } from "./overlay";
import { ProfileSwitcher } from "./profile-switcher";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }> };

export const NAVIGATION: Record<PanelRole, NavItem[]> = {
  student: [
    { href: "", label: "Inicio", icon: House },
    { href: "escanear", label: "Escanear", icon: ScanLine },
    { href: "aprender", label: "Aprender", icon: BookOpen },
    { href: "retos", label: "Retos", icon: Flag },
    { href: "ranking", label: "Ranking", icon: Trophy },
    { href: "progreso", label: "Mi progreso", icon: ChartLine },
    { href: "acciones", label: "Acciones", icon: Leaf },
  ],
  teacher: [
    { href: "", label: "Resumen", icon: House },
    { href: "grupos", label: "Mis grupos", icon: Layers },
    { href: "estudiantes", label: "Estudiantes", icon: Users },
    { href: "actividades", label: "Actividades", icon: ClipboardList },
    { href: "retos", label: "Retos", icon: Flag },
    { href: "estadisticas", label: "Estadísticas", icon: ChartColumn },
    { href: "verificacion", label: "Verificación", icon: ShieldCheck },
    { href: "reportes", label: "Reportes", icon: FileText },
  ],
  director: [
    { href: "", label: "Resumen institucional", icon: House },
    { href: "docentes", label: "Docentes", icon: GraduationCap },
    { href: "estudiantes", label: "Estudiantes", icon: Users },
    { href: "grupos", label: "Grupos", icon: Layers },
    { href: "aprendizaje", label: "Aprendizaje", icon: BookOpen },
    { href: "participacion", label: "Participación", icon: Activity },
    { href: "impacto", label: "Impacto verificado", icon: Leaf },
    { href: "verificacion", label: "Verificación", icon: ShieldCheck },
    { href: "reportes", label: "Reportes", icon: FileText },
  ],
  admin: [
    { href: "", label: "Solicitudes", icon: Inbox },
    { href: "instituciones", label: "Instituciones", icon: Building2 },
    { href: "personas", label: "Personas", icon: Users },
    { href: "contenidos", label: "Contenidos", icon: BookOpen },
    { href: "privacidad", label: "Privacidad", icon: ShieldCheck },
    { href: "auditoria", label: "Auditoría", icon: ScrollText },
  ],
};
/** Página de configuración de cada rol (bloque inferior de la barra lateral). */
const SETTINGS: Record<PanelRole, string | null> = {
  student: "configuracion",
  teacher: "cuenta",
  director: "configuracion",
  admin: null,
};
const ROLE_LABEL: Record<PanelRole, string> = {
  student: "Estudiante",
  teacher: "Docente",
  director: "Dirección",
  admin: "Superadministración",
};
const SUBPAGES: Record<string, string> = { configuracion: "Configuración", cuenta: "Mi cuenta", evaluacion: "Evaluación" };

// 01. initials
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "S";
}

// 02. Shell
export function Shell({ children }: { children: React.ReactNode }) {
  const { role, base, me } = usePanel();
  const pathname = usePathname();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);
  const [switcher, setSwitcher] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("sortly-sidebar") === "collapsed");
    } catch {
      /* preferencia opcional */
    }
  }, []);
  useEffect(() => {
    setDrawer(false);
    scroller.current?.scrollTo({ top: 0 });
  }, [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const items = NAVIGATION[role];
  const parts = pathname.replace(base, "").replace(/^\//, "").split("/").filter(Boolean);
  const current = parts[0] ?? "";
  const currentLabel = items.find((i) => i.href === current)?.label ?? SUBPAGES[current] ?? "";
  const institution = me.memberships.find((m) => m.role === role)?.institution_name;
  const settings = SETTINGS[role];

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    setTip(null);
    try {
      localStorage.setItem("sortly-sidebar", next ? "collapsed" : "open");
    } catch {
      /* preferencia opcional */
    }
  }

  function exitDemo() {
    setActor(null);
    router.push("/");
  }
  function openSwitcher() {
    setDrawer(false);
    setTip(null);
    setSwitcher(true);
  }

  // Muestra el tooltip fuera del área desplazable.
  const tipProps = (label: string, compact: boolean) =>
    compact
      ? {
        onMouseEnter: (e: React.MouseEvent<HTMLElement>) => setTip({ label, top: e.currentTarget.getBoundingClientRect().top + e.currentTarget.offsetHeight / 2 }),
        onMouseLeave: () => setTip(null),
        onFocus: (e: React.FocusEvent<HTMLElement>) => setTip({ label, top: e.currentTarget.getBoundingClientRect().top + e.currentTarget.offsetHeight / 2 }),
        onBlur: () => setTip(null),
      }
      : {};

  const nav = (compact: boolean) => (
    <nav aria-label={`Navegación de ${ROLE_LABEL[role].toLowerCase()}`} className="sb-nav">
      <ul>
        {items.map((item) => {
          const href = item.href ? `${base}/${item.href}` : base;
          const active = current === item.href;
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={compact ? item.label : undefined}
                className={item.href === "escanear" ? "is-featured" : undefined}
                {...tipProps(item.label, compact)}
              >
                <Icon size={19} aria-hidden />
                {!compact && <span>{item.label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const account = (compact: boolean) => (
    <div className="sb-account">
      <div className="sb-person">
        <span className="sb-avatar" aria-hidden="true">{initials(me.displayName)}</span>
        {!compact && (
          <span className="sb-person-text">
            <strong>{me.displayName}</strong>
            <small>{ROLE_LABEL[role]}{institution ? ` · ${institution}` : ""}</small>
          </span>
        )}
      </div>
      <div className="sb-account-actions">
        {settings && (
          <Link
            href={`${base}/${settings}`}
            className="sb-icon-link"
            aria-current={current === settings ? "page" : undefined}
            aria-label={compact ? "Configuración" : undefined}
            {...tipProps("Configuración", compact)}
          >
            <Settings size={18} aria-hidden />
            {!compact && <span>Configuración</span>}
          </Link>
        )}
        <button className="sb-icon-link" onClick={openSwitcher} aria-label={compact ? "Cambiar perfil" : undefined} {...tipProps("Cambiar perfil", compact)}>
          <Repeat size={18} aria-hidden />
          {!compact && <span>Cambiar perfil</span>}
        </button>
        <button className="sb-icon-link" onClick={exitDemo} aria-label={compact ? "Salir de la demostración" : undefined} {...tipProps("Salir de la demostración", compact)}>
          <LogOut size={18} aria-hidden />
          {!compact && <span>Salir de la demostración</span>}
        </button>
      </div>
    </div>
  );

  const demoBadge = (
    <span className="demo-badge">
      <InfoTip label="Demostración">
        Datos ficticios guardados solo en este navegador: no se envían a ningún servidor, no se comparten entre dispositivos y no
        son seguros. <button type="button" className="ui-link" onClick={openSwitcher}>Cambiar perfil</button>
      </InfoTip>
    </span>
  );

  return (
    <div className={`ui-shell${collapsed ? " is-collapsed" : ""}`}>
      <aside className="sb" aria-label="Menú lateral">
        <div className="sb-top">
          <Link href={base} className="sb-brand" aria-label="SortlyScan, inicio del panel">
            {collapsed ? (
              <Image src="/brand/symbol-256.webp" width={34} height={34} alt="" />
            ) : (
              <Image src="/brand/logo-light-480.webp" width={480} height={149} alt="SortlyScan" priority />
            )}
          </Link>
          <button className="sb-collapse" onClick={toggle} aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"} aria-expanded={!collapsed}>
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
        </div>
        {!collapsed && <p className="sb-role">{ROLE_LABEL[role]}</p>}
        {nav(collapsed)}
        {account(collapsed)}
      </aside>
      {tip && collapsed && (
        <span className="sb-tooltip" style={{ top: tip.top }} role="tooltip">
          {tip.label}
        </span>
      )}

      <div className="ui-scroll" ref={scroller}>
        <header className="ui-topbar">
          <Link href={base} className="sb-brand" aria-label="SortlyScan, inicio del panel">
            <Image src="/brand/logo-light-480.webp" width={480} height={149} alt="SortlyScan" />
          </Link>
          <div className="ui-topbar-actions">
            {role === "student" && current !== "escanear" && (
              <Link href={`${base}/escanear`} className="ui-button ui-button-lime ui-button-small">
                <ScanLine size={17} aria-hidden /> Escanear
              </Link>
            )}
            <button className="sb-collapse" onClick={() => setDrawer(true)} aria-label="Abrir menú" aria-expanded={drawer} aria-controls="ui-drawer">
              <Menu size={22} />
            </button>
          </div>
        </header>
        <div className="ui-context">
          <p className="ui-crumbs">
            <span>{ROLE_LABEL[role]}</span>
            {currentLabel && <span aria-current="page">{currentLabel}</span>}
            {parts.length > 1 && <span>Detalle</span>}
          </p>
          <div className="ui-context-right">
            {institution && <span className="ui-context-inst">{institution}</span>}
            {demoBadge}
            <NotificationBell />
          </div>
        </div>
        <OfflineBanner />
        <main id="contenido" className="ui-content" tabIndex={-1}>
          {children}
        </main>
      </div>

      {switcher && <ProfileSwitcher open onClose={() => setSwitcher(false)} />}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div className="sb-backdrop" onClick={() => setDrawer(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div
              id="ui-drawer"
              className="sb sb-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Menú"
              initial={reduce ? false : { x: "-100%" }}
              animate={{ x: 0 }}
              exit={reduce ? { opacity: 0 } : { x: "-100%" }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              <div className="sb-top">
                <p className="sb-role">{ROLE_LABEL[role]}</p>
                <button className="sb-collapse" onClick={() => setDrawer(false)} aria-label="Cerrar menú" autoFocus>
                  <X size={20} />
                </button>
              </div>
              {nav(false)}
              {account(false)}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
