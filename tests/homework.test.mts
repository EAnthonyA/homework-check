import assert from "node:assert/strict";
import { after, test, mock } from "node:test";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import { google } from "googleapis";
import { SCHEMA_SQL } from "../src/lib/schema";

const directory = mkdtempSync(path.join(tmpdir(), "homework-unit-"));
process.env.DB_PATH = path.join(directory, "test.db");
process.env.UPLOAD_DIR = path.join(directory, "uploads");
process.env.ENCRYPTION_KEY = "test-encryption-key-for-homework-1234567890";

// Start with the deployed single-image schema to exercise real startup migration.
const legacy = new DatabaseSync(process.env.DB_PATH);
legacy.exec(SCHEMA_SQL.replace("  image_paths TEXT,\n", "").replace("  done_source TEXT,\n", "").replace("  completion_version INTEGER NOT NULL DEFAULT 0,\n", ""));
legacy.exec(`
  INSERT INTO users (id, google_sub, email, name, role) VALUES ('kid', 'kid', 'kid@example.test', 'Vaikas', 'kid');
  INSERT INTO users (id, google_sub, email, name, role) VALUES ('parent', 'parent', 'parent@example.test', 'Tėvai', 'parent');
  INSERT INTO homework_items (id, source_id, subject, description, due_date, done_at, done_by)
    VALUES ('legacy', 'legacy', 'Matematika', 'Pratimai', '2020-01-01', '2020-01-01T12:00:00Z', 'parent');
  INSERT INTO submissions (id, user_id, homework_id, image_path) VALUES ('old', 'kid', 'legacy', '/api/uploads/old.jpg');
`);
legacy.close();

const repo = await import("../src/lib/repo");
const { getDb } = await import("../src/lib/db");
const { submissionView } = await import("../src/lib/submission-view");
const { validatePhotos, MAX_PHOTO_BYTES } = await import("../src/lib/upload-rules");
const { saveUpload, discardUnsavedUploads } = await import("../src/lib/uploads");
const { evaluateHomeworkImages } = await import("../src/lib/ai");
const { syncAllUsers, removeHomeworkFromCalendars } = await import("../src/lib/calendar");
const { encrypt } = await import("../src/lib/crypto");

after(() => {
  getDb().close();
  rmSync(directory, { recursive: true, force: true });
});

function homework(sourceId: string, dueDate = "2020-01-01") {
  return repo.upsertHomeworkItem({ sourceId, subject: "Matematika", description: "Puslapiai 1–3", dueDate }).item;
}

test("legacy photo migrates once, keeping unknown completion source neutral", () => {
  assert.deepEqual(submissionView(repo.getSubmission("kid", "legacy")!).imagePaths, ["/api/uploads/old.jpg"]);
  assert.equal(repo.getHomeworkById("legacy")!.done_source, null);
  execFileSync(process.execPath, ["--import", "tsx", "-e", "require('./src/lib/db.ts').getDb().close()"], { env: process.env });
  assert.equal(repo.getSubmission("kid", "legacy")!.image_paths, '["/api/uploads/old.jpg"]');
});

test("latest complete photo set and AI verdict replace the previous attempt atomically", () => {
  const item = homework("replace");
  const first = { userId: "kid", homeworkId: item.id, imagePaths: ["/a.jpg"], aiDone: false };
  assert.equal(repo.commitSubmission(first, 0), true);
  assert.equal(repo.commitSubmission({ ...first, imagePaths: ["/b.jpg", "/c.jpg", "/d.jpg"], aiDone: true, aiCorrect: false, aiSummary: "Yra klaidų" }, 0), true);
  const saved = submissionView(repo.getSubmission("kid", item.id)!);
  assert.deepEqual(saved.imagePaths, ["/b.jpg", "/c.jpg", "/d.jpg"]);
  assert.equal(saved.imagePath, "/b.jpg");
  assert.equal(saved.aiCorrect, false);
  assert.equal(repo.listSubmissionsForHomework(item.id).length, 1);
  assert.equal(repo.getHomeworkById(item.id)!.done_source, "ai");
  assert.ok(repo.listHomeworkHistory().some((entry) => entry.id === item.id));
});

