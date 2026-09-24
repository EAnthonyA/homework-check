"use client";

import { useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDateHuman, vilniusDateString } from "@/lib/timezone";
import { Header } from "./header";
import { SubmissionEvidence } from "./submission-evidence";
import { PhotoSubmission } from "./photo-submission";
import { HomeworkSections } from "./homework-sections";
import { AssessmentPreview } from "./assessment-preview";
import { DashboardTabs, SwipeableDashboardPanels, type DashboardTab } from "./dashboard-tabs";
import type { SessionProp, TodayResponse } from "./types";

export function KidView({ session }: { session: SessionProp }) {
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<DashboardTab>("homework");
  const { data, isLoading, error } = useQuery<TodayResponse>({
    queryKey: ["homework", "today"],
    queryFn: async () => {
      const res = await fetch("/api/homework/today");
      if (!res.ok) throw new Error("failed to load homework");
      return res.json();
    },
  });

  return (
    <main className="flex flex-1 flex-col pb-10">
      <Header session={session} />
      <section className="px-5 pt-8">
        <p className="font-hand text-[1.35rem] leading-none text-pen-deep">{formatDateHuman(vilniusDateString())}</p>
        <h1 className="font-display mt-2 text-[2rem] font-black leading-[1.05] tracking-tight text-ink">Mano namų darbai</h1>
        <p className="mt-2.5 max-w-[38ch] text-[0.9375rem] leading-relaxed text-ink-soft">
          Įkelk iki 3 nuotraukų, kai atliksi — visus puslapius įvertinsiu kartu.
        </p>
        {notice && <p role="status" className="mt-4 text-sm text-ink">{notice}</p>}
      </section>
      <div className="mt-7 px-5">
        <DashboardTabs active={activeTab} onChange={setActiveTab} panelId="kid-dashboard" />
        <SwipeableDashboardPanels active={activeTab} onChange={setActiveTab}>
        <div
          id="kid-dashboard-homework-panel"
          role="tabpanel"
          aria-labelledby="kid-dashboard-homework-tab"
          hidden={activeTab !== "homework"}
          className="mt-5 flex flex-col gap-5"
        >
        {isLoading && [0, 1].map((i) => (
          <div key={i} className="sheet p-5 pl-10" aria-label="Kraunama">
            <div className="skeleton h-6 w-32" /><div className="skeleton mt-3 h-4 w-full" />
            <div className="skeleton mt-4 h-11 w-full" />
          </div>
        ))}
        {error && <p role="alert" className="font-hand text-2xl text-pen-deep">✗ Įvyko klaida — atnaujink puslapį.</p>}
        {data?.items.length === 0 && (
          <div className="sheet anim-rise p-8 pl-10">
            <p className="font-hand text-3xl leading-none text-leaf-deep">Laisvadienis!</p>
            <p className="mt-2 text-ink-soft">Neatliktų namų darbų nėra. Gali ilsėtis. ✌</p>
          </div>
        )}
        {data && <HomeworkSections items={data.items} today={data.date}>{(item, i) => {
          const mine = item.submissions.find((s) => s.userId === session.id);
          return (
            <article key={item.id} className="sheet anim-rise p-5 pl-10 pr-5"
              style={{ "--i": Math.min(i, 4) } as CSSProperties}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-display text-[1.35rem] font-bold leading-snug text-ink">{item.subject}</h3>
                <span className="font-hand text-xl text-honey-deep">Neatlikta ✎</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink-soft">{item.description}</p>
              <p className={`font-hand mt-2.5 text-xl leading-tight ${item.dueDate < data.date ? "text-pen-deep" : "text-ink-soft"}`}>
                Atlikti iki {formatDateHuman(item.dueDate)}
              </p>
              {mine && <div className="mt-4 border-t border-dashed border-rule pt-4">
                <SubmissionEvidence submission={mine} />
                {mine.aiDone && mine.aiCorrect === false && (
                  <p className="mt-2 text-sm text-pen-deep">AI rado klaidų. Pataisyk pagal komentarą ir pateik iš naujo.</p>
                )}
              </div>}
              <PhotoSubmission homeworkId={item.id} replacing={Boolean(mine)} onResult={setNotice} />
            </article>
          );
        }}</HomeworkSections>}
        </div>
        <div
          id="kid-dashboard-assessments-panel"
          role="tabpanel"
          aria-labelledby="kid-dashboard-assessments-tab"
          hidden={activeTab !== "assessments"}
          className="mt-5"
        >
          <AssessmentPreview audience="kid" />
        </div>
        </SwipeableDashboardPanels>
      </div>
    </main>
  );
}
