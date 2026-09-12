// Parser for the source homework page HTML.
//
// The homework page renders a table (`.classhomework_table`) with these columns:
//   0. lesson date ("Rugsėjo 10 Ketvirtadienis")
//   1. subject ("Matematika")
//   2. teacher
//   3. homework text (the actual assignment)
//   4. "complete by" deadline (ISO date, e.g. "2026-09-14")  ← used as dueDate
//   5. entered date (ISO)
//   6. attachments
//   7. actions ("Atlikti namų darbą" button)
import * as cheerio from "cheerio";

export interface ParsedHomeworkItem {
  subject: string;
  description: string;
  dueDate: string; // YYYY-MM-DD (the deadline)
  details?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function normalizeIso(text: string): string | null {
  const m = text.trim().match(/(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
}

function cleanText(el: { text: () => string }): string {
  return el.text().replace(/\s+/g, " ").trim();
}

export function parseHomework(html: string): ParsedHomeworkItem[] {
  const $ = cheerio.load(html);
  const items: ParsedHomeworkItem[] = [];

  // Primary strategy: the homework table.
  $("table.classhomework_table").first().find("tr").each((_, tr) => {
    const cells = $(tr).find("td").map((__, td) => cleanText($(td))).get();
    if (cells.length < 5) return; // skip the <th> header row and empty rows

    const dueDate = normalizeIso(cells[4]) ?? normalizeIso(cells[0]);
    const subject = cells[1];
    if (!dueDate || !subject) return;

    items.push({
      subject,
      description: cells[3] || subject,
      dueDate,
      details: cells[2] ? `Mokytojas: ${cells[2]}` : undefined,
    });
  });

  // Generic fallback (only if the known table was not found): any table row
  // with an ISO date followed by subject + description cells.
  if (items.length === 0) {
    $("table").each((_, table) => {
      let currentDate: string | null = null;
      $(table).find("tr").each((__, tr) => {
        const cells = $(tr).find("th, td").map((__, td) => cleanText($(td))).get().filter(Boolean);
        if (cells.length === 0) return;
        const dateIdx = cells.findIndex((c) => normalizeIso(c));
        if (dateIdx >= 0) {
          currentDate = normalizeIso(cells[dateIdx]);
          cells.splice(dateIdx, 1);
        }
        if (!currentDate) return;
        const subject = cells[0];
        const description = cells[cells.length - 1];
        if (subject && description && subject !== description) {
          items.push({ subject, description, dueDate: currentDate });
        }
      });
    });
  }

  // Deduplicate.
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.dueDate}|${item.subject}|${item.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
