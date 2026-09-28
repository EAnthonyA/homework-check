"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileDown, Loader2, Mail } from "lucide-react";
import type { CSSProperties } from "react";
import type { MessagesResponse } from "./types";

function formatReceivedAt(value: string): string {
  const [date, time] = value.split(" ");
  if (!date || !time) return value;
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return value;
  const humanDate = new Intl.DateTimeFormat("lt-LT", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
  return `${humanDate} · ${time.slice(0, 5)}`;
}

export function MessagesPanel() {
  const queryClient = useQueryClient();
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
  const markRead = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await fetch(`/api/messages/${messageId}/read`, { method: "POST" });
      if (!response.ok) throw new Error("failed to mark message as read");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messages"] }),
  });

  return (
    <section className="flex flex-col gap-4" aria-live="polite">
      {messages.isLoading && [0, 1].map((item) => (
        <div key={item} className="sheet p-5 pl-10" aria-label="Kraunami pranešimai">
          <div className="skeleton h-5 w-44" /><div className="skeleton mt-3 h-7 w-3/4" /><div className="skeleton mt-4 h-4 w-full" />
        </div>
      ))}
      {messages.isError && <p role="alert" className="font-hand text-2xl text-pen-deep">✗ Nepavyko įkelti pranešimų.</p>}
      {messages.data?.items.length === 0 && (
        <div className="sheet p-8 pl-10 text-center">
          <Mail className="mx-auto h-6 w-6 text-leaf-deep" aria-hidden="true" />
          <p className="font-hand mt-3 text-3xl leading-none text-leaf-deep">Tuščia</p>
          <p className="mt-2 text-sm text-ink-soft">Pranešimai atsiras po kito atnaujinimo.</p>
        </div>
      )}
      {messages.data?.items.map((message, index) => (
        <article key={message.id} className="sheet anim-rise p-5 pl-10" style={{ "--i": Math.min(index, 4) } as CSSProperties}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="font-semibold text-ink">{message.sender}</p>
            <time className="font-hand text-lg leading-none text-ink-soft">{formatReceivedAt(message.receivedAt)}</time>
          </div>
          <h2 className="font-display mt-3 text-[1.35rem] font-bold leading-snug text-ink">{message.subject}</h2>
          <p className="mt-2 whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink-soft">{message.body}</p>
          {message.attachments.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-dashed border-rule pt-3">
              {message.attachments.map((attachment) => (
                <a key={attachment.id} href={attachment.href} className="btn btn-outline min-h-0 px-3 py-2 text-sm" target="_blank" rel="noreferrer">
                  <FileDown className="h-4 w-4" />
                  <span className="max-w-56 truncate">{attachment.name}</span>
                </a>
              ))}
            </div>
          )}
          <div className="mt-4 border-t border-dashed border-rule pt-3">
            <button
              type="button"
              className="btn btn-outline w-full"
              disabled={markRead.isPending}
              onClick={() => markRead.mutate(message.id)}
            >
              {markRead.isPending && markRead.variables === message.id ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Žymima…</>
              ) : (
                <><Check className="h-4 w-4" /> Pažymėti perskaitytu</>
              )}
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
