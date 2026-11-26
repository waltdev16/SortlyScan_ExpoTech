"use client";
// Gráficos SVG accesibles y responsivos.
import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export const CHART = {
  forest: "#254D35",
  lime: "#C5F36B",
  sage: "#DDE9CE",
  stone: "#A0AA9C",
  carbon: "#101410",
  limeDeep: "#8DBB3A",
  grid: "#E2E8DA",
};

// 01. useWidth
function useWidth<T extends HTMLElement>() {
  // Ref de callback: mide también cuando el lienzo aparece después de cargar los datos.
  const [node, setNode] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!node) return;
    setWidth(node.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, width] as const;
}

// 02. niceMax
function niceMax(value: number) {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/** Máximo del eje: si los datos son conteos enteros pequeños, al menos 5 para evitar decimales. */
// 03. scaleTop
function scaleTop(series: { values: (number | null)[] }[]) {
  const values = series.flatMap((s) => s.values.map((v) => v ?? 0));
  const top = niceMax(Math.max(1, ...values));
  return values.every((v) => Number.isInteger(v)) && top < 5 ? 5 : top;
}

const fmt = (v: number | null | undefined, unit = "") => (v === null || v === undefined ? "—" : `${Math.round(v * 10) / 10}${unit}`);

/** Número que cuenta hasta su valor al entrar en pantalla. */
// 04. AnimatedNumber
export function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) return setShown(value);
    if (!inView) return;
    const controls = animate(0, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [value, inView, reduce]);
  return (
    <span ref={ref}>
      <span className="sr-only">{`${value}${suffix}`}</span>
      <span aria-hidden="true">
        {shown}
        {suffix}
      </span>
    </span>
  );
}

/** Indicador circular de progreso. */
// 05. Ring
export function Ring({
  value,
  size = 112,
  stroke = 10,
  color = CHART.forest,
  track = "#E3E9DB",
  label,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  label: string;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="ch-ring" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct / 100) }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ch-ring-center">{children}</div>
    </div>
  );
}

