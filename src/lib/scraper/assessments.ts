// Parser for the source's upcoming assessments table.
import * as cheerio from "cheerio";

export interface ParsedAssessmentItem {
  assessmentDate: string;
  assessmentType: string;
  groupName: string;
  topic: string;
  enteredDate?: string;
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

export function hasAssessmentsTable(html: string): boolean {
  const $ = cheerio.load(html);
  return $("table").toArray().some((table) =>
    $(table).find("tr").first().find("th").toArray().some((header) =>
      /atsiskaitomojo darbo tipas/i.test(cleanText($(header))),
    ),
  );
}

// A genuine empty schedule has no multi-cell data rows. If such rows do exist
// but parsing produces fewer entries, retain the last known schedule instead
// of accidentally retiring it after an upstream markup change.
export function assessmentDataRowCount(html: string): number {
  const $ = cheerio.load(html);
  let count = 0;
  $("table").each((_, table) => {
    const headers = $(table).find("tr").first().find("th").map((__, th) => cleanText($(th))).get();
    if (!headers.some((header) => /atsiskaitomojo darbo tipas/i.test(header))) return;
    $(table).find("tr").slice(1).each((__, row) => {
      if ($(row).find("td").length > 1) count += 1;
    });
  });
  return count;
}

export function parseAssessments(html: string): ParsedAssessmentItem[] {
  const $ = cheerio.load(html);
  const items: ParsedAssessmentItem[] = [];

  $("table").each((_, table) => {
    const headers = $(table).find("tr").first().find("th").map((__, th) => cleanText($(th))).get();
    if (!headers.some((header) => /atsiskaitomojo darbo tipas/i.test(header))) return;

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
