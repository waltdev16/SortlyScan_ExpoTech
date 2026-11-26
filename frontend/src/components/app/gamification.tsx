"use client";
// Componentes de puntos, niveles y logros.
import { motion, useReducedMotion } from "motion/react";
import { Award, Check, Lock, Sprout } from "lucide-react";
import type { Achievement, ChallengeProgress, Level, LevelDef, Outcome } from "@/lib/api/types";
import { Meter } from "./charts";
import { formatDate } from "./ui";

const FOREST = "#254D35";
const LIME = "#C5F36B";
const SAGE = "#DDE9CE";

/** Planta minimalista que crece con el nivel (1 = semilla … 8 = árbol maduro). SVG sin dependencias. */
export function PlantStage({ stage, size = 120, grow = false, title }: { stage: number; size?: number; grow?: boolean; title?: string }) {
  const reduce = useReducedMotion();
  const s = Math.max(1, Math.min(8, stage));
  const leaf = (x: number, y: number, r: number, flip = false, fill = LIME) => (
    <path d={`M${x} ${y} q ${flip ? -r : r} ${-r * 0.2} ${flip ? -r * 1.6 : r * 1.6} ${-r} q ${flip ? r * 0.6 : -r * 0.6} ${r * 0.9} ${flip ? r * 1.6 : -r * 1.6} ${r}z`}
      fill={fill} stroke={FOREST} strokeWidth="1.6" strokeLinejoin="round" />
  );
  const crown = (cx: number, cy: number, r: number, fill = LIME) => <circle cx={cx} cy={cy} r={r} fill={fill} stroke={FOREST} strokeWidth="2" />;
  const trunkTop = [0, 92, 80, 66, 58, 50, 46, 42, 40][s];
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={title ?? `Planta en la etapa ${s} de 8`} className="plant">
      <circle cx="60" cy="60" r="58" fill={SAGE} />
      <motion.g
        key={s}
        initial={grow && !reduce ? { scale: 0.55, opacity: 0.2 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: "60px 100px" }}
      >
        {s === 1 ? (
          <ellipse cx="60" cy="96" rx="7" ry="5" fill={LIME} stroke={FOREST} strokeWidth="1.8" />
        ) : (
          <path d={`M60 100 C ${s >= 4 ? 58 : 60} 96 ${s >= 4 ? 62 : 60} ${trunkTop + 10} 60 ${trunkTop}`} fill="none" stroke={FOREST}
            strokeWidth={s <= 3 ? 2.4 : s <= 5 ? 4 : 5.5} strokeLinecap="round" />
        )}
        {s === 2 && <>{leaf(60, 82, 7)}{leaf(60, 84, 7, true)}</>}
        {s === 3 && <>{leaf(60, 72, 8)}{leaf(60, 76, 8, true)}{leaf(60, 88, 7)}{leaf(60, 90, 6, true)}</>}
        {s === 4 && <>{crown(60, 58, 13)}{leaf(60, 80, 8)}{leaf(60, 84, 7, true)}</>}
        {s >= 5 && (
          <>
            {s >= 7 && <path d="M60 70 L44 58 M60 64 L76 52" stroke={FOREST} strokeWidth="3" strokeLinecap="round" />}
            {crown(60, s >= 6 ? 44 : 48, s >= 6 ? 22 : 19)}
            {s >= 6 && crown(s >= 7 ? 40 : 44, 56, s >= 7 ? 14 : 11)}
            {s >= 6 && crown(s >= 7 ? 80 : 76, 54, s >= 7 ? 14 : 11)}
            {s === 8 && [[52, 38], [68, 44], [42, 54], [79, 50], [60, 30]].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" fill={FOREST} />
            ))}
          </>
        )}
      </motion.g>
      <path d="M24 100 H96" stroke={FOREST} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** Nivel con su planta, avance y siguiente meta. */
