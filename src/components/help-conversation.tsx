"use client";

import { useState } from "react";
import type { HelpTurn } from "@/lib/starting-help-history";
import { TextArea } from "./ui/text-field";

const suggestions = ["Vis dar nesuprantu", "Paaiškink paprasčiau", "Tai ne ta užduotis"];

export function HelpConversation({ homeworkId, turns, pending, onSend }: {
  homeworkId: string;
  turns: HelpTurn[];
  pending: boolean;
  onSend: (question: string) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState("");

  function send() {
    const question = draft.trim();
    if (!question || pending) return;
    void onSend(question).then(() => setDraft("")).catch(() => {});
  }

  return (
    <div className="mt-4" aria-label="Pokalbis apie užduotį">
      <div className="space-y-3" aria-live="polite">
        {turns.map((turn, index) => (
          <div key={index}>
            {turn.question && <p className="ml-6 mb-2 whitespace-pre-wrap rounded-lg bg-paper p-3 text-sm text-ink"><span className="font-semibold">Tu: </span>{turn.question}</p>}
            {turn.guidance && <div className="mr-4 rounded-lg bg-honey/10 p-3">
              <p className="font-hand text-lg text-honey-deep">Pagalba</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{turn.guidance}</p>
            </div>}
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm font-medium text-ink">Vis dar neaišku?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button key={suggestion} type="button" disabled={pending} onClick={() => { void onSend(suggestion).catch(() => {}); }}
            className="rounded-full border border-rule px-3 py-2 text-sm font-medium text-ink hover:border-pen/40 disabled:opacity-50">
            {suggestion}
          </button>
        ))}
      </div>
      <label htmlFor={`help-question-${homeworkId}`} className="mt-3 block text-sm font-medium text-ink">Parašyk klausimą arba atsakymą</label>
      <TextArea id={`help-question-${homeworkId}`} value={draft} maxLength={600} disabled={pending}
        onChange={(event) => setDraft(event.target.value)} placeholder="Rašyk čia…" className="mt-1 min-h-20" />
      <button type="button" className="btn btn-primary mt-2 w-full" disabled={pending || !draft.trim()} onClick={send}>
        Siųsti
      </button>
      <p className="mt-2 text-xs text-ink-soft">Pokalbis dingsta atnaujinus puslapį. Visas pokalbis tėvams nesiunčiamas.</p>
    </div>
  );
}
