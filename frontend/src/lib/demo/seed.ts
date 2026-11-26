// Datos ficticios iniciales con una semilla fija.

import demoContent from "@/data/demo-content.json";
import type * as T from "../api/types";
import type { DemoAction, DemoDatabase, DemoStudent, InstitutionData, LessonSource } from "./db";

export const PILOT_ID = "centro-escolar-piloto";
export const DAY = 86_400_000;

/** Reglas de puntos iniciales: los mismos valores que la migración 20261125000600 del proyecto completo. */
export const INITIAL_RULES: T.PointRule[] = [
  { key: "scan_learning", label: "Pregunta correcta después de un escaneo", points: 10, max_awards: 3, period: "day", active: true },
  { key: "lesson_first_completion", label: "Primera finalización de una lección", points: 15, max_awards: null, period: null, active: true },
  { key: "quiz_first_pass", label: "Primera aprobación de un cuestionario", points: 25, max_awards: null, period: null, active: true },
  { key: "challenge_group", label: "Reto de grupo completado", points: 50, max_awards: null, period: null, active: true },
  { key: "verified_action", label: "Actividad ambiental verificada por un docente", points: 50, max_awards: 3, period: "week", active: true },
  { key: "challenge_institution", label: "Reto institucional completado", points: 100, max_awards: null, period: null, active: true },
];

// 01. rng
export function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}
export const iso = (t: number) => new Date(t).toISOString();
export const dateOnly = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const STUDENT_NAMES = [
  // 7.º A · Carlos Mejía
  ["Camila R.", "Diego M.", "Valeria S.", "Mateo H.", "Sofía L.", "Andrés P.", "Daniela C.", "Josué A.", "Karla V.", "Rodrigo E."],
  // 8.º B · Ana Lucía Romero
  ["Fernanda G.", "Kevin O.", "Gabriela T.", "Emilio V.", "Paola N.", "Ricardo B.", "Melissa F.", "Alexis Z.", "Tatiana M.", "Nelson R."],
  // 9.º A · Jorge Alvarado
  ["Alejandra F.", "Bryan D.", "Natalia E.", "Óscar J.", "Wendy A.", "Héctor C.", "Jimena L.", "Marvin S.", "Andrea P.", "Lucía Q."],
];

/** Perfiles destacados para el selector (distintos niveles de progreso). */
export const FEATURED_STUDENTS: Record<string, string> = {
  "s-0-1": "Avanzado",
  "s-1-0": "Constante",
  "s-0-0": "En progreso",
  "s-2-9": "Recién llega",
};

// 02. lessonsFromContent
function lessonsFromContent(now: number): LessonSource[] {
  return demoContent.lessons.map((l) => ({
    ...l,
    status: "published" as const,
    version: 1,
    updated_at: iso(now - 30 * DAY),
    quiz: { title: l.quiz.title, pass_score_pct: 70, questions: l.quiz.questions },
    activities: l.activities as LessonSource["activities"],
  }));
}

