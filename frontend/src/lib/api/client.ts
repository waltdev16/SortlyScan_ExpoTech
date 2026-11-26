import type * as T from "./types";

/** Error de la API con mensaje en español listo para mostrarse. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public requestId?: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/**
 * Contrato que usan los paneles.
 *
 * En SortlyScan Interactive Demo la única implementación es `createDemoApi` (lib/demo/demo-api.ts): todo
 * ocurre en el navegador con datos ficticios guardados localmente. La implementación HTTP (FastAPI +
 * Supabase) se conserva en la rama `development-v2` (Release Candidate Full Stack).
 */
export interface Api {
  mode: "live" | "demo";
  me(): Promise<T.Me>;
  updateMe(displayName: string): Promise<{ displayName: string }>;
  redeem(code: string): Promise<{ role: T.Role }>;
  // Estudiante
  studentOverview(): Promise<T.StudentOverview>;
  studentProgress(): Promise<T.StudentProgress>;
  studentChallenges(): Promise<T.Challenge[]>;
  studentRanking(period?: T.RankingPeriod, scope?: "group" | "institution"): Promise<T.StudentRanking>;
  studentGamification(): Promise<T.GamificationSummary>;
  checkActivity(slug: string, position: number, answer: T.ActivityAnswer): Promise<T.ActivityCheck>;
  assessment(): Promise<T.Assessment>;
  submitAssessment(phase: "pre" | "post", answers: number[]): Promise<T.AssessmentResult>;
  answerScan(scanId: string, questionId: string, answer: number): Promise<T.ScanAnswerResult>;
  practiceScanQuestion(questionId: string, answer: number): Promise<T.ScanAnswerResult>;
  myActions(): Promise<T.EnvironmentalAction[]>;
  submitAction(body: T.EnvironmentalActionInput): Promise<{ id: string; status: string }>;
  resubmitAction(id: string, body: { description: string; quantity: number | null; unit: "kg" | "items" | null }): Promise<unknown>;
  lessons(): Promise<T.LessonSummary[]>;
  lesson(slug: string): Promise<T.LessonDetail>;
  startLesson(slug: string): Promise<unknown>;
  submitAttempt(quizId: string, answers: number[], idempotencyKey: string, activityId?: string | null): Promise<T.AttemptResult>;
  // Docentes y dirección
  teacherOverview(): Promise<T.TeacherOverview>;
  groups(): Promise<T.Group[]>;
  gradeLevels(): Promise<{ id: number; name: string }[]>;
  updateGroup(groupId: string, patch: Partial<Pick<T.Group, "name" | "ranking_visibility" | "status">>): Promise<unknown>;
  groupStudents(groupId: string): Promise<T.StudentRow[]>;
  createStudents(groupId: string, names: string[]): Promise<T.CreatedStudent[]>;
  resetStudentCode(groupId: string, studentId: string): Promise<{ userId: string; accessCode: string }>;
  revokeStudent(groupId: string, studentId: string): Promise<unknown>;
  activities(groupId: string): Promise<T.ActivityRow[]>;
  createActivity(groupId: string, body: { lesson_slug: string; title: string; instructions?: string | null; due_on?: string | null }): Promise<unknown>;
  results(groupId: string): Promise<T.GroupResults>;
  groupRanking(groupId: string, period?: T.RankingPeriod): Promise<T.TeacherRanking>;
  reviews(status?: T.ActionStatus | "all"): Promise<T.EnvironmentalAction[]>;
  reviewAction(id: string, decision: "approved" | "rejected" | "changes_requested", note?: string): Promise<T.ReviewResult>;
  environmentalRecords(): Promise<T.EnvironmentalRecord[]>;
  createEnvironmentalRecord(body: T.EnvironmentalRecordInput): Promise<{ id: string }>;
  verifyEnvironmentalRecord(id: string, decision: "verified" | "rejected", note?: string): Promise<unknown>;
  analytics(filters: T.StatsFilters): Promise<T.AnalyticsOverview>;
  report(kind: T.ReportKind, format: T.ReportFormat, filters: T.StatsFilters): Promise<Blob>;
  challenges(groupId?: string): Promise<T.Challenge[]>;
  createChallenge(body: T.ChallengeInput, groupId?: string | null): Promise<unknown>;
  students(): Promise<T.StudentRow[]>;
  groupReportCsv(groupId: string): Promise<Blob>;
  // Dirección
  directorOverview(): Promise<T.DirectorOverview>;
  institution(): Promise<T.Institution>;
  updateInstitution(body: { district?: string; contact_email?: string | null; contact_phone?: string | null }): Promise<T.Institution>;
  staff(): Promise<T.StaffRow[]>;
  revokeStaff(membershipId: string): Promise<unknown>;
  invitations(): Promise<T.InvitationRow[]>;
  createInvitation(email: string): Promise<T.InvitationRow & { code: string }>;
  revokeInvitation(id: string): Promise<unknown>;
  createTeacher(name: string): Promise<{ id: string; name: string }>;
  createGroup(body: { grade_level_id: number; name: string; school_year: number }): Promise<{ id: string }>;
  assignTeacher(groupId: string, teacherId: string): Promise<unknown>;
  unassignTeacher(groupId: string, teacherId: string): Promise<unknown>;
  metrics(): Promise<T.InstitutionMetrics>;
  setRankingScope(scope: "off" | "group" | "institution"): Promise<T.Institution>;
  institutionReportCsv(): Promise<Blob>;
  // Superadministración
  applications(status?: string): Promise<T.ApplicationRow[]>;
  approveApplication(id: string, note?: string): Promise<{ institution: { id: string; name: string }; director: { id: string; name: string } }>;
  createInstitution(body: { name: string; department: string; district: string; director_name: string }): Promise<{ institution: { id: string; name: string }; director: { id: string; name: string } }>;
  adminPeople(): Promise<T.AdminPerson[]>;
  rejectApplication(id: string, note?: string): Promise<unknown>;
  adminInstitutions(): Promise<T.AdminInstitution[]>;
  setInstitutionStatus(id: string, status: "active" | "suspended"): Promise<unknown>;
  directorInvitation(institutionId: string, email: string): Promise<T.InvitationRow & { code: string }>;
  adminLessons(): Promise<T.AdminLesson[]>;
  updateLesson(id: string, body: { title?: string; summary?: string; status?: string; estimated_minutes?: number; pass_score_pct?: number; content?: T.LessonContent }): Promise<T.AdminLessonDetail>;
  adminLesson(id: string): Promise<T.AdminLessonDetail>;
  createLesson(body: { material: string; slug: string; title: string; summary: string; content: T.LessonContent }): Promise<T.AdminLessonDetail>;
  saveQuestion(lessonId: string, position: number, body: T.QuestionInput): Promise<T.AdminLessonDetail>;
  retireQuestion(lessonId: string, position: number): Promise<T.AdminLessonDetail>;
  saveActivity(lessonId: string, position: number, body: T.ActivityInput): Promise<T.AdminLessonDetail>;
  retireActivity(lessonId: string, position: number): Promise<T.AdminLessonDetail>;
  escalatedPrivacy(): Promise<T.PrivacyRequest[]>;
  erasePrivacy(id: string): Promise<unknown>;
  retention(): Promise<T.RetentionInfo>;
  updateRetention(key: string, days: number): Promise<unknown>;
  runRetention(dryRun: boolean): Promise<{ dryRun: boolean; result: T.RetentionInfo["preview"] }>;
  audit(institutionId?: string): Promise<T.AuditRow[]>;
  pointRules(): Promise<{ rules: T.PointRule[]; levels: T.LevelDef[] }>;
  updatePointRule(key: string, body: Partial<Pick<T.PointRule, "points" | "max_awards" | "period" | "active">>): Promise<T.PointRule[]>;
  // Fase 9: notificaciones, gestión escolar y privacidad
  notifications(): Promise<T.NotificationList>;
  readNotifications(id?: string): Promise<T.NotificationList>;
  importStudents(rows: T.ImportRowInput[], confirm: boolean): Promise<T.ImportPreview & Partial<T.ImportResult>>;
  transferStudents(groupId: string, targetGroupId: string, studentIds: string[], reason: "transfer" | "school_year"): Promise<{ moved: number }>;
  reactivateStudent(groupId: string, studentId: string): Promise<unknown>;
  history(before?: number | null): Promise<T.HistoryPage>;
  exportStudent(studentId: string): Promise<Record<string, unknown>>;
  privacyRequests(): Promise<T.PrivacyRequest[]>;
  createPrivacyRequest(body: { kind: T.PrivacyKind; details: string; subject_user_id?: string | null }): Promise<unknown>;
  resolvePrivacyRequest(id: string, body: { decision: "completed" | "rejected" | "escalated"; note?: string | null; new_display_name?: string | null }): Promise<unknown>;
  // Vision
  visionStatus(): Promise<T.VisionStatus>;
  classify(file: Blob, source: "camera" | "upload"): Promise<T.VisionResult>;
  recentScans(): Promise<T.ScanRow[]>;
  sortingRules(): Promise<T.SortingRule[]>;
  saveSortingRules(rules: T.SortingRule[]): Promise<T.SortingRule[]>;
}
