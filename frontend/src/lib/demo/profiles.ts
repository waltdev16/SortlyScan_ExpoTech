// Perfiles ficticios que se pueden "usar" en la demostración (reemplazan el inicio de sesión).
import type * as T from "../api/types";
import { type Actor, type DemoDatabase, type DemoRole, getDb } from "./db";
import { FEATURED_STUDENTS, PILOT_ID } from "./seed";

export const ROLE_SLUG: Record<DemoRole, string> = { student: "estudiante", teacher: "docente", director: "director", admin: "admin" };
export const ROLE_LABEL: Record<DemoRole, string> = { student: "Estudiante", teacher: "Docente", director: "Dirección", admin: "Superadministración" };
export const homeOf = (role: DemoRole) => `/panel/${ROLE_SLUG[role]}`;

const LEVELS = [[0, "Semilla"], [40, "Brote"], [150, "Explorador"], [400, "Guardián"], [800, "Embajador"], [1500, "Eco Líder"], [3000, "Eco Maestro"], [5000, "Leyenda"]] as const;
export const levelName = (points: number) => [...LEVELS].reverse().find(([min]) => points >= min)![1];

export interface StudentOption { id: string; name: string; group: string; points: number; level: string; tag: string | null }
export interface InstitutionOption {
  id: string;
  name: string;
  place: string;
  status: string;
  directors: { id: string; name: string }[];
  teachers: { id: string; name: string; groups: string[] }[];
  students: StudentOption[];
}

export function listProfiles(source: DemoDatabase = getDb()): { institutions: InstitutionOption[]; admin: { id: string; name: string } } {
  const institutions = Object.values(source.institutions).map((i) => {
    const groupLabel = (id: string) => { const g = i.groups.find((x) => x.id === id); return g ? `${g.grade} ${g.name}` : "Sin grupo"; };
    return {
      id: i.institution.id, name: i.institution.name, place: `${i.institution.district}, ${i.institution.department}`, status: i.institution.status,
      directors: i.staff.filter((s) => s.role === "director" && s.status === "active").map((s) => ({ id: s.user_id, name: s.display_name })),
      teachers: i.staff.filter((s) => s.role === "teacher" && s.status === "active").map((s) => ({
        id: s.user_id, name: s.display_name,
        groups: i.groups.filter((g) => g.status === "active" && g.teachers.includes(s.user_id)).map((g) => `${g.grade} ${g.name}`)
      })),
      students: i.students.filter((s) => s.status === "active").map((s) => {
        const points = i.ledger.filter((t) => t.user === s.id).reduce((n, t) => n + t.delta, 0);
        return { id: s.id, name: s.name, group: groupLabel(s.group), points, level: levelName(points), tag: i.institution.id === PILOT_ID ? FEATURED_STUDENTS[s.id] ?? null : null };
      }),
    };
  });
  // La institución piloto primero; luego las creadas en la demo.
  institutions.sort((a, b) => (a.id === PILOT_ID ? -1 : b.id === PILOT_ID ? 1 : a.name.localeCompare(b.name)));
  return { institutions, admin: source.admin };
}

/** Comprueba que el perfil siga existiendo (por ejemplo, después de restablecer o de retirar a la persona). */
export function actorValid(actor: Actor | null, source: DemoDatabase = getDb()): actor is Actor {
  if (!actor) return false;
  if (actor.role === "admin") return actor.personId === source.admin.id;
  const inst = source.institutions[actor.institutionId];
  if (!inst) return false;
  if (actor.role === "student") return inst.students.some((s) => s.id === actor.personId && s.status === "active");
  return inst.staff.some((s) => s.user_id === actor.personId && s.status === "active" && s.role === actor.role);
}

export function actorName(actor: Actor, source: DemoDatabase = getDb()) {
  if (actor.role === "admin") return source.admin.name;
  const inst = source.institutions[actor.institutionId];
  return inst?.students.find((s) => s.id === actor.personId)?.name ?? inst?.staff.find((s) => s.user_id === actor.personId)?.display_name ?? "Perfil ficticio";
}

/** Equivalente al `/me` del servidor para el perfil elegido. */
export function actorMe(actor: Actor, source: DemoDatabase = getDb()): T.Me {
  const inst = source.institutions[actor.institutionId];
  const student = actor.role === "student" ? inst?.students.find((s) => s.id === actor.personId) : null;
  return {
    id: actor.personId,
    email: null,
    displayName: actorName(actor, source),
    accountType: actor.role === "student" ? "managed_student" : "adult",
    username: student?.username ?? null,
    isPlatformAdmin: actor.role === "admin",
    home: homeOf(actor.role),
    memberships: actor.role === "admin" || !inst ? [] : [{
      id: `m-${actor.personId}`, role: actor.role as T.Role, institution_id: inst.institution.id,
      institution_name: inst.institution.name, institution_status: inst.institution.status
    }],
  };
}
