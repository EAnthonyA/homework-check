// Scraper orchestration: login -> fetch homework page -> parse -> upsert into DB.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CookieJar } from "./cookie-jar";
import { login, fetchAssessmentsPage, fetchHomeworkPage, isAssessmentsPageConfigured } from "./source";
import { parseHomework } from "./parse";
import { assessmentDataRowCount, hasAssessmentsTable, parseAssessments } from "./assessments";
import {
  createScrapeRun,
  deactivateAssessments,
  finishScrapeRun,
  upsertAssessmentItem,
  upsertHomeworkItem,
  type AssessmentRow,
  type HomeworkRow,
} from "../repo";
import { sanitizeFreeText } from "../sanitize";

export interface ScrapeResult {
  itemsAdded: number;
  itemsChanged: number;
  items: HomeworkRow[];
  assessmentsAdded: number;
  assessmentsChanged: number;
  assessments: AssessmentRow[];
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
  let assessmentsAdded = 0;
  let assessmentsChanged = 0;
  const assessments: AssessmentRow[] = [];

  try {
    const jar = new CookieJar();
    await login(jar);
    const html = await fetchHomeworkPage(jar);
    let assessmentsHtml: string | null = null;
    if (isAssessmentsPageConfigured()) {
      try {
        assessmentsHtml = await fetchAssessmentsPage(jar);
      } catch (error) {
        // Assessment availability must never stop the established homework sync.
        console.error("[scraper] assessments page could not be fetched; keeping the last known schedule:", error);
      }
    }
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

    if (assessmentsHtml) {
      const parsedAssessments = parseAssessments(assessmentsHtml);
      const dataRowCount = assessmentDataRowCount(assessmentsHtml);
      if (!hasAssessmentsTable(assessmentsHtml)) {
        throw new Error("No assessments table found — keep existing assessments and tune src/lib/scraper/assessments.ts");
      }
      if (parsedAssessments.length < dataRowCount) {
        throw new Error("Could not parse every assessment row — keep existing assessments and tune src/lib/scraper/assessments.ts");
      }

      deactivateAssessments();
      for (const assessment of parsedAssessments) {
        // A dated row is the only identifier exposed by the source. Including
        // every visible field lets a moved or edited assessment replace the old
        // active row during this reconciliation pass.
        const sourceId = createHash("sha256")
          .update(`${assessment.assessmentDate}|${assessment.assessmentType}|${assessment.groupName}|${assessment.topic}`)
          .digest("hex")
          .slice(0, 32);
        const result = upsertAssessmentItem({
          sourceId,
          assessmentDate: assessment.assessmentDate,
          assessmentType: sanitizeFreeText(assessment.assessmentType, 200),
          groupName: sanitizeFreeText(assessment.groupName, 200),
          topic: sanitizeFreeText(assessment.topic, 2000),
          enteredDate: assessment.enteredDate,
        });
        assessments.push(result.item);
        if (result.created) assessmentsAdded += 1;
        else if (result.changed) assessmentsChanged += 1;
      }
    }

    finishScrapeRun(runId, {
      status: "success",
      itemsAdded: itemsAdded + assessmentsAdded,
      itemsChanged: itemsChanged + assessmentsChanged,
    });
    return { itemsAdded, itemsChanged, items, assessmentsAdded, assessmentsChanged, assessments };
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
