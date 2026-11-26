"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info, MoreHorizontal, X } from "lucide-react";

/** Panel lateral para formularios y detalles. Cierra con Escape o el fondo y devuelve el foco. */
export function SidePanel({
  open,
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const items = panel.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex='0']");
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("input,select,textarea,button:not(.sp-close)")?.focus(), 60);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
      if (previous?.isConnected) previous.focus();
    };
  }, [open, onClose]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="sp-backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div
            ref={panel}
            className={`sp${wide ? " sp-wide" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduce ? { opacity: 0 } : { x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { x: 40, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <header className="sp-head">
              <div>
                <h2 id={titleId}>{title}</h2>
                {description && <p>{description}</p>}
              </div>
              <button className="sp-close" onClick={onClose} aria-label="Cerrar panel">
                <X size={20} />
              </button>
            </header>
            <div className="sp-body">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean; hidden?: boolean };

/** Menú contextual de acciones de una fila. */
export function ActionMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const visible = items.filter((i) => !i.hidden);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        root.current?.querySelector<HTMLButtonElement>(".am-trigger")?.focus();
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    root.current?.querySelector<HTMLButtonElement>(".am-menu button")?.focus();
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  if (!visible.length) return null;
  return (
    <div className="am" ref={root}>
      <button className="am-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="am-menu" role="menu" onClick={(e) => e.stopPropagation()}>
          {visible.map((item) => (
            <button key={item.label} role="menuitem" className={item.danger ? "is-danger" : undefined} onClick={() => { setOpen(false); item.onSelect(); }}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Nota informativa discreta (p. ej. metodología de métricas). */
export function InfoTip({ label, children, iconOnly = false }: { label: string; children: React.ReactNode; iconOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <span className="it" ref={root}>
      <button type="button" className="it-trigger" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <Info size={15} aria-hidden /> {iconOnly ? <span className="sr-only">{label}</span> : label}
      </button>
      {open && (
        <span id={id} role="note" className="it-pop">
          {children}
        </span>
      )}
    </span>
  );
}
