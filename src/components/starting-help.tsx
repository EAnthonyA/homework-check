"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Camera, Images, Loader2 } from "lucide-react";
import { MAX_HELP_TURNS, type HelpTurn } from "@/lib/starting-help-history";
import { ChoiceChip } from "./ui/choice-chip";
import { TextField } from "./ui/text-field";
import { HelpConversation } from "./help-conversation";

type Mode = "breakdown" | "explain" | "example" | "start" | "followup";

export function StartingHelp({ homeworkId, description, visible }: { homeworkId: string; description: string; visible: boolean }) {
  const [part, setPart] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [parts, setParts] = useState<string[]>([]);
  const [history, setHistory] = useState<HelpTurn[]>([]);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const help = useMutation({
    mutationFn: async ({ mode, question = "" }: { mode: Mode; question?: string }) => {
      const form = new FormData();
      form.set("mode", mode);
      form.set("part", part);
      form.set("question", mode === "followup" ? question : "");
      form.set("history", JSON.stringify(history.slice(-MAX_HELP_TURNS)));

      if (photo) form.set("photo", photo);

      const response = await fetch(`/api/homework/${homeworkId}/start-help`, { method: "POST", body: form });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Nepavyko gauti pagalbos.");

      return result as { guidance: string; parts: string[] };
    },
    onSuccess: (result, { mode, question = "" }) => {
      setHistory((turns) => [...turns, {
        question: mode === "followup" ? question : "",
        guidance: result.guidance,
      }]);

      if (mode === "breakdown") setParts(result.parts);
    },
  });

  function choosePart(value: string) {
    setPart(value);
    setHistory([]);
    help.reset();
  }

  return (
    <section className="mt-2" hidden={!visible} aria-label="Pagalba pradedant užduotį">
          <h4 className="font-display text-lg font-bold text-ink">Nuo ko pradėti?</h4>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Nufotografuok užduotį arba pasirink jos nuotrauką. Tada galėsi paprašyti paaiškinti.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline flex-1" disabled={help.isPending} onClick={() => camera.current?.click()}>
              <Camera className="h-4 w-4" /> Fotografuoti
            </button>
            <button type="button" className="btn btn-outline flex-1" disabled={help.isPending} onClick={() => gallery.current?.click()}>
              <Images className="h-4 w-4" /> Iš galerijos
            </button>
          </div>
          <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" disabled={help.isPending}
            onChange={(event) => { setPhoto(event.target.files?.[0] ?? null); event.target.value = ""; }} />
          <input ref={gallery} type="file" accept="image/*" className="hidden" disabled={help.isPending}
            onChange={(event) => { setPhoto(event.target.files?.[0] ?? null); event.target.value = ""; }} />
          <p className="mt-2 text-sm text-ink-soft" role="status">
            {photo ? `Pasirinkta: ${photo.name}` : "Pirmiausia pridėk užduoties nuotrauką."}
          </p>
          {photo && <button type="button" className="text-sm text-pen-deep underline" disabled={help.isPending} onClick={() => setPhoto(null)}>Pašalinti nuotrauką</button>}
          <button type="button" className="btn btn-primary mt-3 w-full" disabled={help.isPending || !photo} onClick={() => help.mutate({ mode: "explain" })}>
            {help.isPending ? "Ruošiama pagalba…" : "Paaiškink užduotį"}
          </button>
          <p className="mt-2 text-xs text-ink-soft">Nuotrauka siunčiama AI pagalbai, bet nepateikiama kaip atliktas darbas.</p>
          {history.length > 0 && (
            <HelpConversation homeworkId={homeworkId} turns={history} pending={help.isPending || !photo}
              onSend={(question) => help.mutateAsync({ mode: "followup", question })} />
          )}

          {help.isPending && (
            <p role="status" className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
              <Loader2 className="h-4 w-4 animate-spin" /> Ruošiama pagalba…
            </p>
          )}
          {help.error && <p role="alert" className="mt-3 text-sm text-pen-deep">{help.error.message}</p>}

          <blockquote className="mt-3 whitespace-pre-wrap rounded-lg bg-paper px-3 py-2 text-sm text-ink-soft">
            {description}
          </blockquote>
          <button type="button" className="mt-2 text-sm font-medium text-pen-deep underline"
            disabled={help.isPending || !photo} onClick={() => help.mutate({ mode: "breakdown" })}>
            Nežinau, kuri dalis — suskirstyk užrašą
          </button>

          {parts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Užduoties dalys">
              {parts.map((p, i) => (
                <ChoiceChip key={`${p}-${i}`} selected={part === p} disabled={help.isPending} onClick={() => choosePart(p)}>
                  {p}
                </ChoiceChip>
              ))}
            </div>
          )}

          <label className="mt-3 block text-sm font-medium text-ink" htmlFor={`help-part-${homeworkId}`}>
            Kuri dalis? <span className="font-normal text-ink-soft">(gali palikti tuščią)</span>
          </label>
          <TextField id={`help-part-${homeworkId}`} value={part} maxLength={600} disabled={help.isPending}
            onChange={(event) => choosePart(event.target.value)} placeholder="Pvz., 42 psl. 3 užduotis"
            className="mt-1" />

          <div className="mt-3 flex flex-wrap gap-2">
            {([
              ["example", "Parodyk panašų pavyzdį"],
              ["start", "Nežinau, nuo ko pradėti"],
            ] as const).map(([mode, label]) => (
              <button key={mode} type="button" disabled={help.isPending || !photo} onClick={() => help.mutate({ mode })}
                className="rounded-full border border-rule px-3 py-2 text-sm font-medium text-ink hover:border-pen/40">
                {label}
              </button>
            ))}
          </div>

    </section>
  );
}
