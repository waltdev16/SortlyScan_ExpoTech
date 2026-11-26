// Contratos entre fases. Los tipos vigentes de la API están en lib/api/types.ts.
// Fase 6 (implementada): SortlyScan Vision devuelve VisionResult y registra un escaneo SIN imagen.
// Fase 7 (pendiente): verificación docente de acciones reales. Nada de esto está implementado todavía.
import type { ScanRow, VisionCategory, VisionResult } from "./api/types";

export type UserRole = "student" | "teacher" | "director" | "superadmin";
export type WasteCategory = VisionCategory | "unknown";
export type { ScanRow, VisionResult };

export interface ApiError {
  code: string;
  message: string;
  requestId: string;
}

// Los puntos y la institución se determinan en el servidor; no se aceptan desde el navegador.
export interface LearningSubmission {
  activityId: string;
  answers: string[];
  idempotencyKey: string;
}

/**
 * Fase 7 · propuesta de contrato. Un escaneo es solo un reconocimiento: no prueba que el residuo se
 * separó o entregó. Una acción real necesitará la verificación de un docente de la misma institución
 * (public.scans.review_status pasa de "unverified" a "verified" o "rejected", con reviewed_by y reviewed_at).
 * Solo entonces podría existir un punto con source_type "teacher_verified_action" (ya previsto en
 * point_transactions). No se aceptarán puntos, cantidades ni pesos enviados desde el navegador.
 */
export interface ScanReviewRequest {
  scanId: string;
  decision: "verified" | "rejected";
  note?: string;
}
export interface ScanReviewResult {
  scanId: string;
  reviewStatus: "verified" | "rejected";
  reviewedAt: string;
}
