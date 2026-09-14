"use client";

import { useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Undo2 } from "lucide-react";
import { formatDateHuman } from "@/lib/timezone";
import { Header } from "./header";
import { SubmissionEvidence } from "./submission-evidence";
import type { SessionProp, HistoryResponse } from "./types";

function shortDue(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("lt-LT", {
    timeZone: "UTC",
    weekday: "short",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function HistoryView({ session }: { session: SessionProp }) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const reopen = useMutation({
    mutationFn: async (homeworkId: string) => {
      const response = await fetch(`/api/homework/${homeworkId}/done`, { method: "DELETE" });
      if (!response.ok) throw new Error("Nepavyko grąžinti darbo. Bandyk dar kartą.");
      return response.json() as Promise<{ calendarFailed: number }>;
    },
    onSuccess: (result) => {
      setNotice(result.calendarFailed
        ? "Darbas grąžintas į neatliktus. Kalendoriaus atnaujinti nepavyko — bandyk sinchronizuoti nustatymuose."
        : "Darbas grąžintas į neatliktus. Jį vėl matote namų darbų sąraše.");
      queryClient.invalidateQueries({ queryKey: ["homework"] });
    },
  });
  const { data, isLoading, error } = useQuery<HistoryResponse>({
    queryKey: ["homework", "history"],
    queryFn: async () => {
      const res = await fetch("/api/homework/history");
      if (!res.ok) throw new Error("failed to load history");
      return res.json();
    },
  });

  return (
    <main className="flex flex-1 flex-col pb-10">
      <Header session={session} />

      <section className="px-5 pt-8">
        <h1 className="font-display text-[2rem] font-black leading-[1.05] tracking-tight text-ink">
          Atliktų darbų istorija
        </h1>
        <p className="mt-2.5 max-w-[38ch] text-[0.9375rem] leading-relaxed text-ink-soft">
          Atlikti darbai, vaikų nuotraukos ir AI vertinimai.
        </p>
        {notice && <p role="status" className="mt-4 text-sm text-ink">{notice}</p>}
        {reopen.error && <p role="alert" className="mt-3 text-sm text-pen-deep">{reopen.error.message}</p>}
      </section>

      <div className="mt-7 flex flex-col gap-5 px-5">
        {isLoading && <p className="py-10 text-center text-ink-faint">Kraunama…</p>}
        {error && (
          <p className="font-hand text-2xl text-pen-deep">✗ Įvyko klaida — atnaujink puslapį.</p>
        )}
        {data && data.items.length === 0 && (
          <div className="sheet anim-rise p-8 pl-10">
            <p className="font-hand text-3xl leading-none text-ink-faint">Dar tuščia.</p>
            <p className="mt-2 text-ink-soft">Atlikti namų darbai atsiras čia.</p>
          </div>
        )}
        {data?.items.map((item, i) => (
          <article
            key={item.id}
            className="sheet anim-rise p-5 pl-10 pr-5"
            style={{ "--i": Math.min(i, 4) } as CSSProperties}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-[1.35rem] font-bold leading-snug text-ink">
                  {item.subject}
                </h2>
                <p className="mt-1 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink-soft">
                  {item.description}
                </p>
                <p className="font-hand mt-2.5 text-xl leading-none text-ink-soft">
                  Atlikti iki {shortDue(item.dueDate)}
                </p>
              </div>
              <span className="font-hand shrink-0 text-2xl leading-none text-leaf-deep">Atlikta ✓</span>
            </div>
            <p className="mt-3 text-xs text-ink-faint">
              {item.doneSource === "ai" ? "AI pažymėta kaip atlikta" : item.doneSource === "parent" ? "Tėvų pažymėta kaip atlikta" : "Pažymėta kaip atlikta"}
              {` · ${formatDateHuman(item.doneDate)}`}
              {item.doneByName ? ` · ${item.doneByName}` : ""}
            </p>
            <div className="mt-4 flex flex-col gap-5 border-t border-dashed border-rule pt-4">
              {item.submissions.length ? item.submissions.map((submission) => (
                <SubmissionEvidence key={submission.userId} submission={submission} />
              )) : <p className="text-sm text-ink-soft">Nuotraukų nepateikta.</p>}
            </div>
            {session.role === "parent" && (
              <button type="button" className="btn btn-outline mt-4 w-full" disabled={reopen.isPending}
                onClick={() => reopen.mutate(item.id)}>
                {reopen.isPending && reopen.variables === item.id
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Grąžinama…</>
                  : <><Undo2 className="h-4 w-4" /> Pažymėti kaip neatliktą</>}
              </button>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
