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

export function submissionView(s: SubmissionWithUser) {
  return {
    userId: s.user_id,
    userName: sanitizeFreeText(s.user_name, 200),
    imagePath: s.image_path,
    imagePaths: s.image_paths ? JSON.parse(s.image_paths) as string[] : [s.image_path],
    createdAt: s.created_at,
    aiDone: s.ai_done === null ? null : s.ai_done === 1,
    aiCorrect: s.ai_correct === null ? null : s.ai_correct === 1,
    aiSummary: s.ai_summary,
    aiGoodParts: parseFeedbackParts(s.ai_good_parts),
    aiNeedsWork: parseFeedbackParts(s.ai_needs_work),
    aiError: s.ai_error,
    aiEvaluatedAt: s.ai_evaluated_at,
    learningReason: s.learning_reason,
    learningQuestion: s.learning_question,
    learningGuidance: s.learning_guidance,
  };
}
