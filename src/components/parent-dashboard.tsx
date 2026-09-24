"use client";

import { useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Check, History, Loader2 } from "lucide-react";
import { formatDateHuman, vilniusDateString } from "@/lib/timezone";
import { Header } from "./header";
import { SubmissionEvidence } from "./submission-evidence";
import { HomeworkSections } from "./homework-sections";
import { AssessmentPreview } from "./assessment-preview";
import { DashboardTabs, SwipeableDashboardPanels, type DashboardTab } from "./dashboard-tabs";
import type { SessionProp, TodayResponse } from "./types";

function shortDue(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("lt-LT", {
    timeZone: "UTC",
    weekday: "short",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function ParentDashboard({ session }: { session: SessionProp }) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<DashboardTab>("homework");

  const markDone = useMutation({
    mutationFn: async (homeworkId: string) => {
      const res = await fetch(`/api/homework/${homeworkId}/done`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "failed");
      }
      return res.json();
    },
    onSuccess: (result) => {
      setNotice(result.calendarFailed ? "Darbas pažymėtas atliktu, bet nepavyko pašalinti jo iš kalendoriaus." : "Darbas perkeltas į istoriją. Ten gali jį grąžinti taisyti.");
      queryClient.invalidateQueries({ queryKey: ["homework", "today"] });
      queryClient.invalidateQueries({ queryKey: ["homework", "history"] });
    },
  });

  const { data, isLoading, error } = useQuery<TodayResponse>({
    queryKey: ["homework", "today"],
    queryFn: async () => {
      const res = await fetch("/api/homework/today");
      if (!res.ok) throw new Error("failed to load homework");
      return res.json();
    },
  });

  const todayHuman = formatDateHuman(vilniusDateString());

  return (
    <main className="flex flex-1 flex-col pb-10">
      <Header session={session} />

      <section className="px-5 pt-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-hand text-[1.35rem] leading-none text-pen-deep">{todayHuman}</p>
            <h1 className="font-display mt-2 text-[2rem] font-black leading-[1.05] tracking-tight text-ink">
              Namų darbai
            </h1>
            <p className="mt-2.5 max-w-[38ch] text-[0.9375rem] leading-relaxed text-ink-soft">
              Kas dar liko atlikti ir ką vaikai jau pateikė.
            </p>
          </div>
          <Link
            href="/history"
            aria-label="Istorija"
            title="Istorija"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-rule bg-sheet text-ink transition-colors hover:border-pen/40"
          >
            <History className="h-5 w-5" />
          </Link>
        </div>
        {notice && <p role="status" className="mt-4 text-sm text-ink">{notice}</p>}
        {markDone.error && <p role="alert" className="mt-3 text-sm text-pen-deep">Nepavyko pažymėti darbo. Bandyk dar kartą.</p>}
      </section>

      <div className="mt-7 px-5">
        <DashboardTabs active={activeTab} onChange={setActiveTab} panelId="parent-dashboard" />
        <SwipeableDashboardPanels active={activeTab} onChange={setActiveTab}>
        <div
          id="parent-dashboard-homework-panel"
          role="tabpanel"
          aria-labelledby="parent-dashboard-homework-tab"
          hidden={activeTab !== "homework"}
          className="mt-5 flex flex-col gap-5"
        >
        {isLoading && <p className="py-10 text-center text-ink-faint">Kraunama…</p>}
        {error && (
          <p className="font-hand text-2xl text-pen-deep">✗ Įvyko klaida — atnaujink puslapį.</p>
        )}
        {data && data.items.length === 0 && (
          <div className="sheet anim-rise p-8 pl-10">
            <p className="font-hand text-3xl leading-none text-leaf-deep">Laisvadienis!</p>
            <p className="mt-2 text-ink-soft">Neatliktų namų darbų nėra.</p>
          </div>
        )}
        {data && <HomeworkSections items={data.items} today={data.date}>{(item, i) => {
          return (
            <article
              key={item.id}
              className="sheet anim-rise p-5 pl-10 pr-5"
              style={{ "--i": Math.min(i, 4) } as CSSProperties}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-[1.35rem] font-bold leading-snug text-ink">
                    {item.subject}
                  </h3>
                  <p className="mt-1 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink-soft">
                    {item.description}
                  </p>
                  <p className="font-hand mt-2.5 text-xl leading-none text-ink-soft">
                    Atlikti iki {shortDue(item.dueDate)}
                  </p>
                </div>
                <span className="font-hand shrink-0 text-xl leading-none text-honey-deep">Neatlikta ✎</span>
              </div>

              {item.submissions.length > 0 && (
                <div className="mt-4 flex flex-col gap-3 border-t border-dashed border-rule pt-4">
                  {item.submissions.map((s) => (
                    <div key={s.userId}>
                      <SubmissionEvidence submission={s} />
                      {s.aiDone && s.aiCorrect === false && (
                        <p className="mt-2 text-sm text-pen-deep">AI rado klaidų — vaikas turi pataisyti ir pateikti iš naujo.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 border-t border-dashed border-rule pt-3">
                <button
                  type="button"
                  disabled={markDone.isPending}
                  onClick={() => markDone.mutate(item.id)}
                  className="btn btn-outline w-full"
                >
                  {markDone.isPending && markDone.variables === item.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Žymima…
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Pažymėti kaip atliktą
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        }}</HomeworkSections>}
        </div>
        <div
          id="parent-dashboard-assessments-panel"
          role="tabpanel"
          aria-labelledby="parent-dashboard-assessments-tab"
          hidden={activeTab !== "assessments"}
          className="mt-5"
        >
          <AssessmentPreview audience="parent" />
        </div>
        </SwipeableDashboardPanels>
      </div>
    </main>
  );
}
