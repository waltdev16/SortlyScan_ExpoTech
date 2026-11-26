// SORTLYSCAN INTERACTIVE DEMO · motor de la plataforma en el navegador.
//
// Implementa la misma interfaz `Api` que usa la plataforma completa, pero sobre la base LOCAL compartida
// (lib/demo/db.ts). Cada perfil (actor) es una "sesión" ficticia: lo que hace un docente lo ve el
// estudiante y la dirección, y todo se guarda en este navegador.
//
// Las reglas de puntos, niveles, logros, retos y estadísticas son las mismas que calcula el servidor
// del proyecto completo (migraciones 20261125000600/700 y services/*.py): aquí se reproducen para que la
// demostración se comporte igual. Las preguntas de la demo (data/demo-content.json) son DISTINTAS de
// las evaluaciones reales del proyecto completo.
//
// SortlyScan Vision usa el modelo real en el navegador (lib/vision/engine.ts): nunca hay predicciones
// inventadas ni aleatorias.
import type { Api } from "../api/client";
import { ApiError } from "../api/client";
import type * as T from "../api/types";
import { classify as visionClassify, modelInfo } from "../vision/engine";
import guidanceJson from "@/data/vision-guidance.json";
import {
  type Actor, type DemoAttempt, type DemoChallenge, type DemoAction, type DemoStudent, type InstitutionData, type LessonSource,
  getDb, RecordMap, scheduleSave
} from "./db";
import { DAY, PILOT_ID, dateOnly, iso } from "./seed";
import { buildReport } from "./reports";
import { actorMe } from "./profiles";
import { createAdminMethods } from "./admin";

