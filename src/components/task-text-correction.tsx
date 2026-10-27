"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, PencilLine } from "lucide-react";
import type { SubmissionView } from "./types";

export function TaskTextCorrection({ homeworkId, submission }: { homeworkId: string; submission: SubmissionView }) {
  const [taskText, setTaskText] = useState(submission.manualTaskText ?? "");
  const [open, setOpen] = useState(Boolean(submission.manualTaskText));
  const queryClient = useQueryClient();
  const correct = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/homework/${homeworkId}/task-correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskText }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Nepavyko patikslinti užduoties.");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["homework"] }),
  });

  return (
    <section className="mt-4 border-t border-dashed border-rule pt-4" aria-labelledby={`task-text-${homeworkId}`}>
      <h4 id={`task-text-${homeworkId}`} className="font-display text-lg font-bold text-ink">AI galėjo neteisingai perskaityti sąlygą</h4>
      {submission.aiReadings.map((reading) => (
        <div key={reading.part} className="mt-2 border-l-2 border-honey/60 pl-3 text-sm leading-relaxed text-ink-soft">
          <p className="font-medium text-ink">{reading.part}</p>
          <p>Užduotis perskaityta: {reading.questionRead}</p>
          <p>Atsakymas perskaitytas: {reading.answerRead}</p>
        </div>
      ))}
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        Jeigu matai, kad sąlyga nuskaityta neteisingai, įvesk ją ranka. AI dar kartą patikrins pagal tavo tekstą; tėvai prieš pažymėdami darbą atliktu galės peržiūrėti rezultatą.
      </p>
      {!open ? (
        <button type="button" className="btn btn-outline mt-3 w-full" onClick={() => setOpen(true)}>
          <PencilLine className="h-4 w-4" /> Patikslinti užduoties sąlygą
        </button>
      ) : (
        <div className="mt-3">
          <label htmlFor={`task-text-input-${homeworkId}`} className="text-sm font-medium text-ink">Teisinga užduoties sąlyga</label>
          <textarea id={`task-text-input-${homeworkId}`} value={taskText} maxLength={2_000} disabled={correct.isPending}
            onChange={(event) => setTaskText(event.target.value)} placeholder="Pavyzdžiui: (324 − 36) : a = 324 : a − 36 : 6"
            className="mt-1.5 min-h-28 w-full resize-y rounded-lg border border-rule bg-sheet px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-faint" />
          <button type="button" className="btn btn-primary mt-2 w-full" disabled={correct.isPending || taskText.trim().length < 3}
            onClick={() => correct.mutate()}>
            {correct.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Tikrinama iš naujo…</> : <><PencilLine className="h-4 w-4" /> Patikrinti pagal šią sąlygą</>}
          </button>
        </div>
      )}
      {correct.error && <p role="alert" className="mt-2 text-sm text-pen-deep">{correct.error.message}</p>}
    </section>
  );
}
