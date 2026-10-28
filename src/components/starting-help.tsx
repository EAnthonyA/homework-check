"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Lightbulb, Loader2 } from "lucide-react";
import { ChoiceChip } from "./ui/choice-chip";
import { TextArea, TextField } from "./ui/text-field";

type Mode = "breakdown" | "explain" | "example" | "start" | "followup";

export function StartingHelp({ homeworkId, description, requested }: { homeworkId: string; description: string; requested: boolean }) {
  const [open, setOpen] = useState(false);
  const [part, setPart] = useState("");
  const [question, setQuestion] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [guidance, setGuidance] = useState("");
  const [parts, setParts] = useState<string[]>([]);

  const queryClient = useQueryClient();

  const help = useMutation({
    mutationFn: async (mode: Mode) => {
      const form = new FormData();
      form.set("mode", mode);
      form.set("part", part);
      form.set("question", question);
      form.set("previous", guidance);

      if (photo) form.set("photo", photo);

      const response = await fetch(`/api/homework/${homeworkId}/start-help`, { method: "POST", body: form });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Nepavyko gauti pagalbos.");

      return result as { guidance: string; parts: string[] };
    },
    onSuccess: (result, mode) => {
      setGuidance(result.guidance);

      if (mode === "breakdown") setParts(result.parts);
    },
  });

  const requestHelp = useMutation({
    mutationFn: async (remove: boolean) => {
      const response = await fetch(`/api/homework/${homeworkId}/help-request`, {
        method: remove ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        ...(remove ? {} : { body: JSON.stringify({ part, question }) }),
      });

      if (!response.ok) throw new Error("Nepavyko išsaugoti. Bandyk dar kartą.");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["homework", "today"] }),
  });

  function choosePart(value: string) {
    setPart(value);
    setGuidance("");
    setQuestion("");
    help.reset();
  }

  return (
    <section className="mt-4 border-t border-dashed border-rule pt-4" aria-label="Pagalba pradedant užduotį">
      <button type="button" className="btn btn-outline w-full" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Lightbulb className="h-4 w-4" /> {open ? "Uždaryti pagalbą" : "Nesuprantu užduoties"}
      </button>

      {open && (
        <div className="mt-4">
          <h4 className="font-display text-lg font-bold text-ink">Nuo ko pradėti?</h4>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Pasirink neaiškią dalį arba paprašyk paaiškinti visą užrašą. Tau dar nereikia turėti atsakymo.
          </p>
          <blockquote className="mt-3 whitespace-pre-wrap rounded-lg bg-paper px-3 py-2 text-sm text-ink-soft">
            {description}
          </blockquote>
          <button type="button" className="mt-2 text-sm font-medium text-pen-deep underline"
            disabled={help.isPending} onClick={() => help.mutate("breakdown")}>
            Nežinau, kuri dalis — suskirstyk užrašą
          </button>

          {parts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Užduoties dalys">
              {parts.map((p, i) => (
                <ChoiceChip key={`${p}-${i}`} selected={part === p} onClick={() => choosePart(p)}>
                  {p}
                </ChoiceChip>
              ))}
            </div>
          )}

          <label className="mt-3 block text-sm font-medium text-ink" htmlFor={`help-part-${homeworkId}`}>
            Kuri dalis? <span className="font-normal text-ink-soft">(gali palikti tuščią)</span>
          </label>
          <TextField id={`help-part-${homeworkId}`} value={part} maxLength={600}
            onChange={(event) => setPart(event.target.value)} placeholder="Pvz., 42 psl. 3 užduotis"
            className="mt-1" />

          <label className="mt-3 block text-sm font-medium text-ink" htmlFor={`help-photo-${homeworkId}`}>
            Užduoties nuotrauka <span className="font-normal text-ink-soft">(nebūtina)</span>
          </label>
          <input id={`help-photo-${homeworkId}`} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm text-ink-soft" />
          <p className="mt-1 text-xs text-ink-soft">Nuotrauka siunčiama AI pagalbai, bet neišsaugoma kaip atliktas darbas.</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {([
              ["explain", "Paaiškink užduotį"],
              ["example", "Parodyk panašų pavyzdį"],
              ["start", "Nežinau, nuo ko pradėti"],
            ] as const).map(([mode, label]) => (
              <button key={mode} type="button" disabled={help.isPending} onClick={() => help.mutate(mode)}
                className="rounded-full border border-rule px-3 py-2 text-sm font-medium text-ink hover:border-pen/40">
                {label}
              </button>
            ))}
          </div>

          {help.isPending && (
            <p role="status" className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
              <Loader2 className="h-4 w-4 animate-spin" /> Ruošiama pagalba…
            </p>
          )}
          {help.error && <p role="alert" className="mt-3 text-sm text-pen-deep">{help.error.message}</p>}

          {guidance && (
            <div className="mt-3 rounded-lg bg-honey/10 p-3" aria-live="polite">
              <p className="font-hand text-lg text-honey-deep">Pagalba</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{guidance}</p>
            </div>
          )}

          {guidance && (
            <div className="mt-3">
              <label htmlFor={`help-question-${homeworkId}`} className="text-sm font-medium text-ink">Nori paklausti arba atsakyti?</label>
              <TextArea id={`help-question-${homeworkId}`} value={question} maxLength={600}
                onChange={(event) => setQuestion(event.target.value)}
                className="mt-1 min-h-20" />
              <button type="button" className="mt-1 text-sm font-medium text-pen-deep underline"
                disabled={help.isPending || !question.trim()} onClick={() => help.mutate("followup")}>
                Tęsti pokalbį
              </button>
            </div>
          )}

          <div className="mt-4 border-t border-dashed border-rule pt-3">
            {requested ? (
              <>
                <p role="status" className="text-sm text-leaf-deep">Tėvams parodyta, kad reikia pagalbos.</p>
                <button type="button" className="mt-1 text-sm text-ink-soft underline"
                  disabled={requestHelp.isPending} onClick={() => requestHelp.mutate(true)}>
                  Pagalbos jau nebereikia
                </button>
              </>
            ) : (
              <button type="button" className="text-sm font-medium text-pen-deep underline"
                disabled={requestHelp.isPending} onClick={() => requestHelp.mutate(false)}>
                Vis dar reikia pagalbos — pranešti tėvams
              </button>
            )}
            <p className="mt-1 text-xs text-ink-soft">
              Tėvai matys pasirinktą dalį ir tavo klausimą. Nuotrauka ir AI pokalbis nebus perduoti.
            </p>
            {requestHelp.error && <p role="alert" className="mt-1 text-sm text-pen-deep">{requestHelp.error.message}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
