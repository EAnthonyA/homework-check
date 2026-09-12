// Date helpers pinned to Europe/Vilnius (Lithuania) timezone.
// Homework dates are stored as plain "YYYY-MM-DD" strings to avoid tz bugs.

export const TZ = "Europe/Vilnius";

export function vilniusDateString(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // en-CA renders YYYY-MM-DD
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function isFutureOrToday(dateStr: string, today = vilniusDateString()): boolean {
  return dateStr >= today;
}

export function formatDateHuman(dateStr: string, locale: "lt" | "en" = "lt"): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : "en-GB", {
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
