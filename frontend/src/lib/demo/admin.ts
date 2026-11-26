// Superadministración de la demostración: solicitudes, instituciones, contenidos, auditoría y retención.
// Solo modifica datos ficticios guardados en este navegador.
import type { Api } from "../api/client";
import { ApiError } from "../api/client";
import type * as T from "../api/types";
import type { DemoDatabase, DemoRole, LessonSource } from "./db";
import { emptyInstitution, iso } from "./seed";

interface Ctx {
  db: DemoDatabase;
  role: DemoRole;
  viewer: string;
  audit: (action: string, targetType: string | null, targetId: string | null, institutionId?: string | null) => void;
  unavailable: () => Promise<never>;
  delay: <R>(value: R, ms?: number) => Promise<R>;
  uid: () => string;
}

const MATERIALS = ["plastic", "paper", "cardboard", "metal", "glass", "organic", "other"];
const fail = (status: number, code: string, message: string) => Promise.reject(new ApiError(status, code, message));
const slugify = (v: string) => v.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

type AdminApi = Pick<Api, "applications" | "approveApplication" | "rejectApplication" | "adminInstitutions" | "setInstitutionStatus" | "directorInvitation"
  | "adminLessons" | "updateLesson" | "adminLesson" | "createLesson" | "saveQuestion" | "retireQuestion" | "saveActivity" | "retireActivity"
  | "escalatedPrivacy" | "erasePrivacy" | "retention" | "updateRetention" | "runRetention" | "audit" | "createInstitution" | "adminPeople">;

