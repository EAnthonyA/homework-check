import { CheckCircle2, CircleAlert, CircleX, Sparkles } from "lucide-react";
import type { SubmissionView } from "./types";

// Renders the AI evaluation verdict for a submission. Returns null when there
// is nothing to show (not evaluated yet and no error).
export function AiVerdict({
  submission,
  compact = false,
}: {
  submission: SubmissionView;
  compact?: boolean;
}) {
  if (submission.aiDone === null && !submission.aiError) return null;

  if (submission.aiError) {
    if (compact) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-ink-soft/10 px-2.5 py-1 text-xs font-medium text-ink-soft">
          <Sparkles className="h-3.5 w-3.5" />
          AI: neįvertinta
        </span>
      );
    }
    return (
      <p className="flex items-center gap-1 text-xs font-medium text-ink-soft">
        <Sparkles className="h-3.5 w-3.5" />
        AI negalėjo įvertinti nuotraukos
      </p>
    );
  }

  const { aiDone, aiCorrect } = submission;
  const config = !aiDone
    ? { Icon: CircleX, className: "bg-danger/10 text-danger", label: "AI: neatlikta" }
    : aiCorrect === false
      ? { Icon: CircleAlert, className: "bg-accent/10 text-accent", label: "AI: yra klaidų" }
      : aiCorrect === true
        ? { Icon: CheckCircle2, className: "bg-success/10 text-success", label: "AI: atlikta ir teisinga" }
        : { Icon: CheckCircle2, className: "bg-primary/10 text-primary-dark", label: "AI: atlikta" };

  const badge = (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${config.className}`}
    >
      <config.Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );

  if (compact) return badge;

  return (
    <div className="mt-2">
      {badge}
      {submission.aiSummary && (
        <p className="mt-1.5 text-xs text-ink-soft">{submission.aiSummary}</p>
      )}
    </div>
  );
}
