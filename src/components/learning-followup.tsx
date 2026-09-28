"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Lightbulb, Loader2 } from "lucide-react";
import type { SubmissionView } from "./types";

type Reason = "careless" | "did-not-understand" | "other";

const reasonOptions: Array<{ value: Reason; label: string }> = [
  { value: "careless", label: "Paskubėjau / neapsižiūrėjau" },
  { value: "did-not-understand", label: "Dar nesuprantu temos" },
  { value: "other", label: "Kita priežastis" },
];

export function LearningFollowup({ homeworkId, submission }: { homeworkId: string; submission: SubmissionView }) {
  const [reason, setReason] = useState<Reason | null>(submission.learningReason as Reason | null);
  const [question, setQuestion] = useState(submission.learningQuestion ?? "");
  const [guidance, setGuidance] = useState(submission.learningGuidance ?? "");
  const queryClient = useQueryClient();
  const help = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/homework/${homeworkId}/learning-help`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, question }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Nepavyko paruošti užuominos.");
      return body as { guidance: string };
    },
    onSuccess: (result) => {
      setGuidance(result.guidance);
      queryClient.invalidateQueries({ queryKey: ["homework"] });
    },
  });

  return (
    <section className="mt-4 border-t border-dashed border-rule pt-4" aria-labelledby={`learning-help-${homeworkId}`}>
      <h4 id={`learning-help-${homeworkId}`} className="font-display text-lg font-bold text-ink">Padėk man suprasti</h4>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">Kas, tavo manymu, nutiko?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {reasonOptions.map((option) => (
          <button key={option.value} type="button" disabled={help.isPending} onClick={() => setReason(option.value)}
            className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${reason === option.value ? "border-pen bg-pen/10 text-pen-deep" : "border-rule bg-sheet text-ink-soft hover:border-pen/40"}`}>
            {option.label}
          </button>
        ))}
      </div>
      {reason && (
        <div className="mt-3">
          <label htmlFor={`learning-question-${homeworkId}`} className="text-sm font-medium text-ink">Kuri dalis tau neaiški?</label>
          <textarea id={`learning-question-${homeworkId}`} value={question} maxLength={600} disabled={help.isPending}
            onChange={(event) => setQuestion(event.target.value)} placeholder="Pavyzdžiui: nesuprantu, nuo ko pradėti…"
            className="mt-1.5 min-h-24 w-full resize-y rounded-lg border border-rule bg-sheet px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-faint" />
          <button type="button" className="btn btn-outline mt-2 w-full" disabled={help.isPending || question.trim().length < 3}
            onClick={() => help.mutate()}>
            {help.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Ruošiama užuomina…</> : <><Lightbulb className="h-4 w-4" /> Gauti užuominą</>}
          </button>
        </div>
      )}
      {help.error && <p role="alert" className="mt-2 text-sm text-pen-deep">{help.error.message}</p>}
      {guidance && (
        <div className="mt-3 rounded-lg bg-honey/10 p-3">
          <p className="font-hand text-lg leading-none text-honey-deep">Užuomina, ne atsakymas</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">{guidance}</p>
        </div>
      )}
    </section>
  );
}
