// Parser for the source's upcoming assessments table.
import * as cheerio from "cheerio";

export interface ParsedAssessmentItem {
  assessmentDate: string;
  assessmentType: string;
  groupName: string;
  topic: string;
  enteredDate?: string;
}

/**
 * The source renders the currently valid assessments route in the homework
 * navigation. Prefer it over a configured fallback because the route can vary
 * between source deployments.
 */
export function assessmentPagePathFromHomework(html: string): string | null {
  const $ = cheerio.load(html);
  const href = $("a[href*='/page/control_work/dates_pupil']").first().attr("href")?.trim();
  return href?.startsWith("/") ? href : null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function normalizeIso(text: string): string | null {
  const match = text.trim().match(/(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!match) return null;
  return `${match[1]}-${pad(Number(match[2]))}-${pad(Number(match[3]))}`;
}

function cleanText(el: { text: () => string }): string {
  return el.text().replace(/\s+/g, " ").trim();
}

function assessmentTables($: cheerio.CheerioAPI) {
  return $("table").filter((_, table) => {
    if ($(table).attr("id") === "cWorksListTable") return true;
    const headers = $(table).find("tr").first().find("th").map((__, header) => cleanText($(header))).get();
    return headers.some((header) => /atsiskaitom.*darbo.*tip/i.test(header));
  });
}

export function hasAssessmentsTable(html: string): boolean {
  const $ = cheerio.load(html);
  return assessmentTables($).length > 0;
}

// A genuine empty schedule has no multi-cell data rows. If such rows do exist
// but parsing produces fewer entries, retain the last known schedule instead
// of accidentally retiring it after an upstream markup change.
export function assessmentDataRowCount(html: string): number {
  const $ = cheerio.load(html);
  let count = 0;
  assessmentTables($).each((_, table) => {
    $(table).find("tr").slice(1).each((__, row) => {
      if ($(row).find("td").length > 1) count += 1;
    });
  });
  return count;
}

// Do not retire a previously imported upcoming schedule when the source
// unexpectedly responds with an empty table. A later successful scrape can
// still reconcile a genuinely empty schedule once there is nothing upcoming.
export function canReconcileAssessmentSchedule(
  parsedCount: number,
  dataRowCount: number,
  hasExistingUpcomingAssessments: boolean,
): boolean {
  return parsedCount >= dataRowCount && (parsedCount > 0 || !hasExistingUpcomingAssessments);
}

export function parseAssessments(html: string): ParsedAssessmentItem[] {
  const $ = cheerio.load(html);
  const items: ParsedAssessmentItem[] = [];

  assessmentTables($).each((_, table) => {

    $(table).find("tr").slice(1).each((__, row) => {
      const cells = $(row).find("td").map((___, cell) => cleanText($(cell))).get();
      if (cells.length < 6) return;
      const assessmentDate = normalizeIso(cells[1]);
      const assessmentType = cells[2];
      const groupName = cells[3];
      const topic = cells[4];
      if (!assessmentDate || !assessmentType || !groupName || !topic) return;
      items.push({
        assessmentDate,
        assessmentType,
        groupName,
        topic,
        enteredDate: normalizeIso(cells[5]) ?? undefined,
      });
    });
  });

  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.assessmentDate}|${item.assessmentType}|${item.groupName}|${item.topic}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
