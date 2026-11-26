/* eslint-disable @typescript-eslint/no-require-imports */
const { DatabaseSync } = require("node:sqlite");

const args = process.argv.slice(2);
const days = Number(args.find((arg) => /^\d+$/.test(arg)) || "30");
if (!Number.isInteger(days) || days < 1 || days > 365 || args.some((arg) => !/^\d+$/.test(arg) && arg !== "--details")) {
  throw new Error("Usage: node audit.cjs [days 1-365] [--details]");
}
const details = args.includes("--details");
const since = new Date(Date.now() - days * 86400000).toISOString();
const db = new DatabaseSync(process.env.DB_PATH || "/data/app.db", { readOnly: true });
db.exec("PRAGMA query_only = ON");
const table = (name) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
const columns = new Set(db.prepare("PRAGMA table_info(submissions)").all().map((column) => column.name));
const field = (name) => columns.has(name) ? `s.${name}` : `NULL AS ${name}`;
const parse = (value) => {
  try { return value ? JSON.parse(value) : null; } catch { return null; }
};
const evidence = (value) => {
  if (!value || typeof value !== "object") return null;
  const raw = parse(value.rawResponse);
  return {
    model: value.model || null,
    taskTextVisibility: value.taskTextVisibility || "unknown",
    handwritingLegibility: value.handwritingLegibility || "unknown",
    checks: Array.isArray(value.checks) ? value.checks.map((check) => details ? {
      part: check.part, verdict: check.verdict, questionRead: check.questionRead,
      answerRead: check.answerRead, reason: check.reason,
    } : { part: check.part, verdict: check.verdict }) : [],
    notes: details && Array.isArray(value.notes) ? value.notes : undefined,
    rawVerdict: raw ? { done: raw.done, correct: raw.correct, canVerifyCorrectness: raw.canVerifyCorrectness } : null,
  };
};
const sql = `SELECT h.subject, h.description, h.due_date, h.done_at, h.done_source,
  s.homework_id, s.created_at, ${["ai_done", "ai_correct", "ai_can_verify_correctness", "ai_needs_clearer_photo", "ai_used_manual_task", "ai_error", "ai_summary", "ai_debug", "image_paths"].map(field).join(", ")}
  FROM submissions s JOIN homework_items h ON h.id = s.homework_id
  JOIN users u ON u.id = s.user_id WHERE u.role = 'kid' AND s.created_at >= ? ORDER BY s.created_at DESC`;
const cases = db.prepare(sql).all(since).map((row) => {
  const debug = parse(row.ai_debug);
  const paths = parse(row.image_paths);
  const result = {
    homeworkId: row.homework_id, submittedAt: row.created_at, subject: row.subject, dueDate: row.due_date,
    doneAt: row.done_at, doneSource: row.done_source, done: row.ai_done, correct: row.ai_correct,
    canVerify: row.ai_can_verify_correctness, needsClearerPhoto: row.ai_needs_clearer_photo,
    usedManualTask: row.ai_used_manual_task, hasError: Boolean(row.ai_error),
    photoCount: Array.isArray(paths) ? paths.length : 1,
    initialAssessmentRejected: debug?.initialAssessmentRejected === true,
    initial: evidence(debug), verification: evidence(debug?.verification), focusedRecheck: evidence(debug?.focusedRecheck),
  };
  if (details) {
    result.description = row.description;
    result.summary = row.ai_summary;
    result.error = row.ai_error;
  }
  return result;
});
const totals = db.prepare(`SELECT h.done_source, EXISTS(SELECT 1 FROM submissions s JOIN users u ON u.id=s.user_id
  WHERE s.homework_id=h.id AND u.role='kid') AS has_child_submission, COUNT(*) AS count
  FROM homework_items h WHERE h.done_at >= ? GROUP BY 1,2`).all(since);
let events = null;
if (table("homework_events")) {
  events = db.prepare("SELECT event_type, reason, COUNT(*) AS count FROM homework_events WHERE created_at >= ? GROUP BY event_type, reason ORDER BY count DESC").all(since);
}
const coverage = db.prepare("SELECT COUNT(*) AS total, MIN(created_at) AS earliest, MAX(created_at) AS latest FROM submissions").get();
console.log(JSON.stringify({ since, observedAt: new Date().toISOString(), lookbackDays: days, coverage, completions: totals,
  eventHistoryAvailable: table("homework_events"), events, latestChildSubmissions: cases }, null, 2));
db.close();
