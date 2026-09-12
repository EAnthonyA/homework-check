"use client";

import type { SessionProp } from "./types";

export function Header({ session }: { session: SessionProp }) {
  return (
    <header className="flex items-center justify-between px-5 pt-6">
      <div className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden="true">
          📚
        </span>
        <span className="font-display text-lg font-bold text-ink">Namų darbai</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden text-sm font-medium text-ink-soft sm:block">{session.name}</span>
        {session.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.picture}
            alt={session.name}
            referrerPolicy="no-referrer"
            className="h-9 w-9 rounded-full"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 font-display text-primary">
            {session.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </header>
  );
}
