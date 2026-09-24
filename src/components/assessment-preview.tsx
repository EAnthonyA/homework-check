"use client";

import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { CalendarDays, ChevronRight } from "lucide-react";
import { formatDateHuman } from "@/lib/timezone";
import type { AssessmentsResponse } from "./types";

function daysUntil(date: string, today: string): string {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (days === 0) return "šiandien";
  if (days === 1) return "rytoj";
  return `už ${days} d.`;
}

export function AssessmentPreview({ audience }: { audience: "parent" | "kid" }) {
  const { data, isLoading } = useQuery<AssessmentsResponse>({
    queryKey: ["assessments", "upcoming"],
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      const response = await fetch("/api/assessments/upcoming");
      if (!response.ok) throw new Error("failed to load assessments");
      return response.json();
    },
  });

  if (isLoading) {
    return <div className="sheet p-5 pl-10" aria-label="Kraunami atsiskaitymai"><div className="skeleton h-5 w-48" /><div className="skeleton mt-4 h-14 w-full" /></div>;
  }
  if (!data || data.items.length === 0) return null;

  return (
    <section className="sheet anim-rise overflow-hidden p-5 pl-10" style={{ "--i": 0 } as CSSProperties}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-hand text-xl leading-none text-pen-deep">Pasiruošimui</p>
          <h2 className="font-display mt-1 text-[1.35rem] font-bold leading-tight text-ink">Artėjantys atsiskaitymai</h2>
        </div>
        <CalendarDays className="mt-1 h-5 w-5 shrink-0 text-pen" aria-hidden="true" />
      </div>

      <div className="mt-4 divide-y divide-dashed divide-rule border-y border-dashed border-rule">
        {data.items.map((item) => (
          <article key={item.id} className="py-4 first:pt-3 last:pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-[1.05rem] font-bold leading-snug text-ink">{item.group}</p>
                <p className="mt-0.5 text-sm text-ink-soft">{item.type}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-hand text-xl leading-none text-pen-deep">{daysUntil(item.date, data.date)}</p>
                <p className="mt-1 text-xs text-ink-faint">{formatDateHuman(item.date)}</p>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink-soft">{item.topic}</p>
            {audience === "parent" && item.enteredDate && (
              <p className="mt-2 text-xs text-ink-faint">Įvesta {formatDateHuman(item.enteredDate)}</p>
            )}
          </article>
        ))}
      </div>
      {audience === "kid" && (
        <p className="mt-3 flex items-center gap-1 text-sm font-medium text-ink-soft">
          Pradėk nuo artimiausio dalyko <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </p>
      )}
    </section>
  );
}