// 03. pilotInstitution
function pilotInstitution(now: number, lessons: LessonSource[]): InstitutionData {
  const random = rng(20261124);
  const year = new Date(now).getFullYear();
  const groups = [
    { id: "g-7a", name: "A", grade: "7.º grado", grade_level_id: 7, ranking_visibility: "group" as const, teachers: ["t-1"], school_year: year, status: "active" as const },
    { id: "g-8b", name: "B", grade: "8.º grado", grade_level_id: 8, ranking_visibility: "group" as const, teachers: ["t-2"], school_year: year, status: "active" as const },
    { id: "g-9a", name: "A", grade: "9.º grado", grade_level_id: 9, ranking_visibility: "private" as const, teachers: ["t-3"], school_year: year, status: "active" as const },
  ];
  const students: DemoStudent[] = [];
  STUDENT_NAMES.forEach((list, gi) => list.forEach((name, i) =>
    students.push({ id: `s-${gi}-${i}`, name, username: `piloto${gi + 7}${String(i + 1).padStart(2, "0")}`, group: groups[gi].id, status: "active", createdAt: now - 60 * DAY })));
  const slugs = lessons.map((l) => l.slug);
  const attempts: InstitutionData["attempts"] = [];
  const solved: Record<string, number> = {};
  const scansLearned: InstitutionData["scansLearned"] = [];
  let n = 0;
  const id = () => `x${(++n).toString(36)}`;
  const complete = (user: string, slug: string, at: number, score = 3) => {
    lessons.find((l) => l.slug === slug)!.activities.forEach((_, p) => (solved[`${user}|${slug}|${p + 1}`] = at - 3600_000));
    attempts.push({ id: id(), user, lesson: slug, score, max: 3, passed: score === 3, at });
  };
  students.forEach((s, index) => {
    if (["s-0-0", "s-0-1", "s-1-0", "s-2-9"].includes(s.id)) return;
    const engagement = 0.3 + random() * 0.65;
    slugs.forEach((slug, li) => {
      if (random() > engagement - li * 0.07) return;
      const base = now - Math.floor(random() * 50 + (index % 5)) * DAY;
      if (random() < 0.75) lessons[li].activities.forEach((_, p) => (solved[`${s.id}|${slug}|${p + 1}`] = base - 3600_000));
      const tries = 1 + Math.floor(random() * 2);
      for (let t = 0; t < tries; t++) {
        const score = Math.min(3, 1 + Math.floor(random() * 3) + t);
        attempts.push({ id: id(), user: s.id, lesson: slug, score, max: 3, passed: score === 3, at: base + t * 3600_000 });
      }
    });
    if (random() < 0.5) scansLearned.push({ user: s.id, material: ["plastic", "paper", "metal"][index % 3], correct: random() < 0.8, at: now - Math.floor(random() * 20) * DAY });
  });
  // Diego M. (avanzado): todas las lecciones, varias preguntas de escaneo y acciones verificadas cada semana.
  slugs.forEach((slug, i) => complete("s-0-1", slug, now - (45 - i * 6) * DAY));
  for (let k = 0; k < 6; k++) scansLearned.push({ user: "s-0-1", material: ["plastic", "paper", "cardboard", "metal", "glass", "plastic"][k], correct: true, at: now - (20 - k * 3) * DAY });
  // Fernanda G. (constante): cinco lecciones y algunas acciones.
  slugs.slice(0, 5).forEach((slug, i) => complete("s-1-0", slug, now - (30 - i * 5) * DAY));
  // Camila R. (en progreso): plástico completo, papel aprobado con una actividad pendiente.
  lessons[0].activities.forEach((_, p) => (solved[`s-0-0|${slugs[0]}|${p + 1}`] = now - 3 * DAY - 7200_000));
  solved[`s-0-0|${slugs[1]}|1`] = now - DAY - 7200_000;
  solved[`s-0-0|${slugs[1]}|2`] = now - DAY - 7000_000;
  attempts.push({ id: id(), user: "s-0-0", lesson: slugs[0], score: 2, max: 3, passed: false, at: now - 3 * DAY },
    { id: id(), user: "s-0-0", lesson: slugs[0], score: 3, max: 3, passed: true, at: now - 3 * DAY + 3600_000 },
    { id: id(), user: "s-0-0", lesson: slugs[1], score: 3, max: 3, passed: true, at: now - DAY });
  scansLearned.push({ user: "s-0-0", material: "metal", correct: true, at: now - 2 * DAY });
  // Lucía Q. (recién llega): sin actividad.

  const actions: DemoAction[] = [
    { id: "ea-1", user_id: "s-0-0", group_id: "g-7a", kind: "separation", material: "plastic", description: "Separé las botellas PET del aula en una bolsa aparte.", quantity: 14, unit: "items", occurred_on: dateOnly(now - 6 * DAY), status: "approved", review_note: "¡Bien hecho! Estaban limpias.", reviewed_at: iso(now - 5 * DAY), created_at: iso(now - 6 * DAY), reviewer: "t-1" },
    { id: "ea-2", user_id: "s-0-0", group_id: "g-7a", kind: "compost", material: "organic", description: "Llevé cáscaras de fruta al compost de la escuela.", quantity: null, unit: null, occurred_on: dateOnly(now - DAY), status: "pending", review_note: null, reviewed_at: null, created_at: iso(now - DAY), reviewer: null },
    { id: "ea-3", user_id: "s-0-2", group_id: "g-7a", kind: "delivery", material: "cardboard", description: "Entregamos cajas aplanadas al centro de acopio con mi familia.", quantity: 3.5, unit: "kg", occurred_on: dateOnly(now - 2 * DAY), status: "pending", review_note: null, reviewed_at: null, created_at: iso(now - 2 * DAY), reviewer: null },
    { id: "ea-4", user_id: "s-1-2", group_id: "g-8b", kind: "cleanup", material: null, description: "Limpieza de la cancha y separación de latas.", quantity: 20, unit: "items", occurred_on: dateOnly(now - 3 * DAY), status: "pending", review_note: null, reviewed_at: null, created_at: iso(now - 3 * DAY), reviewer: null },
    { id: "ea-5", user_id: "s-2-3", group_id: "g-9a", kind: "separation", material: "paper", description: "Separé hojas usadas de la biblioteca para reciclar.", quantity: 2, unit: "kg", occurred_on: dateOnly(now - 9 * DAY), status: "changes_requested", review_note: "Indica cuántas bolsas fueron y dónde las dejaste.", reviewed_at: iso(now - 8 * DAY), created_at: iso(now - 9 * DAY), reviewer: "t-3" },
  ];
  // Acciones verificadas del estudiante avanzado (dos por semana, dentro del límite de 3 por semana).
  const kinds = ["separation", "delivery", "cleanup", "campaign"] as const;
  for (let k = 0; k < 12; k++) {
    const at = now - (40 - k * 3) * DAY;
    actions.push({
      id: `ea-d${k}`, user_id: "s-0-1", group_id: "g-7a", kind: kinds[k % 4], material: (["plastic", "paper", "metal", "cardboard"] as const)[k % 4],
      description: ["Separé botellas del recreo.", "Entregué latas en el centro de acopio.", "Limpieza del patio con mi grupo.", "Jornada de reciclaje de la escuela."][k % 4],
      quantity: 5 + k, unit: "items", occurred_on: dateOnly(at), status: "approved", review_note: "Verificado en clase.", reviewed_at: iso(at + DAY / 2), created_at: iso(at), reviewer: "t-1"
    });
  }
  for (let k = 0; k < 4; k++) {
    const at = now - (25 - k * 6) * DAY;
    actions.push({
      id: `ea-f${k}`, user_id: "s-1-0", group_id: "g-8b", kind: "separation", material: "plastic", description: "Separación de botellas en el aula.",
      quantity: 8 + k, unit: "items", occurred_on: dateOnly(at), status: "approved", review_note: null, reviewed_at: iso(at + DAY / 2), created_at: iso(at), reviewer: "t-2"
    });
  }

  const assessments: InstitutionData["assessments"] = {};
  students.forEach((s, i) => {
    if (s.id === "s-0-0" || s.id === "s-2-9") return;
    const pre = 2 + (i % 4);
    const entry: InstitutionData["assessments"][string] = { pre: { phase: "pre", score: pre, maxScore: 6, scorePct: Math.round((pre * 100) / 6), byMaterial: {}, at: now - 50 * DAY } };
    if (i % 3 !== 0) {
      const post = Math.min(6, pre + 1 + (i % 2));
      entry.post = { phase: "post", score: post, maxScore: 6, scorePct: Math.round((post * 100) / 6), byMaterial: {}, at: now - 4 * DAY };
    }
    assessments[s.id] = entry;
  });
  assessments["s-0-0"] = { pre: { phase: "pre", score: 3, maxScore: 6, scorePct: 50, byMaterial: {}, at: now - 12 * DAY } };

  const staff: T.StaffRow[] = [
    { membership_id: "m-d1", user_id: "d-1", role: "director", status: "active", display_name: "Marta Elena Cruz", groups: [] },
    { membership_id: "m-t1", user_id: "t-1", role: "teacher", status: "active", display_name: "Carlos Mejía", groups: [] },
    { membership_id: "m-t2", user_id: "t-2", role: "teacher", status: "active", display_name: "Ana Lucía Romero", groups: [] },
    { membership_id: "m-t3", user_id: "t-3", role: "teacher", status: "active", display_name: "Jorge Alvarado", groups: [] },
  ];
  const record = (r: Partial<T.EnvironmentalRecord> & Pick<T.EnvironmentalRecord, "id" | "kind" | "material" | "quantity" | "unit" | "occurred_on" | "status">, by: string) =>
    ({
      kindLabel: "", responsible: null, notes: null, supersedes_id: null, superseded: false, verified_at: null, verification_note: null,
      group_id: null, group_name: null, recorded_by_name: staff.find((x) => x.user_id === by)!.display_name, verified_by_name: null, recorded_by: by, ...r
    }) as InstitutionData["records"][number];
  const records = [
    record({ id: "r-1", kind: "weighing", material: "plastic", quantity: 12.4, unit: "kg", occurred_on: dateOnly(now - 20 * DAY), responsible: "Carlos Mejía", notes: "Pesaje en la báscula de la cooperativa escolar.", status: "verified", verified_at: iso(now - 19 * DAY), group_id: "g-7a", group_name: "A", verified_by_name: "Marta Elena Cruz" }, "t-1"),
    record({ id: "r-2", kind: "delivery", material: "plastic", quantity: 12.1, unit: "kg", occurred_on: dateOnly(now - 15 * DAY), responsible: "Marta Elena Cruz", notes: "Comprobante del centro de acopio (ficticio).", supersedes_id: "r-1", status: "verified", verified_at: iso(now - 14 * DAY), verified_by_name: "Marta Elena Cruz" }, "d-1"),
    record({ id: "r-3", kind: "campaign", material: "metal", quantity: 85, unit: "items", occurred_on: dateOnly(now - 9 * DAY), responsible: "Comité ambiental", notes: "Latas contadas en la jornada.", status: "verified", verified_at: iso(now - 8 * DAY), verified_by_name: "Marta Elena Cruz" }, "t-2"),
    record({ id: "r-4", kind: "weighing", material: "paper", quantity: 6.8, unit: "kg", occurred_on: dateOnly(now - 2 * DAY), responsible: "Ana Lucía Romero", status: "pending", group_id: "g-8b", group_name: "B" }, "t-2"),
    record({ id: "r-5", kind: "weighing", material: "cardboard", quantity: 9.5, unit: "kg", occurred_on: dateOnly(now - 35 * DAY), responsible: "Jorge Alvarado", status: "verified", verified_at: iso(now - 34 * DAY), group_id: "g-9a", group_name: "A", verified_by_name: "Marta Elena Cruz" }, "t-3"),
  ];
  return {
    institution: {
      id: PILOT_ID, name: "Centro Escolar Piloto SortlyScan", official_code: "DEMO-0001", department: "San Salvador", district: "Apopa",
      institution_type: "public", contact_email: "direccion@piloto.sortlyscan.invalid", contact_phone: null, status: "active", ranking_scope: "group", created_at: iso(now - 90 * DAY)
    },
    groups, students, staff, attempts, solved, started: {}, scansLearned, scans: [],
    activities: [
      { id: "a-1", group: "g-7a", lesson: slugs[2], title: "Prepara cajas para el acopio", instructions: "Completa la lección y su cuestionario.", due_on: dateOnly(now + 4 * DAY), created_at: iso(now - 2 * DAY) },
      { id: "a-2", group: "g-7a", lesson: slugs[1], title: "Repaso: papel limpio y seco", instructions: null, due_on: null, created_at: iso(now - 9 * DAY) },
      { id: "a-3", group: "g-8b", lesson: slugs[4], title: "Vidrio con cuidado", instructions: "Comenta en clase los errores comunes.", due_on: dateOnly(now + 7 * DAY), created_at: iso(now - DAY) },
      { id: "a-4", group: "g-9a", lesson: slugs[3], title: "Latas y metales", instructions: null, due_on: dateOnly(now + 5 * DAY), created_at: iso(now - 3 * DAY) },
    ],
    challenges: [
      { id: "c-1", group: null, lesson: null, kind: "group_participation", goal: 60, title: "Toda la escuela aprende", description: "Que al menos el 60 % de la escuela haga una actividad de aprendizaje este mes.", starts_on: dateOnly(now - 10 * DAY), ends_on: dateOnly(now + 20 * DAY) },
      { id: "c-2", group: "g-7a", lesson: null, kind: "learning", goal: 2, title: "Dos lecciones esta semana", description: "Completa dos lecciones con sus actividades y cuestionario.", starts_on: dateOnly(now - 4 * DAY), ends_on: dateOnly(now + 3 * DAY) },
      { id: "c-3", group: "g-7a", lesson: null, kind: "identification", goal: 3, title: "Identifica tres residuos", description: "Escanea residuos del aula y responde bien su pregunta.", starts_on: dateOnly(now - DAY), ends_on: dateOnly(now + 6 * DAY) },
      { id: "c-4", group: "g-8b", lesson: slugs[0], kind: "quiz", goal: 1, title: "Botellas sin restos", description: null, starts_on: dateOnly(now + 3 * DAY), ends_on: dateOnly(now + 10 * DAY) },
      { id: "c-5", group: "g-7a", lesson: null, kind: "verified_recycling", goal: 1, title: "Separación verificada", description: "Registra una actividad de separación y que tu docente la verifique.", starts_on: dateOnly(now - 45 * DAY), ends_on: dateOnly(now - 2 * DAY) },
      { id: "c-6", group: "g-9a", lesson: null, kind: "quiz", goal: 2, title: "Dos cuestionarios aprobados", description: "Aprueba dos cuestionarios de materiales distintos.", starts_on: dateOnly(now - 7 * DAY), ends_on: dateOnly(now + 7 * DAY) },
    ],
    actions, records, assessments,
    sortingRules: (["plastic", "paper", "cardboard", "metal", "glass", "organic", "other"] as const).map((material) => ({
      material, accepted: material === "other" ? false : true,
      place: { plastic: "Contenedor amarillo del pasillo", paper: "Caja azul de la dirección", cardboard: "Bodega, aplanado", metal: "Contenedor gris", glass: "Solo con el docente", organic: "Compostera del huerto escolar", other: "Basura común" }[material],
      notes: null
    })),
    ledger: [], completions: {}, awarded: {},
    notifications: [
      { id: "n-1", user: "s-0-0", kind: "challenge_new", title: "Nuevo reto: Identifica tres residuos", body: "Revisa la meta y las fechas en Retos.", link: "/panel/estudiante/retos", created_at: iso(now - DAY), read: false },
      { id: "n-2", user: "s-0-0", kind: "action_approved", title: "Tu docente verificó: Separación en el aula", body: "¡Bien hecho! Estaban limpias.", link: "/panel/estudiante/acciones", created_at: iso(now - 5 * DAY), read: true },
      { id: "n-3", user: "s-2-3", kind: "action_changes", title: "Tu docente pidió cambios en una actividad", body: "Indica cuántas bolsas fueron y dónde las dejaste.", link: "/panel/estudiante/acciones", created_at: iso(now - 8 * DAY), read: false },
    ],
    privacy: [
      {
        id: "p-1", kind: "correction", details: "El nombre visible de un estudiante tiene una letra equivocada.", status: "pending", created_at: iso(now - DAY),
        resolved_at: null, resolution_note: null, subject_user_id: "s-1-4", subject_name: "Paola N.", requested_by_name: "Ana Lucía Romero", subject_role: "student"
      },
    ],
    seeded: false,
  };
}

