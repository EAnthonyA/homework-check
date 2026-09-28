// Scraper orchestration: login -> fetch homework page -> parse -> upsert into DB.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CookieJar } from "./cookie-jar";
import { fetchAssessmentsPage, fetchHomeworkPage, fetchMessageDetail, fetchMessagesPage, login } from "./source";
import { parseHomework } from "./parse";
import { assessmentDataRowCount, canReconcileAssessmentSchedule, hasAssessmentsTable, parseAssessments } from "./assessments";
import { parseMessageDetail, parseMessageList, shouldImportMessage } from "./messages";
import {
  createScrapeRun,
  deactivateAssessments,
  finishScrapeRun,
  getMessageBySourceId,
  listUpcomingAssessments,
  upsertAssessmentItem,
  upsertHomeworkItem,
  upsertMessageItem,
  type AssessmentRow,
  type HomeworkRow,
} from "../repo";
import { sanitizeFreeText } from "../sanitize";
import { vilniusDateString } from "../timezone";

export interface ScrapeResult {
  itemsAdded: number;
  itemsChanged: number;
  items: HomeworkRow[];
  assessmentsAdded: number;
  assessmentsChanged: number;
  assessments: AssessmentRow[];
  messagesAdded: number;
  messagesChanged: number;
}

function dumpHtml(html: string, page: "homework" | "assessments"): void {
  if (process.env.SCRAPER_DEBUG !== "1") return;
  const dir = path.resolve(process.cwd(), "data/debug");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${page}-${new Date().toISOString().replace(/[:.]/g, "-")}.html`);
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
  let messagesAdded = 0;
  let messagesChanged = 0;

  try {
    const jar = new CookieJar();
    await login(jar);
    const html = await fetchHomeworkPage(jar);
    let listedMessages: Array<{ sourceId: string; unread: boolean }> | null = [];
    try {
      let messagesPagePath: string | undefined;
      do {
        const messagesHtml = await fetchMessagesPage(jar, messagesPagePath);
        const page = parseMessageList(messagesHtml);
        listedMessages.push(...page.items);
        messagesPagePath = page.nextPagePath;
      } while (messagesPagePath);
    } catch (error) {
      // Message availability must never prevent the established homework sync.
      console.error("[scraper] messages page could not be fetched; keeping local messages:", error);
      listedMessages = null;
    }
    let assessmentsHtml: string | null = null;
    try {
      assessmentsHtml = await fetchAssessmentsPage(jar);
    } catch (error) {
      // Assessment availability must never stop the established homework sync.
      console.error("[scraper] assessments page could not be fetched; keeping the last known schedule:", error);
    }
    dumpHtml(html, "homework");
    if (assessmentsHtml) dumpHtml(assessmentsHtml, "assessments");

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

    if (listedMessages) {
      const seenMessageIds = new Set<string>();
      for (const listed of listedMessages) {
        if (seenMessageIds.has(listed.sourceId)) continue;
        seenMessageIds.add(listed.sourceId);
        if (!shouldImportMessage(listed, Boolean(getMessageBySourceId(listed.sourceId)))) continue;
        try {
          const detail = parseMessageDetail(await fetchMessageDetail(jar, listed.sourceId), listed.sourceId);
          if (!detail) throw new Error("message detail could not be parsed");
          const result = upsertMessageItem({
            sourceId: listed.sourceId,
            sender: sanitizeFreeText(detail.sender, 200),
            subject: sanitizeFreeText(detail.subject, 500),
            body: sanitizeFreeText(detail.body, 10_000),
            receivedAt: detail.receivedAt,
            attachments: detail.attachments.map((attachment) => ({
              name: sanitizeFreeText(attachment.name, 500),
              sourcePath: attachment.sourcePath,
            })),
          });
          if (result.created) messagesAdded += 1;
          else if (result.changed) messagesChanged += 1;
          // The source marks a message as read when its detail page is fetched.
          // This happens only after its list entry was discovered and immediately
          // before its complete content is written to our local inbox.
        } catch (error) {
          // Do not acknowledge a message whose local copy was not safely saved.
          console.error(`[scraper] message ${listed.sourceId} could not be imported; keeping it unread at the source:`, error);
        }
      }
    }

    if (assessmentsHtml && hasAssessmentsTable(assessmentsHtml)) {
      const parsedAssessments = parseAssessments(assessmentsHtml);
      const dataRowCount = assessmentDataRowCount(assessmentsHtml);
      if (!canReconcileAssessmentSchedule(
        parsedAssessments.length,
        dataRowCount,
        listUpcomingAssessments(vilniusDateString()).length > 0,
      )) {
        throw new Error("Assessment schedule was incomplete or unexpectedly empty — keeping existing assessments");
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
    } else if (assessmentsHtml) {
      // The source can occasionally serve a page without the schedule table.
      // Keep the last known schedule and let homework/messages refresh normally.
      console.error("[scraper] assessments table was not found; keeping the last known schedule");
    }

    finishScrapeRun(runId, {
      status: "success",
      itemsAdded: itemsAdded + assessmentsAdded + messagesAdded,
      itemsChanged: itemsChanged + assessmentsChanged + messagesChanged,
    });
    return { itemsAdded, itemsChanged, items, assessmentsAdded, assessmentsChanged, assessments, messagesAdded, messagesChanged };
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