type ActivitySource = LessonSource["activities"][number] & { answer: unknown; options?: string[]; bins?: string[]; items?: string[]; left?: string[]; right?: string[] };
const MATERIAL_META: Record<string, { name: string; code: string }> = {
  plastic: { name: "Plástico", code: "PET" },
  paper: { name: "Papel", code: "PAPEL" },
  cardboard: { name: "Cartón", code: "CARTÓN" },
  metal: { name: "Metal", code: "METAL" },
  glass: { name: "Vidrio", code: "VIDRIO" },
  organic: { name: "Residuos orgánicos", code: "ORGÁNICO" },
  other: { name: "Otros residuos", code: "OTROS" },
};
const DEMO_LEVELS: T.LevelDef[] = [
  { number: 1, name: "Semilla", min_points: 0 }, { number: 2, name: "Brote", min_points: 40 },
  { number: 3, name: "Explorador", min_points: 150 }, { number: 4, name: "Guardián", min_points: 400 },
  { number: 5, name: "Embajador", min_points: 800 }, { number: 6, name: "Eco Líder", min_points: 1500 },
  { number: 7, name: "Eco Maestro", min_points: 3000 }, { number: 8, name: "Leyenda", min_points: 5000 },
];
const ACHIEVEMENTS: { id: string; title: string; description: string; type: string; target: number; material?: string }[] = [
  { id: "primer-descubrimiento", title: "Primer descubrimiento", description: "Respondiste bien la pregunta de un residuo que escaneaste.", type: "scan_correct", target: 1 },
  { id: "primera-leccion", title: "Primera lección", description: "Completaste todas las actividades y el cuestionario de una lección.", type: "lessons_completed", target: 1 },
  { id: "primer-paso", title: "Primer paso", description: "Aprobaste tu primer cuestionario.", type: "quizzes_passed", target: 1 },
  { id: "experto-plastico", title: "Experto en plástico", description: "Completaste la lección de plástico con el cuestionario perfecto.", type: "material_expert", target: 1, material: "plastic" },
  { id: "experto-papel", title: "Experto en papel", description: "Completaste la lección de papel con el cuestionario perfecto.", type: "material_expert", target: 1, material: "paper" },
  { id: "seis-materiales", title: "Conocimiento completo", description: "Aprobaste los cuestionarios de los seis materiales.", type: "materials_passed", target: 6 },
  { id: "primer-reto", title: "Primer reto", description: "Completaste tu primer reto.", type: "challenges_completed", target: 1 },
  { id: "semana-de-aprendizaje", title: "Una semana de aprendizaje", description: "Aprendiste en tres días distintos de una misma semana.", type: "learning_days_in_week", target: 3 },
  { id: "participacion-verificada", title: "Participación verificada", description: "Un docente verificó una actividad ambiental tuya.", type: "verified_actions", target: 1 },
  { id: "colaborador-de-equipo", title: "Colaborador de equipo", description: "Tu grupo completó un reto de participación contigo.", type: "group_challenges", target: 1 },
];
const KIND_LABELS: Record<T.ChallengeKind, string> = {
  learning: "Aprendizaje", quiz: "Cuestionarios", identification: "Identificación de materiales",
  group_participation: "Participación grupal", verified_recycling: "Reciclaje verificado", institutional_activity: "Actividad institucional",
};
const VERIFICATION: Record<T.ChallengeKind, string> = {
  learning: "Automática: lecciones completadas en el periodo", quiz: "Automática: cuestionarios aprobados en el periodo",
  identification: "Automática: preguntas de escaneo respondidas correctamente",
  group_participation: "Automática: porcentaje del grupo con actividad de aprendizaje",
  verified_recycling: "Docente: actividades ambientales aprobadas", institutional_activity: "Docente: jornadas o campañas aprobadas",
};
const ACTION_LABELS: Record<T.ActionKind, string> = {
  separation: "Separación en el aula", delivery: "Entrega en centro de acopio",
  cleanup: "Limpieza", compost: "Compostaje", campaign: "Jornada o campaña", other: "Otra actividad"
};
const RECORD_LABELS: Record<T.RecordKind, string> = {
  weighing: "Pesaje", delivery: "Entrega en centro de acopio",
  campaign: "Jornada de reciclaje", reception: "Recepción de material clasificado"
};
// 01. levelFor
function levelFor(points: number): T.Level {
  let current = DEMO_LEVELS[0];
  for (const lv of DEMO_LEVELS) if (points >= lv.min_points) current = lv;
  const next = DEMO_LEVELS.find((lv) => lv.min_points > current.min_points);
  return {
    number: current.number, name: current.name, points, floor: current.min_points, nextAt: next?.min_points ?? null,
    nextName: next?.name ?? null, total: DEMO_LEVELS.length,
    progressPct: next ? Math.round(((points - current.min_points) / (next.min_points - current.min_points)) * 100) : 100, rulesVersion: "demo"
  };
}
const uid = () => Math.random().toString(36).slice(2, 10);
const delay = <R,>(value: R, ms = 220) => new Promise<R>((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const weekStart = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const monthStart = (t: number) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };

// 02. createDemoApi
export function createDemoApi(actor: Actor): Api {
  const db = getDb();
  const role = actor.role;
  const viewer = actor.personId;
  const inst: InstitutionData = db.institutions[actor.institutionId] ?? db.institutions[PILOT_ID];
  // Vista de trabajo sobre la institución: los arreglos y objetos son LOS MISMOS de la base compartida
  // (los cambios se guardan); las lecciones publicadas vienen del contenido global.
  const w = {
    ...inst,
    lessons: db.content.lessons.filter((l) => l.status === "published")
      .map((l) => ({ id: `lesson-${l.slug}`, quizId: `quiz-${l.slug}`, slug: l.slug, material: l.material as T.MaterialId, source: l })),
    solved: new RecordMap(inst.solved),
    completions: new RecordMap(inst.completions),
    awarded: new RecordMap(inst.awarded),
    assessments: new RecordMap(inst.assessments),
  };
  const rule = (key: string) => db.pointRules.find((r) => r.key === key);
  const RULE = new Proxy({} as Record<string, number>, { get: (_, key: string) => rule(key)?.points ?? 0 });
  const extraJson = db.content;
  const lessonBy = (slug: string) => {
    const l = w.lessons.find((x) => x.slug === slug);
    if (!l) throw new ApiError(404, "not_found", "La lección no existe o no está publicada.");
    return l;
  };
  /** Actividades vigentes (las retiradas por la superadministración no cuentan) con su posición original. */
  const liveActs = (slug: string) => (lessonBy(slug).source.activities as ActivitySource[]).map((a, i) => ({ a, p: i + 1 })).filter((x) => !x.a.retired);
  const liveQuestions = (src: LessonSource) => src.quiz.questions.filter((q) => !q.retired);
  const allSolved = (user: string, slug: string) => liveActs(slug).every(({ p }) => w.solved.has(`${user}|${slug}|${p}`));
  const quizPassed = (user: string, slug: string) => w.attempts.some((a) => a.user === user && a.lesson === slug && a.passed);
  const completedAt = (user: string, slug: string): number | null => {
    if (!allSolved(user, slug) || !quizPassed(user, slug)) return null;
    const lastActivity = Math.max(0, ...liveActs(slug).map(({ p }) => w.solved.get(`${user}|${slug}|${p}`)!));
    const firstPass = Math.min(...w.attempts.filter((a) => a.user === user && a.lesson === slug && a.passed).map((a) => a.at));
    return Math.max(lastActivity, firstPass);
  };
  const bestPct = (user: string, slug: string) => {
    const list = w.attempts.filter((a) => a.user === user && a.lesson === slug);
    return list.length ? Math.max(...list.map((a) => Math.round((a.score * 100) / a.max))) : null;
  };
  const statusOf = (user: string, slug: string): T.LessonSummary["progress_status"] =>
    completedAt(user, slug) ? "completed"
      : w.attempts.some((a) => a.user === user && a.lesson === slug) || liveActs(slug).some(({ p }) => w.solved.has(`${user}|${slug}|${p}`))
        || inst.started[`${user}|${slug}`] ? "started" : null;

  // ------------------------------------------------------------------ notificaciones e historial
  const notifyUser = (user: string, kind: T.NotificationKind, title: string, body: string | null, link: string | null) => {
    inst.notifications.unshift({ id: `n-${uid()}`, user, kind, title, body, link, created_at: iso(Date.now()), read: false });
  };
  const personName = (id: string) => w.students.find((s) => s.id === id)?.name ?? w.staff.find((s) => s.user_id === id)?.display_name
    ?? (id === db.admin.id ? db.admin.name : "Persona ficticia");
  const audit = (action: string, targetType: string | null, targetId: string | null, institutionId: string | null = inst.institution.id) => {
    const target = institutionId ? db.institutions[institutionId] : null;
    db.audit.unshift({
      id: (db.audit[0]?.id ?? 0) + 1, created_at: iso(Date.now()), action, target_type: targetType, target_id: targetId,
      institution_name: target?.institution.name ?? null, actor_name: personName(viewer), request_id: null, institution_id: institutionId
    });
  };

  // ------------------------------------------------------------------ puntos (mismas reglas que el servidor)
  const has = (user: string, source: string) => w.ledger.some((t) => t.user === user && t.source === source);
  /** Otorga puntos UNA vez por origen, respetando el límite por periodo de la regla. -1 = límite alcanzado. */
  const grant = (user: string, ruleKey: string, source: string, reason: string, at = Date.now(), validation = "automatic") => {
    const r = rule(ruleKey);
    if (!r || !r.active || has(user, source)) return 0;
    if (r.max_awards && r.period) {
      const startOf = r.period === "day" ? (t: number) => new Date(t).toDateString() : r.period === "week" ? (t: number) => String(weekStart(t)) : (t: number) => String(monthStart(t));
      const used = w.ledger.filter((t) => t.user === user && t.rule === ruleKey && startOf(t.at) === startOf(at)).length;
      if (used >= r.max_awards) return -1;
    }
    w.ledger.push({ user, delta: r.points, reason, rule: ruleKey, source, at, validation });
    return r.points;
  };
  const pointsOf = (user: string, since = -Infinity) => w.ledger.filter((t) => t.user === user && t.at >= since).reduce((s, t) => s + t.delta, 0);
  const learningEvents = (user: string) => [
    ...w.attempts.filter((a) => a.user === user).map((a) => a.at),
    ...[...w.solved.entries()].filter(([k]) => k.startsWith(`${user}|`)).map(([, t]) => t),
    ...w.scansLearned.filter((s) => s.user === user).map((s) => s.at),
  ];
  const challengeWindow = (c: DemoChallenge) => [new Date(`${c.starts_on}T00:00:00`).getTime(), new Date(`${c.ends_on}T23:59:59`).getTime()];
  const roster = (group: string | null) => w.students.filter((s) => s.status === "active" && (!group || s.group === group));
  const countFor = (c: DemoChallenge, user: string) => {
    const [a, b] = challengeWindow(c);
    const inside = (t: number) => t >= a && t <= b;
    switch (c.kind) {
      case "learning": return w.lessons.filter((l) => (!c.lesson || l.slug === c.lesson) && inside(completedAt(user, l.slug) ?? -1)).length;
      case "quiz": return new Set(w.attempts.filter((x) => x.user === user && x.passed && inside(x.at) && (!c.lesson || x.lesson === c.lesson)).map((x) => x.lesson)).size;
      case "identification": return w.scansLearned.filter((s) => s.user === user && s.correct && inside(s.at)).length;
      case "verified_recycling": return w.actions.filter((x) => x.user_id === user && x.status === "approved" && x.occurred_on >= c.starts_on && x.occurred_on <= c.ends_on).length;
      case "institutional_activity": return w.actions.filter((x) => x.user_id === user && x.status === "approved" && x.kind === "campaign" && x.occurred_on >= c.starts_on && x.occurred_on <= c.ends_on).length;
      default: return learningEvents(user).some(inside) ? 1 : 0;
    }
  };
  const progressOf = (c: DemoChallenge, user: string | null): T.ChallengeProgress => {
    if (c.kind === "group_participation") {
      const list = roster(c.group);
      const participants = list.filter((s) => countFor(c, s.id) > 0).length;
      const pct = list.length ? Math.round((participants * 100) / list.length) : 0;
      const mine = user ? countFor(c, user) > 0 : null;
      return {
        current: pct, target: c.goal, unit: c.group ? "% del grupo" : "% de la institución", participants, enrolled: list.length,
        iParticipated: mine, met: list.length > 0 && pct >= c.goal && mine !== false
      };
    }
    const current = user ? countFor(c, user) : 0;
    const unit = {
      learning: "lecciones", quiz: "cuestionarios", identification: "respuestas correctas", verified_recycling: "actividades verificadas",
      institutional_activity: "jornadas verificadas", group_participation: ""
    }[c.kind];
    return { current: Math.min(current, c.goal), target: c.goal, unit, met: current >= c.goal };
  };
  const stateOf = (c: DemoChallenge) => {
    const today = dateOnly(Date.now());
    return today < c.starts_on ? "upcoming" : today > c.ends_on ? "ended" : "active";
  };
  /** Registra los retos cumplidos. En el historial inicial (`replay`) la fecha es la última actividad dentro del reto. */
  const settleChallenges = (user: string, replay = false) => {
    const s = w.students.find((x) => x.id === user);
    if (!s) return;
    for (const c of w.challenges) {
      if ((c.group && c.group !== s.group) || stateOf(c) === "upcoming") continue;
      const key = `${c.id}|${user}`;
      if (w.completions.has(key) || !progressOf(c, user).met) continue;
      const [from, to] = challengeWindow(c);
      const inside = [...learningEvents(user), ...w.actions.filter((x) => x.user_id === user && x.status === "approved" && x.reviewed_at).map((x) => Date.parse(x.reviewed_at!))]
        .filter((t) => t >= from && t <= to);
      const at = replay ? Math.min(Date.now(), Math.max(from, ...inside)) : Date.now();
      w.completions.set(key, at);
      grant(user, c.group ? "challenge_group" : "challenge_institution", `challenge:${c.id}`, `Completó el reto «${c.title}»`, at);
    }
  };
  const achievementValues = (user: string) => {
    const weeks = new Map<number, Set<string>>();
    learningEvents(user).forEach((t) => { const k = weekStart(t); const set = weeks.get(k) ?? new Set(); set.add(new Date(t).toDateString()); weeks.set(k, set); });
    const completed = w.lessons.filter((l) => completedAt(user, l.slug));
    const values = {
      scan_correct: w.scansLearned.filter((s) => s.user === user && s.correct).length,
      lessons_completed: completed.length,
      quizzes_passed: new Set(w.attempts.filter((a) => a.user === user && a.passed).map((a) => a.lesson)).size,
      materials_passed: new Set(w.attempts.filter((a) => a.user === user && a.passed).map((a) => lessonBy(a.lesson).material)).size,
      challenges_completed: [...w.completions.keys()].filter((k) => k.endsWith(`|${user}`)).length,
      group_challenges: [...w.completions.keys()].filter((k) => k.endsWith(`|${user}`) && w.challenges.find((c) => c.id === k.split("|")[0])?.kind === "group_participation").length,
      verified_actions: w.actions.filter((a) => a.user_id === user && a.status === "approved").length,
      learning_days_in_week: Math.max(0, ...[...weeks.values()].map((d) => d.size)),
    };
    return { values: values as Record<string, number>, experts: new Set<string>(completed.filter((l) => bestPct(user, l.slug) === 100).map((l) => l.material)) };
  };
  const achievementsOf = (user: string, award: boolean) => {
    const v = achievementValues(user);
    const fresh: T.Achievement[] = [];
    const list = ACHIEVEMENTS.map((a) => {
      const current = a.type === "material_expert" ? (v.experts.has(a.material!) ? 1 : 0) : v.values[a.type] ?? 0;
      const key = `${a.id}|${user}`;
      if (award && !w.awarded.has(key) && current >= a.target) {
        w.awarded.set(key, Date.now());
        fresh.push({ id: a.id, title: a.title, description: a.description });
      }
      const at = w.awarded.get(key);
      return {
        id: a.id, title: a.title, description: a.description, target: a.target, current: Math.min(current, a.target),
        awarded_at: at ? iso(at) : null, status: at ? "earned" : current > 0 ? "in_progress" : "locked",
        condition: { type: a.type, material: a.material }
      } as T.Achievement;
    });
    return { list, fresh };
  };
  const outcome = (user: string, before: number): T.Outcome => {
    settleChallenges(user);
    const { fresh } = achievementsOf(user, true);
    const total = pointsOf(user);
    const levelUp = levelFor(total).number > levelFor(before).number;
    for (const a of fresh) notifyUser(user, "achievement", `Logro desbloqueado: ${a.title}`, a.description, "/panel/estudiante/progreso");
    if (levelUp) notifyUser(user, "level_up", `Subiste al nivel ${levelFor(total).name}`, null, "/panel/estudiante/progreso");
    return { pointsAwarded: total - before, totalPoints: total, level: levelFor(total), levelUp, newAchievements: fresh };
  };
  // Historial inicial: la primera vez se reproducen los eventos en orden con las mismas reglas de puntos.
  if (!inst.seeded) (() => {
    const events: { at: number; run: () => void }[] = [];
    w.students.forEach((s) => w.lessons.forEach((l) => {
      const first = w.attempts.filter((a) => a.user === s.id && a.lesson === l.slug && a.passed).sort((a, b) => a.at - b.at)[0];
      if (first) events.push({ at: first.at, run: () => grant(s.id, "quiz_first_pass", `quiz:${l.slug}`, `Aprobó «${l.source.quiz.title}» por primera vez`, first.at) });
      const done = completedAt(s.id, l.slug);
      if (done) events.push({ at: done, run: () => grant(s.id, "lesson_first_completion", `lesson:${l.slug}`, `Completó la lección «${l.source.title}»`, done) });
    }));
    w.scansLearned.filter((x) => x.correct).forEach((x, i) => events.push({ at: x.at, run: () => grant(x.user, "scan_learning", `scan:seed-${i}`, "Respondió bien tras escanear", x.at) }));
    w.actions.filter((a) => a.status === "approved").forEach((a) => events.push({ at: new Date(a.reviewed_at!).getTime(), run: () => grant(a.user_id, "verified_action", `action:${a.id}`, `Actividad verificada: ${ACTION_LABELS[a.kind]}`, new Date(a.reviewed_at!).getTime(), "teacher_verified") }));
    events.sort((a, b) => a.at - b.at).forEach((e) => e.run());
    w.students.forEach((s) => { settleChallenges(s.id, true); achievementsOf(s.id, true); });
    // Fechas de logros iniciales: alrededor de su evento.
    w.awarded.forEach((_, k) => w.awarded.set(k, Date.now() - 2 * DAY));
    inst.seeded = true;
    scheduleSave();
  })();

  const summary = (l: (typeof w.lessons)[number], user = viewer): T.LessonSummary => ({
    id: l.id, slug: l.slug, title: l.source.title, summary: l.source.summary, material: l.material,
    material_name: MATERIAL_META[l.material].name, material_code: MATERIAL_META[l.material].code,
    estimated_minutes: l.source.minutes, quiz_id: l.quizId, progress_status: statusOf(user, l.slug), best_score_pct: bestPct(user, l.slug),
    attempts: w.attempts.filter((a) => a.user === user && a.lesson === l.slug).length,
    activities_done: allSolved(user, l.slug), activity_count: liveActs(l.slug).length,
    activities_solved: liveActs(l.slug).filter(({ p }) => w.solved.has(`${user}|${l.slug}|${p}`)).length,
  });
  const attemptRow = (a: DemoAttempt): T.AttemptRow => {
    const student = w.students.find((s) => s.id === a.user);
    const group = w.groups.find((g) => g.id === student?.group);
    return {
      id: a.id, lesson_title: lessonBy(a.lesson).source.title, slug: a.lesson, display_name: student?.name,
      group_name: group ? `${group.grade} ${group.name}` : undefined, score: a.score, max_score: a.max, passed: a.passed, created_at: iso(a.at)
    };
  };
  const myGroups = () => (role === "director" ? w.groups : w.groups.filter((g) => g.teachers.includes(viewer)));
  const requireGroup = (id: string) => {
    const g = myGroups().find((x) => x.id === id);
    if (!g) throw new ApiError(404, "not_found", "El grupo no existe o no tienes acceso.");
    return g;
  };
  const activeStudents = (groupId?: string) => w.students.filter((s) => s.status === "active" && (!groupId || s.group === groupId));
  const groupRow = (g: (typeof w.groups)[number]): T.Group => ({
    id: g.id, name: g.name, school_year: g.school_year, ranking_visibility: g.ranking_visibility, status: g.status,
    grade_level_id: g.grade_level_id, grade: g.grade, students: activeStudents(g.id).length,
    teachers: g.teachers.map((t) => ({ id: t, name: w.staff.find((s) => s.user_id === t)?.display_name ?? "Docente" })),
  });
  const lessonsDone = (user: string) => w.lessons.filter((l) => completedAt(user, l.slug)).length;
  const metricsFor = (g: (typeof w.groups)[number]): T.GroupMetrics => {
    const ids = new Set(activeStudents(g.id).map((s) => s.id));
    const list = w.attempts.filter((a) => ids.has(a.user));
    return {
      id: g.id, name: g.name, grade: g.grade, students: ids.size,
      active_30d: new Set(list.filter((a) => a.at > Date.now() - 30 * DAY).map((a) => a.user)).size,
      attempts: list.length, passed_attempts: list.filter((a) => a.passed).length,
      avg_score_pct: list.length ? Math.round(list.reduce((s, a) => s + (a.score * 100) / a.max, 0) / list.length) : null,
      lessons_completed: [...ids].reduce((sum, id) => sum + lessonsDone(id), 0),
    };
  };
  const studentRow = (s: DemoStudent): T.StudentRow => {
    const g = w.groups.find((x) => x.id === s.group)!;
    const list = w.attempts.filter((a) => a.user === s.id);
    return {
      enrollment_id: `e-${s.id}`, user_id: s.id, display_name: s.name, username: s.username, status: s.status,
      group_id: g.id, group_name: g.name, grade: g.grade, points: pointsOf(s.id), lessons_completed: lessonsDone(s.id),
      avg_score_pct: list.length ? Math.round(list.reduce((sum, a) => sum + (a.score * 100) / a.max, 0) / list.length) : null,
      last_activity_at: list.length ? iso(Math.max(...list.map((a) => a.at))) : null
    };
  };
  const challengeRow = (c: DemoChallenge, user?: string): T.Challenge => {
    const lesson = c.lesson ? lessonBy(c.lesson) : null;
    const group = w.groups.find((g) => g.id === c.group);
    const eligible = roster(c.group);
    const state = stateOf(c);
    const completedAt = user ? w.completions.get(`${c.id}|${user}`) : undefined;
    return {
      id: c.id, title: c.title, description: c.description, kind: c.kind, kindLabel: KIND_LABELS[c.kind], verification: VERIFICATION[c.kind],
      goal_count: c.goal, starts_on: c.starts_on, ends_on: c.ends_on, state, lesson_slug: c.lesson, lesson_title: lesson?.source.title ?? null,
      institutional: !c.group, group_id: c.group, group_name: group ? `${group.grade} ${group.name}` : null,
      reward: RULE[c.group ? "challenge_group" : "challenge_institution"],
      progress: user ? (state === "upcoming" ? { current: 0, target: c.goal, unit: "", met: false } : progressOf(c, user)) : undefined,
      groupProgress: !user && c.kind === "group_participation" ? progressOf(c, null) : null,
      completed: user ? Boolean(completedAt) : undefined, completedAt: completedAt ? iso(completedAt) : null,
      eligible: eligible.length, participants: eligible.filter((s) => w.completions.has(`${c.id}|${s.id}`)).length
    };
  };
  const csv = (rows: (string | number | null | undefined)[][]) =>
    new Blob(["﻿" + rows.map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n")], { type: "text/csv" });
  const weekKey = (t: number) => dateOnly(weekStart(t) + 12 * 3600_000);
  const weeklyOf = (list: DemoAttempt[], groupOf?: (a: DemoAttempt) => string | undefined): T.WeeklyPoint[] => {
    const map = new Map<string, { attempts: number; students: Set<string>; sum: number; group?: string }>();
    list.filter((a) => a.at > Date.now() - 84 * DAY).forEach((a) => {
      const group = groupOf?.(a);
      const key = `${weekKey(a.at)}|${group ?? ""}`;
      const item = map.get(key) ?? { attempts: 0, students: new Set<string>(), sum: 0, group };
      item.attempts++; item.students.add(a.user); item.sum += (a.score * 100) / a.max; map.set(key, item);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => ({
      week: key.split("|")[0], attempts: v.attempts, students: v.students.size, avg_score_pct: Math.round(v.sum / v.attempts),
      ...(v.group ? { group_id: v.group } : {})
    }));
  };
  const unavailable = () => Promise.reject(new ApiError(403, "demo", "Esta función no está disponible en el modo demostración."));
  const myNotices = () => inst.notifications.filter((n) => n.user === viewer);
  const noticeList = (): T.NotificationList => {
    const items = myNotices().slice(0, 30).map(({ user: _u, ...n }) => n);
    return { items, unread: items.filter((n) => !n.read).length };
  };
  const me = (): T.Me => actorMe(actor);
  const adminMethods = () => createAdminMethods({ db, role, viewer, audit, unavailable, delay, uid });
  /** Guía educativa del escaneo: misma combinación que `educational()` del backend (lección + guía + regla local). */
  const education = (category: string): T.VisionEducation => {
    const G = guidanceJson as unknown as { guidance: Record<string, Record<string, unknown>>; lessonByCategory: Record<string, string> };
    const g = G.guidance[category] ?? {};
    const lesson = w.lessons.find((l) => l.material === category);
    const content = lesson?.source.content;
    const rule = w.sortingRules.find((r) => r.material === category) ?? null;
    const list = db.content.scanQuestions[category] ?? [];
    const seen = inst.scans.filter((x) => x.user === viewer && x.category === category).length;
    const index = list.length ? seen % list.length : 0;
    return {
      summary: (g.summary as string) ?? null, what: content?.what ?? null,
      recognize: content?.identify ?? (g.recognize as string[]) ?? [], recyclable: (g.recyclable as string) ?? null,
      prepare: content?.classify ?? (g.prepare as string[]) ?? [], mistakes: content?.mistakes ?? (g.mistakes as string[]) ?? [],
      tips: content?.tips ?? (g.tips as string[]) ?? [],
      question: list.length ? { id: `demo-${category}:${index}`, prompt: list[index].prompt, options: list[index].options } : null,
      lessonSlug: lesson?.slug ?? G.lessonByCategory[category] ?? null, lessonTitle: lesson?.source.title ?? null,
      institutionRule: rule ? { material: rule.material, accepted: rule.accepted, place: rule.place, notes: rule.notes } : null,
    };
  };
  const studentGroup = () => w.groups.find((g) => g.id === w.students.find((s) => s.id === viewer)?.group);
  const assessmentState = (user: string): T.AssessmentState => {
    const a = w.assessments.get(user) ?? {};
    const done = lessonsDone(user);
    const shape = (r?: T.AssessmentResult & { at: number }) => (r ? { score: r.score, max_score: r.maxScore, created_at: iso(r.at) } : null);
    return {
      available: !a.pre ? "pre" : !a.post && done >= 3 ? "post" : null, pre: shape(a.pre), post: shape(a.post),
      postAfterLessons: 3, lessonsCompleted: done
    };
  };
  const actionRow = (a: DemoAction): T.EnvironmentalAction => {
    const g = w.groups.find((x) => x.id === a.group_id)!;
    return {
      ...a, kindLabel: ACTION_LABELS[a.kind], group_name: `${g.grade} ${g.name}`,
      display_name: w.students.find((s) => s.id === a.user_id)?.name ?? "Estudiante",
      reviewer_name: a.reviewer ? w.staff.find((s) => s.user_id === a.reviewer)?.display_name ?? null : null
    };
  };
  const recordRows = () => w.records.map((r) => ({
    ...r, kindLabel: RECORD_LABELS[r.kind],
    superseded: w.records.some((x) => x.supersedes_id === r.id && x.status === "verified")
  }));

  // ------------------------------------------------------------------ estadísticas (mismas definiciones que el servidor)
  const analytics = (f: T.StatsFilters): T.AnalyticsOverview => {
    const end = f.end ?? dateOnly(Date.now());
    const start = f.start ?? dateOnly(new Date(`${end}T12:00:00`).getTime() - 89 * DAY);
    const [a, b] = [new Date(`${start}T00:00:00`).getTime(), new Date(`${end}T23:59:59`).getTime()];
    const inside = (t: number) => t >= a && t <= b;
    const groups = myGroups().filter((g) => (!f.group || g.id === f.group) && (!f.grade || g.grade_level_id === f.grade));
    if (f.group && !groups.length) throw new ApiError(403, "forbidden", "No supervisas ese grupo.");
    const lessonOk = (slug: string) => !f.material || lessonBy(slug).material === f.material;
    const firstAttempts = (ids: Set<string>) => {
      const seen = new Map<string, DemoAttempt>();
      [...w.attempts].sort((x, y) => x.at - y.at).forEach((x) => {
        if (ids.has(x.user) && inside(x.at) && lessonOk(x.lesson) && !seen.has(`${x.user}|${x.lesson}`)) seen.set(`${x.user}|${x.lesson}`, x);
      });
      return [...seen.values()];
    };
    const active = (ids: Set<string>) => [...ids].filter((id) => w.attempts.some((x) => x.user === id && inside(x.at) && lessonOk(x.lesson))
      || [...w.solved.entries()].some(([k, t]) => k.startsWith(`${id}|`) && inside(t) && lessonOk(k.split("|")[1]))
      || w.scansLearned.some((s) => s.user === id && inside(s.at) && (!f.material || s.material === f.material))).length;
    const startedPairs = (ids: Set<string>) => [...ids].flatMap((id) => w.lessons.filter((l) => lessonOk(l.slug)).filter((l) => {
      const times = [...w.attempts.filter((x) => x.user === id && x.lesson === l.slug).map((x) => x.at),
      ...liveActs(l.slug).map(({ p }) => w.solved.get(`${id}|${l.slug}|${p}`)).filter((t): t is number => t !== undefined)];
      return times.length && inside(Math.min(...times));
    }).map((l) => ({ id, slug: l.slug })));
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
    const byGroup: T.GroupStats[] = groups.map((g) => {
      const ids = new Set(activeStudents(g.id).map((s) => s.id));
      const firsts = firstAttempts(ids);
      const startedList = startedPairs(ids);
      const done = startedList.filter((p) => completedAt(p.id, p.slug)).length;
      const act = active(ids);
      const attempts = w.attempts.filter((x) => ids.has(x.user) && inside(x.at) && lessonOk(x.lesson)).length;
      return {
        id: g.id, name: g.name, grade: g.grade, enrolled: ids.size, active: act,
        participationPct: ids.size ? Math.round((act * 100) / ids.size) : null, lessons_started: startedList.length,
        lessons_completed: [...ids].reduce((s, id) => s + w.lessons.filter((l) => lessonOk(l.slug) && inside(completedAt(id, l.slug) ?? -1)).length, 0),
        completionRatePct: startedList.length ? Math.round((done * 100) / startedList.length) : null, quiz_attempts: attempts,
        first_attempt_pct: avg(firsts.map((x) => (x.score * 100) / x.max)), students_evaluated: new Set(firsts.map((x) => x.user)).size,
        challenges_completed: [...w.completions.entries()].filter(([k, t]) => ids.has(k.split("|")[1]) && inside(t)).length,
        verified_actions: w.actions.filter((x) => x.group_id === g.id && x.status === "approved" && x.occurred_on >= start && x.occurred_on <= end).length,
        noRecords: ids.size === 0 || (act === 0 && attempts === 0)
      };
    });
    const all = new Set(groups.flatMap((g) => activeStudents(g.id).map((s) => s.id)));
    const firsts = firstAttempts(all);
    const byMaterial: T.MaterialStats[] = ["plastic", "paper", "cardboard", "metal", "glass", "organic"].filter((m) => !f.material || m === f.material).map((m) => {
      const list = firsts.filter((x) => lessonBy(x.lesson).material === m);
      const studentsN = new Set(list.map((x) => x.user)).size;
      const passed = new Set(w.attempts.filter((x) => all.has(x.user) && x.passed && inside(x.at) && lessonBy(x.lesson).material === m).map((x) => x.user)).size;
      const pct = avg(list.map((x) => (x.score * 100) / x.max));
      const rate = studentsN ? Math.round((passed * 100) / studentsN) : null;
      return {
        material: m, name: MATERIAL_META[m].name, students: studentsN, first_attempt_pct: pct, students_passed: passed, passRatePct: rate,
        needsReinforcement: studentsN >= 3 && ((rate ?? 100) < 70 || (pct ?? 0) < 70)
      };
    });
    const weekly: T.AnalyticsOverview["weekly"] = [];
    for (let t = weekStart(a); t <= b; t += 7 * DAY) {
      const within = (x: number) => x >= t && x < t + 7 * DAY;
      const ids = new Set([...all].filter((id) => w.attempts.some((x) => x.user === id && within(x.at)) || w.scansLearned.some((s) => s.user === id && within(s.at))));
      weekly.push({ week: dateOnly(t + 12 * 3600_000), active_students: ids.size, first_attempt_pct: avg(firsts.filter((x) => within(x.at)).map((x) => (x.score * 100) / x.max)) });
    }
    const buckets: [number, number | null, string][] = [[0, 0, "0"], [1, 49, "1–49"], [50, 149, "50–149"], [150, 399, "150–399"], [400, null, "400 o más"]];
    const totals = [...all].map((id) => w.ledger.filter((tx) => tx.user === id && inside(tx.at)).reduce((s, tx) => s + tx.delta, 0));
    const pairs = [...all].map((id) => w.assessments.get(id)).filter((x): x is { pre: T.AssessmentResult & { at: number }; post: T.AssessmentResult & { at: number } } => Boolean(x?.pre && x.post));
    const summarize = (list: typeof pairs) => list.length ? {
      pairs: list.length, prePct: avg(list.map((x) => x.pre.scorePct)), postPct: avg(list.map((x) => x.post.scorePct)),
      changePts: (avg(list.map((x) => x.post.scorePct)) ?? 0) - (avg(list.map((x) => x.pre.scorePct)) ?? 0), improved: list.filter((x) => x.post.score > x.pre.score).length
    }
      : { pairs: 0, prePct: null, postPct: null, changePts: null, improved: 0 };
    const enrolled = all.size;
    const act = active(all);
    const startedAll = byGroup.reduce((s, g) => s + g.lessons_started, 0);
    const doneAll = startedPairs(all).filter((p) => completedAt(p.id, p.slug)).length;
    const verified = recordRows().filter((r) => r.status === "verified" && !r.superseded && r.occurred_on >= start && r.occurred_on <= end
      && (!f.group || r.group_id === f.group) && (!f.material || r.material === f.material));
    const byMat = new Map<string, { material: string; unit: "kg" | "items"; quantity: number; records: number }>();
    verified.forEach((r) => { const k = `${r.material}|${r.unit}`; const e = byMat.get(k) ?? { material: r.material, unit: r.unit, quantity: 0, records: 0 }; e.quantity += r.quantity; e.records++; byMat.set(k, e); });
    const byMonth = new Map<string, { month: string; unit: "kg" | "items"; quantity: number }>();
    verified.forEach((r) => { const k = `${r.occurred_on.slice(0, 7)}|${r.unit}`; const e = byMonth.get(k) ?? { month: r.occurred_on.slice(0, 7), unit: r.unit, quantity: 0 }; e.quantity += r.quantity; byMonth.set(k, e); });
    const sum = (unit: string) => Math.round([...byMat.values()].filter((x) => x.unit === unit).reduce((s, x) => s + x.quantity, 0) * 100) / 100;
    return {
      filters: { start, end, group: f.group ?? null, grade: f.grade ? String(f.grade) : null, material: f.material ?? null },
      definitions: DEFINITIONS,
      summary: {
        enrolled, active: act, participationPct: enrolled ? Math.round((act * 100) / enrolled) : null, lessonsStarted: startedAll,
        lessonsCompleted: byGroup.reduce((s, g) => s + g.lessons_completed, 0), completionRatePct: startedAll ? Math.round((doneAll * 100) / startedAll) : null,
        quizAttempts: byGroup.reduce((s, g) => s + g.quiz_attempts, 0), firstAttemptPct: avg(firsts.map((x) => (x.score * 100) / x.max)),
        studentsEvaluated: new Set(firsts.map((x) => x.user)).size, challengesCompleted: byGroup.reduce((s, g) => s + g.challenges_completed, 0),
        verifiedActions: byGroup.reduce((s, g) => s + g.verified_actions, 0), groupsWithoutRecords: byGroup.filter((g) => g.noRecords).length,
        pendingReviews: w.actions.filter((x) => x.status === "pending" && groups.some((g) => g.id === x.group_id)).length
      },
      byGroup, byMaterial, weekly,
      pointsDistribution: buckets.map(([lo, hi, label]) => ({ range: label, students: totals.filter((t) => t >= lo && (hi === null || t <= hi)).length })),
      assessment: {
        overall: summarize(pairs),
        taken: { pre: [...all].filter((id) => w.assessments.get(id)?.pre).length, post: [...all].filter((id) => w.assessments.get(id)?.post).length },
        byGroup: groups.map((g) => ({
          groupId: g.id, groupName: `${g.grade} ${g.name}`, ...summarize(activeStudents(g.id).map((s) => w.assessments.get(s.id))
            .filter((x): x is (typeof pairs)[number] => Boolean(x?.pre && x.post)))
        })).filter((g) => g.pairs > 0),
        byMaterial: [],
        note: "Comparación pareada: solo estudiantes con evaluación inicial y posterior. Mismas preguntas en ambas fases. Una mejora no demuestra por sí sola el efecto de SortlyScan: no hay grupo de control y pueden influir otras clases, la familiaridad con las preguntas y la madurez de los estudiantes.",
      },
      environment: role === "director" ? {
        byMaterial: [...byMat.values()], byMonth: [...byMonth.values()].sort((x, y) => x.month.localeCompare(y.month)),
        pendingRecords: w.records.filter((r) => r.status === "pending").length,
        actions: { approved: w.actions.filter((x) => x.status === "approved").length, pending: w.actions.filter((x) => x.status === "pending").length },
        totals: { kg: sum("kg"), items: sum("items") },
        note: "Solo registros verificados por la dirección. Los kilogramos y los objetos se muestran por separado y nunca se suman. Un pesaje reemplazado por una entrega se cuenta una sola vez. No se calculan equivalencias de CO₂, agua, árboles ni energía.",
      } : null,
    };
  };

  const api: Api = {
    mode: "demo",
    me: () => delay(me()),
    updateMe: (displayName) => {
      const clean = displayName.replace(/\s+/g, " ").trim();
      if (clean.length < 2 || clean.length > 80 || /[<>]/.test(clean)) return Promise.reject(new ApiError(422, "validation_error", "Escribe un nombre de 2 a 80 caracteres."));
      if (role === "student") return Promise.reject(new ApiError(403, "forbidden", "Tu docente administra tu nombre."));
      if (role === "admin") db.admin.name = clean;
      else { const st = w.staff.find((x) => x.user_id === viewer); if (st) st.display_name = clean; }
      return delay({ displayName: clean });
    },
    redeem: unavailable,
    studentOverview: () => {
      const g = studentGroup()!;
      settleChallenges(viewer);
      const lessons = w.lessons.map((l) => summary(l));
      const points = pointsOf(viewer);
      return delay<T.StudentOverview>({
        displayName: personName(viewer), institution: w.institution.name,
        group: { id: g.id, name: g.name, grade: g.grade, ranking_visibility: g.ranking_visibility }, points, level: levelFor(points),
        levels: DEMO_LEVELS, assessment: assessmentState(viewer),
        lessons: {
          total: lessons.length, completed: lessons.filter((l) => l.progress_status === "completed").length,
          next: lessons.filter((l) => l.progress_status !== "completed").slice(0, 3)
        },
        recentAttempts: w.attempts.filter((a) => a.user === viewer).sort((a, b) => b.at - a.at).slice(0, 5).map(attemptRow),
        activities: w.activities.filter((a) => a.group === g.id).map((a) => ({
          id: a.id, title: a.title, instructions: a.instructions,
          due_on: a.due_on, lesson_slug: a.lesson, lesson_title: lessonBy(a.lesson).source.title, completed: statusOf(viewer, a.lesson) === "completed"
        })),
        challenges: w.challenges.filter((c) => !c.group || c.group === g.id).map((c) => challengeRow(c, viewer)).filter((c) => c.state !== "ended").slice(0, 4),
        achievements: achievementsOf(viewer, false).list.filter((a) => a.awarded_at),
      }, 450);
    },
    studentProgress: () => {
      const points = pointsOf(viewer);
      return delay<T.StudentProgress>({
        lessons: w.lessons.map((l) => summary(l)),
        history: w.attempts.filter((a) => a.user === viewer).sort((a, b) => b.at - a.at).map(attemptRow),
        ledger: w.ledger.filter((t) => t.user === viewer).sort((a, b) => b.at - a.at).map((t) => ({
          delta: t.delta, reason: t.reason,
          created_at: iso(t.at), rules_version: "demo", rule_key: t.rule, validation: t.validation
        })),
        achievements: achievementsOf(viewer, false).list, points, level: levelFor(points), levels: DEMO_LEVELS,
      });
    },
    studentGamification: () => {
      const points = pointsOf(viewer);
      return delay<T.GamificationSummary>({
        points, level: levelFor(points), levels: DEMO_LEVELS, rules: db.pointRules,
        achievements: achievementsOf(viewer, false).list
      });
    },
    studentChallenges: () => {
      const g = studentGroup()!;
      settleChallenges(viewer);
      return delay(w.challenges.filter((c) => !c.group || c.group === g.id).map((c) => challengeRow(c, viewer)));
    },
    studentRanking: (period = "all", scope = "group") => {
      const g = studentGroup()!;
      const since = period === "week" ? weekStart(Date.now()) : period === "month" ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() : -Infinity;
      const setting = w.institution.ranking_scope ?? "group";
      if (scope === "institution" && setting !== "institution") return Promise.reject(new ApiError(403, "forbidden", "Tu institución no tiene activado el ranking institucional."));
      const evolution = Array.from({ length: 8 }, (_, i) => {
        const start = weekStart(Date.now()) - (7 - i) * 7 * DAY;
        const within = (t: number) => t >= start && t < start + 7 * DAY;
        return {
          week: dateOnly(start + 12 * 3600_000), points: w.ledger.filter((t) => t.user === viewer && within(t.at)).reduce((s, t) => s + t.delta, 0),
          activities: learningEvents(viewer).filter(within).length
        };
      });
      const base = {
        period, scope, rankingScope: setting, group: { name: g.name, grade: g.grade }, evolution,
        groupComparison: w.groups.map((x) => {
          const list = activeStudents(x.id); return {
            name: x.name, grade: x.grade, students: list.length,
            avgPoints: list.length ? Math.round(list.reduce((s, st) => s + pointsOf(st.id, since), 0) / list.length) : null, isMine: x.id === g.id
          };
        }),
        effort: { thisWeek: evolution[7].activities, lastWeek: evolution[6].activities }, entries: [], position: null, participants: 0,
      };
      if (setting === "off") return delay<T.StudentRanking>({ ...base, visibility: "off", myPoints: pointsOf(viewer, since) });
      const pool = scope === "group" ? activeStudents(g.id) : activeStudents();
      const rows = pool.map((s) => ({ s, points: pointsOf(s.id, since) })).sort((a, b) => b.points - a.points || a.s.name.localeCompare(b.s.name));
      const position = rows.findIndex((r) => r.s.id === viewer) + 1;
      const visible = scope === "institution" || g.ranking_visibility === "group";
      const limit = scope === "institution" ? 10 : rows.length;
      return delay<T.StudentRanking>({
        ...base, visibility: visible ? "visible" : "private", position, participants: rows.length, myPoints: pointsOf(viewer, since),
        entries: visible ? rows.slice(0, limit).map((r, i) => ({
          position: i + 1, displayName: r.s.name, points: r.points,
          groupName: scope === "institution" ? `${w.groups.find((x) => x.id === r.s.group)!.grade} ${w.groups.find((x) => x.id === r.s.group)!.name}` : null, isMe: r.s.id === viewer
        })) : []
      });
    },
    lessons: () => delay(w.lessons.map((l) => summary(l))),
    lesson: (slug) => {
      const l = lessonBy(slug);
      return delay<T.LessonDetail>({
        ...summary(l), content: { ...l.source.content, intro: l.source.intro, examples: l.source.examples }, quiz_title: l.source.quiz.title, pass_score_pct: l.source.quiz.pass_score_pct,
        questions: liveQuestions(l.source).map((q, i) => ({ id: `${l.slug}-q${i + 1}`, position: i + 1, prompt: q.prompt, options: q.options })),
        activities: liveActs(slug).map(({ a, p }) => ({
          id: `${l.slug}-a${p}`, position: p, kind: a.kind as T.ActivityKind, prompt: a.prompt,
          payload: a.kind === "sort" ? { bins: a.bins, items: a.items } : a.kind === "match" ? { left: a.left, right: a.right } : a.kind === "truefalse" ? {} : { options: a.options },
          solved: w.solved.has(`${viewer}|${slug}|${p}`), attempts: 0
        })),
        quizPassed: quizPassed(viewer, slug),
        progress: statusOf(viewer, slug) ? { status: statusOf(viewer, slug)!, best_score_pct: bestPct(viewer, slug) } : null,
      });
    },
    startLesson: (slug) => {
      if (role === "student") inst.started[`${viewer}|${slug}`] ??= Date.now();
      return delay({ status: "started" }, 50);
    },
    checkActivity: (slug, position, answer) => {
      const activity = liveActs(slug).find((x) => x.p === position)?.a;
      if (!activity) return Promise.reject(new ApiError(404, "not_found", "La actividad no existe."));
      const key = activity.answer;
      const correct = same(answer, key);
      const items = Array.isArray(key) && Array.isArray(answer) ? (key as number[]).map((k, i) => answer[i] === k) : null;
      const base: T.ActivityCheck = { correct, items, explanation: activity.explanation, answer: correct ? (key as T.ActivityAnswer) : null, recorded: false };
      if (role !== "student") return delay(base, 250);
      const before = pointsOf(viewer);
      const k = `${viewer}|${slug}|${position}`;
      if (correct && !w.solved.has(k)) w.solved.set(k, Date.now());
      const wasDone = w.ledger.some((t) => t.user === viewer && t.source === `lesson:${slug}`);
      let lessonCompleted = false;
      if (!wasDone && completedAt(viewer, slug)) {
        grant(viewer, "lesson_first_completion", `lesson:${slug}`, `Completó la lección «${lessonBy(slug).source.title}»`);
        lessonCompleted = true;
      }
      const remaining = liveActs(slug).filter(({ p }) => !w.solved.has(`${viewer}|${slug}|${p}`)).length;
      return delay<T.ActivityCheck>({ ...base, ...outcome(viewer, before), recorded: true, lessonCompleted, activitiesRemaining: remaining }, 300);
    },
    submitAttempt: (quizId, answers) => {
      if (role !== "student") return unavailable();
      const l = w.lessons.find((x) => x.quizId === quizId);
      if (!l) return Promise.reject(new ApiError(404, "not_found", "El cuestionario no existe."));
      const questions = liveQuestions(l.source);
      const passPct = l.source.quiz.pass_score_pct;
      if (answers.length !== questions.length) return Promise.reject(new ApiError(422, "validation_error", "Responde todas las preguntas."));
      const score = answers.filter((a, i) => a === questions[i].correct).length;
      const passed = score * 100 >= passPct * questions.length;
      const before = pointsOf(viewer);
      w.attempts.push({ id: uid(), user: viewer, lesson: l.slug, score, max: questions.length, passed, at: Date.now() });
      if (passed) grant(viewer, "quiz_first_pass", `quiz:${l.slug}`, `Aprobó «${l.source.quiz.title}» por primera vez`);
      let lessonCompleted = false;
      if (completedAt(viewer, l.slug) && !has(viewer, `lesson:${l.slug}`)) {
        grant(viewer, "lesson_first_completion", `lesson:${l.slug}`, `Completó la lección «${l.source.title}»`);
        lessonCompleted = true;
      }
      return delay<T.AttemptResult>({
        attemptId: uid(), score, maxScore: questions.length, scorePct: Math.round((score * 100) / questions.length), passed, passScorePct: passPct,
        questions: questions.map((q, i) => ({
          position: i + 1, selected: answers[i], correct: answers[i] === q.correct,
          correctOption: passed ? q.correct : null, explanation: q.explanation
        })),
        ...outcome(viewer, before), lessonCompleted, replayed: false,
      }, 500);
    },
    assessment: () => delay<T.Assessment>({
      id: extraJson.assessment.id, title: extraJson.assessment.title, version: 1,
      questions: extraJson.assessment.questions.map((q, i) => ({ position: i + 1, material: q.material as T.MaterialId, prompt: q.prompt, options: q.options })),
      state: role === "student" ? assessmentState(viewer) : null
    }),
    submitAssessment: (phase, answers) => {
      const state = assessmentState(viewer);
      if (state.available !== phase) return Promise.reject(new ApiError(409, "not_available", "Esta evaluación todavía no está disponible."));
      const qs = extraJson.assessment.questions;
      if (answers.length !== qs.length) return Promise.reject(new ApiError(422, "validation_error", "Responde todas las preguntas."));
      const byMaterial: Record<string, { correct: number; total: number }> = {};
      qs.forEach((q, i) => { const m = (byMaterial[q.material] ??= { correct: 0, total: 0 }); m.total++; m.correct += answers[i] === q.correct ? 1 : 0; });
      const score = Object.values(byMaterial).reduce((s, m) => s + m.correct, 0);
      const result = { phase, score, maxScore: qs.length, scorePct: Math.round((score * 100) / qs.length), byMaterial };
      const entry = w.assessments.get(viewer) ?? {};
      entry[phase] = { ...result, at: Date.now() };
      w.assessments.set(viewer, entry);
      return delay<T.AssessmentResult>(result, 400);
    },
    answerScan: (scanId, questionId, answer) => {
      const [material, index] = questionId.replace("demo-", "").split(":");
      const q = (extraJson.scanQuestions as Record<string, { correct: number; explanation: string }[]>)[material]?.[Number(index)];
      if (!q) return Promise.reject(new ApiError(404, "not_found", "La pregunta no existe."));
      const correct = answer === q.correct;
      if (role !== "student") return delay<T.ScanAnswerResult>({ correct, explanation: q.explanation, correctOption: q.correct, pointsAwarded: 0, recorded: false });
      // Igual que el servidor: una sola respuesta por escaneo, y solo de un escaneo propio identificado de ese material.
      const scan = inst.scans.find((x) => x.id === scanId && x.user === viewer);
      if (!scan || scan.category !== material) return Promise.reject(new ApiError(404, "not_found", "No encontramos ese escaneo."));
      if (scan.answered) return Promise.reject(new ApiError(409, "already_answered", "Ya respondiste la pregunta de este escaneo."));
      scan.answered = true;
      const before = pointsOf(viewer);
      w.scansLearned.push({ user: viewer, material, correct, at: Date.now() });
      const got = correct ? grant(viewer, "scan_learning", `scan:${scanId}`, `Respondió bien sobre ${MATERIAL_META[material]?.name.toLowerCase() ?? material} tras escanear`) : 0;
      return delay<T.ScanAnswerResult>({ correct, explanation: q.explanation, correctOption: q.correct, ...outcome(viewer, before), limited: got === -1, recorded: true });
    },
    practiceScanQuestion: (questionId, answer) => {
      const [material, index] = questionId.replace("demo-", "").split(":");
      const q = (extraJson.scanQuestions as Record<string, { correct: number; explanation: string }[]>)[material]?.[Number(index)];
      if (!q) return Promise.reject(new ApiError(404, "not_found", "La pregunta no existe."));
      return delay<T.ScanAnswerResult>({ correct: answer === q.correct, explanation: q.explanation, correctOption: q.correct, pointsAwarded: 0, recorded: false });
    },
    myActions: () => delay(w.actions.filter((a) => a.user_id === viewer).sort((a, b) => b.created_at.localeCompare(a.created_at)).map(actionRow)),
    submitAction: (body) => {
      if (role !== "student") return unavailable();
      if (body.occurred_on > dateOnly(Date.now())) return Promise.reject(new ApiError(422, "validation_error", "La fecha no puede ser futura."));
      if (w.actions.filter((a) => a.user_id === viewer && (a.status === "pending" || a.status === "changes_requested")).length >= 5) {
        return Promise.reject(new ApiError(429, "too_many_pending", "Tienes 5 actividades esperando revisión. Espera a que tu docente las revise."));
      }
      const id = `ea-${uid()}`;
      w.actions.unshift({
        id, user_id: viewer, group_id: studentGroup()!.id, kind: body.kind, material: body.material, description: body.description,
        quantity: body.quantity, unit: body.unit, occurred_on: body.occurred_on, status: "pending", review_note: null, reviewed_at: null,
        created_at: iso(Date.now()), reviewer: null
      });
      return delay({ id, status: "pending" }, 300);
    },
    resubmitAction: (id, body) => {
      const a = w.actions.find((x) => x.id === id && x.user_id === viewer);
      if (!a || a.status !== "changes_requested") return Promise.reject(new ApiError(409, "not_editable", "Solo puedes corregir actividades con cambios solicitados."));
      Object.assign(a, body, { status: "pending" });
      return delay({ id, status: "pending" });
    },
    reviews: (status = "pending") => delay(w.actions.filter((a) => myGroups().some((g) => g.id === a.group_id) && (status === "all" || a.status === status))
      .sort((a, b) => a.created_at.localeCompare(b.created_at)).map(actionRow)),
    reviewAction: (id, decision, note) => {
      const a = w.actions.find((x) => x.id === id);
      if (!a || !myGroups().some((g) => g.id === a.group_id)) return Promise.reject(new ApiError(403, "forbidden", "Solo el docente del grupo o la dirección pueden revisar esta actividad."));
      if (a.status !== "pending") return Promise.reject(new ApiError(409, "already_reviewed", "Esta actividad ya fue revisada."));
      if (decision !== "approved" && !note?.trim()) return Promise.reject(new ApiError(422, "validation_error", "Explica el motivo al estudiante."));
      Object.assign(a, { status: decision, review_note: note?.trim() || null, reviewed_at: iso(Date.now()), reviewer: viewer });
      let points = 0;
      let limited = false;
      if (decision === "approved") {
        const before = pointsOf(a.user_id);
        const got = grant(a.user_id, "verified_action", `action:${a.id}`, `Actividad verificada: ${ACTION_LABELS[a.kind]}`, Date.now(), "teacher_verified");
        limited = got === -1;
        points = outcome(a.user_id, before).pointsAwarded;
      }
      notifyUser(a.user_id, decision === "approved" ? "action_approved" : decision === "rejected" ? "action_rejected" : "action_changes",
        decision === "approved" ? `Tu docente verificó: ${ACTION_LABELS[a.kind]}` : decision === "rejected" ? `Tu docente no aprobó: ${ACTION_LABELS[a.kind]}` : "Tu docente pidió cambios en una actividad",
        note?.trim() || (points > 0 ? `Ganaste ${points} puntos.` : null), "/panel/estudiante/acciones");
      audit(`environmental_action.${decision}`, "environmental_action", id);
      return delay<T.ReviewResult>({ id, status: decision, pointsAwarded: points, limited }, 300);
    },
    environmentalRecords: () => delay(recordRows().sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))),
    createEnvironmentalRecord: (body) => {
      if (body.supersedes_id) {
        const prev = w.records.find((r) => r.id === body.supersedes_id);
        if (!prev || prev.material !== body.material || prev.unit !== body.unit) return Promise.reject(new ApiError(422, "validation_error", "Solo se puede reemplazar un registro del mismo material y unidad."));
        if (w.records.some((r) => r.supersedes_id === body.supersedes_id && r.status !== "rejected")) return Promise.reject(new ApiError(409, "already_superseded", "Ese registro ya fue reemplazado por otro."));
      }
      const id = `r-${uid()}`;
      const g = w.groups.find((x) => x.id === body.group_id);
      w.records.unshift({
        ...body, id, kindLabel: "", superseded: false, status: "pending", verified_at: null, verification_note: null,
        group_name: g?.name ?? null, recorded_by_name: me().displayName, verified_by_name: null, recorded_by: viewer
      });
      return delay({ id }, 300);
    },
    verifyEnvironmentalRecord: (id, decision, note) => {
      if (role !== "director") return Promise.reject(new ApiError(403, "forbidden", "Solo la dirección verifica registros ambientales."));
      const r = w.records.find((x) => x.id === id);
      if (!r || r.status !== "pending") return Promise.reject(new ApiError(409, "already_reviewed", "Este registro ya fue revisado."));
      Object.assign(r, { status: decision, verified_at: iso(Date.now()), verification_note: note ?? null, verified_by_name: personName(viewer) });
      audit(`environmental_record.${decision}`, "environmental_record", id);
      return delay({ ok: true });
    },
    analytics: (f) => { try { return delay(analytics(f), 400); } catch (e) { return Promise.reject(e); } },
    report: async (kind, format, f) => {
      if (kind === "resumen-institucional" && role !== "director") return unavailable();
      const data = analytics(f);
      const groupIds = new Set(myGroups().map((g) => g.id));
      const pct = (v: number | null) => (v === null ? "sin registros" : v);
      const TITLES: Record<T.ReportKind, string> = {
        "progreso-estudiantil": "Progreso estudiantil", "rendimiento-grupos": "Rendimiento de grupos", participacion: "Participación",
        "actividades-educativas": "Actividades educativas", retos: "Retos", "reciclaje-verificado": "Reciclaje verificado",
        "resumen-institucional": "Resumen institucional",
      };
      const groupsSection = {
        columns: ["Grupo", "Matriculados", "Activos", "Participación (%)", "Lecciones completadas", "Finalización (%)", "Primer intento (%)", "Actividades verificadas"],
        rows: data.byGroup.map((g) => [`${g.grade} ${g.name}`, g.enrolled, g.active, pct(g.participationPct), g.lessons_completed, pct(g.completionRatePct), pct(g.first_attempt_pct), g.verified_actions])
      };
      const sections: { heading?: string; columns: string[]; rows: (string | number | null)[][] }[] = [];
      if (kind === "progreso-estudiantil") {
        sections.push({
          columns: ["Estudiante (ficticio)", "Grupo", "Lecciones completadas", "Cuestionarios aprobados", "Actividades verificadas", "Puntos", "Nivel"],
          rows: w.students.filter((x) => x.status === "active" && groupIds.has(x.group) && (!f.group || x.group === f.group)).map((x) => {
            const g = w.groups.find((y) => y.id === x.group)!;
            const p = pointsOf(x.id);
            return [x.name, `${g.grade} ${g.name}`, lessonsDone(x.id), new Set(w.attempts.filter((t) => t.user === x.id && t.passed).map((t) => t.lesson)).size,
            w.actions.filter((t) => t.user_id === x.id && t.status === "approved").length, p, levelFor(p).name];
          })
        });
      } else if (kind === "rendimiento-grupos") {
        sections.push(groupsSection);
      } else if (kind === "participacion") {
        sections.push({ columns: ["Semana", "Estudiantes activos", "Primer intento (%)"], rows: data.weekly.map((x) => [x.week, x.active_students, pct(x.first_attempt_pct)]) });
      } else if (kind === "actividades-educativas") {
        sections.push({
          columns: ["Material", "Estudiantes", "Primer intento (%)", "Aprobaron", "Aprobación (%)", "Necesita refuerzo"],
          rows: data.byMaterial.map((m) => [m.name, m.students, pct(m.first_attempt_pct), m.students_passed, pct(m.passRatePct), m.needsReinforcement ? "Sí" : "No"])
        });
      } else if (kind === "retos") {
        sections.push({
          columns: ["Reto", "Tipo", "Alcance", "Meta", "Inicio", "Fin", "Estudiantes que lo completaron"],
          rows: w.challenges.filter((c) => !c.group || groupIds.has(c.group)).map((c) => {
            const g = c.group ? w.groups.find((y) => y.id === c.group) : null;
            return [c.title, KIND_LABELS[c.kind], g ? `${g.grade} ${g.name}` : "Toda la institución", c.goal, c.starts_on, c.ends_on,
            [...w.completions.keys()].filter((k) => k.startsWith(`${c.id}|`)).length];
          })
        });
      } else if (kind === "reciclaje-verificado") {
        sections.push({
          heading: "Actividades ambientales aprobadas por docentes", columns: ["Fecha", "Actividad", "Material", "Cantidad", "Unidad", "Grupo"],
          rows: w.actions.filter((x) => x.status === "approved" && groupIds.has(x.group_id) && x.occurred_on >= data.filters.start! && x.occurred_on <= data.filters.end!)
            .map((x) => { const g = w.groups.find((y) => y.id === x.group_id); return [x.occurred_on, ACTION_LABELS[x.kind], x.material ? MATERIAL_META[x.material]?.name ?? x.material : "—", x.quantity, x.unit === "kg" ? "kg" : x.unit ? "unidades" : null, g ? `${g.grade} ${g.name}` : ""]; })
        });
        if (role === "director") sections.push({
          heading: "Registros ambientales verificados por la dirección", columns: ["Fecha", "Tipo", "Material", "Cantidad", "Unidad", "Responsable"],
          rows: w.records.filter((x) => x.status === "verified" && !w.records.some((y) => y.supersedes_id === x.id && y.status === "verified"))
            .map((x) => [x.occurred_on, RECORD_LABELS[x.kind], MATERIAL_META[x.material]?.name ?? x.material, x.quantity, x.unit === "kg" ? "kg" : "unidades", x.responsible])
        });
      } else {
        const sm = data.summary;
        sections.push({
          heading: "Indicadores principales", columns: ["Indicador", "Valor"], rows: [
            ["Estudiantes matriculados", sm.enrolled], ["Estudiantes activos", sm.active], ["Participación (%)", pct(sm.participationPct)],
            ["Lecciones completadas", sm.lessonsCompleted], ["Tasa de finalización (%)", pct(sm.completionRatePct)], ["Intentos de cuestionario", sm.quizAttempts],
            ["Promedio del primer intento (%)", pct(sm.firstAttemptPct)], ["Retos completados", sm.challengesCompleted], ["Actividades ambientales verificadas", sm.verifiedActions],
            ["Revisiones pendientes", sm.pendingReviews]]
        }, { heading: "Por grupo", ...groupsSection });
        if (data.environment) sections.push({
          heading: "Material verificado físicamente (registros de la dirección)", columns: ["Material", "Cantidad", "Unidad", "Registros"],
          rows: data.environment.byMaterial.map((m) => [MATERIAL_META[m.material]?.name ?? m.material, m.quantity, m.unit === "kg" ? "kg" : "unidades", m.records])
        });
      }
      const notes = [
        "Todos los nombres, resultados y cantidades de este reporte son FICTICIOS y se generaron en este navegador. No representan impacto ambiental real.",
        "Un escaneo con SortlyScan Vision indica que la IA identificó un residuo; no demuestra que se haya reciclado. El reciclaje solo se cuenta cuando un docente o la dirección lo verifica.",
        ...(kind === "resumen-institucional" || kind === "rendimiento-grupos" ? Object.values(DEFINITIONS).slice(0, 6).map((d) => `${d.label}: ${d.formula}`) : []),
      ];
      const blob = await buildReport({
        title: TITLES[kind], institution: w.institution.name, period: `${data.filters.start} – ${data.filters.end}`,
        generatedBy: `${personName(viewer)} (perfil ficticio)`, sections, notes
      }, format);
      audit(`report.${format}`, "report", kind);
      return blob;
    },
    teacherOverview: () => {
      const groups = myGroups();
      const ids = new Set(groups.flatMap((g) => activeStudents(g.id).map((s) => s.id)));
      const groupOfAttempt = (a: DemoAttempt) => w.students.find((s) => s.id === a.user)?.group;
      return delay<T.TeacherOverview>({
        weekly: weeklyOf(w.attempts.filter((a) => ids.has(a.user)), groupOfAttempt),
        displayName: personName(viewer), institution: w.institution.name, groups: groups.map(groupRow), metrics: groups.map(metricsFor),
        recentAttempts: w.attempts.filter((a) => ids.has(a.user)).sort((a, b) => b.at - a.at).slice(0, 10).map(attemptRow),
        upcomingActivities: w.activities.filter((a) => groups.some((g) => g.id === a.group)).map((a) => {
          const g = w.groups.find((x) => x.id === a.group)!;
          return { id: a.id, title: a.title, due_on: a.due_on, group_name: g.name, lesson_title: lessonBy(a.lesson).source.title };
        }),
      }, 450);
    },
    groups: () => delay(myGroups().map(groupRow)),
    gradeLevels: () => delay(Array.from({ length: 9 }, (_, i) => ({ id: i + 1, name: `${i + 1}.º grado` }))),
    updateGroup: (id, patch) => {
      const g = requireGroup(id);
      if (patch.ranking_visibility) g.ranking_visibility = patch.ranking_visibility;
      if (patch.name && role === "director") g.name = patch.name;
      if (patch.status && role === "director") g.status = patch.status;
      audit(patch.status === "revoked" ? "group.archive" : "group.update", "group", id);
      return delay({ id });
    },
    groupStudents: (id) => { requireGroup(id); return delay(w.students.filter((s) => s.group === id).map(studentRow)); },
    createStudents: (id, names) => {
      requireGroup(id);
      const clean = names.map((n) => n.replace(/\s+/g, " ").trim());
      if (clean.some((n) => n.length < 2 || n.length > 80 || /[<>]/.test(n) || /^[=+\-@]/.test(n))) {
        return Promise.reject(new ApiError(422, "validation_error", "Revisa los nombres: entre 2 y 80 caracteres, sin símbolos especiales."));
      }
      // En la demostración no hay contraseñas ni códigos: el perfil aparece directamente en el selector.
      const created = clean.map((name) => {
        const s: DemoStudent = { id: `s-${uid()}`, name, username: `demo${uid().slice(0, 4)}`, group: id, status: "active", createdAt: Date.now() };
        w.students.push(s);
        audit("student.create", "enrollment", s.id);
        return { userId: s.id, displayName: name, username: s.username, accessCode: "" };
      });
      return delay(created);
    },
    resetStudentCode: () => Promise.reject(new ApiError(403, "demo", "En la demostración no hay códigos de acceso: cada perfil se abre desde «Cambiar perfil».")),
    revokeStudent: (g, sid) => {
      requireGroup(g);
      const s = w.students.find((x) => x.id === sid);
      if (s) { s.status = "revoked"; audit("student.revoke", "enrollment", sid); }
      return delay({ status: "revoked" });
    },
    activities: (id) => {
      requireGroup(id);
      const students = activeStudents(id);
      return delay(w.activities.filter((a) => a.group === id).map((a) => ({
        id: a.id, title: a.title, instructions: a.instructions,
        due_on: a.due_on, created_at: a.created_at, lesson_slug: a.lesson, lesson_title: lessonBy(a.lesson).source.title,
        students: students.length, completed: students.filter((s) => statusOf(s.id, a.lesson) === "completed").length
      })));
    },
    createActivity: (id, body) => {
      requireGroup(id);
      lessonBy(body.lesson_slug);
      if (!body.title?.trim()) return Promise.reject(new ApiError(422, "validation_error", "Escribe un título para la actividad."));
      const actId = `a-${uid()}`;
      w.activities.unshift({
        id: actId, group: id, lesson: body.lesson_slug, title: body.title.trim(), instructions: body.instructions ?? null,
        due_on: body.due_on ?? null, created_at: iso(Date.now())
      });
      for (const st of activeStudents(id)) notifyUser(st.id, "activity_assigned", `Nueva actividad: ${body.title.trim()}`,
        body.due_on ? `Entrega: ${body.due_on}` : null, `/panel/estudiante/aprender/${body.lesson_slug}`);
      audit("activity.create", "activity", actId);
      return delay({ ok: true });
    },
    results: (id) => {
      requireGroup(id);
      const students = activeStudents(id);
      const cells: T.GroupResults["cells"] = [];
      students.forEach((s) => w.lessons.forEach((l) => {
        const list = w.attempts.filter((a) => a.user === s.id && a.lesson === l.slug);
        if (list.length) cells.push({
          user_id: s.id, lesson_id: l.id, attempts: list.length, best_pct: bestPct(s.id, l.slug)!,
          passed: list.some((a) => a.passed), last_at: iso(Math.max(...list.map((a) => a.at)))
        });
      }));
      return delay<T.GroupResults>({
        lessons: w.lessons.map((l) => ({ id: l.id, slug: l.slug, title: l.source.title, material: MATERIAL_META[l.material].name })),
        students: students.map((s) => ({ user_id: s.id, display_name: s.name })), cells,
        recent: w.attempts.filter((a) => students.some((s) => s.id === a.user)).sort((a, b) => b.at - a.at).slice(0, 30).map(attemptRow),
      });
    },
    groupRanking: (id, period = "all") => {
      const g = requireGroup(id);
      const since = period === "week" ? weekStart(Date.now()) : period === "month" ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() : -Infinity;
      const rows = activeStudents(id).map((s) => ({ user_id: s.id, display_name: s.name, points: pointsOf(s.id, since), lessons_completed: lessonsDone(s.id) }))
        .sort((a, b) => b.points - a.points || a.display_name.localeCompare(b.display_name));
      return delay<T.TeacherRanking>({ visibility: g.ranking_visibility, period, entries: rows.map((r, i) => ({ position: i + 1, ...r })) });
    },
    challenges: (id) => {
      if (id) requireGroup(id);
      const visible = role === "director" ? w.challenges : w.challenges.filter((c) => !c.group || myGroups().some((g) => g.id === c.group));
      visible.forEach((c) => roster(c.group).forEach((s) => settleChallenges(s.id)));
      return delay(visible.filter((c) => !id || !c.group || c.group === id).map((c) => challengeRow(c)));
    },
    createChallenge: (body, id) => {
      if (id) requireGroup(id);
      else if (role !== "director") return unavailable();
      if (body.ends_on < body.starts_on) return Promise.reject(new ApiError(422, "validation_error", "La fecha final debe ser posterior a la inicial."));
      if (!body.title?.trim() || !(body.goal_count >= 1)) return Promise.reject(new ApiError(422, "validation_error", "El reto necesita un título y una meta mayor que cero."));
      const cid = `c-${uid()}`;
      w.challenges.unshift({
        id: cid, group: id ?? null, lesson: body.lesson_slug ?? null, title: body.title.trim(), kind: body.kind, goal: body.goal_count,
        description: body.description ?? null, starts_on: body.starts_on, ends_on: body.ends_on
      });
      for (const st of roster(id ?? null)) notifyUser(st.id, "challenge_new", `Nuevo reto: ${body.title.trim()}`, "Revisa la meta y las fechas en Retos.", "/panel/estudiante/retos");
      audit("challenge.create", "challenge", cid);
      return delay({ ok: true });
    },
    students: () => delay(w.students.filter((s) => myGroups().some((g) => g.id === s.group)).map(studentRow)),
    groupReportCsv: (id) => {
      requireGroup(id);
      return delay(csv([["Estudiante (ficticio)", "Grado", "Grupo", "Lecciones completadas", "Promedio (%)", "Puntos"],
      ...activeStudents(id).map(studentRow).map((r) => [r.display_name, r.grade, r.group_name, r.lessons_completed, r.avg_score_pct, r.points])]), 50);
    },
    directorOverview: () => delay<T.DirectorOverview>({
      institution: { id: w.institution.id, name: w.institution.name, department: w.institution.department, district: w.institution.district, status: w.institution.status },
      displayName: personName(viewer),
      counts: {
        teachers: w.staff.filter((s) => s.role === "teacher" && s.status === "active").length, students: activeStudents().length,
        groups: w.groups.filter((g) => g.status === "active").length, pending_invitations: 0
      },
      groups: w.groups.map(metricsFor),
    }, 450),
    institution: () => delay(w.institution),
    updateInstitution: (body) => {
      if (role !== "director") return unavailable();
      Object.assign(w.institution, body);
      audit("institution.update", "institution", w.institution.id);
      return delay(w.institution);
    },
    setRankingScope: (scope) => {
      if (role !== "director") return unavailable();
      w.institution.ranking_scope = scope;
      audit("institution.ranking_scope", "institution", w.institution.id);
      return delay(w.institution);
    },
    staff: () => delay(w.staff.map((s) => ({ ...s, groups: w.groups.filter((g) => g.teachers.includes(s.user_id)).map((g) => ({ id: g.id, name: g.name, grade: g.grade })) }))),
    revokeStaff: (id) => {
      if (role !== "director") return unavailable();
      const st = w.staff.find((x) => x.membership_id === id);
      if (st && st.role === "teacher") {
        st.status = "revoked";
        w.groups.forEach((g) => { g.teachers = g.teachers.filter((t) => t !== st.user_id); });
        audit("staff.revoke", "membership", id);
      }
      return delay({ ok: true });
    },
    // Sin invitaciones ni correos: la dirección registra docentes directamente por nombre.
    invitations: () => delay([]),
    createInvitation: () => Promise.reject(new ApiError(403, "demo", "En la demostración no se envían invitaciones: registra al docente por su nombre.")),
    revokeInvitation: () => delay({ ok: true }),
    createTeacher: (name) => {
      if (role !== "director") return unavailable();
      const clean = name.replace(/\s+/g, " ").trim();
      if (clean.length < 2 || clean.length > 80 || /[<>]/.test(clean)) return Promise.reject(new ApiError(422, "validation_error", "Escribe un nombre de 2 a 80 caracteres."));
      const id = `t-${uid()}`;
      w.staff.push({ membership_id: `m-${id}`, user_id: id, role: "teacher", status: "active", display_name: clean, groups: [] });
      audit("staff.create", "membership", id);
      return delay({ id, name: clean });
    },
    createGroup: (body) => {
      if (role !== "director") return unavailable();
      const name = body.name.trim();
      if (!name || name.length > 20) return Promise.reject(new ApiError(422, "validation_error", "La sección debe tener entre 1 y 20 caracteres."));
      if (w.groups.some((g) => g.status === "active" && g.grade_level_id === body.grade_level_id && g.name.toLowerCase() === name.toLowerCase() && g.school_year === body.school_year)) {
        return Promise.reject(new ApiError(409, "duplicate", "Ya existe ese grupo en este año escolar."));
      }
      const id = `g-${uid()}`;
      w.groups.push({
        id, name, grade: `${body.grade_level_id}.º grado`, grade_level_id: body.grade_level_id, ranking_visibility: "private", teachers: [],
        school_year: body.school_year, status: "active"
      });
      audit("group.create", "group", id);
      return delay({ id });
    },
    assignTeacher: (g, t) => {
      if (role !== "director") return unavailable();
      const group = requireGroup(g);
      if (!w.staff.some((x) => x.user_id === t && x.role === "teacher" && x.status === "active")) return Promise.reject(new ApiError(404, "not_found", "Ese docente no está activo."));
      if (!group.teachers.includes(t)) group.teachers.push(t);
      audit("group.assign_teacher", "group", g);
      return delay({ ok: true });
    },
    unassignTeacher: (g, t) => {
      if (role !== "director") return unavailable();
      const group = requireGroup(g);
      group.teachers = group.teachers.filter((x) => x !== t);
      audit("group.unassign_teacher", "group", g);
      return delay({ ok: true });
    },
    metrics: () => delay<T.InstitutionMetrics>({
      learning: {
        byGroup: w.groups.map(metricsFor), byMaterial: w.lessons.map((l) => {
          const list = w.attempts.filter((a) => a.lesson === l.slug);
          return {
            material: l.material, name: MATERIAL_META[l.material].name, attempts: list.length,
            avg_score_pct: list.length ? Math.round(list.reduce((s, a) => s + (a.score * 100) / a.max, 0) / list.length) : null,
            students_passed: new Set(list.filter((a) => a.passed).map((a) => a.user)).size
          };
        })
      },
      participation: { weekly: weeklyOf(w.attempts) },
      environment: {
        scans: { total: inst.scans.length, identified: inst.scans.filter((x) => x.status === "identified").length },
        note: "Los escaneos registran reconocimientos de la IA, no residuos reciclados."
      },
    }),
    institutionReportCsv: () => delay(csv([["Grado", "Grupo", "Estudiantes", "Cuestionarios", "Promedio (%)"],
    ...w.groups.map(metricsFor).map((m) => [m.grade, m.name, m.students, m.attempts, m.avg_score_pct])]), 50),
    ...adminMethods(),
    // Gestión escolar y privacidad: datos ficticios guardados solo en este navegador.
    notifications: () => delay(noticeList(), 120),
    readNotifications: (id) => {
      for (const n of myNotices()) if (!id || n.id === id) n.read = true;
      return delay(noticeList(), 80);
    },
    importStudents: (rows, confirm) => {
      const groups = myGroups();
      const norm = (v: string) => v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
      const seen = new Set<string>();
      const result: T.ImportRowResult[] = rows.map((r) => {
        const name = r.display_name.replace(/\s+/g, " ").trim();
        const group = groups.find((g) => g.id === r.group_id) ?? groups.find((g) => r.group_label && norm(`${g.grade} ${g.name}`) === norm(r.group_label));
        const messages: string[] = [];
        let status: T.ImportRowResult["status"] = "ok";
        if (name.length < 2 || name.length > 80 || /^[=+\-@]/.test(name) || /[<>]/.test(name)) { status = "error"; messages.push("Nombre no válido"); }
        if (!group) { status = "error"; messages.push("Grupo no encontrado o sin permiso para registrar en él"); }
        if (status !== "error" && group) {
          const key = `${group.id}|${norm(name)}`;
          if (seen.has(key)) { status = "error"; messages.push("Repetido en el archivo"); }
          else if (w.students.some((x) => x.group === group.id && x.status === "active" && norm(x.name) === norm(name))) {
            status = r.accept_duplicate ? "ok" : "warning"; messages.push("Ya existe un estudiante activo con ese nombre en el grupo");
          }
          seen.add(key);
        }
        return {
          line: r.line, displayName: name, groupId: group?.id ?? null, groupLabel: group ? `${group.grade} ${group.name}` : r.group_label ?? "",
          status, messages, acceptDuplicate: !!r.accept_duplicate
        };
      });
      const summary = {
        ok: result.filter((r) => r.status === "ok").length, warning: result.filter((r) => r.status === "warning").length,
        error: result.filter((r) => r.status === "error").length
      };
      if (!confirm) return delay({ rows: result, summary, canCommit: summary.error === 0 && summary.ok > 0 });
      if (summary.error) return Promise.reject(new ApiError(422, "import_invalid", "Corrige las filas con errores antes de registrar."));
      const created = result.filter((r) => r.status === "ok").map((r) => {
        const st: DemoStudent = { id: `s-${uid()}`, name: r.displayName, username: `demo${uid().slice(0, 4)}`, group: r.groupId!, status: "active", createdAt: Date.now() };
        w.students.push(st);
        audit("student.import", "enrollment", st.id);
        return { line: r.line, userId: st.id, displayName: st.name, username: st.username, accessCode: "", groupLabel: r.groupLabel };
      });
      return delay({ rows: result, summary, canCommit: false, created, failed: [] });
    },
    transferStudents: (g, target, ids) => {
      if (role !== "director") return unavailable();
      const list = w.students.filter((x) => x.group === g && x.status === "active" && (!ids.length || ids.includes(x.id)));
      if (!w.groups.some((x) => x.id === target && x.status === "active")) return Promise.reject(new ApiError(404, "not_found", "El grupo de destino no existe."));
      for (const x of list) x.group = target;
      audit("student.transfer", "group", target);
      return delay({ moved: list.length });
    },
    reactivateStudent: (g, sid) => {
      requireGroup(g);
      const x = w.students.find((y) => y.id === sid);
      if (x) x.status = "active";
      return delay({ status: "active" });
    },
    history: (before) => {
      const rows = db.audit.filter((r) => r.institution_id === inst.institution.id && (!before || r.id < before));
      const page = rows.slice(0, 25);
      return delay<T.HistoryPage>({
        items: page.map((r) => ({
          id: r.id, created_at: r.created_at, action: r.action, target_type: r.target_type,
          metadata: {}, actor_name: r.actor_name
        })), nextBefore: rows.length > 25 ? page[page.length - 1].id : null
      });
    },
    exportStudent: (sid) => delay({
      perfil: { display_name: w.students.find((x) => x.id === sid)?.name ?? "Estudiante" },
      nota: "Exportación de demostración con datos ficticios."
    }),
    privacyRequests: () => delay(inst.privacy),
    createPrivacyRequest: (body) => {
      inst.privacy.unshift({
        id: `p-${uid()}`, kind: body.kind, details: body.details, status: "pending", created_at: new Date().toISOString(),
        resolved_at: null, resolution_note: null, subject_user_id: body.subject_user_id ?? viewer, subject_name: me().displayName,
        requested_by_name: me().displayName, subject_role: role as T.Role
      });
      return delay({ status: "pending" });
    },
    resolvePrivacyRequest: (id, body) => {
      const r = inst.privacy.find((x) => x.id === id);
      if (r) { r.status = body.decision; r.resolution_note = body.note ?? null; r.resolved_at = body.decision === "escalated" ? null : new Date().toISOString(); }
      return delay({ status: body.decision });
    },
    pointRules: () => delay({ rules: db.pointRules, levels: DEMO_LEVELS }),
    updatePointRule: (key, body) => {
      if (role !== "admin") return unavailable();
      const r = rule(key);
      if (!r) return Promise.reject(new ApiError(404, "not_found", "La regla no existe."));
      if (body.points !== undefined && (!Number.isInteger(body.points) || body.points < 0 || body.points > 500)) {
        return Promise.reject(new ApiError(422, "validation_error", "Los puntos deben ser un número entero entre 0 y 500."));
      }
      Object.assign(r, body);
      audit("point_rule.update", "point_rule", key, null);
      return delay(db.pointRules);
    },
    // SortlyScan Vision: modelo REAL en el navegador (ver lib/vision/engine.ts). Nada aleatorio.
    visionStatus: async () => {
      try {
        const meta = await modelInfo();
        const G = guidanceJson as unknown as { labels: Record<string, string> };
        return {
          status: "ready" as const, modelVersion: meta.version, thresholds: meta.thresholds,
          categories: meta.categories.map((id) => ({ id, label: G.labels[id] })),
          unsupportedCategories: (meta.unsupported_categories ?? []).map((id) => ({ id, label: G.labels[id] })),
          message: "Reconocimiento automático en este navegador. Puede equivocarse: revisa siempre la explicación."
        };
      } catch {
        return {
          status: "unavailable" as const, reason: "model_missing", categories: [],
          message: "No se encontró el modelo de reconocimiento en este sitio."
        };
      }
    },
    classify: async (file, source) => {
      let result: T.VisionResult;
      try {
        result = await visionClassify(file);
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code && ["unsupported_media", "empty_file", "file_too_large", "image_too_small"].includes(code)) {
          throw new ApiError(code === "file_too_large" ? 413 : 415, code, (e as Error).message);
        }
        return {
          status: "unavailable", reason: code ?? "load_failed",
          message: "No se pudo cargar el modelo de reconocimiento. Revisa tu conexión y vuelve a intentarlo."
        };
      }
      const category = result.category && result.category !== "unknown" ? result.category : null;
      if (category) result.education = education(category);
      // Igual que el servidor: solo los estudiantes generan un registro (sin la foto) y nunca suma puntos por sí solo.
      if (role === "student") {
        const id = `scan-${uid()}`;
        inst.scans.unshift({
          id, user: viewer, category: result.category ?? "unknown", status: result.status === "identified" ? "identified" : "unknown",
          confidence: result.confidence ?? 0, model: result.modelVersion ?? "", at: Date.now()
        });
        result.scan = { recorded: true, id, reviewStatus: "unverified" };
      } else {
        result.scan = { recorded: false };
      }
      result.demo = false;
      void source;
      return result;
    },
    recentScans: () => delay(inst.scans.filter((x) => x.user === viewer).slice(0, 10).map((x) => ({
      id: x.id, status: x.status,
      category: x.category as T.VisionCategory | "unknown", label: (guidanceJson as unknown as { labels: Record<string, string> }).labels[x.category] ?? x.category,
      confidence: x.confidence, model_version: x.model, review_status: "unverified" as const, created_at: iso(x.at)
    })), 80),
    sortingRules: () => delay(w.sortingRules.map((r) => ({ ...r }))),
    saveSortingRules: (rules) => {
      w.sortingRules.splice(0, w.sortingRules.length, ...rules.map((r) => ({ ...r, place: r.place?.trim() || null, notes: r.notes?.trim() || null })));
      return delay(w.sortingRules.map((r) => ({ ...r })));
    },
  };
  return persisted(api);
}

/**
 * Reproduce el historial inicial de puntos de cada institución que aún no lo tenga (la primera vez que
 * se abre la demo o después de restablecerla), para que el selector de perfiles muestre puntos y niveles.
 */
// 03. ensureSeeded
export function ensureSeeded() {
  const db = getDb();
  for (const inst of Object.values(db.institutions)) {
    if (inst.seeded) continue;
    const staff = inst.staff.find((s) => s.status === "active");
    if (staff) createDemoApi({ role: staff.role as Actor["role"], personId: staff.user_id, institutionId: inst.institution.id });
  }
}

/**
 * Guarda la base local después de cada llamada (con o sin error), para que los cambios sobrevivan a
 * recargar la página y lleguen a otros perfiles y pestañas. Las lecturas no escriben: `saveNow` solo
 * escribe si algo cambió.
 */
// 04. persisted
function persisted(api: Api): Api {
  return new Proxy(api, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        try {
          const out = value.apply(target, args);
          if (out && typeof (out as Promise<unknown>).finally === "function") return (out as Promise<unknown>).finally(scheduleSave);
          scheduleSave();
          return out;
        } catch (e) {
          scheduleSave();
          return Promise.reject(e);
        }
      };
    },
  });
}

