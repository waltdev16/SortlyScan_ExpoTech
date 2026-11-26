// Base de datos LOCAL de la demostración interactiva.
//
// Una sola copia de los datos ficticios, compartida por todos los perfiles (estudiante, docente,
// dirección y superadministración), guardada en localStorage de este navegador. Lo que un perfil
// cambia lo ven los demás al instante, y sobrevive a recargar la página.
//
// Por qué localStorage y no IndexedDB: los datos completos ocupan unos 150–400 KB de JSON (muy por
// debajo del límite habitual de 5 MB), se leen una vez al abrir la demo y se guardan con una escritura
// síncrona y atómica. IndexedDB añadiría código asíncrono y migraciones sin beneficio a este tamaño.
//
// No es una base institucional: no se comparte entre dispositivos ni navegadores, no tiene control de
// acceso real y cualquiera con acceso al navegador puede leerla o borrarla.

import type * as T from "../api/types";
import { seedDatabase } from "./seed";

export const DB_KEY = "sortlyscan-demo-db";
export const DB_VERSION = 4;

export type DemoRole = "student" | "teacher" | "director" | "admin";
export interface Actor {
  role: DemoRole;
  /** Persona que se está "usando". Para superadministración, el id de su cuenta ficticia. */
  personId: string;
  /** Institución del perfil. Superadministración usa la institución piloto solo como contexto. */
  institutionId: string;
}

export interface DemoAttempt { id: string; user: string; lesson: string; score: number; max: number; passed: boolean; at: number }
export interface DemoStudent { id: string; name: string; username: string; group: string; status: "active" | "revoked"; createdAt?: number }
export interface DemoTx { user: string; delta: number; reason: string; rule: string; source: string; at: number; validation: string }
export interface DemoChallenge { id: string; group: string | null; lesson: string | null; title: string; description: string | null; kind: T.ChallengeKind; goal: number; starts_on: string; ends_on: string }
export interface DemoAction extends Omit<T.EnvironmentalAction, "kindLabel" | "group_name" | "display_name" | "reviewer_name"> { reviewer: string | null }
export interface DemoGroup { id: string; name: string; grade: string; grade_level_id: number; ranking_visibility: "group" | "private"; teachers: string[]; school_year: number; status: "active" | "revoked" }
export interface DemoActivity { id: string; group: string; lesson: string; title: string; instructions: string | null; due_on: string | null; created_at: string }
export interface DemoScan { id: string; user: string; category: string; status: "identified" | "unknown"; confidence: number; model: string; at: number; answered?: boolean }
export interface DemoNotification extends T.NotificationItem { user: string }
export type AssessmentEntry = { pre?: T.AssessmentResult & { at: number }; post?: T.AssessmentResult & { at: number } };

/** Datos de UNA institución. Todo es JSON plano (sin Map ni Set) para poder guardarlo. */
export interface InstitutionData {
  institution: T.Institution & { created_at: string };
  groups: DemoGroup[];
  students: DemoStudent[];
  staff: T.StaffRow[];
  attempts: DemoAttempt[];
  /** `${estudiante}|${lección}|${posición}` → momento en que resolvió la actividad */
  solved: Record<string, number>;
  /** `${estudiante}|${lección}` → momento en que abrió la lección */
  started: Record<string, number>;
  scansLearned: { user: string; material: string; correct: boolean; at: number }[];
  scans: DemoScan[];
  activities: DemoActivity[];
  challenges: DemoChallenge[];
  actions: DemoAction[];
  records: (T.EnvironmentalRecord & { recorded_by: string })[];
  assessments: Record<string, AssessmentEntry>;
  sortingRules: T.SortingRule[];
  ledger: DemoTx[];
  /** `${reto}|${estudiante}` → momento en que lo completó */
  completions: Record<string, number>;
  /** `${logro}|${estudiante}` → momento en que lo obtuvo */
  awarded: Record<string, number>;
  notifications: DemoNotification[];
  privacy: T.PrivacyRequest[];
  /** El historial inicial ya se reprodujo con las reglas de puntos (se hace una sola vez). */
  seeded: boolean;
}

export interface LessonSource {
  slug: string;
  material: string;
  title: string;
  summary: string;
  minutes: number;
  status: "draft" | "published" | "archived";
  version: number;
  updated_at: string;
  content: T.LessonContent;
  intro?: string;
  examples?: string[];
  quiz: { title: string; pass_score_pct: number; version?: number; questions: { prompt: string; options: string[]; correct: number; explanation: string; retired?: boolean }[] };
  activities: ({ kind: string; prompt: string; explanation: string; answer: unknown; retired?: boolean } & Record<string, unknown>)[];
}

