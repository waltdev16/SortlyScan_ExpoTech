// Tipos de las respuestas de la API v1 (backend/app). Los nombres respetan el JSON recibido.
export type Role = "student" | "teacher" | "director";
export type MaterialId = "plastic" | "paper" | "cardboard" | "metal" | "glass" | "organic";

export interface Membership {
  id: string;
  role: Role;
  institution_id: string;
  institution_name: string;
  institution_status: string;
}
export interface Me {
  id: string;
  email: string | null;
  displayName: string;
  accountType: "adult" | "managed_student";
  username: string | null;
  isPlatformAdmin: boolean;
  memberships: Membership[];
  home: string;
}
export interface Level {
  number: number;
  name: string;
  points: number;
  floor: number;
  nextAt: number | null;
  nextName: string | null;
  progressPct: number;
  total?: number;
  rulesVersion: string;
}
/** Tabla de niveles: viene de la API (public.levels); la interfaz no define umbrales propios. */
export interface LevelDef { number: number; name: string; min_points: number }
export interface PointRule { key: string; label: string; points: number; max_awards: number | null; period: "day" | "week" | "month" | null; active: boolean }
export interface LessonSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  material: MaterialId;
  material_name: string;
  material_code: string;
  estimated_minutes: number;
  quiz_id: string;
  progress_status: "started" | "completed" | null;
  best_score_pct: number | null;
  attempts?: number;
  activities_done?: boolean;
  activity_count?: number;
  activities_solved?: number;
}
export interface LessonContent {
  intro?: string;
  examples?: string[];
  what: string;
  identify: string[];
  classify: string[];
  mistakes: string[];
  tips: string[];
}
export interface Question {
  id: string;
  position: number;
  prompt: string;
  options: string[];
}
export type ActivityKind = "choice" | "truefalse" | "sort" | "image" | "match";
export interface LessonActivity {
  id: string;
  position: number;
  kind: ActivityKind;
  prompt: string;
  payload: { options?: string[]; bins?: string[]; items?: string[]; left?: string[]; right?: string[] };
  solved: boolean;
  attempts: number;
}
export type ActivityAnswer = number | boolean | number[];
/** Resultado de una recompensa: puntos, nivel y logros calculados en el servidor. */
export interface Outcome {
  pointsAwarded: number;
  totalPoints: number;
  level: Level;
  levelUp: boolean;
  newAchievements: Achievement[];
}
export interface ActivityCheck extends Partial<Outcome> {
  correct: boolean;
  items: boolean[] | null;
  explanation: string;
  answer: ActivityAnswer | null;
  recorded: boolean;
  lessonCompleted?: boolean;
  activitiesRemaining?: number;
}
export interface LessonDetail extends Omit<LessonSummary, "progress_status" | "best_score_pct"> {
  content: LessonContent;
  quiz_title: string;
  pass_score_pct: number;
  questions: Question[];
  activities: LessonActivity[];
  quizPassed: boolean;
  progress: { status: string; best_score_pct: number | null; activities_completed_at?: string | null } | null;
}
export interface Achievement {
  id: string;
  title: string;
  description: string;
  awarded_at?: string | null;
  target?: number;
  current?: number;
  status?: "earned" | "in_progress" | "locked";
  condition?: { type: string; material?: string };
}
export interface AttemptResult {
  attemptId: string;
  score: number;
  maxScore: number;
  scorePct: number;
  passed: boolean;
  passScorePct: number;
  questions: {
    position: number;
    selected: number | null;
    correct: boolean;
    correctOption: number | null;
    explanation: string;
  }[];
  pointsAwarded: number;
  totalPoints: number;
  level: Level;
  levelUp?: boolean;
  lessonCompleted?: boolean;
  newAchievements: Achievement[];
  replayed: boolean;
}
export interface AttemptRow {
  id: string;
  lesson_title: string;
  slug?: string;
  display_name?: string;
  group_name?: string;
  score: number;
  max_score: number;
  passed: boolean;
  created_at: string;
}
export type ChallengeKind = "learning" | "quiz" | "identification" | "group_participation" | "verified_recycling" | "institutional_activity";
export interface ChallengeProgress {
  current: number;
  target: number;
  unit: string;
  met: boolean;
  participants?: number;
  enrolled?: number;
  iParticipated?: boolean | null;
}
export interface Challenge {
  id: string;
  title: string;
  description: string | null;
  kind: ChallengeKind;
  kindLabel: string;
  verification: string;
  goal_count: number;
  starts_on: string;
  ends_on: string;
  state: "upcoming" | "active" | "ended";
  lesson_slug: string | null;
  lesson_title: string | null;
  institutional?: boolean;
  completed?: boolean;
  completedAt?: string | null;
  reward?: number;
  progress?: ChallengeProgress;
  groupProgress?: ChallengeProgress | null;
  group_id?: string | null;
  group_name?: string | null;
  eligible?: number;
  participants?: number;
}
export interface StudentActivity {
  id: string;
  title: string;
  instructions: string | null;
  due_on: string | null;
  lesson_slug: string;
  lesson_title: string;
  completed: boolean;
}
export interface GroupInfo {
  id: string;
  name: string;
  grade: string;
  ranking_visibility: "private" | "group";
}
export interface AssessmentState {
  available: "pre" | "post" | null;
  pre: { score: number; max_score: number; created_at: string } | null;
  post: { score: number; max_score: number; created_at: string } | null;
  postAfterLessons: number;
  lessonsCompleted: number;
}
export interface StudentOverview {
  displayName: string;
  institution: string | null;
  group: GroupInfo | null;
  points: number;
  level: Level;
  levels: LevelDef[];
  assessment: AssessmentState;
  lessons: { total: number; completed: number; next: LessonSummary[] };
  recentAttempts: AttemptRow[];
  activities: StudentActivity[];
  challenges: Challenge[];
  achievements: Achievement[];
}
export interface StudentProgress {
  lessons: LessonSummary[];
  history: AttemptRow[];
  ledger: { delta: number; reason: string; created_at: string; rules_version: string; rule_key?: string | null; validation?: string }[];
  achievements: Achievement[];
  points: number;
  level: Level;
  levels: LevelDef[];
}
export type RankingPeriod = "week" | "month" | "all";
export interface StudentRanking {
  period: RankingPeriod;
  scope: "group" | "institution";
  rankingScope: "off" | "group" | "institution";
  group: { name: string; grade: string } | null;
  visibility: "off" | "private" | "visible";
  position: number | null;
  participants: number;
  myPoints?: number;
  entries: { position: number; displayName: string; points: number; groupName: string | null; isMe: boolean }[];
  evolution: { week: string; points: number; activities: number }[];
  groupComparison: { name: string; grade: string; students: number; avgPoints: number | null; isMine: boolean }[];
  effort: { thisWeek: number; lastWeek: number };
}
export interface GamificationSummary {
  points: number;
  level: Level;
  levels: LevelDef[];
  rules: PointRule[];
  achievements: Achievement[];
}
export interface Assessment {
  id: string;
  title: string;
  version: number;
  questions: { position: number; material: MaterialId; prompt: string; options: string[] }[];
  state: AssessmentState | null;
}
export interface AssessmentResult {
  phase: "pre" | "post";
  score: number;
  maxScore: number;
  scorePct: number;
  byMaterial: Record<string, { correct: number; total: number }>;
}
export type ActionKind = "separation" | "delivery" | "cleanup" | "compost" | "campaign" | "other";
export type ActionStatus = "pending" | "approved" | "rejected" | "changes_requested";
export interface EnvironmentalAction {
  id: string;
  kind: ActionKind;
  kindLabel: string;
  material: string | null;
  description: string;
  quantity: number | null;
  unit: "kg" | "items" | null;
  occurred_on: string;
  status: ActionStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  group_id: string;
  group_name: string;
  display_name: string;
  reviewer_name: string | null;
  user_id: string;
}
export interface EnvironmentalActionInput {
  kind: ActionKind;
  material: string | null;
  description: string;
  quantity: number | null;
  unit: "kg" | "items" | null;
  occurred_on: string;
  idempotency_key: string;
}
export interface ReviewResult { id: string; status: ActionStatus; pointsAwarded: number; limited: boolean }
export type RecordKind = "weighing" | "delivery" | "campaign" | "reception";
export interface EnvironmentalRecord {
  id: string;
  kind: RecordKind;
  kindLabel: string;
  material: string;
  quantity: number;
  unit: "kg" | "items";
  occurred_on: string;
  responsible: string;
  notes: string | null;
  supersedes_id: string | null;
  superseded: boolean;
  status: "pending" | "verified" | "rejected";
  verified_at: string | null;
  verification_note: string | null;
  group_id: string | null;
  group_name: string | null;
  recorded_by_name: string | null;
  verified_by_name: string | null;
}
export interface EnvironmentalRecordInput {
  kind: RecordKind;
  material: string;
  quantity: number;
  unit: "kg" | "items";
  occurred_on: string;
  responsible: string;
  notes: string | null;
  group_id: string | null;
  supersedes_id: string | null;
}
export interface EnvironmentTotals {
  byMaterial: { material: string; unit: "kg" | "items"; quantity: number; records: number }[];
  byMonth: { month: string; unit: "kg" | "items"; quantity: number }[];
  pendingRecords: number;
  actions: { approved: number; pending: number };
  totals: { kg: number; items: number };
  note: string;
}
export interface StatsFilters { start?: string; end?: string; group?: string; grade?: number; material?: string }
export interface MetricDef { label: string; formula: string; source: string }
export interface GroupStats {
  id: string;
  name: string;
  grade: string;
  enrolled: number;
  active: number;
  participationPct: number | null;
  lessons_started: number;
  lessons_completed: number;
  completionRatePct: number | null;
  quiz_attempts: number;
  first_attempt_pct: number | null;
  students_evaluated: number;
  challenges_completed: number;
  verified_actions: number;
  noRecords: boolean;
}
export interface MaterialStats {
  material: string;
  name: string;
  students: number;
  first_attempt_pct: number | null;
  students_passed: number;
  passRatePct: number | null;
  needsReinforcement: boolean;
}
export interface AssessmentComparison {
  overall: { pairs: number; prePct: number | null; postPct: number | null; changePts: number | null; improved: number };
  taken: { pre: number; post: number };
  byGroup: { groupId: string; groupName: string; pairs: number; prePct: number | null; postPct: number | null; changePts: number | null; improved: number }[];
  byMaterial: { material: string; prePct: number; postPct: number }[];
  note: string;
}
export interface AnalyticsOverview {
  filters: Record<string, string | null>;
  definitions: Record<string, MetricDef>;
  summary: {
    enrolled: number; active: number; participationPct: number | null; lessonsStarted: number; lessonsCompleted: number;
    completionRatePct: number | null; quizAttempts: number; firstAttemptPct: number | null; studentsEvaluated: number;
    challengesCompleted: number; verifiedActions: number; groupsWithoutRecords: number; pendingReviews: number;
  };
  byGroup: GroupStats[];
  byMaterial: MaterialStats[];
  weekly: { week: string; active_students: number; first_attempt_pct: number | null }[];
  pointsDistribution: { range: string; students: number }[];
  assessment: AssessmentComparison;
  environment: EnvironmentTotals | null;
}
export type ReportKind = "progreso-estudiantil" | "rendimiento-grupos" | "participacion" | "actividades-educativas" | "retos"
  | "reciclaje-verificado" | "resumen-institucional";