/** Barra horizontal animada simple (progreso de una métrica). */
// 06. Meter
export function Meter({ value, label, tone = "forest" }: { value: number; label: string; tone?: "forest" | "lime" | "carbon" }) {
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`ch-meter ch-meter-${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <motion.span initial={reduce ? false : { width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  );
}

interface Series {
  name: string;
  values: (number | null)[];
  color: string;
}

// 07. SrTable
function SrTable({ caption, labels, series, unit }: { caption: string; labels: string[]; series: Series[]; unit: string }) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Categoría</th>
            {series.map((s) => (
              <th key={s.name} scope="col">{s.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, i) => (
            <tr key={label + i}>
              <th scope="row">{label}</th>
              {series.map((s) => (
                <td key={s.name}>{fmt(s.values[i], unit)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 08. Legend
function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="ch-legend" aria-hidden="true">
      {series.map((s) => (
        <li key={s.name}>
          <span style={{ background: s.color }} />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

/** Gráfico de líneas con área suave para la primera serie. */
// 09. LineChart
export function LineChart({
  labels,
  series,
  unit = "",
  max,
  height = 220,
  caption,
  formatLabel = (l) => l,
}: {
  labels: string[];
  series: Series[];
  unit?: string;
  max?: number;
  height?: number;
  caption: string;
  formatLabel?: (label: string) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const reduce = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const id = useId().replace(/:/g, "");
  const pad = { l: 40, r: 14, t: 14, b: 30 };
  const innerW = Math.max(10, width - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;
  const top = max ?? scaleTop(series);
  const x = (i: number) => pad.l + (labels.length <= 1 ? innerW / 2 : (i / (labels.length - 1)) * innerW);
  const y = (v: number) => pad.t + innerH - (v / top) * innerH;
  const paths = useMemo(
    () =>
      series.map((s) => {
        let d = "";
        let open = false;
        s.values.forEach((v, i) => {
          if (v === null) return (open = false);
          d += `${open ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
          open = true;
        });
        return d;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, width, top, height],
  );
  const first = series[0];
  const valid = first?.values.map((v, i) => (v === null ? null : i)).filter((v): v is number => v !== null) ?? [];
  const area =
    valid.length > 1
      ? `${paths[0]}L${x(valid[valid.length - 1]).toFixed(1)},${pad.t + innerH}L${x(valid[0]).toFixed(1)},${pad.t + innerH}Z`
      : "";
  const step = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(innerW / 80))));
  const pick = (clientX: number, el: Element) => {
    const rect = el.getBoundingClientRect();
    const rel = clientX - rect.left - pad.l;
    setActive(Math.max(0, Math.min(labels.length - 1, Math.round((rel / innerW) * (labels.length - 1 || 1)))));
  };
  if (labels.length === 0) return <p className="ch-empty">Aún no hay datos suficientes para este gráfico.</p>;
  return (
    <figure className="ch">
      <Legend series={series} />
      <div
        ref={ref}
        className="ch-canvas"
        tabIndex={0}
        role="group"
        aria-label={`${caption}. Usa las flechas para recorrer los valores.`}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setActive((a) => Math.min(labels.length - 1, (a ?? -1) + 1));
          if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? labels.length) - 1));
          if (e.key === "Escape") setActive(null);
        }}
        onBlur={() => setActive(null)}
      >
        {width > 0 && (
          <svg width={width} height={height} aria-hidden="true" onPointerMove={(e) => pick(e.clientX, e.currentTarget)} onPointerLeave={() => setActive(null)}>
            <defs>
              <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={first?.color} stopOpacity="0.16" />
                <stop offset="1" stopColor={first?.color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={pad.l + innerW} y1={y(top * t)} y2={y(top * t)} stroke={CHART.grid} />
                <text x={pad.l - 8} y={y(top * t) + 4} textAnchor="end" className="ch-axis">
                  {top >= 5 ? Math.round(top * t) : fmt(top * t)}
                  {t === 1 ? unit : ""}
                </text>
              </g>
            ))}
            {labels.map((l, i) =>
              i % step === 0 || i === labels.length - 1 ? (
                <text key={l + i} x={x(i)} y={height - 8} textAnchor="middle" className="ch-axis">
                  {formatLabel(l)}
                </text>
              ) : null,
            )}
            {area && (
              <motion.path d={area} fill={`url(#${id}-fill)`} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.3 }} />
            )}
            {paths.map((d, si) => (
              <motion.path
                key={series[si].name}
                d={d}
                fill="none"
                stroke={series[si].color}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
            ))}
            {series.map((s) =>
              s.values.map((v, i) =>
                v === null || (labels.length > 16 && active !== i) ? null : (
                  <circle key={s.name + i} cx={x(i)} cy={y(v)} r={active === i ? 5 : 3} fill="#fff" stroke={s.color} strokeWidth={2} />
                ),
              ),
            )}
            {active !== null && <line x1={x(active)} x2={x(active)} y1={pad.t} y2={pad.t + innerH} stroke={CHART.stone} strokeDasharray="3 3" />}
          </svg>
        )}
        {active !== null && width > 0 && (
          <div className="ch-tip" style={{ left: Math.min(Math.max(x(active), 70), width - 70), top: 0 }} role="status">
            <strong>{formatLabel(labels[active])}</strong>
            {series.map((s) => (
              <span key={s.name}>
                <i style={{ background: s.color }} />
                {s.name}: {fmt(s.values[active], unit)}
              </span>
            ))}
          </div>
        )}
      </div>
      <SrTable caption={caption} labels={labels.map(formatLabel)} series={series} unit={unit} />
    </figure>
  );
}

