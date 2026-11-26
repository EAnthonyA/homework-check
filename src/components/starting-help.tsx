"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Images, Lightbulb, Loader2 } from "lucide-react";
import { MAX_HELP_TURNS, type HelpTurn } from "@/lib/starting-help-history";
import { ChoiceChip } from "./ui/choice-chip";
import { TextField } from "./ui/text-field";
import { HelpConversation } from "./help-conversation";

type Mode = "breakdown" | "explain" | "example" | "start" | "followup";

export function StartingHelp({ homeworkId, description, requested }: { homeworkId: string; description: string; requested: boolean }) {
  const [open, setOpen] = useState(false);
  const [part, setPart] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [parts, setParts] = useState<string[]>([]);
  const [history, setHistory] = useState<HelpTurn[]>([]);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

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
      if (mode === "followup") setLastQuestion(question);
      setHistory((turns) => [...turns, {
        question: mode === "followup" ? question : "",
        guidance: result.guidance,
      }]);

      if (mode === "breakdown") setParts(result.parts);
    },
  });

  const requestHelp = useMutation({
    mutationFn: async (remove: boolean) => {
      const response = await fetch(`/api/homework/${homeworkId}/help-request`, {
        method: remove ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        ...(remove ? {} : { body: JSON.stringify({ part, question: lastQuestion }) }),
      });

      if (!response.ok) throw new Error("Nepavyko išsaugoti. Bandyk dar kartą.");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["homework", "today"] }),
  });

  function choosePart(value: string) {
    setPart(value);
    setLastQuestion("");
    setHistory([]);
    help.reset();
  }

  return (
    <section className="mt-4 border-t border-dashed border-rule pt-4" aria-label="Pagalba pradedant užduotį">
      <button type="button" className="btn btn-primary w-full" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Lightbulb className="h-4 w-4" /> {open ? "Uždaryti pagalbą" : "Nesuprantu — paaiškink"}
      </button>

      {open && (
        <div className="mt-4">
          <h4 className="font-display text-lg font-bold text-ink">Nuo ko pradėti?</h4>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Nufotografuok užduotį arba pasirink nuotrauką ir paprašyk paaiškinti. Atsakymo dar nereikia.
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
            {photo ? `Pasirinkta: ${photo.name}` : "Nuotrauka nebūtina, bet gali padėti paaiškinti."}
          </p>
          {photo && <button type="button" className="text-sm text-pen-deep underline" disabled={help.isPending} onClick={() => setPhoto(null)}>Pašalinti nuotrauką</button>}
          <button type="button" className="btn btn-primary mt-3 w-full" disabled={help.isPending} onClick={() => help.mutate({ mode: "explain" })}>
            {help.isPending ? "Ruošiama pagalba…" : "Paaiškink užduotį"}
          </button>
          <p className="mt-2 text-xs text-ink-soft">Nuotrauka siunčiama AI pagalbai, bet nepateikiama kaip atliktas darbas.</p>
          {history.length > 0 && (
            <HelpConversation homeworkId={homeworkId} turns={history} pending={help.isPending}
              onSend={(question) => help.mutateAsync({ mode: "followup", question })} />
          )}

          {help.isPending && (
            <p role="status" className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
              <Loader2 className="h-4 w-4 animate-spin" /> Ruošiama pagalba…
            </p>
          )}
          {help.error && <p role="alert" className="mt-3 text-sm text-pen-deep">{help.error.message}</p>}

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
                Paprašyti tėvų pagalbos
              </button>
            )}
            <p className="mt-1 text-xs text-ink-soft">
              Tėvai matys pasirinktą dalį ir paskutinį išsiųstą klausimą. Nuotrauka ir AI atsakymai nebus perduoti.
            </p>
            {requestHelp.error && <p role="alert" className="mt-1 text-sm text-pen-deep">{requestHelp.error.message}</p>}
          </div>

          <blockquote className="mt-3 whitespace-pre-wrap rounded-lg bg-paper px-3 py-2 text-sm text-ink-soft">
            {description}
          </blockquote>
          <button type="button" className="mt-2 text-sm font-medium text-pen-deep underline"
            disabled={help.isPending} onClick={() => help.mutate({ mode: "breakdown" })}>
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
              <button key={mode} type="button" disabled={help.isPending} onClick={() => help.mutate({ mode })}
                className="rounded-full border border-rule px-3 py-2 text-sm font-medium text-ink hover:border-pen/40">
                {label}
              </button>
            ))}
          </div>


        </div>
      )}
    </section>
  );
}
