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
  created_at: string;
  updated_at: string;
}

export interface SubmissionWithUser {
  id: string;
  user_id: string;
  homework_id: string;
  image_path: string;
  note: string | null;
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
  INSERT INTO homework_items (id, source_id, subject, description, due_date, details)
  VALUES (?, ?, ?, ?, ?, ?)
`;
const UPDATE_HOMEWORK_SQL = `
  UPDATE homework_items
  SET subject = ?, description = ?, due_date = ?, details = ?,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE id = ?
`;

export function upsertHomeworkItem(input: {
  sourceId: string;
  subject: string;
  description: string;
  dueDate: string;
  details?: string | null;
}): { item: HomeworkRow; created: boolean; changed: boolean } {
  const existing = getHomeworkBySourceId(input.sourceId);
  if (existing) {
    const changed =
      existing.subject !== input.subject ||
      existing.description !== input.description ||
      existing.due_date !== input.dueDate ||
      (existing.details ?? null) !== (input.details ?? null);
    if (changed) {
      stmt(UPDATE_HOMEWORK_SQL).run(input.subject, input.description, input.dueDate, input.details ?? null, existing.id);
      return { item: getHomeworkBySourceId(input.sourceId)!, created: false, changed: true };
    }
    return { item: existing, created: false, changed: false };
  }
  stmt(INSERT_HOMEWORK_SQL).run(newId(), input.sourceId, input.subject, input.description, input.dueDate, input.details ?? null);
  return { item: getHomeworkBySourceId(input.sourceId)!, created: true, changed: false };
}

export function getHomeworkById(id: string): HomeworkRow | undefined {
  return stmt("SELECT * FROM homework_items WHERE id = ?").get(id) as HomeworkRow | undefined;
}

export function listHomeworkByDate(date: string): HomeworkRow[] {
  return stmt("SELECT * FROM homework_items WHERE due_date = ? ORDER BY subject ASC").all(date) as unknown as HomeworkRow[];
}

export function listHomeworkFrom(date: string): HomeworkRow[] {
  return stmt("SELECT * FROM homework_items WHERE due_date >= ? ORDER BY due_date ASC, subject ASC").all(date) as unknown as HomeworkRow[];
}

export function listAllHomework(): HomeworkRow[] {
  return stmt("SELECT * FROM homework_items ORDER BY due_date ASC, subject ASC").all() as unknown as HomeworkRow[];
}

// ---------- Submissions ----------

const UPSERT_SUBMISSION_SQL = `
  INSERT INTO submissions (id, user_id, homework_id, image_path, note)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(user_id, homework_id) DO UPDATE SET
    image_path = excluded.image_path,
    note = excluded.note,
    created_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
`;
export function upsertSubmission(userId: string, homeworkId: string, imagePath: string, note?: string | null): void {
  stmt(UPSERT_SUBMISSION_SQL).run(newId(), userId, homeworkId, imagePath, note ?? null);
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