/** Barras verticales (agrupadas cuando hay varias series). */
// 10. BarChart
export function BarChart({
  labels,
  series,
  unit = "",
  max,
  height = 240,
  caption,
}: {
  labels: string[];
  series: Series[];
  unit?: string;
  max?: number;
  height?: number;
  caption: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const reduce = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const pad = { l: 40, r: 8, t: 14, b: 44 };
  const innerW = Math.max(10, width - pad.l - pad.r);
  const innerH = height - pad.t - pad.b;
  const top = max ?? scaleTop(series);
  const band = innerW / Math.max(1, labels.length);
  const barW = Math.min(34, (band * 0.62) / series.length);
  const y = (v: number) => pad.t + innerH - (v / top) * innerH;
  const maxChars = Math.max(4, Math.floor(band / 7.5));
  const short = (s: string) => (s.length > maxChars ? `${s.slice(0, maxChars - 1)}…` : s);
  if (labels.length === 0) return <p className="ch-empty">Aún no hay datos suficientes para este gráfico.</p>;
  return (
    <figure className="ch">
      <Legend series={series} />
      <div ref={ref} className="ch-canvas" onPointerLeave={() => setActive(null)}>
        {width > 0 && (
          <svg width={width} height={height} aria-hidden="true">
            {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={pad.l + innerW} y1={y(top * t)} y2={y(top * t)} stroke={CHART.grid} />
                <text x={pad.l - 8} y={y(top * t) + 4} textAnchor="end" className="ch-axis">
                  {top >= 5 ? Math.round(top * t) : fmt(top * t)}
                  {t === 1 ? unit : ""}
                </text>
              </g>
            ))}
            {labels.map((label, i) => {
              const cx = pad.l + band * i + band / 2;
              const groupW = barW * series.length + 4 * (series.length - 1);
              return (
                <g key={label + i} onPointerEnter={() => setActive(i)}>
                  <rect x={pad.l + band * i} y={pad.t} width={band} height={innerH} fill={active === i ? "#F1F5EC" : "transparent"} />
                  {series.map((s, si) => {
                    const v = s.values[i] ?? 0;
                    const bx = cx - groupW / 2 + si * (barW + 4);
                    return (
                      <motion.rect
                        key={s.name}
                        x={bx}
                        width={barW}
                        rx={4}
                        fill={s.color}
                        initial={reduce ? false : { y: pad.t + innerH, height: 0 }}
                        animate={{ y: y(v), height: Math.max(0, pad.t + innerH - y(v)) }}
                        transition={{ duration: 0.7, delay: reduce ? 0 : i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                      />
                    );
                  })}
                  <text x={cx} y={height - 24} textAnchor="middle" className="ch-axis ch-axis-x">
                    {short(label)}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
        <div className="ch-bar-keys">
          {labels.map((label, i) => (
            <button
              key={label + i}
              type="button"
              className="ch-bar-key"
              style={{ left: pad.l + band * i, width: band, height: innerH + pad.t }}
              aria-label={`${label}: ${series.map((s) => `${s.name} ${fmt(s.values[i], unit)}`).join(", ")}`}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onPointerEnter={() => setActive(i)}
            />
          ))}
        </div>
        {active !== null && width > 0 && (
          <div className="ch-tip" style={{ left: Math.min(Math.max(pad.l + band * active + band / 2, 80), width - 80), top: 0 }} role="status">
            <strong>{labels[active]}</strong>
            {series.map((s) => (
              <span key={s.name}>
                <i style={{ background: s.color }} />
                {s.name}: {fmt(s.values[active], unit)}
              </span>
            ))}
          </div>
        )}
      </div>
      <SrTable caption={caption} labels={labels} series={series} unit={unit} />
    </figure>
  );
}

/** Distribución en anillo con leyenda accesible. */
// 11. Donut
export function Donut({
  segments,
  caption,
  center,
  size = 150,
}: {
  segments: { label: string; value: number; color: string }[];
  caption: string;
  center?: React.ReactNode;
  size?: number;
}) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0);
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <figure className="ch ch-donut">
      <div className="ch-donut-figure" style={{ width: size, height: size }}>
        <svg width={size} height={size} aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8EDE2" strokeWidth={stroke} />
          {total > 0 &&
            segments.map((s, i) => {
              const len = (s.value / total) * c;
              const dash = Math.max(0, len - (segments.length > 1 ? 2 : 0));
              const el = (
                <motion.circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={active === i ? stroke + 4 : stroke}
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                />
              );
              offset += len;
              return el;
            })}
        </svg>
        <div className="ch-ring-center">{center}</div>
      </div>
      <ul className="ch-donut-legend">
        {segments.map((s, i) => (
          <li key={s.label} className={active === i ? "is-active" : undefined} onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)}>
            <span style={{ background: s.color }} aria-hidden="true" />
            <span className="ch-donut-label">{s.label}</span>
            <strong>{s.value}</strong>
            <small>{total ? Math.round((s.value / total) * 100) : 0}%</small>
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}