export type ReportFormat = "csv" | "xlsx" | "pdf";
export interface Group {
  id: string;
  name: string;
  school_year: number;
  ranking_visibility: "private" | "group";
  status: "active" | "revoked";
  grade_level_id: number;
  grade: string;
  students: number;
  teachers: { id: string; name: string }[];
}
export interface GroupMetrics {
  id: string;
  name: string;
  grade: string;
  students: number;
  active_30d: number;
  attempts: number;
  passed_attempts: number;
  avg_score_pct: number | null;
  lessons_completed: number;
}
export interface StudentRow {
  enrollment_id: string;
  user_id: string;
  display_name: string;
  username: string | null;
  status: "active" | "revoked";
  group_id: string;
  group_name: string;
  grade: string;
  points: number;
  lessons_completed: number;
  avg_score_pct: number | null;
  last_activity_at: string | null;
}
export interface CreatedStudent {
  userId: string;
  displayName: string;
  username: string;
  accessCode: string;
}
export interface ActivityRow {
  id: string;
  title: string;
  instructions: string | null;
  due_on: string | null;
  created_at: string;
  lesson_slug: string;
  lesson_title: string;
  students: number;
  completed: number;
}
export interface GroupResults {
  lessons: { id: string; slug: string; title: string; material: string }[];
  students: { user_id: string; display_name: string }[];
  cells: { user_id: string; lesson_id: string; attempts: number; best_pct: number; passed: boolean; last_at: string }[];
  recent: AttemptRow[];
}
export interface TeacherRanking {
  visibility: "private" | "group";
  period?: RankingPeriod;
  entries: { position: number; user_id: string; display_name: string; points: number; lessons_completed: number }[];
}
export interface WeeklyPoint {
  week: string;
  attempts: number;
  students: number;
  avg_score_pct: number | null;
  group_id?: string;
}
export interface TeacherOverview {
  weekly: WeeklyPoint[];
  displayName: string;
  institution: string | null;
  groups: Group[];
  metrics: GroupMetrics[];
  recentAttempts: AttemptRow[];
  upcomingActivities: { id: string; title: string; due_on: string | null; group_name: string; lesson_title: string }[];
}
export interface Institution {
  id: string;
  name: string;
  official_code: string | null;
  department: string;
  district: string;
  institution_type: string;
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
  ranking_scope?: "off" | "group" | "institution";
}
export interface DirectorOverview {
  institution: { id: string; name: string; department: string; district: string; status: string };
  displayName: string;
  counts: { teachers: number; students: number; groups: number; pending_invitations: number };
  groups: GroupMetrics[];
}
export interface StaffRow {
  membership_id: string;
  user_id: string;
  role: Role;
  status: "active" | "revoked";
  display_name: string;
  groups: { id: string; name: string; grade: string }[];
}
export interface InvitationRow {
  id: string;
  email: string;
  role: Role;
  expires_at: string;
  created_at: string;
  state: "pending" | "accepted" | "revoked" | "expired";
  code?: string;
}
export interface InstitutionMetrics {
  learning: {
    byGroup: GroupMetrics[];
    byMaterial: { material: string; name: string; attempts: number; avg_score_pct: number | null; students_passed: number }[];
  };
  participation: { weekly: WeeklyPoint[] };
  environment: { scans: { total: number; identified: number }; note: string };
}
export interface ApplicationRow {
  id: string;
  institution_name: string;
  official_code: string | null;
  department: string;
  district: string;
  institution_type: string;
  representative_name: string;
  representative_position: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
}
export interface AdminInstitution {
  id: string;
  name: string;
  official_code: string | null;
  department: string;
  district: string;
  status: "active" | "suspended";
  directors: number;
  teachers: number;
  students: number;
  created_at: string;
}
export interface AdminLesson {
  id: string;
  slug: string;
  title: string;
  summary: string;
  status: "draft" | "published" | "archived";
  version: number;
  material: string;
  questions: number;
  updated_at: string;
}
export interface AuditRow {
  id: number;
  created_at: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  institution_name: string | null;
  actor_name: string | null;
  request_id: string | null;
}
export type VisionCategory = "plastic" | "paper" | "cardboard" | "metal" | "glass" | "organic" | "other";
export interface VisionCategoryInfo { id: VisionCategory; label: string }
export interface VisionStatus {
  status: "ready" | "unavailable";
  reason?: string | null;
  message?: string;
  modelVersion?: string;
  categories: VisionCategoryInfo[];
  unsupportedCategories?: VisionCategoryInfo[];
  thresholds?: { min_confidence: number; min_margin: number };
}
export interface SortingRule {
  material: VisionCategory;
  label?: string;
  accepted: boolean | null;
  place: string | null;
  notes: string | null;
  updated_at?: string | null;
}
export interface VisionEducation {
  summary: string | null;
  what: string | null;
  recognize: string[];
  recyclable: string | null;
  prepare: string[];
  mistakes: string[];
  tips: string[];
  /** Sin respuesta: se califica en el servidor (o localmente en la demostración). */
  question: { id: string; prompt: string; options: string[] } | null;
  lessonSlug: string | null;
  lessonTitle: string | null;
  institutionRule: Pick<SortingRule, "material" | "accepted" | "place" | "notes"> | null;
}
/** Respuesta de /vision/classify. "unknown" = el modelo no está seguro (no es "Otros residuos"). */
export interface VisionResult {
  status: "identified" | "unknown" | "unavailable";
  category?: VisionCategory | "unknown";
  label?: string;
  confidence?: number;
  alternatives?: { category: VisionCategory; label: string; confidence: number }[];
  reason?: "low_confidence" | "ambiguous" | "too_dark" | "low_detail" | string | null;
  retry?: string;
  message?: string;
  modelVersion?: string;
  processingMs?: number;
  unsupportedCategories?: string[];
  education?: VisionEducation;
  /** Contrato para la fase 7: un escaneo nunca es reciclaje verificado ni suma puntos por sí mismo. */
  scan?: { recorded: boolean; id?: string; reviewStatus?: "unverified" | "verified" | "rejected" };
  demo?: boolean;
}
export interface ScanRow {
  id: string;
  status: "identified" | "unknown";
  category: VisionCategory | "unknown";
  label: string;
  confidence: number;
  model_version: string;
  review_status: "unverified" | "verified" | "rejected";
  created_at: string;
}
export interface ApplicationInput {
  institution_name: string;
  official_code?: string | null;
  department: string;
  district: string;
  institution_type: "public" | "private" | "subsidized" | "other";
  representative_name: string;
  representative_position: string;
  email: string;
  phone?: string | null;
  message?: string | null;
  accepts_privacy: boolean;
  website?: string;
}
export interface ChallengeInput {
  title: string;
  description?: string | null;
  kind: ChallengeKind;
  goal_count: number;
  lesson_slug?: string | null;
  starts_on: string;
  ends_on: string;
}

