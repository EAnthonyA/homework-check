"use client";

import { useQuery } from "@tanstack/react-query";
import { useRef, type ReactNode, type TouchEvent } from "react";
import type { AssessmentsResponse, MessagesResponse, TodayResponse } from "./types";

export type DashboardTab = "homework" | "assessments" | "messages" | "consultations";

const TAB_ORDER: DashboardTab[] = ["homework", "assessments", "messages", "consultations"];

export function SwipeableDashboardPanels({
  active,
  onChange,
  children,
}: {
  active: DashboardTab;
  onChange: (tab: DashboardTab) => void;
  children: ReactNode;
}) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (event.touches.length !== 1 || target.closest("button, a, input, textarea, select, label")) return;
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || event.changedTouches.length !== 1) return;

    const end = event.changedTouches[0];
    const horizontal = end.clientX - start.x;
    const vertical = end.clientY - start.y;
    if (Math.abs(horizontal) < 64 || Math.abs(horizontal) < Math.abs(vertical) * 1.5) return;
    const current = TAB_ORDER.indexOf(active);
    if (horizontal < 0 && current < TAB_ORDER.length - 1) onChange(TAB_ORDER[current + 1]);
    if (horizontal > 0 && current > 0) onChange(TAB_ORDER[current - 1]);
  }

  return (
    <div
      className="touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => { touchStart.current = null; }}
    >
      {children}
    </div>
  );
}

export function DashboardTabs({
  active,
  onChange,
  panelId,
}: {
  active: DashboardTab;
  onChange: (tab: DashboardTab) => void;
  panelId: string;
}) {
  const homework = useQuery<TodayResponse>({
    queryKey: ["homework", "today"],
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      const response = await fetch("/api/homework/today");
      if (!response.ok) throw new Error("failed to load homework");
      return response.json();
    },
  });
  const assessments = useQuery<AssessmentsResponse>({
    queryKey: ["assessments", "upcoming"],
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      const response = await fetch("/api/assessments/upcoming");
      if (!response.ok) throw new Error("failed to load assessments");
      return response.json();
    },
  });
  const messages = useQuery<MessagesResponse>({
    queryKey: ["messages"],
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      const response = await fetch("/api/messages");
      if (!response.ok) throw new Error("failed to load messages");
      return response.json();
    },
  });

  const tabs: Array<{ id: DashboardTab; label: string; count: number | undefined }> = [
    { id: "homework", label: "Namų darbai", count: homework.data?.items.length },
    { id: "assessments", label: "Atsiskaitymai", count: assessments.data?.items.length },
    { id: "messages", label: "Pranešimai", count: messages.data?.items.length },
    { id: "consultations", label: "Konsultacijos", count: undefined },
  ];

  return (
    <div role="tablist" aria-label="Mokyklos informacija" className="flex gap-5 overflow-x-auto border-b border-rule">
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            id={`${panelId}-${tab.id}-tab`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${panelId}-${tab.id}-panel`}
            onClick={() => onChange(tab.id)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-1 pb-2.5 text-[0.9375rem] font-semibold transition-colors ${
              selected
                ? "border-pen text-ink"
                : "border-transparent text-ink-faint hover:border-rule hover:text-ink-soft"
            }`}
          >
            {tab.label}{tab.count === undefined ? "" : ` (${tab.count})`}
          </button>
        );
      })}
    </div>
  );
}
