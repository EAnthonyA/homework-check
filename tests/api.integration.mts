import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SignJWT } from "jose";
import { SCHEMA_SQL } from "../src/lib/schema";

test("authenticated upload, history and undo against the production server", { timeout: 120_000 }, async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "homework-api-"));
  const dbPath = path.join(directory, "test.db");
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA_SQL);
  db.exec(`
    INSERT INTO users (id, google_sub, email, name, role, calendar_enabled) VALUES ('parent', 'parent', 'parent@example.test', 'Tėvai', 'parent', 0);
    INSERT INTO users (id, google_sub, email, name, role, calendar_enabled) VALUES ('kid', 'kid', 'kid@example.test', 'Vaikas', 'kid', 0);
    INSERT INTO homework_items (id, source_id, subject, description, due_date) VALUES ('overdue', 'overdue', 'Matematika', 'Trys puslapiai', '2020-01-01');
  `);
  db.close();
  const secret = "integration-test-session-secret-123456789";
  async function cookie(role: string) {
    const token = await new SignJWT({ role, name: role, email: `${role}@example.test` })
      .setProtectedHeader({ alg: "HS256" }).setSubject(role).setExpirationTime("10m")
      .sign(new TextEncoder().encode(secret));
    return `auth-token=${token}`;
  }
  const parent = await cookie("parent");
  const kid = await cookie("kid");
  const port = 33000 + Math.floor(Math.random() * 10000);
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    env: { ...process.env, DB_PATH: dbPath, UPLOAD_DIR: path.join(directory, "uploads"),
      SESSION_SECRET: secret, GEMINI_API_KEY: "", SCRAPE_CRON: "0 0 1 1 *", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    if (server.exitCode === null) {
      const exited = new Promise<void>((resolve) => server.once("exit", () => resolve()));
      server.kill("SIGTERM");
      await exited;
    }
    rmSync(directory, { recursive: true, force: true });
  });
  await new Promise<void>((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${output}`)), 30_000);
    server.on("error", reject);
    server.once("exit", () => { clearTimeout(timer); reject(new Error(`Server exited: ${output}`)); });
    const capture = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes("Ready in")) { clearTimeout(timer); resolve(); }
    };
    server.stdout.on("data", capture);
    server.stderr.on("data", capture);
  });

  async function request(url: string, session?: string, init: RequestInit = {}) {
    return fetch(`${base}${url}`, { ...init, headers: { ...init.headers, ...(session ? { cookie: session } : {}) } });
  }
  function photos(count: number, invalid = false) {
    const form = new FormData();
    form.append("homeworkId", "overdue");
    for (let index = 0; index < count; index++) {
      form.append("file", new File([`page ${index}`], `${index}.jpg`, { type: invalid && index === count - 1 ? "text/plain" : "image/jpeg" }));
    }
    return form;
  }
  await t.test("parent-only mutations/history and authenticated photos", async () => {
    assert.equal((await request("/api/homework/overdue/done", undefined, { method: "DELETE" })).status, 401);
    assert.equal((await request("/api/homework/overdue/done", kid, { method: "DELETE" })).status, 403);
    assert.equal((await request("/api/homework/overdue/done", kid, { method: "POST" })).status, 403);
    assert.equal((await request("/api/homework/missing/done", parent, { method: "DELETE" })).status, 404);
    assert.equal((await request("/api/homework/history", kid)).status, 403);
    assert.equal((await request("/api/upload", undefined, { method: "POST", body: photos(1) })).status, 401);
  });
  await t.test("single-photo compatibility, three-photo replacement, and invalid-set rollback", async () => {
    const single = await request("/api/upload", kid, { method: "POST", body: photos(1) });
    assert.equal(single.status, 200);
    const response = await request("/api/upload", kid, { method: "POST", body: photos(3) });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.imagePaths.length, 3);
    assert.equal(result.imagePath, result.imagePaths[0]);
    assert.equal(result.completed, false);
    assert.equal(result.ai, null);
    assert.equal((await request(result.imagePath)).status, 401);
    const uploadedImage = await request(result.imagePath, parent);
    assert.equal(uploadedImage.status, 200);
    assert.equal(uploadedImage.headers.get("cache-control"), "private, no-store");
    for (const body of [photos(0), photos(4), photos(2, true)]) {
      assert.equal((await request("/api/upload", kid, { method: "POST", body })).status, 400);
    }
    const today = await (await request("/api/homework/today", kid)).json();
    assert.equal(today.items[0].mineDone, false);
    assert.equal(today.items[0].submissions.length, 1);
    assert.deepEqual(today.items[0].submissions[0].imagePaths, result.imagePaths);
  });
  await t.test("completion evidence and repeated undo restore overdue work without losing photos", async () => {
    assert.equal((await request("/api/homework/overdue/done", parent, { method: "POST" })).status, 200);
    const history = await (await request("/api/homework/history", parent)).json();
    assert.equal(history.items.length, 1);
    assert.equal(history.items[0].doneSource, "parent");
    assert.equal(history.items[0].submissions[0].imagePaths.length, 3);
    assert.equal((await request("/api/upload", kid, { method: "POST", body: photos(1) })).status, 409);
    assert.equal((await (await request("/api/homework/today", kid)).json()).items.length, 0);
    for (let index = 0; index < 2; index++) {
      const response = await request("/api/homework/overdue/done", parent, { method: "DELETE" });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).calendarFailed, 0);
    }
    assert.equal((await (await request("/api/homework/history", parent)).json()).items.length, 0);
    for (const session of [parent, kid]) {
      const today = await (await request("/api/homework/today", session)).json();
      assert.equal(today.items[0].id, "overdue");
      assert.equal(today.items[0].submissions[0].imagePaths.length, 3);
      assert.equal(today.items[0].mineDone, false);
    }
  });

  // Optional browser coverage using an installed Playwright module, without
  // requiring browser binaries for the normal HTTP integration suite.
  if (process.env.HOMEWORK_PLAYWRIGHT_MODULE) {
    await t.test("mobile photo drafts, retry, parent evidence, and undo", async () => {
      const { chromium } = await import(process.env.HOMEWORK_PLAYWRIGHT_MODULE!);
      const browser = await chromium.launch({ headless: true });
      try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        await context.addCookies([{ name: "auth-token", value: kid.slice("auth-token=".length), url: base }]);
        const page = await context.newPage();
        const browserErrors: string[] = [];
        page.on("pageerror", (error: Error) => browserErrors.push(error.message));
        await page.goto(`${base}/kid`);
        await page.getByText("Vėluojantys darbai", { exact: true }).waitFor();
        const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2WQAAAABJRU5ErkJggg==", "base64");
        const file = (name: string) => ({ name, mimeType: "image/png", buffer: png });
        await page.locator('input[capture="environment"]').setInputFiles(file("page1.png"));
        await page.locator('input[multiple]').setInputFiles([file("page2.png"), file("page3.png")]);
        assert.equal(await page.getByRole("button", { name: "Iš galerijos" }).isDisabled(), true);
        await page.getByRole("button", { name: "Pašalinti 2 nuotrauką" }).click();
        await page.locator('input[multiple]').setInputFiles(file("replacement.png"));
        await page.setViewportSize({ width: 320, height: 740 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        if (process.env.HOMEWORK_SCREENSHOT_DIR) {
          await page.screenshot({ path: path.join(process.env.HOMEWORK_SCREENSHOT_DIR, "homework-kid.png"), fullPage: true });
        }
        await page.route("**/api/upload", (route: { fulfill: (value: unknown) => Promise<void> }) => route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"Bandomoji klaida"}' }));
        await page.getByRole("button", { name: "Pateikti vertinimui" }).click();
        await page.getByRole("alert").filter({ hasText: "Bandomoji klaida" }).waitFor();
        assert.equal(await page.getByRole("button", { name: /Pašalinti \d nuotrauką/ }).count(), 3);
        await page.unroute("**/api/upload");
        await page.getByRole("button", { name: "Pateikti vertinimui" }).click();
        await page.getByRole("status").filter({ hasText: "Nuotraukos išsaugotos" }).waitFor();
        assert.equal(await page.getByRole("button", { name: /Pašalinti \d nuotrauką/ }).count(), 0);
        await context.addCookies([{ name: "auth-token", value: parent.slice("auth-token=".length), url: base }]);
        await page.goto(`${base}/dashboard`);
        await page.getByRole("button", { name: "Pažymėti kaip atliktą" }).click();
        await page.getByRole("status").waitFor();
        await page.goto(`${base}/history`);
        await page.getByText(/Tėvų pažymėta kaip atlikta/).waitFor();
        assert.equal(await page.getByRole("link", { name: /atverti visą dydį/ }).count(), 3);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        if (process.env.HOMEWORK_SCREENSHOT_DIR) {
          await page.screenshot({ path: path.join(process.env.HOMEWORK_SCREENSHOT_DIR, "homework-history.png"), fullPage: true });
        }
        await page.getByRole("button", { name: "Pažymėti kaip neatliktą" }).click();
        await page.getByRole("status").filter({ hasText: "Darbas grąžintas" }).waitFor();
        assert.deepEqual(browserErrors, []);
      } finally { await browser.close(); }
    });
  }
});
