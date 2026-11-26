import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SignJWT } from "jose";
import { SCHEMA_SQL } from "../src/lib/schema";

const live = process.env.HOMEWORK_LIVE_GRADING === "1";
const modulePath = process.env.HOMEWORK_PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(modulePath);
const directory = mkdtempSync(path.join(tmpdir(), "homework-quality-db-"));
const screenshots = mkdtempSync(path.join(tmpdir(), "homework-quality-results-"));
const db = new DatabaseSync(path.join(directory, "app.db"));
const secret = randomUUID();
const fixtures = [
  { id: "correct", subject: "Matematika", description: "Apskaičiuok 12 + 7.", question: "1. Apskaičiuok 12 + 7.", answer: "19", fixed: "" },
  { id: "grammar", subject: "Anglų kalba", description: "Atlik 2 pratimo 5 klausimą.", question: "2 (5). ___ Dan and Lisa watch TV?", answer: "Does", fixed: "Do" },
  { id: "missing", subject: "Matematika", description: "Atlik U307 uždavinį.", question: "U307. Apskaičiuok 8 × 4.", answer: "", fixed: "32" },
  { id: "false-allegation", subject: "Matematika", description: "Išspręsk K39.", question: "K39. Apskaičiuok (12 + 15) × 2.", answer: "54", fixed: "" },
  { id: "unclear", subject: "Matematika", description: "Išspręsk U266.", question: "U266. Ar 135 dalijasi iš 5?", answer: "taip", fixed: "taip" },
  { id: "unavailable", subject: "Anglų kalba", description: "Atlik 3 pratimo 1 klausimą.", question: "3 (1). ___ Dan and Lisa watch TV?", answer: "Does", fixed: "Do" },
];
const images = new Map<string, { id: string; corrected: boolean }>();
const calls = new Map<string, number>();
let app: ReturnType<typeof spawn> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let provider: ReturnType<typeof createServer> | undefined;

async function listen(server: ReturnType<typeof createServer>): Promise<number> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No local port");
  return address.port;
}

function evaluation(id: string, corrected: boolean, verifier: boolean) {
  const fixture = fixtures.find(item => item.id === id)!;
  const missing = id === "missing" && !corrected;
  const wrong = (id === "grammar" || id === "unclear" || id === "unavailable") && !corrected;
  const part = id === "grammar" ? (verifier ? "2 užduoties 5 dalis" : "Grammar 2 (5)")
    : id === "unavailable" ? "3 (1)" : id === "false-allegation" ? "K39" : "U266";
  const summary = missing ? "Įkelk savo sprendimo nuotrauką." : wrong
    ? "Patikrink pagalbinį veiksmažodį prie dviejų asmenų." : "Atlikta teisingai.";
  return {
    done: !missing, canVerifyCorrectness: !missing, correct: missing ? null : !wrong, summary,
    goodParts: [], needsWork: wrong ? [part + " — " + summary] : [],
    debug: { taskTextVisibility: "clear", handwritingLegibility: "clear", notes: [],
      checks: missing ? [] : [{ part, verdict: wrong ? "incorrect" : "correct",
        questionRead: fixture.question, answerRead: corrected ? fixture.fixed : fixture.answer, reason: summary }] },
  };
}

async function launchApp(env: NodeJS.ProcessEnv) {
  const probe = createServer();
  const port = await listen(probe);
  await new Promise<void>(resolve => probe.close(() => resolve()));
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
    env: { ...process.env, ...env, DB_PATH: path.join(directory, "app.db"),
      UPLOAD_DIR: path.join(directory, "uploads"), SESSION_SECRET: secret,
      SCRAPE_CRON: "0 0 1 1 *", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const child = app;
  await new Promise<void>((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("Server startup timed out: " + output)), 30_000);
    child.stdout!.on("data", chunk => {
      output += chunk.toString();
      if (output.includes("Ready in")) { clearTimeout(timer); resolve(); }
    });
    child.stderr!.on("data", chunk => { output += chunk.toString(); });
    child.once("exit", () => { clearTimeout(timer); reject(new Error("Server exited: " + output)); });
    child.once("error", reject);
  });
  return "http://127.0.0.1:" + port;
}

