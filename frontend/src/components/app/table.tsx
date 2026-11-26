"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { ActionMenu, type MenuItem } from "./overlay";

export interface Column<R> {
  key: string;
  header: string;
  render: (row: R) => React.ReactNode;
  sortValue?: (row: R) => string | number | null;
  align?: "left" | "right" | "center";
  primary?: boolean;
  hideOnMobile?: boolean;
}
export interface Filter<R> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  test: (row: R, value: string) => boolean;
  initial?: string;
}

/**
 * Tabla con búsqueda, filtros, ordenamiento, paginación, detalle y menú de acciones.
 * En pantallas pequeñas se presenta como lista de filas apiladas.
 */
export function DataTable<R>({
  rows,
  columns,
  rowKey,
  searchText,
  searchLabel = "Buscar",
  filters = [],
  actions,
  onOpen,
  openLabel,
  pageSize = 10,
  empty = "No hay resultados.",
  caption,
  toolbar,
  rowClass,
}: {
  rows: R[];
  columns: Column<R>[];
  rowKey: (row: R) => string;
  searchText?: (row: R) => string;
  searchLabel?: string;
  filters?: Filter<R>[];
  actions?: (row: R) => MenuItem[];
  onOpen?: (row: R) => void;
  openLabel?: (row: R) => string;
  pageSize?: number;
  empty?: string;
  caption: string;
  toolbar?: React.ReactNode;
  rowClass?: (row: R) => string | undefined;
}) {
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(filters.map((f) => [f.key, f.initial ?? ""])),
  );
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const initialKey = filters.map((f) => f.initial ?? "").join("|");
  useEffect(() => {
    setValues(Object.fromEntries(filters.map((f) => [f.key, f.initial ?? ""])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es");
    let list = rows.filter(
      (r) =>
        (!q || (searchText?.(r) ?? "").toLocaleLowerCase("es").includes(q)) &&
        filters.every((f) => !values[f.key] || f.test(r, values[f.key])),
    );
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        list = [...list].sort((a, b) => {
          const va = col.sortValue!(a);
          const vb = col.sortValue!(b);
          if (va === vb) return 0;
          if (va === null) return 1;
          if (vb === null) return -1;
          return (va > vb ? 1 : -1) * sort.dir;
        });
      }
    }
    return list;
  }, [rows, query, values, sort, columns, filters, searchText]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize);
  useEffect(() => setPage(0), [query, values]);

  return (
    <div className="dt">
      {(searchText || filters.length > 0 || toolbar) && (
        <div className="dt-tools">
          {searchText && (
            <label className="dt-search">
              <Search size={16} aria-hidden />
              <span className="sr-only">{searchLabel}</span>
              <input type="search" placeholder={searchLabel} value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          )}
          {filters.map((f) => (
            <label key={f.key} className="dt-filter">
              <span className="sr-only">{f.label}</span>
              <select value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} aria-label={f.label}>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          ))}
          {toolbar && <div className="dt-toolbar-extra">{toolbar}</div>}
        </div>
      )}
      <div className="dt-wrap">
        <table className="dt-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={`${c.align ? `is-${c.align}` : ""}${c.hideOnMobile ? " dt-hide-m" : ""}`}
                    aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : undefined}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        className="dt-sort"
                        onClick={() => setSort(active ? (sort!.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 })}
                      >
                        {c.header}
                        {active ? (sort!.dir === 1 ? <ArrowUp size={14} aria-hidden /> : <ArrowDown size={14} aria-hidden />) : null}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
              {(actions || onOpen) && (
                <th scope="col" className="is-right">
                  <span className="sr-only">Acciones</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={rowKey(row)} className={rowClass?.(row)}>
                {columns.map((c) =>
                  c.primary ? (
                    <th key={c.key} scope="row" className={c.align ? `is-${c.align}` : undefined}>
                      {onOpen ? (
                        <button type="button" className="dt-open" onClick={() => onOpen(row)}>
                          {c.render(row)}
                          {/* El nombre accesible empieza con el texto visible (WCAG 2.5.3) y agrega la acción. */}
                          {openLabel && <span className="sr-only"> · {openLabel(row)}</span>}
                        </button>
                      ) : (
                        c.render(row)
                      )}
                    </th>
                  ) : (
                    <td key={c.key} data-label={c.header} className={`${c.align ? `is-${c.align}` : ""}${c.hideOnMobile ? " dt-hide-m" : ""}`}>
                      {c.render(row)}
                    </td>
                  ),
                )}
                {(actions || onOpen) && (
                  <td className="is-right dt-actions">
                    {actions && <ActionMenu label={`Acciones: ${openLabel?.(row) ?? ""}`} items={actions(row)} />}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className="dt-empty">{empty}</p>}
      </div>
      {filtered.length > pageSize && (
        <nav className="dt-pages" aria-label="Paginación">
          <span>
            {current * pageSize + 1}–{Math.min(filtered.length, (current + 1) * pageSize)} de {filtered.length}
          </span>
          <button type="button" onClick={() => setPage(current - 1)} disabled={current === 0} aria-label="Página anterior">
            <ChevronLeft size={18} />
          </button>
          <span aria-live="polite">
            {current + 1} / {pages}
          </span>
          <button type="button" onClick={() => setPage(current + 1)} disabled={current >= pages - 1} aria-label="Página siguiente">
            <ChevronRight size={18} />
          </button>
        </nav>
      )}
    </div>
  );
}

/** Pestañas de filtrado con contador (estados de actividades, retos, lecciones). */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          className={value === o.value ? "is-active" : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined && <span className="tabs-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