test("undo preserves evidence, restores overdue visibility, and is idempotent", () => {
  const item = homework("undo");
  repo.commitSubmission({ userId: "kid", homeworkId: item.id, imagePaths: ["/proof.jpg"], aiDone: true }, 0);
  repo.markHomeworkDone(item.id, "parent");
  assert.equal(repo.getHomeworkById(item.id)!.done_source, "ai");
  repo.reopenHomework(item.id);
  repo.reopenHomework(item.id);
  const reopened = repo.getHomeworkById(item.id)!;
  assert.equal(reopened.completion_version, 2);
  assert.equal(reopened.done_at, null);
  assert.equal(reopened.done_by, null);
  assert.equal(reopened.done_source, null);
  assert.equal(repo.getSubmission("kid", item.id)!.ai_done, 1);
  assert.ok(repo.listUnfinishedHomework().some((entry) => entry.id === item.id));
  assert.ok(!repo.listHomeworkHistory().some((entry) => entry.id === item.id));
});

test("an in-flight AI result cannot overwrite parent completion or a complete/reopen cycle", () => {
  const item = homework("race");
  const input = { userId: "kid", homeworkId: item.id, imagePaths: ["/stale.jpg"], aiDone: true };
  repo.markHomeworkDone(item.id, "parent");
  assert.equal(repo.commitSubmission(input, 0), false);
  assert.equal(repo.getHomeworkById(item.id)!.done_source, "parent");
  repo.reopenHomework(item.id);
  assert.equal(repo.commitSubmission(input, 0), false);
  assert.equal(repo.getSubmission("kid", item.id), undefined);
  assert.equal(repo.commitSubmission(input, 2), true);
});

test("missing or failed AI evaluation saves photos without completing homework", () => {
  for (const aiError of [null, "Evaluation failed"]) {
    const item = homework(`ai-${aiError}`);
    assert.equal(repo.commitSubmission({ userId: "kid", homeworkId: item.id, imagePaths: ["/1.jpg", "/2.jpg"], aiDone: null, aiError }, 0), true);
    assert.equal(repo.getHomeworkById(item.id)!.done_at, null);
    assert.equal(repo.getSubmission("kid", item.id)!.ai_error, aiError);
  }
});

test("photo rules accept 1–3 files and reject invalid sets before saving", async () => {
  const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
  for (const count of [1, 2, 3]) assert.doesNotThrow(() => validatePhotos(Array(count).fill(file)));
  for (const files of [[], [file, file, file, file], [new File([], "empty.jpg", { type: "image/jpeg" })],
    [file, new File(["no"], "bad.txt", { type: "text/plain" })],
    [new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "big.jpg", { type: "image/jpeg" })]]) {
    assert.throws(() => validatePhotos(files));
  }
  const saved = await saveUpload(file);
  assert.equal(readdirSync(process.env.UPLOAD_DIR!).length, 1);
  discardUnsavedUploads([saved.imagePath]);
  assert.equal(readdirSync(process.env.UPLOAD_DIR!).length, 0);
});

test("Gemini receives all pages in one request and returns one combined verdict", async (t) => {
  process.env.GEMINI_API_KEY = "test-key";
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    requests++;
    const body = JSON.parse(String(init.body));
    const images = body.contents[0].parts.filter((part: { inlineData?: unknown }) => part.inlineData);
    assert.equal(images.length, 3);
    assert.deepEqual(images.map((part: { inlineData: { data: string } }) => part.inlineData.data), ["AQ==", "Ag==", "Aw=="]);
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"done":true,"correct":false,"summary":"Patikrink atsakymą."}' }] } }] });
  });
  const verdict = await evaluateHomeworkImages({ images: [1, 2, 3].map((n) => ({ imageBytes: new Uint8Array([n]), mimeType: "image/jpeg" })), subject: "Matematika", description: "Trys puslapiai", details: null });
  assert.equal(requests, 1);
  assert.deepEqual(verdict, { done: true, correct: false, summary: "Patikrink atsakymą." });
});