async function main() {
  if (live && !process.env.GEMINI_API_KEY) throw new Error("Set GEMINI_API_KEY for live grading.");
  db.exec(SCHEMA_SQL);
  db.exec("INSERT INTO users (id, google_sub, email, name, role) VALUES ('kid','kid','kid@example.test','Mokinys','kid')");
  const env: NodeJS.ProcessEnv = { NODE_ENV: "production" };
  if (!live) {
    provider = createServer(async (req, res) => {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString());
        const imageParts = body.contents[0].parts.filter((p: { inlineData?: unknown }) => p.inlineData);
        const data = imageParts.at(-1).inlineData.data;
        const fixture = images.get(data);
        assert.ok(fixture, "Unexpected image sent to grader");
        if (fixture.id === "missing" && fixture.corrected) assert.equal(imageParts.length, 2, "Retry should retain the question photo");
        const verifier = Boolean(req.url?.includes("quality-verifier"));
        const count = calls.get(fixture.id) ?? 0;
        calls.set(fixture.id, count + 1);
        if (fixture.id === "unavailable" && verifier && count === 1) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { code: 503, status: "UNAVAILABLE", message: "offline" } }));
          return;
        }
        const result = evaluation(fixture.id, fixture.corrected, verifier);
        if (fixture.id === "grammar" && !fixture.corrected && !verifier) {
          result.debug.checks[0].answerRead = "Atsakymas: Does";
        }
        if (fixture.id === "false-allegation" && count === 0) {
          result.correct = false;
          result.needsWork = ["K39 — pasitikrink skaičius"];
          result.debug.checks[0].verdict = "incorrect";
          result.debug.checks[0].questionRead = "K39. Apskaičiuok (12 + 5) × 4.";
        }
        if (fixture.id === "unclear" && verifier && !fixture.corrected) {
          result.debug.checks[0].answerRead = "neįskaitoma";
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] }));
      } catch (error) {
        console.error("Replay error", error);
        res.writeHead(500).end();
      }
    });
    const port = await listen(provider);
    Object.assign(env, { GEMINI_API_KEY: "local-test-key", GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:" + port,
      GEMINI_VISION_MODEL: "quality-primary", GEMINI_VERIFIER_MODEL: "quality-verifier" });
  }
  const base = await launchApp(env);
  browser = await chromium.launch({ headless: true, executablePath: process.env.HOMEWORK_CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 393, height: 873 }, deviceScaleFactor: 2.75,
    isMobile: true, hasTouch: true, locale: "lt-LT", reducedMotion: "reduce" });
  const token = await new SignJWT({ role: "kid", name: "Mokinys", email: "kid@example.test" })
    .setSubject("kid").setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
  await context.addCookies([{ name: "auth-token", value: token, url: base }]);
  let failed = 0;

  for (const fixture of fixtures.filter((item) => !live || !["unclear", "unavailable"].includes(item.id))) {
    db.prepare("INSERT INTO homework_items (id, source_id, subject, description, due_date) VALUES (?,?,?,?,?)")
      .run(fixture.id, fixture.id, fixture.subject, fixture.description, "2020-01-01");
    const page = await context.newPage();
    try {
      await page.goto(base + "/kid");
      const card = page.locator("article").filter({ hasText: fixture.description });
      await card.waitFor();
      const submit = async (corrected: boolean) => {
        const sheet = await context.newPage();
        await sheet.setViewportSize({ width: 900, height: 1200 });
        await sheet.setContent('<main style="box-sizing:border-box;width:800px;height:1100px;font:36px Arial;padding:40px;background:white;display:flex;flex-direction:column;justify-content:center"><h3></h3><p></p><b></b></main>');
        await sheet.evaluate(({ question, answer }: { question: string; answer: string }) => {
          document.querySelector("h3")!.textContent = "Namų darbai";
          document.querySelector("p")!.textContent = question;
          document.querySelector("b")!.textContent = answer ? "Atsakymas: " + answer : "";
        }, { question: fixture.question, answer: corrected ? fixture.fixed : fixture.answer });
        const image = await sheet.locator("main").screenshot();
        await sheet.close();
        images.set(image.toString("base64"), { id: fixture.id, corrected });
        await card.getByRole("button", { name: /Atlikau — pateikti|Pateikti iš naujo/ }).click();
        if (corrected && ["grammar", "unclear", "unavailable"].includes(fixture.id)) {
          await card.getByRole("button", { name: "Pašalinti išsaugotą 1 nuotrauką" }).click();
        }
        await card.locator('input[type="file"][multiple]').setInputFiles({ name: "darbas.png", mimeType: "image/png", buffer: image });
        await card.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(screenshots, fixture.id + (corrected ? "-selected-retry" : "-selected") + ".png"), fullPage: true, animations: "disabled" });
        const response = page.waitForResponse((r: { url(): string; request(): { method(): string } }) =>
          new URL(r.url()).pathname === "/api/upload" && r.request().method() === "POST", { timeout: 150_000 });
        await card.getByRole("button", { name: "Pateikti vertinimui" }).click();
        const result = await response;
        assert.equal(result.status(), 200);
        const body = await result.json();
        assert.ok(body.ai && !body.aiError, "Grader unavailable; inspect server logs");
        await page.reload();
        await page.getByRole("heading", { name: "Mano namų darbai" }).waitFor();
        await page.screenshot({ path: path.join(screenshots, fixture.id + (corrected ? "-retry" : "-feedback") + ".png"), fullPage: true, animations: "disabled" });
        return body;
      };
      const result = await submit(false);
      if (fixture.id === "correct" || fixture.id === "false-allegation") {
        assert.equal(result.completed, true, "Correct work should complete");
      } else {
        assert.equal(result.completed, false, "Unfinished work should remain open");
        const text = await card.innerText();
        if (fixture.id === "unavailable") {
          assert.match(text, /dar kartą/iu, "Verifier failure should offer a retry");
          await card.getByRole("button", { name: /Pateikti iš naujo/ }).click();
          const retry = page.waitForResponse((r: { url(): string; request(): { method(): string } }) =>
            new URL(r.url()).pathname === "/api/upload" && r.request().method() === "POST", { timeout: 150_000 });
          await card.getByRole("button", { name: "Pateikti vertinimui" }).click();
          assert.equal((await retry).status(), 200);
          await page.reload();
          await card.getByRole("heading", { name: "Padėk man suprasti" }).waitFor();
        } else if (fixture.id === "grammar") {
          assert.ok(/pagalbin|veiksmažod|daugiskait/i.test(text) && !text.includes("tėvų peržiūrai"),
            "Child needs a specific grammar hint instead of parent review");
          assert.equal(await card.getByRole("heading", { name: "Padėk man suprasti" }).isVisible(), true);
        } else if (fixture.id === "missing") {
          const feedback = text.split("AI vertinimas")[1]?.split("Pateikti iš naujo")[0] ?? "";
          assert.match(feedback, /(?:įkelk|įkelti|pridėk|pateik|pateikti|nufotografuok|nufotografuoti)[^.\n]*(?:sprendim|atsakym)/iu,
            "Child needs a request for the solution page");
        } else {
          assert.match(text, /arčiau|aiškiau/iu, "Ambiguous answer should request clearer evidence");
        }
        const retry = await submit(true);
        assert.equal(retry.completed, true, "Corrected work should complete");
      }
      assert.equal(db.prepare("SELECT done_source FROM homework_items WHERE id=?").get(fixture.id)?.done_source, "ai");
      console.log("PASS", fixture.id);
    } catch (error) {
      failed++;
      const submission = db.prepare("SELECT ai_summary, ai_debug, ai_error FROM submissions WHERE homework_id = ?").get(fixture.id);
      writeFileSync(path.join(screenshots, fixture.id + "-evidence.json"), JSON.stringify(submission, null, 2));
      await page.screenshot({ path: path.join(screenshots, fixture.id + "-failure.png"), fullPage: true }).catch(() => {});
      console.error("FAIL", fixture.id, error instanceof Error ? error.message : error);
    } finally {
      await page.close();
    }
  }
  console.log("Mode:", live ? "live Gemini" : "replayed Gemini");
  console.log("Screenshots:", screenshots);
  if (failed) process.exitCode = 1;
}

try {
  await main();
} finally {
  if (browser) {
    await Promise.race([
      browser.close(),
      new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }
  if (app && app.exitCode === null && app.signalCode === null) {
    const stopped = once(app, "exit");
    app.kill();
    const forceStop = setTimeout(() => app?.kill("SIGKILL"), 5_000);
    await stopped;
    clearTimeout(forceStop);
  }
  if (provider) await new Promise<void>(resolve => provider!.close(() => resolve()));
  db.close();
  rmSync(directory, { recursive: true, force: true });
}
process.exit(process.exitCode || 0);
