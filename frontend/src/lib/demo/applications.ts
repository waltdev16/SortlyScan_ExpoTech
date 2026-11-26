// Solicitudes institucionales de la demostración: se guardan como FICTICIAS en este navegador.
import type * as T from "../api/types";
import { getDb, saveNow } from "./db";

export function submitLocalApplication(input: T.ApplicationInput) {
  const db = getDb();
  const id = `app-${Math.random().toString(36).slice(2, 10)}`;
  db.applications.unshift({
    id, institution_name: input.institution_name.trim(), official_code: input.official_code ?? null, department: input.department, district: input.district.trim(),
    institution_type: input.institution_type, representative_name: input.representative_name.trim(), representative_position: input.representative_position.trim(),
    email: input.email || "sin-correo@ejemplo.invalid", phone: input.phone ?? null, message: input.message ?? null, status: "pending", review_note: null,
    created_at: new Date().toISOString(),
  });
  saveNow();
  return id;
}