export interface DemoDatabase {
  version: number;
  createdAt: string;
  /** Contenidos educativos compartidos por todas las instituciones (editables por superadministración). */
  content: {
    lessons: LessonSource[];
    assessment: { id: string; title: string; version: number; questions: { material: string; prompt: string; options: string[]; correct: number }[] };
    scanQuestions: Record<string, { prompt: string; options: string[]; correct: number; explanation: string }[]>;
  };
  pointRules: T.PointRule[];
  retention: { key: string; days: number; description: string; updated_at: string }[];
  applications: (T.ApplicationRow & { institution_id?: string })[];
  institutions: Record<string, InstitutionData>;
  admin: { id: string; name: string };
  audit: (T.AuditRow & { institution_id: string | null })[];
}

let db: DemoDatabase | null = null;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSaved = "";
let version = 0;
const ACTOR_KEY = "sortlyscan-demo-actor";

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null; // modo privado estricto o almacenamiento bloqueado: la demo funciona sin guardar
  }
}

/** Devuelve la base (la crea con los datos iniciales la primera vez o si cambió de versión). */
export function getDb(): DemoDatabase {
  if (db) return db;
  const raw = storage()?.getItem(DB_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DemoDatabase;
      if (parsed.version === DB_VERSION) { db = parsed; lastSaved = raw; }
    } catch {
      /* datos dañados: se vuelven a crear */
    }
  }
  if (!db) {
    db = seedDatabase(DB_VERSION);
    saveNow();
  }
  return db;
}

export function saveNow() {
  if (!db) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  try {
    const text = JSON.stringify(db);
    // Solo se escribe si algo cambió: así dos pestañas abiertas no se recargan una a la otra sin fin.
    if (text === lastSaved) return;
    storage()?.setItem(DB_KEY, text);
    lastSaved = text;
  } catch {
    /* sin espacio o bloqueado: los cambios siguen en memoria hasta recargar */
  }
}

/** Guarda poco después de un cambio (agrupa varias escrituras seguidas en una). */
export function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(saveNow, 60);
}

/** Avisa a la interfaz que los datos cambiaron (cambio de perfil, restablecer, otra pestaña). */
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function notify() {
  version++;
  listeners.forEach((l) => l());
}
/** Cambia cada vez que la base se reemplaza (otra pestaña, restablecer, cambio de perfil). */
export const getVersion = () => version;

function session(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/**
 * Perfil activo. Cada pestaña recuerda el suyo (sessionStorage), así se pueden abrir dos perfiles a la vez
 * —por ejemplo, docente en una pestaña y estudiante en otra— y ver cómo se sincronizan.
 */
export function getActor(): Actor | null {
  const raw = session()?.getItem(ACTOR_KEY) ?? storage()?.getItem(ACTOR_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Actor;
  } catch {
    return null;
  }
}

export function setActor(actor: Actor | null) {
  try {
    if (actor) {
      session()?.setItem(ACTOR_KEY, JSON.stringify(actor));
      storage()?.setItem(ACTOR_KEY, JSON.stringify(actor));
    } else {
      session()?.removeItem(ACTOR_KEY);
      storage()?.removeItem(ACTOR_KEY);
    }
  } catch {
    /* almacenamiento bloqueado */
  }
  notify();
}

/** «Restablecer demostración»: borra todo lo guardado y vuelve a los datos iniciales. */
export function resetDemo() {
  storage()?.removeItem(DB_KEY);
  lastSaved = "";
  db = seedDatabase(DB_VERSION);
  saveNow();
  setActor(null);
}

/** Tamaño aproximado de lo guardado (para la pantalla de información). */
export function storedBytes() {
  return storage()?.getItem(DB_KEY)?.length ?? 0;
}

// Si la demo está abierta en dos pestañas, un cambio en una se refleja en la otra.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== DB_KEY) return;
    db = null;
    lastSaved = "";
    getDb();
    notify();
  });
}

/** Envoltura con la interfaz de Map sobre un objeto guardable (para no reescribir el motor de reglas). */
export class RecordMap<V> {
  constructor(private readonly target: Record<string, V>) { }
  has(key: string) {
    return Object.prototype.hasOwnProperty.call(this.target, key);
  }
  get(key: string): V | undefined {
    return this.has(key) ? this.target[key] : undefined;
  }
  set(key: string, value: V) {
    this.target[key] = value;
    return this;
  }
  keys() {
    return Object.keys(this.target)[Symbol.iterator]();
  }
  entries() {
    return (Object.entries(this.target) as [string, V][])[Symbol.iterator]();
  }
  forEach(fn: (value: V, key: string) => void) {
    Object.entries(this.target).forEach(([k, v]) => fn(v as V, k));
  }
  get size() {
    return Object.keys(this.target).length;
  }
}
