"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar, History, LogOut, RefreshCw } from "lucide-react";
import { Header } from "./header";
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
    <main className="flex flex-1 flex-col pb-10">
      <Header session={session} />

      <section className="px-5 pt-8">
        <h1 className="font-display text-[2rem] font-black leading-tight tracking-tight text-ink">
          Nustatymai
        </h1>
        <p className="mt-1.5 text-ink-soft">Paskyra, kalendorius ir atnaujinimai.</p>
      </section>

      <div className="mt-7 flex flex-col gap-5 px-5">
        {/* Account */}
        <section className="sheet p-5 pl-10">
          <h2 className="font-display text-lg font-bold text-ink">Paskyra</h2>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{user?.name ?? session.name}</p>
              <p className="truncate text-sm text-ink-soft">{user?.email ?? session.email}</p>
            </div>
            <span className="shrink-0 rounded-full bg-slate/10 px-3 py-1 text-xs font-semibold text-slate">
              {session.role === "parent" ? "Tėvas / mama" : "Vaikas"}
            </span>
          </div>
        </section>

        {/* Calendar toggle */}
        <section className="sheet p-5 pl-10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-ink">Google kalendorius</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                Namų darbai automatiškai patenka į tavo kalendorių.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(user?.calendarEnabled)}
              disabled={toggleCalendar.isPending || !user}
              onClick={() => toggleCalendar.mutate(!user?.calendarEnabled)}
              className={`relative h-7 w-[3.25rem] shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                user?.calendarEnabled ? "bg-leaf" : "bg-rule"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-sheet shadow-sm transition-all ${
                  user?.calendarEnabled ? "left-[1.75rem]" : "left-1"
                }`}
              />
            </button>
          </div>
        </section>

        {/* History (parent only) */}
        {isParent && (
          <section className="sheet p-5 pl-10">
            <h2 className="font-display text-lg font-bold text-ink">Namų darbų istorija</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              Pažymėti atlikti namų darbai.
            </p>
            <Link href="/history" className="btn btn-outline mt-4 w-full">
              <History className="h-4 w-4" />
              Peržiūrėti istoriją
            </Link>
          </section>
        )}

        {/* Scrape (parent only) */}
        {isParent && (
          <section className="sheet p-5 pl-10">
            <h2 className="font-display text-lg font-bold text-ink">Atnaujinti namų darbus</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              Paimk iš šaltinio dabar arba palauk automatinio atnaujinimo 15:00.
            </p>
            <button
              type="button"
              disabled={scrapeNow.isPending}
              onClick={() => scrapeNow.mutate()}
              className="btn btn-outline mt-4 w-full"
            >
              <RefreshCw className={`h-4 w-4 ${scrapeNow.isPending ? "animate-spin" : ""}`} />
              {scrapeNow.isPending ? "Atnaujinama…" : "Atnaujinti dabar"}
            </button>
            {scrapeNow.isError && (
              <p className="mt-2 text-sm font-medium text-pen-deep">
                Įvyko klaida: {String(scrapeNow.error)}
              </p>
            )}
            <p className="mt-2 text-xs text-ink-faint">
              Paskutinis atnaujinimas:{" "}
              {formatWhen(scrapeRun.data?.run?.finished_at, "Dar nebuvo")}
            </p>
          </section>
        )}

        {/* Calendar sync (parent only) */}
        {isParent && (
          <section className="sheet p-5 pl-10">
            <h2 className="font-display text-lg font-bold text-ink">Sinchronizuoti kalendorių</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              Sukurti kalendoriaus įvykius visiems vartotojams.
            </p>
            <button
              type="button"
              disabled={syncCalendar.isPending}
              onClick={() => syncCalendar.mutate()}
              className="btn btn-primary mt-4 w-full"
            >
              <Calendar className="h-4 w-4" />
              Sinchronizuoti kalendorių
            </button>
            {syncCalendar.isSuccess && (
              <p className="font-hand mt-2 text-xl text-leaf-deep">
                {syncCalendar.data?.calendarFailed
                  ? `Nepavyko sinchronizuoti ${syncCalendar.data.calendarFailed} įvykių. Bandyk dar kartą.`
                  : `OK (+${syncCalendar.data?.calendarCreated ?? 0})`}
              </p>
            )}
          </section>
        )}

        {/* Sign out */}
        <button
          type="button"
          disabled={signOut.isPending}
          onClick={() => signOut.mutate()}
          className="btn btn-danger w-full"
        >
          <LogOut className="h-4 w-4" />
          Atsijungti
        </button>
      </div>
    </main>
  );
}