test("calendar undo restores original dates once and respects preferences", async () => {
  repo.updateRefreshToken("kid", encrypt("test-token"));
  repo.setCalendarEnabled("parent", false);
  const item = homework("calendar", "2020-02-03");
  let inserts = 0;
  const requestBodies: unknown[] = [];
  const calendarMock = mock.method(google as unknown as { calendar: () => unknown }, "calendar", () => ({ events: {
    insert: async ({ requestBody }: { requestBody: unknown }) => { requestBodies.push(requestBody); return { data: { id: `event-${++inserts}` } }; },
    get: async () => ({ data: requestBodies.at(-1) }),
    delete: async () => ({}),
  } }) as unknown as ReturnType<typeof google.calendar>);
  try {
    await syncAllUsers([item]);
    repo.markHomeworkDone(item.id, "parent");
    await removeHomeworkFromCalendars(item.id);
    assert.equal(repo.getCalendarEvent("kid", item.id), undefined);
    repo.reopenHomework(item.id);
    assert.equal((await syncAllUsers([item])).created, 1);
    assert.equal((await syncAllUsers([item])).created, 0);
    assert.equal(inserts, 2);
    assert.deepEqual(requestBodies[0], requestBodies[1]);
    assert.equal(repo.getCalendarEvent("parent", item.id), undefined);
  } finally { calendarMock.mock.restore(); }
});

test("calendar failures preserve reopened state and cancelled events are recreated", async () => {
  const item = homework("calendar-failure");
  repo.markHomeworkDone(item.id, "parent");
  repo.reopenHomework(item.id);
  repo.upsertCalendarEvent("kid", item.id, "cancelled-event");
  let fail = true;
  const calendarMock = mock.method(google as unknown as { calendar: () => unknown }, "calendar", () => ({ events: {
    get: async () => ({ data: { status: "cancelled" } }),
    insert: async () => {
      if (fail) throw new Error("Simulated calendar outage");
      return { data: { id: "restored-event" } };
    },
  } }));
  const logger = mock.method(console, "error", () => {});
  try {
    assert.equal((await syncAllUsers([item])).failed, 1);
    assert.equal(repo.getHomeworkById(item.id)!.done_at, null);
    fail = false;
    assert.equal((await syncAllUsers([item])).created, 1);
    assert.equal(repo.getCalendarEvent("kid", item.id)!.google_event_id, "restored-event");
  } finally {
    calendarMock.mock.restore();
    logger.mock.restore();
  }
});

test("reopening while calendar deletion is in flight restores the event afterward", async () => {
  const item = homework("calendar-race");
  repo.upsertCalendarEvent("kid", item.id, "old-event");
  repo.markHomeworkDone(item.id, "parent");
  let deletionStarted!: () => void;
  const started = new Promise<void>((resolve) => { deletionStarted = resolve; });
  let finishDeletion!: () => void;
  const pending = new Promise<void>((resolve) => { finishDeletion = resolve; });
  const operations: string[] = [];
  const calendarMock = mock.method(google as unknown as { calendar: () => unknown }, "calendar", () => ({ events: {
    delete: async () => { operations.push("delete"); deletionStarted(); await pending; },
    insert: async () => { operations.push("insert"); return { data: { id: "new-event" } }; },
  } }));
  try {
    const removal = removeHomeworkFromCalendars(item.id);
    await started;
    repo.reopenHomework(item.id);
    const restoration = syncAllUsers([item]);
    finishDeletion();
    await Promise.all([removal, restoration]);
    assert.deepEqual(operations, ["delete", "insert"]);
    assert.equal(repo.getCalendarEvent("kid", item.id)!.google_event_id, "new-event");
  } finally { calendarMock.mock.restore(); }
});