// 01. createAdminMethods
export function createAdminMethods({ db, role, audit, unavailable, delay, uid }: Ctx): AdminApi {
  const guard = <R>(fn: () => Promise<R>): Promise<R> => (role === "admin" ? fn() : unavailable());
  const lessonById = (id: string) => db.content.lessons.find((l) => `lesson-${l.slug}` === id);
  const attemptsFor = (slug: string) => Object.values(db.institutions).reduce((n, i) => n + i.attempts.filter((a) => a.lesson === slug).length, 0);
  const detail = (l: LessonSource): T.AdminLessonDetail => ({
    id: `lesson-${l.slug}`, slug: l.slug, title: l.title, summary: l.summary, status: l.status, version: l.version, estimated_minutes: l.minutes,
    material: l.material, content: l.content, quiz_id: `quiz-${l.slug}`, pass_score_pct: l.quiz.pass_score_pct, quiz_version: l.quiz.version ?? 1,
    questions: l.quiz.questions.map((q, i) => ({ q, i })).filter(({ q }) => !q.retired)
      .map(({ q, i }) => ({ id: `${l.slug}-q${i + 1}`, position: i + 1, prompt: q.prompt, options: q.options, explanation: q.explanation, correct: q.correct, has_answers: attemptsFor(l.slug) > 0 })),
    activities: l.activities.map((a, i) => ({ a, i })).filter(({ a }) => !a.retired).map(({ a, i }) => ({
      id: `${l.slug}-a${i + 1}`, position: i + 1, kind: a.kind as T.ActivityKind, prompt: a.prompt, explanation: a.explanation,
      payload: { options: a.options as string[] | undefined, bins: a.bins as string[] | undefined, items: a.items as string[] | undefined, left: a.left as string[] | undefined, right: a.right as string[] | undefined },
      answer: a.answer as T.AdminActivity["answer"], has_answers: false
    })),
    retired: l.quiz.questions.filter((q) => q.retired).length + l.activities.filter((a) => a.retired).length,
    attempts: attemptsFor(l.slug),
  });
  const touch = (l: LessonSource) => { l.version += 1; l.updated_at = iso(Date.now()); };
  const need = (l: LessonSource | undefined) => { if (!l) throw new ApiError(404, "not_found", "La lección no existe."); return l; };
  const createInst = (name: string, department: string, district: string, directorName: string, app?: T.ApplicationRow) => {
    const id = `inst-${uid()}`;
    const directorId = `d-${uid()}`;
    const base: T.ApplicationRow = app ?? {
      id: "", institution_name: name, official_code: null, department, district, institution_type: "public",
      representative_name: directorName, representative_position: "Director(a)", email: "", phone: null, message: null, status: "approved", review_note: null, created_at: iso(Date.now())
    };
    db.institutions[id] = emptyInstitution(id, base, directorId, Date.now());
    return { id, name: base.institution_name, director: { id: directorId, name: directorName } };
  };
  const validText = (v: string, min: number, max: number) => v.trim().length >= min && v.trim().length <= max && !/[<>]/.test(v);

  return {
    applications: (status) => guard(() => delay(db.applications.filter((a) => !status || a.status === status).sort((a, b) => b.created_at.localeCompare(a.created_at)))),
    approveApplication: (id, note) => guard(() => {
      const app = db.applications.find((a) => a.id === id);
      if (!app || app.status !== "pending") return fail(409, "already_reviewed", "Esta solicitud ya fue revisada.");
      const created = createInst(app.institution_name, app.department, app.district, app.representative_name, app);
      Object.assign(app, { status: "approved", review_note: note ?? null, institution_id: created.id });
      audit("application.approve", "application", id, created.id);
      audit("institution.approve", "institution", created.id, created.id);
      return delay({ institution: { id: created.id, name: created.name }, director: created.director });
    }),
    rejectApplication: (id, note) => guard(() => {
      const app = db.applications.find((a) => a.id === id);
      if (!app || app.status !== "pending") return fail(409, "already_reviewed", "Esta solicitud ya fue revisada.");
      if (!note?.trim()) return fail(422, "validation_error", "Escribe el motivo del rechazo.");
      Object.assign(app, { status: "rejected", review_note: note.trim() });
      audit("application.reject", "application", id, null);
      return delay({ ok: true });
    }),
    createInstitution: (body) => guard(() => {
      if (!validText(body.name, 3, 120) || !validText(body.district, 2, 80) || !validText(body.director_name, 2, 80)) {
        return fail(422, "validation_error", "Completa el nombre de la institución, el distrito y el nombre de la dirección.");
      }
      const created = createInst(body.name.trim(), body.department.trim() || "San Salvador", body.district.trim(), body.director_name.trim());
      audit("institution.create", "institution", created.id, created.id);
      return delay({ institution: { id: created.id, name: created.name }, director: created.director });
    }),
    adminInstitutions: () => guard(() => delay(Object.values(db.institutions).map((i) => ({
      id: i.institution.id, name: i.institution.name, official_code: i.institution.official_code, department: i.institution.department, district: i.institution.district,
      status: i.institution.status as "active" | "suspended", created_at: i.institution.created_at,
      directors: i.staff.filter((s) => s.role === "director" && s.status === "active").length,
      teachers: i.staff.filter((s) => s.role === "teacher" && s.status === "active").length,
      students: i.students.filter((s) => s.status === "active").length,
    })))),
    setInstitutionStatus: (id, status) => guard(() => {
      const i = db.institutions[id];
      if (!i) return fail(404, "not_found", "La institución no existe.");
      i.institution.status = status;
      audit(status === "suspended" ? "institution.suspend" : "institution.reactivate", "institution", id, id);
      return delay({ ok: true });
    }),
    directorInvitation: () => fail(403, "demo", "En la demostración no se envían invitaciones: la dirección aparece directamente en «Cambiar perfil»."),
    adminPeople: () => guard(() => delay(Object.values(db.institutions).flatMap((i) => [
      ...i.staff.map((s) => ({
        id: s.user_id, name: s.display_name, role: s.role as T.Role, status: s.status, institution: i.institution.name,
        group: i.groups.filter((g) => g.status === "active" && g.teachers.includes(s.user_id)).map((g) => `${g.grade} ${g.name}`).join(", ") || null
      })),
      ...i.students.map((s) => {
        const g = i.groups.find((x) => x.id === s.group);
        return { id: s.id, name: s.name, role: "student" as T.Role, status: s.status, institution: i.institution.name, group: g ? `${g.grade} ${g.name}` : null };
      }),
    ]))),
    adminLessons: () => guard(() => delay(db.content.lessons.map((l) => ({
      id: `lesson-${l.slug}`, slug: l.slug, title: l.title, summary: l.summary, status: l.status,
      version: l.version, material: l.material, questions: l.quiz.questions.filter((q) => !q.retired).length, updated_at: l.updated_at
    })))),
    adminLesson: (id) => guard(() => delay(detail(need(lessonById(id))))),
    updateLesson: (id, body) => guard(() => {
      const l = need(lessonById(id));
      if (body.title !== undefined && !validText(body.title, 3, 120)) return fail(422, "validation_error", "El título debe tener entre 3 y 120 caracteres.");
      if (body.pass_score_pct !== undefined && (body.pass_score_pct < 50 || body.pass_score_pct > 100)) return fail(422, "validation_error", "La nota mínima debe estar entre 50 y 100.");
      if (body.status === "published" && (l.quiz.questions.filter((q) => !q.retired).length < 1)) return fail(422, "validation_error", "Una lección publicada necesita al menos una pregunta.");
      if (body.title !== undefined) l.title = body.title.trim();
      if (body.summary !== undefined) l.summary = body.summary.trim();
      if (body.status) l.status = body.status as LessonSource["status"];
      if (body.estimated_minutes) l.minutes = body.estimated_minutes;
      if (body.pass_score_pct) l.quiz.pass_score_pct = body.pass_score_pct;
      if (body.content) l.content = body.content;
      touch(l);
      audit(body.status ? `lesson.${body.status}` : "lesson.update", "lesson", l.slug, null);
      return delay(detail(l));
    }),
    createLesson: (body) => guard(() => {
      const slug = slugify(body.slug || body.title);
      if (!slug || db.content.lessons.some((l) => l.slug === slug)) return fail(409, "duplicate", "Ya existe una lección con ese identificador.");
      if (!MATERIALS.includes(body.material)) return fail(422, "validation_error", "Elige un material válido.");
      if (!validText(body.title, 3, 120)) return fail(422, "validation_error", "El título debe tener entre 3 y 120 caracteres.");
      const l: LessonSource = {
        slug, material: body.material, title: body.title.trim(), summary: body.summary.trim(), minutes: 10, status: "draft", version: 1,
        updated_at: iso(Date.now()), content: body.content, quiz: { title: `Cuestionario: ${body.title.trim()}`, pass_score_pct: 70, questions: [] }, activities: []
      };
      db.content.lessons.push(l);
      audit("lesson.create", "lesson", slug, null);
      return delay(detail(l));
    }),
    saveQuestion: (id, position, body) => guard(() => {
      const l = need(lessonById(id));
      if (!validText(body.prompt, 5, 300) || body.options.length < 2 || body.options.length > 5 || body.options.some((o) => !validText(o, 1, 160))
        || body.correct < 0 || body.correct >= body.options.length || !validText(body.explanation, 5, 400)) {
        return fail(422, "validation_error", "Revisa la pregunta: enunciado, 2 a 5 opciones, respuesta correcta y explicación.");
      }
      const q = { prompt: body.prompt.trim(), options: body.options.map((o) => o.trim()), correct: body.correct, explanation: body.explanation.trim() };
      if (position > 0 && l.quiz.questions[position - 1]) {
        // Como en el servidor: una pregunta con respuestas se retira y se agrega una nueva versión, para no alterar resultados anteriores.
        if (attemptsFor(l.slug) > 0) { l.quiz.questions[position - 1].retired = true; l.quiz.questions.push(q); }
        else l.quiz.questions[position - 1] = q;
      } else l.quiz.questions.push(q);
      l.quiz.version = (l.quiz.version ?? 1) + 1;
      touch(l);
      audit("question.save", "lesson", l.slug, null);
      return delay(detail(l));
    }),
    retireQuestion: (id, position) => guard(() => {
      const l = need(lessonById(id));
      const q = l.quiz.questions[position - 1];
      if (!q) return fail(404, "not_found", "La pregunta no existe.");
      if (l.status === "published" && l.quiz.questions.filter((x) => !x.retired).length <= 1) return fail(422, "validation_error", "Una lección publicada necesita al menos una pregunta.");
      q.retired = true;
      l.quiz.version = (l.quiz.version ?? 1) + 1;
      touch(l);
      audit("question.retire", "lesson", l.slug, null);
      return delay(detail(l));
    }),
    saveActivity: (id, position, body) => guard(() => {
      const l = need(lessonById(id));
      if (!validText(body.prompt, 5, 300) || !validText(body.explanation, 5, 400)) return fail(422, "validation_error", "Escribe el enunciado y la explicación de la actividad.");
      const a = {
        kind: body.kind, prompt: body.prompt.trim(), explanation: body.explanation.trim(), answer: body.answer,
        ...(body.options ? { options: body.options } : {}), ...(body.bins ? { bins: body.bins } : {}), ...(body.items ? { items: body.items } : {}),
        ...(body.left ? { left: body.left } : {}), ...(body.right ? { right: body.right } : {})
      };
      if (position > 0 && l.activities[position - 1]) { l.activities[position - 1].retired = true; l.activities.push(a); }
      else l.activities.push(a);
      touch(l);
      audit("activity_item.save", "lesson", l.slug, null);
      return delay(detail(l));
    }),
    retireActivity: (id, position) => guard(() => {
      const l = need(lessonById(id));
      const a = l.activities[position - 1];
      if (!a) return fail(404, "not_found", "La actividad no existe.");
      a.retired = true;
      touch(l);
      audit("activity_item.retire", "lesson", l.slug, null);
      return delay(detail(l));
    }),
    escalatedPrivacy: () => guard(() => delay(Object.values(db.institutions).flatMap((i) => i.privacy.filter((p) => p.status === "escalated")
      .map((p) => ({ ...p, institution_name: i.institution.name }))))),
    erasePrivacy: (id) => guard(() => {
      for (const i of Object.values(db.institutions)) {
        const p = i.privacy.find((x) => x.id === id);
        if (!p) continue;
        const subject = p.subject_user_id;
        if (subject) {
          const st = i.students.find((x) => x.id === subject);
          if (st) { st.name = "Estudiante eliminado"; st.status = "revoked"; }
          i.scans = i.scans.filter((x) => x.user !== subject);
          i.notifications = i.notifications.filter((x) => x.user !== subject);
        }
        Object.assign(p, { status: "completed", resolved_at: iso(Date.now()), resolution_note: "Datos personales anonimizados (demostración)." });
        audit("privacy.erase", "privacy_request", id, i.institution.id);
        return delay({ ok: true });
      }
      return fail(404, "not_found", "La solicitud no existe.");
    }),
    retention: () => guard(() => delay(retentionInfo(db))),
    updateRetention: (key, days) => guard(() => {
      const r = db.retention.find((x) => x.key === key);
      if (!r) return fail(404, "not_found", "La política no existe.");
      if (!Number.isInteger(days) || days < 7 || days > 3650) return fail(422, "validation_error", "Los días deben estar entre 7 y 3650.");
      Object.assign(r, { days, updated_at: iso(Date.now()) });
      audit("retention.update", "retention", key, null);
      return delay({ ok: true });
    }),
    runRetention: (dryRun) => guard(() => {
      const preview = retentionInfo(db).preview;
      if (!dryRun) {
        const cut = (key: string) => Date.now() - (db.retention.find((x) => x.key === key)?.days ?? 3650) * 86_400_000;
        for (const i of Object.values(db.institutions)) {
          i.notifications = i.notifications.filter((n) => Date.parse(n.created_at) >= cut("notifications"));
          i.scans = i.scans.filter((x) => x.answered || x.at >= cut("scans"));
        }
        db.audit = db.audit.filter((r) => Date.parse(r.created_at) >= cut("audit_log"));
        audit("retention.run", "retention", null, null);
      }
      return delay({ dryRun, result: preview });
    }),
    audit: (institutionId) => guard(() => delay(db.audit.filter((r) => !institutionId || r.institution_id === institutionId).slice(0, 200))),
  };
}

// 02. retentionInfo
function retentionInfo(db: DemoDatabase): T.RetentionInfo {
  const cut = (key: string) => Date.now() - (db.retention.find((x) => x.key === key)?.days ?? 3650) * 86_400_000;
  const all = Object.values(db.institutions);
  return {
    settings: db.retention.map((r) => ({ ...r })),
    preview: {
      notifications: { days: db.retention.find((x) => x.key === "notifications")?.days ?? 0, rows: all.reduce((n, i) => n + i.notifications.filter((x) => Date.parse(x.created_at) < cut("notifications")).length, 0) },
      scans: { days: db.retention.find((x) => x.key === "scans")?.days ?? 0, rows: all.reduce((n, i) => n + i.scans.filter((x) => !x.answered && x.at < cut("scans")).length, 0) },
      audit_log: { days: db.retention.find((x) => x.key === "audit_log")?.days ?? 0, rows: db.audit.filter((r) => Date.parse(r.created_at) < cut("audit_log")).length },
    },
  };
}
