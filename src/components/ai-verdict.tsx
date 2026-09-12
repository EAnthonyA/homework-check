import type { SubmissionView } from "./types";

// Renders the AI evaluation as a teacher's hand-written margin note.
// Returns null when there is nothing to show (not evaluated yet and no error).

type Verdict =
  | { kind: "none" }
  | { kind: "error" }
  | { kind: "notDone" }
  | { kind: "done"; correct: boolean | null };

const styles = {
  error: { text: "text-slate", mark: "mark-slate", label: "Neįvertinta" },
  notDone: { text: "text-pen-deep", mark: "mark-pen", label: "Neatlikta" },
  wrong: { text: "text-honey-deep", mark: "mark-honey", label: "Yra klaidų" },
  right: { text: "text-leaf-deep", mark: "mark-leaf", label: "Atlikta ir teisinga" },
  done: { text: "text-leaf-deep", mark: "mark-leaf", label: "Atlikta" },
} as const;

function resolveVerdict(submission: SubmissionView): Verdict {
  if (submission.aiError) return { kind: "error" };
  if (submission.aiDone === null) return { kind: "none" };
  if (submission.aiDone === false) return { kind: "notDone" };
  return { kind: "done", correct: submission.aiCorrect };
}

function styleFor(v: Verdict) {
  if (v.kind === "error") return styles.error;
  if (v.kind === "notDone") return styles.notDone;
  if (v.kind === "done" && v.correct === false) return styles.wrong;
  if (v.kind === "done" && v.correct === true) return styles.right;
  return styles.done;
}

export function AiVerdict({
  submission,
  compact = false,
}: {
  submission: SubmissionView;
  compact?: boolean;
}) {
  const v = resolveVerdict(submission);
  if (v.kind === "none") return null;

  const s = styleFor(v);

  const glyph = s === styles.error ? "—" : s === styles.wrong ? "△" : s === styles.notDone ? "✗" : "✓";

  if (compact) {
    return (
      <span className={`mark ${s.mark} font-hand text-xl leading-none ${s.text}`}>
        {glyph} {s.label}
      </span>
    );
  }

  return (
    <div className="mt-3">
      <span className={`mark ${s.mark} font-hand text-2xl leading-tight ${s.text}`}>
        {glyph} {s.label}
      </span>
      {submission.aiSummary && (
        <p className="font-hand mt-1.5 text-xl leading-snug text-ink-soft">{submission.aiSummary}</p>
      )}
    </div>
  );
}
