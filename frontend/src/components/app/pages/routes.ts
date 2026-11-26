// Secciones conocidas de cada panel (para generar las páginas estáticas). Las lecciones que la
// superadministración cree durante la demostración se abren con el respaldo de not-found.tsx.
import demoContent from "@/data/demo-content.json";

const SECTIONS = {
  estudiante: ["", "escanear", "aprender", "retos", "ranking", "progreso", "acciones", "evaluacion", "configuracion"],
  docente: ["", "grupos", "estudiantes", "actividades", "retos", "estadisticas", "verificacion", "reportes", "cuenta"],
  director: ["", "docentes", "estudiantes", "grupos", "aprendizaje", "participacion", "impacto", "verificacion", "reportes", "configuracion"],
  admin: ["", "instituciones", "personas", "contenidos", "privacidad", "auditoria"],
} as const;

export function panelParams(panel: keyof typeof SECTIONS): { section: string[] }[] {
  const list: { section: string[] }[] = SECTIONS[panel].map((s) => ({ section: s ? [s as string] : [] }));
  if (panel === "estudiante") list.push(...demoContent.lessons.map((l) => ({ section: ["aprender", l.slug] })));
  return list;
}
