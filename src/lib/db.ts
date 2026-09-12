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
  instance = database;
  return database;
}
