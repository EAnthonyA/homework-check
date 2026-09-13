// Scraper orchestration: login -> fetch homework page -> parse -> upsert into DB.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CookieJar } from "./cookie-jar";
import { login, fetchHomeworkPage } from "./source";
import { parseHomework } from "./parse";
import { createScrapeRun, finishScrapeRun, upsertHomeworkItem, type HomeworkRow } from "../repo";
import { sanitizeFreeText } from "../sanitize";

export interface ScrapeResult {
  itemsAdded: number;
  itemsChanged: number;
  items: HomeworkRow[];
}

function dumpHtml(html: string): void {
  if (process.env.SCRAPER_DEBUG !== "1") return;
  const dir = path.resolve(process.cwd(), "data/debug");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `homework-${new Date().toISOString().replace(/[:.]/g, "-")}.html`);
  writeFileSync(file, html);
  console.log(`[scraper] debug HTML written to ${file}`);
}

export async function runScrape(): Promise<ScrapeResult> {
  const runId = createScrapeRun();
  let itemsAdded = 0;
  let itemsChanged = 0;
  const items: HomeworkRow[] = [];

  try {
    const jar = new CookieJar();
    await login(jar);
    const html = await fetchHomeworkPage(jar);
    dumpHtml(html);

    const parsed = parseHomework(html);
    if (parsed.length === 0) {
      throw new Error("No homework entries parsed — check SCRAPER_DEBUG HTML dump and tune src/lib/scraper/parse.ts");
    }

    for (const p of parsed) {
      const sourceId = createHash("sha256")
        .update(`${p.dueDate}|${p.subject}|${p.description}`)
        .digest("hex")
        .slice(0, 32);
      const result = upsertHomeworkItem({
        sourceId,
        subject: sanitizeFreeText(p.subject, 200),
        description: sanitizeFreeText(p.description, 2000),
        dueDate: p.dueDate,
        assignedDate: p.assignedDate,
        details: p.details ? sanitizeFreeText(p.details, 2000) : null,
      });
      items.push(result.item);
      if (result.created) itemsAdded += 1;
      else if (result.changed) itemsChanged += 1;
    }

    finishScrapeRun(runId, { status: "success", itemsAdded, itemsChanged });
    return { itemsAdded, itemsChanged, items };
  } catch (err) {
    finishScrapeRun(runId, {
      status: "error",
      itemsAdded,
      itemsChanged,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