/** Institución vacía creada al aprobar una solicitud (solo con su dirección). */
// 04. emptyInstitution
export function emptyInstitution(id: string, app: T.ApplicationRow, directorId: string, now: number): InstitutionData {
  return {
    institution: {
      id, name: app.institution_name, official_code: app.official_code, department: app.department, district: app.district,
      institution_type: app.institution_type, contact_email: app.email, contact_phone: app.phone, status: "active", ranking_scope: "group", created_at: iso(now)
    },
    groups: [], students: [],
    staff: [{ membership_id: `m-${directorId}`, user_id: directorId, role: "director", status: "active", display_name: app.representative_name, groups: [] }],
    attempts: [], solved: {}, started: {}, scansLearned: [], scans: [], activities: [], challenges: [], actions: [], records: [], assessments: {},
    sortingRules: (["plastic", "paper", "cardboard", "metal", "glass", "organic", "other"] as const).map((material) => ({ material, accepted: null, place: null, notes: null })),
    ledger: [], completions: {}, awarded: {}, notifications: [], privacy: [], seeded: true,
  };
}

// 05. seedDatabase
export function seedDatabase(version: number): DemoDatabase {
  const now = Date.now();
  const lessons = lessonsFromContent(now);
  const app = (a: Partial<T.ApplicationRow> & Pick<T.ApplicationRow, "id" | "institution_name" | "district" | "representative_name" | "status" | "created_at">): T.ApplicationRow => ({
    official_code: null, department: "San Salvador", institution_type: "public", representative_position: "Director(a)",
    email: "contacto@ejemplo.sortlyscan.invalid", phone: null, message: null, review_note: null, ...a
  });
  return {
    version,
    createdAt: iso(now),
    content: { lessons, assessment: demoContent.assessment, scanQuestions: demoContent.scanQuestions },
    pointRules: INITIAL_RULES.map((r) => ({ ...r })),
    retention: [
      { key: "notifications", days: 90, description: "Notificaciones internas leídas y no leídas.", updated_at: iso(now) },
      { key: "scans", days: 365, description: "Registros de escaneo (sin imagen). Se conservan los que tienen una pregunta respondida.", updated_at: iso(now) },
      { key: "audit_log", days: 1825, description: "Registro de acciones administrativas.", updated_at: iso(now) },
    ],
    applications: [
      app({
        id: "app-1", institution_name: "Complejo Educativo Las Brisas (ficticio)", district: "Soyapango", representative_name: "Rosa Amaya",
        message: "Queremos usar SortlyScan con 7.º y 8.º grado.", status: "pending", created_at: iso(now - 2 * DAY)
      }),
      app({
        id: "app-2", institution_name: "Escuela Rural Los Laureles (ficticia)", department: "La Libertad", district: "Comasagua", representative_name: "Mauricio Pérez",
        message: "Tenemos conexión limitada; nos interesa la guía sin internet.", status: "pending", created_at: iso(now - 5 * DAY)
      }),
      app({
        id: "app-3", institution_name: "Instituto de Prueba Duplicado (ficticio)", district: "Apopa", representative_name: "Sin datos",
        status: "rejected", review_note: "Solicitud duplicada del Centro Escolar Piloto.", created_at: iso(now - 40 * DAY)
      }),
    ],
    institutions: { [PILOT_ID]: pilotInstitution(now, lessons) },
    admin: { id: "admin-1", name: "Equipo SortlyScan (ficticio)" },
    audit: [
      { id: 3, created_at: iso(now - 40 * DAY), action: "application.reject", target_type: "application", target_id: "app-3", institution_name: null, actor_name: "Equipo SortlyScan (ficticio)", request_id: null, institution_id: null },
      { id: 2, created_at: iso(now - 89 * DAY), action: "institution.approve", target_type: "institution", target_id: PILOT_ID, institution_name: "Centro Escolar Piloto SortlyScan", actor_name: "Equipo SortlyScan (ficticio)", request_id: null, institution_id: PILOT_ID },
      { id: 1, created_at: iso(now - 88 * DAY), action: "group.create", target_type: "group", target_id: "g-7a", institution_name: "Centro Escolar Piloto SortlyScan", actor_name: "Marta Elena Cruz", request_id: null, institution_id: PILOT_ID },
    ],
  };
}
