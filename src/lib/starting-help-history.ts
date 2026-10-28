import { sanitizeFreeText } from "./sanitize";

export const MAX_HELP_TURNS = 8;

export type HelpTurn = { question: string; guidance: string };

export function parseHelpHistory(value: FormDataEntryValue | null): HelpTurn[] {
  if (typeof value !== "string" || value.length > 40_000) return [];

  try {
    const parsed: unknown = JSON.parse(value);

    if (!Array.isArray(parsed)) return [];

    return parsed.slice(-MAX_HELP_TURNS).flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];

      const turn = item as Record<string, unknown>;

      if (typeof turn.question !== "string" || typeof turn.guidance !== "string") return [];

      return [{
        question: sanitizeFreeText(turn.question, 600),
        guidance: sanitizeFreeText(turn.guidance, 1400),
      }];
    });
  } catch {
    return [];
  }
}
