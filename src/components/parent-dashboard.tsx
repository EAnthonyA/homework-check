"use client";

import { useQuery } from "@tanstack/react-query";
import { Calendar, Check, Clock } from "lucide-react";
import { formatDateHuman } from "@/lib/timezone";
import { Header } from "./header";
import { BottomNav } from "./bottom-nav";
import { AiVerdict } from "./ai-verdict";
import type { SessionProp, TodayResponse } from "./types";

export function ParentDashboard({ session }: { session: SessionProp }) {
  const { data, isLoading, error } = useQuery<TodayResponse>({
    queryKey: ["homework", "today"],
    queryFn: async () => {
      const res = await fetch("/api/homework/today");
      if (!res.ok) throw new Error("failed to load homework");
      return res.json();
    },
  });

  return (
    <main className="flex flex-1 flex-col pb-24">
      <Header session={session} />

      <div className="px-5 pt-6">
        <h1 className="font-display text-2xl font-bold text-ink">Šiandienos namų darbai</h1>
        <p className="mt-1 text-ink-soft">Ką reikia padaryti šiandien</p>
      </div>

      <div className="mt-4 flex flex-col gap-4 px-5">
        {isLoading && <p className="py-10 text-center text-ink-soft">Kraunama…</p>}
        {error && (
          <p className="rounded-card bg-danger/10 p-4 text-sm font-medium text-danger">
            Įvyko klaida
          </p>
        )}
        {data && data.items.length === 0 && (
          <div className="rounded-card bg-surface p-8 text-center shadow-card">
            <div className="text-4xl">🎉</div>
            <p className="mt-2 font-medium text-ink">Šiandien namų darbų nėra. 🎉</p>
          </div>
        )}
        {data?.items.map((item) => {
          const done = item.submissions.length > 0;
          return (
            <div key={item.id} className="rounded-card bg-surface p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink">{item.subject}</h2>
                  <p className="mt-1 whitespace-pre-wrap text-ink-soft">{item.description}</p>
                  <p className="mt-2 flex items-center gap-1 text-xs font-medium text-ink-soft">
                    <Calendar className="h-3.5 w-3.5" />
                    Atlikti iki: {formatDateHuman(item.dueDate)}
                  </p>
                </div>
                {done ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                    <Check className="h-3.5 w-3.5" />
                    Atlikta
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                    <Clock className="h-3.5 w-3.5" />
                    Laukiama
                  </span>
                )}
              </div>

              {item.submissions.length > 0 && (
                <div className="mt-4 flex flex-col gap-2 border-t border-black/5 pt-3">
                  {item.submissions.map((s) => (
                    <div key={s.userId} className="flex flex-wrap items-center gap-2">
                      <a
                        href={s.imagePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary-dark"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={s.imagePath}
                          alt={s.userName}
                          className="h-5 w-5 rounded object-cover"
                        />
                        {s.userName} · pateikė
                      </a>
                      <AiVerdict submission={s} compact />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <BottomNav role={session.role} />
    </main>
  );
}