export interface ScanAnswerResult extends Partial<Outcome> {
  correct: boolean;
  explanation: string;
  correctOption: number;
  replayed?: boolean;
  limited?: boolean;
  recorded?: boolean;
}

// --- Fase 9: notificaciones, gestión escolar, privacidad y editor de contenidos ---------------
export type NotificationKind = "activity_assigned" | "challenge_new" | "action_approved" | "action_rejected" | "action_changes" | "achievement" | "level_up";
export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read: boolean;
}
export interface NotificationList { items: NotificationItem[]; unread: number }
export interface ImportRowInput { line: number; display_name: string; group_id?: string | null; group_label?: string | null; accept_duplicate?: boolean }
export interface ImportRowResult {
  line: number;
  displayName: string;
  groupId: string | null;
  groupLabel: string;
  status: "ok" | "warning" | "error";
  messages: string[];
  acceptDuplicate: boolean;
}
export interface ImportSummary { ok: number; warning: number; error: number }
export interface ImportPreview { rows: ImportRowResult[]; summary: ImportSummary; canCommit: boolean }
export interface ImportResult {
  created: (CreatedStudent & { line: number; groupLabel: string })[];
  failed: { line: number; message: string }[];
  summary: ImportSummary;
}
export interface HistoryItem {
  id: number;
  created_at: string;
  action: string;
  target_type: string | null;
  metadata: Record<string, unknown>;
  actor_name: string | null;
}
export interface HistoryPage { items: HistoryItem[]; nextBefore: number | null }
export type PrivacyKind = "correction" | "access" | "anonymization" | "deletion";
export type PrivacyStatus = "pending" | "completed" | "rejected" | "escalated";
export interface PrivacyRequest {
  id: string;
  kind: PrivacyKind;
  details: string;
  status: PrivacyStatus;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  subject_user_id: string | null;
  subject_name: string | null;
  requested_by_name: string | null;
  subject_role: Role | null;
  institution_name?: string;
}
export interface AdminQuestion { id: string; position: number; prompt: string; options: string[]; explanation: string; correct: number; has_answers: boolean }
export interface AdminActivity {
  id: string;
  position: number;
  kind: ActivityKind;
  prompt: string;
  payload: { options?: string[]; bins?: string[]; items?: string[]; left?: string[]; right?: string[] };
  explanation: string;
  answer: boolean | number | number[];
  has_answers: boolean;
}
export interface AdminLessonDetail {
  id: string;
  slug: string;
  title: string;
  summary: string;
  status: "draft" | "published" | "archived";
  version: number;
  estimated_minutes: number;
  material: string;
  content: LessonContent;
  quiz_id: string;
  pass_score_pct: number;
  quiz_version: number;
  questions: AdminQuestion[];
  activities: AdminActivity[];
  retired: number;
  attempts: number;
}
export interface QuestionInput { prompt: string; options: string[]; correct: number; explanation: string }
export interface ActivityInput {
  kind: ActivityKind;
  prompt: string;
  explanation: string;
  options?: string[];
  bins?: string[];
  items?: string[];
  left?: string[];
  right?: string[];
  answer: boolean | number | number[];
}
export interface RetentionInfo {
  settings: { key: string; days: number; description: string; updated_at: string }[];
  preview: Record<string, { days: number; rows: number }>;
}

/** Persona ficticia listada en la superadministración de la demostración. */
export interface AdminPerson { id: string; name: string; role: Role; status: string; institution: string; group: string | null }
