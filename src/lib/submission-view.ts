import type { SubmissionWithUser } from "./repo";
import { sanitizeFreeText } from "./sanitize";

function parseFeedbackParts(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").map((item) => sanitizeFreeText(item, 300)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function parseDebug(value: string | null) {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return null;
    const debug = parsed as Record<string, unknown>;
    const text = (item: unknown, maxLength = 400) => typeof item === "string" ? sanitizeFreeText(item, maxLength) : "";
    const allowed = <T extends string>(item: unknown, values: readonly T[], fallback: T) =>
      typeof item === "string" && values.includes(item as T) ? item as T : fallback;
    const checks = Array.isArray(debug.checks) ? debug.checks.flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const check = item as Record<string, unknown>;
      return [{
        part: text(check.part, 100) || "numeris neįskaitomas",
        verdict: allowed(check.verdict, ["correct", "incorrect", "unverifiable"] as const, "unverifiable"),
        questionRead: text(check.questionRead) || "neįskaitoma",
        answerRead: text(check.answerRead) || "neįskaitoma",
        reason: text(check.reason) || "AI nepateikė priežasties.",
      }];
    }).slice(0, 20) : [];
    const notes = Array.isArray(debug.notes)
      ? debug.notes.filter((item): item is string => typeof item === "string").map((item) => sanitizeFreeText(item, 300)).filter(Boolean).slice(0, 10)
      : [];
    return {
      model: text(debug.model, 200),
      taskTextVisibility: allowed(debug.taskTextVisibility, ["clear", "partial", "missing", "unknown"] as const, "unknown"),
      handwritingLegibility: allowed(debug.handwritingLegibility, ["clear", "mixed", "unclear", "unknown"] as const, "unknown"),
      checks,
      notes,
      rawResponse: text(debug.rawResponse, 6_000),
      verificationRawResponse: text(debug.verificationRawResponse, 6_000),
    };
  } catch {
    return null;
  }
}

export function submissionView(s: SubmissionWithUser, includeDebug = false) {
  const debug = parseDebug(s.ai_debug);
  return {
    userId: s.user_id,
    userName: sanitizeFreeText(s.user_name, 200),
    imagePath: s.image_path,
    imagePaths: s.image_paths ? JSON.parse(s.image_paths) as string[] : [s.image_path],
    createdAt: s.created_at,
    aiDone: s.ai_done === null ? null : s.ai_done === 1,
    aiCorrect: s.ai_correct === null ? null : s.ai_correct === 1,
    aiCanVerifyCorrectness: s.ai_can_verify_correctness === null ? null : s.ai_can_verify_correctness === 1,
    aiNeedsClearerPhoto: s.ai_needs_clearer_photo === 1,
    aiSummary: s.ai_summary,
    aiGoodParts: parseFeedbackParts(s.ai_good_parts),
    aiNeedsWork: parseFeedbackParts(s.ai_needs_work),
    aiReadings: (debug?.checks ?? []).filter((check) => check.verdict === "incorrect").map((check) => ({
      part: check.part,
      questionRead: check.questionRead,
      answerRead: check.answerRead,
    })),
    aiDebug: includeDebug ? debug : null,
    manualTaskText: s.manual_task_text,
    aiUsedManualTask: s.ai_used_manual_task === 1,
    aiError: s.ai_error,
    aiEvaluatedAt: s.ai_evaluated_at,
    learningReason: s.learning_reason,
    learningQuestion: s.learning_question,
    learningGuidance: s.learning_guidance,
  };
}
