// Free-text sanitization for all user/AI-facing strings (per project conventions).
export function sanitizeFreeText(input: string, maxLength = 2000): string {
  return input
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ") // control characters
    .replace(/<[^>]*>/g, "") // strip any HTML-like tags
    .replace(/\s+/g, " ") // collapse whitespace
    .trim()
    .slice(0, maxLength);
}
