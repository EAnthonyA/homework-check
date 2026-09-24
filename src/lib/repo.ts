// Thin typed repository over the SQLite database (plain SQL, no ORM).
// SQL statements are prepared lazily on first use, so importing this module
// never opens the database (important for Next.js build workers).
import { randomUUID } from "node:crypto";
import type { StatementSync } from "node:sqlite";
import { getDb } from "./db";

export type Role = "parent" | "kid";

export interface UserRow {
  id: string;
  google_sub: string;
  email: string;
  name: string;
  picture: string | null;
  role: Role;
  calendar_enabled: number;
  encrypted_refresh_token: string | null;
  calendar_timezone: string;
  created_at: string;
  updated_at: string;
}

export interface HomeworkRow {
  id: string;
  source_id: string;
  subject: string;
  description: string;
  due_date: string;
  details: string | null;
  assigned_date: string | null;
  done_at: string | null;
  done_by: string | null;
  done_source: "parent" | "ai" | null;
  completion_version: number;
  created_at: string;
  updated_at: string;
}

export interface HomeworkHistoryRow extends HomeworkRow {
  done_by_name: string | null;
}

export interface AssessmentRow {
  id: string;
  source_id: string;
  assessment_date: string;
  assessment_type: string;
  group_name: string;
  topic: string;
  entered_date: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface SubmissionWithUser {
  id: string;
  user_id: string;
  homework_id: string;
  image_path: string;
  image_paths: string | null;
  note: string | null;
  ai_done: number | null;
  ai_correct: number | null;
  ai_summary: string | null;
  ai_error: string | null;
  ai_evaluated_at: string | null;
  created_at: string;
  user_name: string;
  user_role: Role;
}

export interface ScrapeRunRow {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  items_added: number;
  items_changed: number;
  error: string | null;
}

export function newId(): string {
  return randomUUID();
}

const statementCache = new Map<string, StatementSync>();

function stmt(sql: string): StatementSync {
  let s = statementCache.get(sql);
  if (!s) {
    s = getDb().prepare(sql);
    statementCache.set(sql, s);
  }
  return s;
}

// ---------- Users ----------

const UPSERT_USER_SQL = `
  INSERT INTO users (id, google_sub, email, name, picture, role, encrypted_refresh_token)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(google_sub) DO UPDATE SET
    email = excluded.email,
    name = excluded.name,
    picture = excluded.picture
`;

export function upsertUser(input: {
  googleSub: string;
  email: string;
  name: string;
  picture: string | null;
  role: Role;
  encryptedRefreshToken?: string | null;
}): UserRow {
  stmt(UPSERT_USER_SQL).run(
    newId(),
    input.googleSub,
    input.email,
    input.name,
    input.picture,
    input.role,
    input.encryptedRefreshToken ?? null,
  );
  return getUserByGoogleSub(input.googleSub)!;
}

export function getUserByGoogleSub(googleSub: string): UserRow | undefined {
  return stmt("SELECT * FROM users WHERE google_sub = ?").get(googleSub) as UserRow | undefined;
}

export function getUserById(id: string): UserRow | undefined {
  return stmt("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function getUserByEmail(email: string): UserRow | undefined {
  return stmt("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
}

export function listUsers(): UserRow[] {
  return stmt("SELECT * FROM users ORDER BY created_at ASC").all() as unknown as UserRow[];
}

export function updateRefreshToken(id: string, encrypted: string | null): void {
  stmt(
    "UPDATE users SET encrypted_refresh_token = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
  ).run(encrypted, id);
}

export function setCalendarEnabled(id: string, enabled: boolean): void {
  stmt(
    "UPDATE users SET calendar_enabled = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
  ).run(enabled ? 1 : 0, id);
}

export function setUserRole(id: string, role: Role): void {
  stmt(
    "UPDATE users SET role = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
  ).run(role, id);
}

// ---------- Homework ----------

export function getHomeworkBySourceId(sourceId: string): HomeworkRow | undefined {
  return stmt("SELECT * FROM homework_items WHERE source_id = ?").get(sourceId) as HomeworkRow | undefined;
}

const INSERT_HOMEWORK_SQL = `
  INSERT INTO homework_items (id, source_id, subject, description, due_date, details, assigned_date)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;
const UPDATE_HOMEWORK_SQL = `
  UPDATE homework_items
  SET subject = ?, description = ?, due_date = ?, details = ?, assigned_date = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id = ?
`;

export function upsertHomeworkItem(input: {
  sourceId: string;
  subject: string;
  description: string;
  dueDate: string;
  details?: string | null;
  assignedDate?: string | null;
}): { item: HomeworkRow; created: boolean; changed: boolean } {
  const existing = getHomeworkBySourceId(input.sourceId);
  if (existing) {
    const changed =
      existing.subject !== input.subject ||
      existing.description !== input.description ||
      existing.due_date !== input.dueDate ||
      (existing.details ?? null) !== (input.details ?? null) ||
      (existing.assigned_date ?? null) !== (input.assignedDate ?? null);
    if (changed) {
      stmt(UPDATE_HOMEWORK_SQL).run(
        input.subject,
        input.description,
        input.dueDate,
        input.details ?? null,
        input.assignedDate ?? null,
        existing.id,
      );
      return { item: getHomeworkBySourceId(input.sourceId)!, created: false, changed: true };
    }
    return { item: existing, created: false, changed: false };
  }
  stmt(INSERT_HOMEWORK_SQL).run(
    newId(),
    input.sourceId,
    input.subject,
    input.description,
    input.dueDate,
    input.details ?? null,
    input.assignedDate ?? null,
  );
  return { item: getHomeworkBySourceId(input.sourceId)!, created: true, changed: false };
}

export function getHomeworkById(id: string): HomeworkRow | undefined {
  return stmt("SELECT * FROM homework_items WHERE id = ?").get(id) as HomeworkRow | undefined;
}

export function listHomeworkByDate(date: string): HomeworkRow[] {
  return stmt("SELECT * FROM homework_items WHERE due_date = ? ORDER BY subject ASC").all(date) as unknown as HomeworkRow[];
}

export function listHomeworkFrom(date: string): HomeworkRow[] {
  return stmt(
    "SELECT * FROM homework_items WHERE due_date >= ? AND done_at IS NULL ORDER BY due_date ASC, subject ASC",
  ).all(date) as unknown as HomeworkRow[];
}

export function listAllHomework(): HomeworkRow[] {
  return stmt("SELECT * FROM homework_items ORDER BY due_date ASC, subject ASC").all() as unknown as HomeworkRow[];
}

export function listUnfinishedHomework(): HomeworkRow[] {
  return stmt("SELECT * FROM homework_items WHERE done_at IS NULL ORDER BY due_date ASC, subject ASC").all() as unknown as HomeworkRow[];
}

export function markHomeworkDone(id: string, doneBy: string, source: "parent" | "ai" = "parent"): void {
  stmt(
    "UPDATE homework_items SET done_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), done_by = ?, done_source = ?, completion_version = completion_version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND done_at IS NULL",
  ).run(doneBy, source, id);
}

export function reopenHomework(id: string): void {
  stmt(
    "UPDATE homework_items SET done_at = NULL, done_by = NULL, done_source = NULL, completion_version = completion_version + 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND done_at IS NOT NULL",
  ).run(id);
}

export function listHomeworkHistory(): HomeworkHistoryRow[] {
  return stmt(`
    SELECT h.*, u.name AS done_by_name
    FROM homework_items h
    LEFT JOIN users u ON u.id = h.done_by
    WHERE h.done_at IS NOT NULL
    ORDER BY h.done_at DESC, h.due_date DESC
  `).all() as unknown as HomeworkHistoryRow[];
}

// ---------- Assessments ----------

export function getAssessmentById(id: string): AssessmentRow | undefined {
  return stmt("SELECT * FROM assessment_items WHERE id = ?").get(id) as AssessmentRow | undefined;
}

export function getAssessmentBySourceId(sourceId: string): AssessmentRow | undefined {
  return stmt("SELECT * FROM assessment_items WHERE source_id = ?").get(sourceId) as AssessmentRow | undefined;
}

const INSERT_ASSESSMENT_SQL = `
  INSERT INTO assessment_items (
    id, source_id, assessment_date, assessment_type, group_name, topic, entered_date, active
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
`;
const UPDATE_ASSESSMENT_SQL = `
  UPDATE assessment_items
  SET assessment_date = ?, assessment_type = ?, group_name = ?, topic = ?, entered_date = ?, active = 1,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id = ?
`;

export function upsertAssessmentItem(input: {
  sourceId: string;
  assessmentDate: string;
  assessmentType: string;
  groupName: string;
  topic: string;
  enteredDate?: string | null;
}): { item: AssessmentRow; created: boolean; changed: boolean } {
  const existing = getAssessmentBySourceId(input.sourceId);
  if (existing) {
    const changed =
      existing.assessment_date !== input.assessmentDate ||
      existing.assessment_type !== input.assessmentType ||
      existing.group_name !== input.groupName ||
      existing.topic !== input.topic ||
      (existing.entered_date ?? null) !== (input.enteredDate ?? null) ||
      existing.active !== 1;
    if (changed) {
      stmt(UPDATE_ASSESSMENT_SQL).run(
        input.assessmentDate,
        input.assessmentType,
        input.groupName,
        input.topic,
        input.enteredDate ?? null,
        existing.id,
      );
      return { item: getAssessmentBySourceId(input.sourceId)!, created: false, changed: true };
    }
    return { item: existing, created: false, changed: false };
  }
  stmt(INSERT_ASSESSMENT_SQL).run(
    newId(),
    input.sourceId,
    input.assessmentDate,
    input.assessmentType,
    input.groupName,
    input.topic,
    input.enteredDate ?? null,
  );
  return { item: getAssessmentBySourceId(input.sourceId)!, created: true, changed: false };
}

// The source does not expose a stable assessment ID. A full successful scrape
// therefore reconciles its visible schedule: missing rows are retired, while a
// rescheduled row is imported as the new date.
export function deactivateAssessments(): void {
  stmt(
    "UPDATE assessment_items SET active = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE active = 1",
  ).run();
}

export function listUpcomingAssessments(date: string): AssessmentRow[] {
  return stmt(
    "SELECT * FROM assessment_items WHERE active = 1 AND assessment_date >= ? ORDER BY assessment_date ASC, group_name ASC",
  ).all(date) as unknown as AssessmentRow[];
}

// ---------- Submissions ----------

const UPSERT_SUBMISSION_SQL = `
  INSERT INTO submissions (
    id, user_id, homework_id, image_path, image_paths, note,
    ai_done, ai_correct, ai_summary, ai_error, ai_evaluated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(user_id, homework_id) DO UPDATE SET
    image_path = excluded.image_path,
    image_paths = excluded.image_paths,
    note = excluded.note,
    ai_done = excluded.ai_done,
    ai_correct = excluded.ai_correct,
    ai_summary = excluded.ai_summary,
    ai_error = excluded.ai_error,
    ai_evaluated_at = excluded.ai_evaluated_at,
    created_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
`;
export function upsertSubmission(input: {
  userId: string;
  homeworkId: string;
  imagePaths: string[];
  note?: string | null;
  aiDone?: boolean | null;
  aiCorrect?: boolean | null;
  aiSummary?: string | null;
  aiError?: string | null;
  aiEvaluatedAt?: string | null;
}): void {
  if (input.imagePaths.length < 1 || input.imagePaths.length > 3) {
    throw new Error("Expected 1–3 photos");
  }
  stmt(UPSERT_SUBMISSION_SQL).run(
    newId(),
    input.userId,
    input.homeworkId,
    input.imagePaths[0],
    JSON.stringify(input.imagePaths),
    input.note ?? null,
    input.aiDone == null ? null : input.aiDone ? 1 : 0,
    input.aiCorrect == null ? null : input.aiCorrect ? 1 : 0,
    input.aiSummary ?? null,
    input.aiError ?? null,
    input.aiEvaluatedAt ?? null,
  );
}

// Commit the evidence and its completion decision together, only if no parent
// changed the status while evaluation was in flight (including done → undone).
export function commitSubmission(
  input: Parameters<typeof upsertSubmission>[0],
  expectedVersion: number,
): boolean {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const item = getHomeworkById(input.homeworkId);
    if (!item || item.done_at || item.completion_version !== expectedVersion) {
      db.exec("ROLLBACK");
      return false;
    }
    upsertSubmission(input);
    // A photographed solution is complete only when AI can confirm both that
    // the whole task is present and that it is correct. A partial or incorrect
    // solution remains active so the child can read the feedback and retry.
    if (input.aiDone && input.aiCorrect === true) {
      markHomeworkDone(input.homeworkId, input.userId, "ai");
    }
    db.exec("COMMIT");
    return true;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function getSubmission(userId: string, homeworkId: string): SubmissionWithUser | undefined {
  const row = stmt("SELECT * FROM submissions WHERE user_id = ? AND homework_id = ?").get(userId, homeworkId) as
    | (Omit<SubmissionWithUser, "user_name" | "user_role"> & { user_name?: string; user_role?: Role })
    | undefined;
  if (!row) return undefined;
  return { ...row, user_name: row.user_name ?? "", user_role: row.user_role ?? "kid" };
}

export function listSubmissionsForHomework(homeworkId: string): SubmissionWithUser[] {
  return stmt(`
  SELECT s.*, u.name AS user_name, u.role AS user_role
  FROM submissions s
  JOIN users u ON u.id = s.user_id
  WHERE s.homework_id = ?
  ORDER BY s.created_at ASC
`).all(homeworkId) as unknown as SubmissionWithUser[];
}

// ---------- Calendar events ----------

export function getCalendarEvent(
  userId: string,
  homeworkId: string,
): { id: string; google_event_id: string } | undefined {
  return stmt("SELECT * FROM calendar_events WHERE user_id = ? AND homework_id = ?").get(userId, homeworkId) as
    | { id: string; google_event_id: string }
    | undefined;
}

const UPSERT_CALENDAR_EVENT_SQL = `
  INSERT INTO calendar_events (id, user_id, homework_id, google_event_id)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(user_id, homework_id) DO UPDATE SET
    google_event_id = excluded.google_event_id,
    synced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
`;
export function upsertCalendarEvent(userId: string, homeworkId: string, googleEventId: string): void {
  stmt(UPSERT_CALENDAR_EVENT_SQL).run(newId(), userId, homeworkId, googleEventId);
}

export function deleteCalendarEvent(userId: string, homeworkId: string): void {
  stmt("DELETE FROM calendar_events WHERE user_id = ? AND homework_id = ?").run(userId, homeworkId);
}

export function getAssessmentCalendarEvent(
  userId: string,
  assessmentId: string,
): { id: string; google_event_id: string } | undefined {
  return stmt("SELECT * FROM assessment_calendar_events WHERE user_id = ? AND assessment_id = ?").get(userId, assessmentId) as
    | { id: string; google_event_id: string }
    | undefined;
}

const UPSERT_ASSESSMENT_CALENDAR_EVENT_SQL = `
  INSERT INTO assessment_calendar_events (id, user_id, assessment_id, google_event_id)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(user_id, assessment_id) DO UPDATE SET
    google_event_id = excluded.google_event_id,
    synced_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
`;
export function upsertAssessmentCalendarEvent(userId: string, assessmentId: string, googleEventId: string): void {
  stmt(UPSERT_ASSESSMENT_CALENDAR_EVENT_SQL).run(newId(), userId, assessmentId, googleEventId);
}

export function deleteAssessmentCalendarEvent(userId: string, assessmentId: string): void {
  stmt("DELETE FROM assessment_calendar_events WHERE user_id = ? AND assessment_id = ?").run(userId, assessmentId);
}

export function listRetiredAssessmentCalendarEvents(userId: string): Array<{ assessment_id: string; google_event_id: string }> {
  return stmt(`
    SELECT e.assessment_id, e.google_event_id
    FROM assessment_calendar_events e
    JOIN assessment_items a ON a.id = e.assessment_id
    WHERE e.user_id = ? AND a.active = 0
  `).all(userId) as unknown as Array<{ assessment_id: string; google_event_id: string }>;
}

// ---------- Scrape runs ----------

export function createScrapeRun(): string {
  const id = newId();
  stmt("INSERT INTO scrape_runs (id) VALUES (?)").run(id);
  return id;
}

const FINISH_SCRAPE_RUN_SQL = `
  UPDATE scrape_runs
  SET finished_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), status = ?, items_added = ?, items_changed = ?, error = ?
  WHERE id = ?
`;
export function finishScrapeRun(
  id: string,
  result: { status: "success" | "error"; itemsAdded: number; itemsChanged: number; error?: string | null },
): void {
  stmt(FINISH_SCRAPE_RUN_SQL).run(result.status, result.itemsAdded, result.itemsChanged, result.error ?? null, id);
}

export function getLatestScrapeRun(): ScrapeRunRow | undefined {
  return stmt("SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT 1").get() as ScrapeRunRow | undefined;
}
