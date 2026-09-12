"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Camera, Check, Loader2 } from "lucide-react";

import { formatDateHuman } from "@/lib/timezone";
import { Header } from "./header";
import { BottomNav } from "./bottom-nav";
import { AiVerdict } from "./ai-verdict";
import type { SessionProp, TodayResponse } from "./types";

export function KidView({ session }: { session: SessionProp }) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<TodayResponse>({
    queryKey: ["homework", "today"],
    queryFn: async () => {
      const res = await fetch("/api/homework/today");
      if (!res.ok) throw new Error("failed to load homework");
      return res.json();
    },
  });

  const upload = useMutation({
    mutationFn: async ({ homeworkId, file }: { homeworkId: string; file: File }) => {
      const formData = new FormData();
      formData.append("homeworkId", homeworkId);
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homework", "today"] });
    },
  });

  return (
    <main className="flex flex-1 flex-col pb-24">
      <Header session={session} />

      <div className="px-5 pt-6">
        <h1 className="font-display text-2xl font-bold text-ink">Mano namų darbai</h1>
        <p className="mt-1 text-ink-soft">Įkelk nuotrauką, kai atliksi</p>
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
            <p className="mt-2 font-medium text-ink">Šiandien namų darbų nėra! 🎉</p>
          </div>
        )}

        {data?.items.map((item) => {
          const mine = item.submissions.find((s) => s.userId === session.id);
          const uploading = upload.isPending && upload.variables?.homeworkId === item.id;

          return (
            <div key={item.id} className="rounded-card bg-surface p-5 shadow-card">
              <h2 className="font-display text-lg font-semibold text-ink">{item.subject}</h2>
              <p className="mt-1 whitespace-pre-wrap text-ink-soft">{item.description}</p>
              <p className="mt-2 flex items-center gap-1 text-xs font-medium text-ink-soft">
                <Calendar className="h-3.5 w-3.5" />
                Atlikti iki: {formatDateHuman(item.dueDate)}
              </p>

              {mine ? (
                <div className="mt-4 border-t border-black/5 pt-4">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mine.imagePath}
                      alt="Atlikta"
                      className="h-16 w-16 rounded-xl object-cover"
                    />
                    <div className="flex flex-col">
                      <span className="flex items-center gap-1 text-sm font-semibold text-success">
                        <Check className="h-4 w-4" />
                        Atlikta! ✅
                      </span>
                      <label className="mt-1 cursor-pointer text-xs font-medium text-ink-soft underline">
                        Pakeisti nuotrauką
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) upload.mutate({ homeworkId: item.id, file });
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <AiVerdict submission={mine} />
                </div>
              ) : (
                <div className="mt-4 border-t border-black/5 pt-4">
                  <label className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-dark">
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Įkeliama ir vertinama…
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4" />
                        Įkelti nuotrauką
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) upload.mutate({ homeworkId: item.id, file });
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <p className="mt-2 text-center text-xs text-ink-soft">Nufotografuok arba padaryk ekrano nuotrauką.</p>
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
