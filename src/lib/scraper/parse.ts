// Parser for the source homework page HTML.
//
// NOTE: selectors below are best-effort heuristics. The authenticated page
// structure could not be inspected ahead of time, so the scraper supports
// SCRAPER_DEBUG=1 (dumps the raw HTML to ./data/debug) to tune these selectors
// against the real markup if needed.
import * as cheerio from "cheerio";

export interface ParsedHomeworkItem {
  subject: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  details?: string;
}

const MONTHS_LT: Record<string, number> = {
  sausio: 1, vasario: 2, kovo: 3, balandžio: 4, gegužės: 5, birželio: 6,
  liepos: 7, rugpjūčio: 8, rugsėjo: 9, spalio: 10, lapkričio: 11, gruodžio: 12,
};

const MONTHS_EN: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Extract a YYYY-MM-DD date from arbitrary text; falls back to `fallbackYear`. */
export function extractDate(text: string, fallbackYear: string): string | null {
  const t = text.replace(/\u00a0/g, " ").trim();
  if (!t) return null;

  // 2026-09-12, 2026.09.12, 2026/09/12, 09-12 / 2026-09-12 14:00
  const numeric = t.match(/(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (numeric) return `${numeric[1]}-${pad(Number(numeric[2]))}-${pad(Number(numeric[3]))}`;

  // "Rugsėjo 12", "Rugsėjo 12 d.", "2026 m. rugsėjo 12 d."
  const named = t.match(/(20\d{2})?\s*(?:m\.?\s*)?([A-Za-zĄČĘĖĮŠŲŪŽąčęėįšųūž]+)\s+(\d{1,2})\s*(?:d\.?)?/i);
  if (named) {
    const month = MONTHS_LT[named[2].toLowerCase()] ?? MONTHS_EN[named[2].toLowerCase()];
    if (month) {
      const year = named[1] ?? fallbackYear;
      return `${year}-${pad(month)}-${pad(Number(named[3]))}`;
    }
  }
  return null;
}

function looksLikeSubject(cell: string): boolean {
  return /[A-Za-zĄČĘĖĮŠŲŪŽąčęėįšųūž]/.test(cell) && cell.length <= 60;
}

/**
 * Parse homework items grouped by date.
 * Strategy A: table rows (a date cell sets the current date; remaining cells
 * become subject + description). Strategy B: date headings followed by list
 * items or paragraphs.
 */
export function parseHomework(html: string, today: string): ParsedHomeworkItem[] {
  const $ = cheerio.load(html);
  const items: ParsedHomeworkItem[] = [];
  const seen = new Set<string>();

  const push = (item: ParsedHomeworkItem) => {
    const key = `${item.dueDate}|${item.subject}|${item.description}`;
    if (item.subject && item.description && !seen.has(key)) {
      seen.add(key);
      items.push(item);
    }
  };

  // Strategy A: tables
  $("table").each((_, table) => {
    let currentDate: string | null = null;
    $(table)
      .find("tr")
      .each((__, tr) => {
        const cells = $(tr)
          .find("th, td")
          .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
          .get()
          .filter(Boolean);

        if (cells.length === 0) return;
        const dateIdx = cells.findIndex((c) => extractDate(c, today));
        if (dateIdx >= 0) {
          currentDate = extractDate(cells[dateIdx], today);
          cells.splice(dateIdx, 1);
        }
        if (!currentDate) return;

        // Typical shape: [subject, description] (date already stripped).
        const subject = cells.find((c) => looksLikeSubject(c)) ?? cells[0];
        const description = cells[cells.length - 1];
        if (subject && description && subject !== description) {
          push({ subject, description, dueDate: currentDate });
        }
      });
  });

  // Strategy B: date headings followed by items
  $("[class*='date'], [class*='diena'], h1, h2, h3, h4, strong, b").each((_, el) => {
    const raw = $(el).text().replace(/\s+/g, " ").trim();
    const date = extractDate(raw, today);
    if (!date) return;

    const node = el.nextSibling ?? el.next;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const collect = (n: any): void => {
      if (!n) return;
      const $n = $(n);
      const nextDate = $n.find("[class*='date'], [class*='diena']").text();
      if (nextDate && extractDate(nextDate, today)) return;
      const text = $n.text().replace(/\s+/g, " ").trim();
      if (!text || text.length > 300) return;
      // Heuristic: "Subject - description" or "Subject: description"
      const m = text.match(/^(.{1,60}?)\s*[-–—:]\s*(.+)$/);
      if (m) push({ subject: m[1].trim(), description: m[2].trim(), dueDate: date });
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node as any)?.next?.each?.((_: number, n: unknown) => collect(n));
    collect(node);
  });

  // Fallback: any list item / paragraph containing "Subject - description"
  $("li, .task, .homework, .entry").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    const m = text.match(/^(20\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})\s+(.{1,60}?)\s*[-–—:]\s*(.+)$/);
    if (m) {
      push({
        subject: m[4].trim(),
        description: m[5].trim(),
        dueDate: `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`,
      });
    }
  });

  return items;
}
