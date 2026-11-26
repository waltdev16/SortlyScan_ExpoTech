"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { cloneElement, isValidElement, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { ApiError } from "@/lib/api/client";
import type { MaterialId } from "@/lib/api/types";
import { materialPhotos } from "@/data/material-photos";
import { MaterialArt } from "../material-art";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="ui-page-header">
      <div className="ui-page-title">
        {eyebrow && <p className="ui-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="ui-lead">{description}</p>}
      </div>
      {actions && <div className="ui-header-actions">{actions}</div>}
    </header>
  );
}

/** Bloque de una cuadrícula Bento. `tone` define el fondo; `span` las columnas en escritorio. */
export function Tile({
  children,
  span = 4,
  rows,
  tone = "plain",
  className = "",
  title,
  action,
  label,
}: {
  children: React.ReactNode;
  span?: 3 | 4 | 5 | 6 | 7 | 8 | 12;
  rows?: 2;
  tone?: "plain" | "dark" | "lime" | "sage" | "open";
  className?: string;
  title?: string;
  action?: React.ReactNode;
  label?: string;
}) {
  return (
    <section className={`tile tile-${tone} span-${span}${rows ? " rows-2" : ""} ${className}`} aria-label={!title ? label : undefined}>
      {(title || action) && (
        <div className="tile-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Bento({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bento ${className}`}>{children}</div>;
}

export function SeeAll({ href, children = "Ver todo" }: { href: string; children?: React.ReactNode }) {
  return (
    <Link className="see-all" href={href}>
      {children} <ArrowRight size={15} aria-hidden />
    </Link>
  );
}

/**
 * Imagen de un material. Si existe una fotografía con licencia registrada en
 * data/material-photos.ts se usa; si no, la ilustración vectorial del material.
 */
export function MaterialImage({ material, className = "", priority = false }: { material: MaterialId; className?: string; priority?: boolean }) {
  const photo = materialPhotos[material];
  return (
    <span className={`mat-img mat-${material} ${className}`} aria-hidden="true">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.src} alt="" loading={priority ? "eager" : "lazy"} decoding="async" />
      ) : (
        <MaterialArt material={material} />
      )}
    </span>
  );
}

export function Section({
  title,
  aside,
  children,
  id,
}: {
  title?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section className="ui-section" aria-labelledby={title && id ? `${id}-title` : undefined}>
      {(title || aside) && (
        <div className="ui-section-head">
          {title && <h2 id={id ? `${id}-title` : undefined}>{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Skeleton({ lines = 3, block = false }: { lines?: number; block?: boolean }) {
  return (
    <div className="ui-skeleton" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      {block && <div className="ui-skeleton-block" />}
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="ui-skeleton-line" style={{ width: `${92 - ((i * 17) % 40)}%` }} />
      ))}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="ui-notice ui-notice-error" role="alert">
      <p>
        <strong>No se pudo completar la solicitud.</strong> {error.message}
      </p>
      {error.requestId && <p className="ui-muted ui-small">Código de referencia: {error.requestId}</p>}
      {onRetry && (
        <button className="ui-button ui-button-quiet" onClick={onRetry}>
          Intentar de nuevo
        </button>
      )}
    </div>
  );
}

export function Notice({
  tone = "info",
  children,
  title,
}: {
  tone?: "info" | "warn" | "success" | "error";
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div className={`ui-notice ui-notice-${tone}`} role={tone === "error" ? "alert" : undefined}>
      {title && <p className="ui-notice-title">{title}</p>}
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="ui-empty">
      <p className="ui-empty-title">{title}</p>
      {children && <div className="ui-muted">{children}</div>}
    </div>
  );
}

export function Progress({ value, label, tone = "lime" }: { value: number; label: string; tone?: "lime" | "forest" }) {
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`ui-progress ui-progress-${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <motion.span
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

export function Stat({ label, value, hint, compact }: { label: string; value: React.ReactNode; hint?: React.ReactNode; compact?: boolean }) {
  return (
    <div className={`ui-stat${compact ? " is-compact" : ""}`}>
      <p className="ui-stat-label">{label}</p>
      <p className="ui-stat-value">{value}</p>
      {hint && <p className="ui-stat-hint">{hint}</p>}
    </div>
  );
}

export function BarList({
  items,
  suffix = "",
  max,
  label,
}: {
  items: { label: string; value: number | null; note?: string }[];
  suffix?: string;
  max?: number;
  label: string;
}) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value ?? 0));
  return (
    <ul className="ui-bars" aria-label={label}>
      {items.map((item) => (
        <li key={item.label}>
          <span className="ui-bars-label">{item.label}</span>
          <span className="ui-bars-track" aria-hidden="true">
            <Progress value={((item.value ?? 0) / top) * 100} label={item.label} tone="forest" />
          </span>
          <span className="ui-bars-value">
            {item.value === null ? "—" : `${item.value}${suffix}`}
            {item.note && <small> {item.note}</small>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  // Con error, el control se marca como inválido (lectores de pantalla) y el mensaje forma parte de su etiqueta.
  const control = error && isValidElement<{ "aria-invalid"?: boolean }>(children)
    ? cloneElement(children, { "aria-invalid": true })
    : children;
  return (
    <label className="ui-field">
      <span className="ui-field-label">{label}</span>
      {control}
      {hint && !error && <span className="ui-field-hint">{hint}</span>}
      {error && <span className="ui-field-error">{error}</span>}
    </label>
  );
}

export function Chip({ tone = "neutral", children }: { tone?: "neutral" | "ok" | "warn" | "muted" | "lime"; children: React.ReactNode }) {
  return <span className={`ui-chip ui-chip-${tone}`}>{children}</span>;
}

export function CopyCode({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="ui-code">
      <code aria-label={label}>{value}</code>
      <button
        type="button"
        className="ui-link-button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copiado" : "Copiar"}
      </button>
    </span>
  );
}

export function ViewFade({ children, viewKey }: { children: React.ReactNode; viewKey: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={viewKey}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

const dateFormat = new Intl.DateTimeFormat("es-SV", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("es-SV", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
}
export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTimeFormat.format(date);
}
export function pct(score: number, max: number) {
  return Math.round((score * 100) / max);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function today(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