export function LevelPanel({ level, compact = false }: { level: Level; compact?: boolean }) {
  return (
    <div className={`level-panel${compact ? " is-compact" : ""}`}>
      <PlantStage stage={level.number} size={compact ? 88 : 112} title={`Planta del nivel ${level.name}`} />
      <div className="level-panel-text">
        <p className="kpi-label">Nivel {level.number}{level.total ? ` de ${level.total}` : ""}</p>
        <p className="level-panel-name">{level.name}</p>
        <Meter value={level.progressPct} tone="lime" label={`Avance hacia el siguiente nivel: ${level.progressPct}%`} />
        <p className="tile-note">
          {level.nextAt === null ? "Llegaste al nivel más alto." : `${level.nextAt - level.points} puntos para ${level.nextName}`}
        </p>
      </div>
    </div>
  );
}

/** Camino de niveles: todas las etapas con su umbral; resalta la actual. */
export function LevelPath({ levels, current }: { levels: LevelDef[]; current: number }) {
  return (
    <ol className="level-path" aria-label="Niveles">
      {levels.map((lv) => (
        <li key={lv.number} className={lv.number === current ? "is-current" : lv.number < current ? "is-past" : undefined}
          aria-current={lv.number === current ? "step" : undefined}>
          <PlantStage stage={lv.number} size={48} title={lv.name} />
          <strong>{lv.name}</strong>
          <small>{lv.min_points.toLocaleString("es-SV")} pts</small>
        </li>
      ))}
    </ol>
  );
}

/** Aviso tras una acción que pudo otorgar puntos, subir de nivel o desbloquear logros. */
export function RewardNote({ outcome, extra }: { outcome: Partial<Outcome> | null | undefined; extra?: React.ReactNode }) {
  const reduce = useReducedMotion();
  if (!outcome || (!outcome.pointsAwarded && !outcome.levelUp && !outcome.newAchievements?.length && !extra)) return null;
  return (
    <motion.div className="reward-note" role="status" initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      {outcome.levelUp && outcome.level && (
        <div className="reward-levelup">
          <PlantStage stage={outcome.level.number} size={72} grow title={`Nueva etapa: ${outcome.level.name}`} />
          <p><strong>¡Subiste a {outcome.level.name}!</strong><br />Tu planta creció.</p>
        </div>
      )}
      {!!outcome.pointsAwarded && <p><Sprout size={16} aria-hidden /> +{outcome.pointsAwarded} puntos · total {outcome.totalPoints}</p>}
      {outcome.newAchievements?.map((a) => (
        <p key={a.id}><Award size={16} aria-hidden /> Nuevo logro: <strong>{a.title}</strong></p>
      ))}
      {extra}
    </motion.div>
  );
}

/** Logros con condición, estado, fecha y avance. */
export function AchievementList({ achievements }: { achievements: Achievement[] }) {
  return (
    <ul className="achievements">
      {achievements.map((a) => {
        const earned = Boolean(a.awarded_at);
        const target = a.target ?? 1;
        const current = a.current ?? (earned ? target : 0);
        return (
          <li key={a.id} className={earned ? "is-earned" : a.status === "in_progress" ? "is-progress" : undefined}>
            <span className="achievement-mark" aria-hidden>{earned ? <Check size={17} /> : <Lock size={15} />}</span>
            <span className="achievement-body">
              <strong>{a.title}</strong>
              <small>{a.description}</small>
              {earned ? (
                <small className="achievement-date">Obtenido el {formatDate(a.awarded_at)}</small>
              ) : target > 1 ? (
                <span className="achievement-progress">
                  <Meter value={(current / target) * 100} tone="lime" label={`${a.title}: ${current} de ${target}`} />
                  <small>{current}/{target}</small>
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Avance de un reto calculado en el servidor. */
export function ChallengeMeter({ progress, completed }: { progress?: ChallengeProgress | null; completed?: boolean }) {
  if (!progress) return null;
  const value = completed ? 100 : progress.target ? (progress.current / progress.target) * 100 : 0;
  const text = progress.unit.startsWith("%")
    ? `${progress.current}${progress.unit} participa (meta: ${progress.target} %)`
    : `${progress.current} de ${progress.target} ${progress.unit}`;
  return (
    <div className="challenge-meter">
      <Meter value={value} tone={completed ? "forest" : "lime"} label={`Avance del reto: ${text}`} />
      <small>{completed ? "Meta alcanzada" : text}</small>
    </div>
  );
}