const DEFINITIONS: Record<string, T.MetricDef> = {
  enrolled: { label: "Estudiantes matriculados", formula: "Estudiantes con matrícula activa en los grupos filtrados.", source: "enrollments" },
  active: { label: "Estudiantes activos", formula: "Estudiantes matriculados con al menos una actividad de aprendizaje (actividad de lección, cuestionario o pregunta de escaneo) en el periodo.", source: "lesson_activity_results, quiz_attempts, scan_learning" },
  participation: { label: "Participación", formula: "Estudiantes activos ÷ estudiantes matriculados × 100. Un grupo sin estudiantes aparece «sin registros», no como 0 %.", source: "Derivada" },
  lessons_started: { label: "Lecciones iniciadas", formula: "Pares estudiante–lección iniciados en el periodo.", source: "lesson_progress.started_at" },
  lessons_completed: { label: "Lecciones completadas", formula: "Pares estudiante–lección completados en el periodo (todas las actividades y cuestionario final aprobado).", source: "lesson_progress" },
  completion_rate: { label: "Tasa de finalización", formula: "Lecciones iniciadas en el periodo que ya están completadas ÷ lecciones iniciadas en el periodo × 100.", source: "lesson_progress" },
  quiz_attempts: { label: "Intentos de cuestionario", formula: "Envíos de cuestionario en el periodo (un estudiante puede enviar varios). No es un número de estudiantes.", source: "quiz_attempts" },
  first_attempt_score: { label: "Promedio del primer intento", formula: "Promedio del porcentaje del primer intento de cada estudiante en cada cuestionario dentro del periodo.", source: "quiz_attempts" },
  pass_rate: { label: "Aprobación por estudiante", formula: "Estudiantes que aprobaron ÷ estudiantes que intentaron × 100 (por cuestionario).", source: "quiz_attempts" },
  challenges_completed: { label: "Retos completados", formula: "Cumplimientos de retos registrados en el periodo.", source: "challenge_completions" },
  verified_actions: { label: "Actividades verificadas", formula: "Actividades ambientales aprobadas por un docente, con fecha de realización en el periodo.", source: "environmental_actions" },
  points_distribution: { label: "Distribución de puntos", formula: "Estudiantes según los puntos obtenidos en el periodo.", source: "point_transactions" },
  reinforcement: { label: "Materiales que necesitan refuerzo", formula: "Materiales con aprobación por estudiante menor a 70 % o promedio del primer intento menor a 70 %, con al menos 3 estudiantes evaluados.", source: "quiz_attempts" },
};
