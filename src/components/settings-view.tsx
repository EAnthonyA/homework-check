"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Calendar, LogOut, RefreshCw } from "lucide-react";
import { Header } from "./header";
import { BottomNav } from "./bottom-nav";
import type { SessionProp } from "./types";

interface SettingsUser {
  id: string;
  email: string;
  name: string;
  role: string;
  calendarEnabled: boolean;
}

interface ScrapeRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  items_added: number;
  items_changed: number;
  error: string | null;
}

function formatWhen(iso: string | null | undefined, never: string): string {
  if (!iso) return never;
  return new Date(iso.replace(" ", "T") + (iso.includes("Z") ? "" : "Z")).toLocaleString("lt-LT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SettingsView({ session }: { session: SessionProp }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isParent = session.role === "parent";

  const settings = useQuery<{ user: SettingsUser }>({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  const scrapeRun = useQuery<{ run: ScrapeRun | null }>({
    queryKey: ["scrape", "latest"],
    enabled: isParent,
    queryFn: async () => {
      const res = await fetch("/api/scrape");
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
  });

  const toggleCalendar = useMutation({
    mutationFn: async (calendarEnabled: boolean) => {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarEnabled }),
      });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  const scrapeNow = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/scrape", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "failed");
      return body;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scrape", "latest"] }),
  });

  const syncCalendar = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/calendar/sync", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "failed");
      return body;
    },
  });

  const signOut = useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", { method: "POST" });
    },
    onSuccess: () => {
      router.push("/login");
      router.refresh();
    },
  });

  const user = settings.data?.user;

  return (
    <main className="flex flex-1 flex-col pb-24">
      <Header session={session} />

      <div className="px-5 pt-6">
        <h1 className="font-display text-2xl font-bold text-ink">Nustatymai</h1>
      </div>

      <div className="mt-4 flex flex-col gap-4 px-5">
        {/* Account */}
        <section className="rounded-card bg-surface p-5 shadow-card">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">
            Paskyra
          </h2>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-ink">{user?.name ?? session.name}</p>
              <p className="text-sm text-ink-soft">{user?.email ?? session.email}</p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary-dark">
              {session.role === "parent" ? "Tėvas / mama" : "Vaikas"}
            </span>
          </div>
        </section>

        {/* Calendar toggle */}
        <section className="rounded-card bg-surface p-5 shadow-card">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">
              Google kalendorius
            </h2>
          </div>
          <p className="mt-2 text-sm text-ink-soft">Namų darbai automatiškai patenka į tavo kalendorių.</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-sm font-medium text-ink">
              {user?.calendarEnabled ? "Įjungtas" : "Išjungtas"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(user?.calendarEnabled)}
              disabled={toggleCalendar.isPending || !user}
              onClick={() => toggleCalendar.mutate(!user?.calendarEnabled)}
              className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-50 ${
                user?.calendarEnabled ? "bg-primary" : "bg-black/15"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                  user?.calendarEnabled ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>
        </section>

        {/* Scrape (parent only) */}
        {isParent && (
          <section className="rounded-card bg-surface p-5 shadow-card">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-accent" />
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">
                Namų darbų atnaujinimas
              </h2>
            </div>
            <p className="mt-2 text-sm text-ink-soft">Atnaujinti iš šaltinio dabar arba palaukti automatinio atnaujinimo 15:00.</p>
            <button
              type="button"
              disabled={scrapeNow.isPending}
              onClick={() => scrapeNow.mutate()}
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${scrapeNow.isPending ? "animate-spin" : ""}`} />
              {scrapeNow.isPending ? "Atnaujinama…" : "Atnaujinti dabar"}
            </button>
            {scrapeNow.isError && (
              <p className="mt-2 text-xs font-medium text-danger">
                Įvyko klaida: {String(scrapeNow.error)}
              </p>
            )}
            <p className="mt-2 text-xs text-ink-soft">
              Paskutinis atnaujinimas:{" "}
              {formatWhen(scrapeRun.data?.run?.finished_at, "Dar nebuvo")}
            </p>
          </section>
        )}

        {/* Calendar sync (parent only) */}
        {isParent && (
          <section className="rounded-card bg-surface p-5 shadow-card">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-soft">
              Sinchronizuoti kalendorių
            </h2>
            <p className="mt-2 text-sm text-ink-soft">Sukurti kalendoriaus įvykius visiems vartotojams.</p>
            <button
              type="button"
              disabled={syncCalendar.isPending}
              onClick={() => syncCalendar.mutate()}
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              <Calendar className="h-4 w-4" />
              Sinchronizuoti kalendorių
            </button>
            {syncCalendar.isSuccess && (
              <p className="mt-2 text-xs font-medium text-success">
                OK (+{syncCalendar.data?.calendarCreated ?? 0})
              </p>
            )}
          </section>
        )}

        {/* Sign out */}
        <button
          type="button"
          disabled={signOut.isPending}
          onClick={() => signOut.mutate()}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-danger/10 px-4 py-3 font-semibold text-danger transition-colors hover:bg-danger/15 disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          Atsijungti
        </button>
      </div>

      <BottomNav role={session.role} />
    </main>
  );
}
