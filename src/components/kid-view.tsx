"use client";

import type { CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";

import { formatDateHuman, vilniusDateString } from "@/lib/timezone";
import { Header } from "./header";
import { AiVerdict } from "./ai-verdict";
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

function SkeletonCard() {
  return (
    <div className="sheet p-5 pl-10">
      <div className="skeleton h-6 w-32" />
      <div className="skeleton mt-3 h-4 w-full" />
      <div className="skeleton mt-2 h-4 w-3/4" />
      <div className="skeleton mt-4 h-11 w-full" />
    </div>
  );
}

export function KidView({ session }: { session: SessionProp }) {
  const queryClient = useQueryClient();
  const todayHuman = formatDateHuman(vilniusDateString());

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
    <main className="flex flex-1 flex-col pb-10">
      <Header session={session} />

      <section className="px-5 pt-8">
        <p className="font-hand text-[1.35rem] leading-none text-pen-deep">{todayHuman}</p>
        <h1 className="font-display mt-2 text-[2rem] font-black leading-[1.05] tracking-tight text-ink">
          Mano namų darbai
        </h1>
        <p className="mt-2.5 max-w-[38ch] text-[0.9375rem] leading-relaxed text-ink-soft">
          Įkelk nuotrauką, kai atliksi — parašysiu, ar gerai.
        </p>
      </section>

      <div className="mt-7 flex flex-col gap-5 px-5">
        {isLoading && (
          <div className="flex flex-col gap-5">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {error && (
          <p className="font-hand text-2xl text-pen-deep">✗ Įvyko klaida — atnaujink puslapį.</p>
        )}

        {data && data.items.length === 0 && (
          <div className="sheet anim-rise p-8 pl-10">
            <p className="font-hand text-3xl leading-none text-leaf-deep">Laisvadienis!</p>
            <p className="mt-2 text-ink-soft">Šiandien namų darbų nėra. Gali ilsėtis. ✌</p>
          </div>
        )}

        {data?.items.map((item, i) => {
          const mine = item.submissions.find((s) => s.userId === session.id);
          const notDone = mine?.aiDone === false;
          const uploading = upload.isPending && upload.variables?.homeworkId === item.id;

          return (
            <article
              key={item.id}
              className="sheet anim-rise p-5 pl-10 pr-5"
              style={{ "--i": Math.min(i, 4) } as CSSProperties}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-[1.35rem] font-bold leading-snug text-ink">
                  {item.subject}
                </h2>
                {mine && (
                  <span
                    className={`font-hand mt-0.5 shrink-0 text-2xl leading-none ${
                      notDone ? "text-pen-deep" : "text-leaf-deep"
                    }`}
                  >
                    {notDone ? "Neatlikta ✗" : "Atlikta ✓"}
                  </span>
                )}
              </div>

              <p className="mt-1 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink-soft">
                {item.description}
              </p>
              <p className="font-hand mt-2.5 text-xl leading-none text-ink-soft">
                Atlikti iki {shortDue(item.dueDate)}
              </p>

              {mine ? (
                <div className="mt-4 border-t border-dashed border-rule pt-4">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mine.imagePath}
                      alt="Atlikta"
                      className="h-16 w-16 rounded-lg border border-rule object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      {notDone ? (
                        <span className="font-hand text-xl leading-none text-pen-deep">Pataisyk</span>
                      ) : (
                        <span className="font-hand text-xl leading-none text-leaf-deep">Puiku!</span>
                      )}
                      <label className="mt-1 block cursor-pointer text-xs font-medium text-ink-soft underline decoration-dotted underline-offset-2 hover:text-ink">
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
                <div className="mt-4 border-t border-dashed border-rule pt-4">
                  <label className="btn btn-primary w-full">
                    {uploading ? (
                      <>
                        <Loader2 className="h-[1.1rem] w-[1.1rem] animate-spin" />
                        Įkeliama ir vertinama…
                      </>
                    ) : (
                      <>
                        <Camera className="h-[1.1rem] w-[1.1rem]" />
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
                  <p className="font-hand mt-2 text-center text-xl leading-none text-ink-faint">
                    Nufotografuok arba padaryk ekrano nuotrauką
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
