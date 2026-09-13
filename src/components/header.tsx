"use client";

import Link from "next/link";
import type { SessionProp } from "./types";

export function Header({ session }: { session: SessionProp }) {
  const homeHref = session.role === "parent" ? "/dashboard" : "/kid";

  return (
    <header className="flex items-center justify-between px-5 pt-7">
      <Link href={homeHref} className="flex flex-col leading-none">
        <span className="font-display text-[1.35rem] font-bold tracking-tight text-ink">
          Namų <em className="italic text-pen-deep">darbai</em>
        </span>
        <svg
          viewBox="0 0 120 9"
          className="mt-1.5 h-2 w-[7.5rem] text-pen"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M2 6.5C28 2.5 58 8 118 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </Link>

      <div className="flex items-center gap-2.5">
        <span className="hidden text-sm font-medium text-ink-soft sm:block">{session.name}</span>
        <Link
          href="/settings"
          aria-label="Nustatymai"
          title="Nustatymai"
          className="block rounded-full transition-transform duration-150 hover:scale-105 focus-visible:scale-105"
        >
          {session.picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.picture}
              alt={session.name}
              referrerPolicy="no-referrer"
              className="h-9 w-9 rounded-full border border-rule object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pen/15 font-display text-[1.05rem] font-bold text-pen-deep transition-colors hover:bg-pen/25">
              {session.name.charAt(0).toUpperCase()}
            </div>
          )}
        </Link>
      </div>
    </header>
  );
}
