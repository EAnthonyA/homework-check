// Database singleton using Node's built-in `node:sqlite` (DatabaseSync).
// Zero native dependencies; works in the Node 24 Docker image without build tools.
//
// The connection is opened lazily (on first use, not at import time) so that
// Next.js build workers that merely import this module never touch the DB file.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema";

const DB_PATH = process.env.DB_PATH ?? "./data/app.db";

let instance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (instance) return instance;

  if (DB_PATH !== ":memory:") {
    const file = path.resolve(process.cwd(), DB_PATH);
    mkdirSync(path.dirname(file), { recursive: true });
  }

  const database = new DatabaseSync(DB_PATH);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(SCHEMA_SQL);
  migrate(database);
  instance = database;
  return database;
}

// Idempotent column migrations for pre-existing databases: SCHEMA_SQL only
// creates tables if they don't exist, so columns added later need a manual
// ALTER TABLE guarded by PRAGMA table_info.
function migrate(database: DatabaseSync): void {
  const submissions = database.prepare("PRAGMA table_info(submissions)").all() as Array<{
    name: string;
  }>;
  const add = (name: string, definition: string) => {
    if (!submissions.some((c) => c.name === name)) {
      database.exec(`ALTER TABLE submissions ADD COLUMN ${definition}`);
    }
  };
  add("ai_done", "ai_done INTEGER");
  add("ai_correct", "ai_correct INTEGER");
  add("ai_summary", "ai_summary TEXT");
  add("ai_error", "ai_error TEXT");
  add("ai_evaluated_at", "ai_evaluated_at TEXT");
  add("image_paths", "image_paths TEXT");
  database.exec("UPDATE submissions SET image_paths = json_array(image_path) WHERE image_paths IS NULL");

  const homework = database.prepare("PRAGMA table_info(homework_items)").all() as Array<{
    name: string;
  }>;
  if (!homework.some((c) => c.name === "assigned_date")) {
    database.exec("ALTER TABLE homework_items ADD COLUMN assigned_date TEXT");
  }
  if (!homework.some((c) => c.name === "done_at")) {
    database.exec("ALTER TABLE homework_items ADD COLUMN done_at TEXT");
  }
  if (!homework.some((c) => c.name === "done_by")) {
    database.exec("ALTER TABLE homework_items ADD COLUMN done_by TEXT");
  }
  if (!homework.some((c) => c.name === "done_source")) {
    database.exec("ALTER TABLE homework_items ADD COLUMN done_source TEXT");
  }
  if (!homework.some((c) => c.name === "completion_version")) {
    database.exec("ALTER TABLE homework_items ADD COLUMN completion_version INTEGER NOT NULL DEFAULT 0");
  }

  const assessments = database.prepare("PRAGMA table_info(assessment_items)").all() as Array<{ name: string }>;
  if (assessments.length > 0 && !assessments.some((c) => c.name === "active")) {
    database.exec("ALTER TABLE assessment_items ADD COLUMN active INTEGER NOT NULL DEFAULT 1");
  }
}
