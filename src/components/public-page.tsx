import Link from "next/link";
import type { ReactNode } from "react";

export function PublicPage({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lead: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col px-5 py-7 sm:py-10">
      <header className="anim-fade flex items-center justify-between gap-4">
        <Link href="/about" className="flex flex-col leading-none">
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
        <Link href="/login" className="btn btn-outline min-h-10 px-4 py-2 text-sm">
          Prisijungti
        </Link>
      </header>

      <article className="sheet anim-rise mt-10 px-7 py-9 pl-11 sm:px-10 sm:pl-14" style={{ "--i": 1 } as React.CSSProperties}>
        <p className="font-hand text-2xl leading-none text-pen-deep">{eyebrow}</p>
        <h1 className="font-display mt-3 max-w-[13ch] text-[clamp(2.4rem,8vw,3.7rem)] font-black leading-[0.94] tracking-tight text-ink">
          {title}
        </h1>
        <p className="mt-5 max-w-[42ch] text-[1.04rem] leading-7 text-ink-soft">{lead}</p>

        <div className="mt-10 space-y-9 text-[0.98rem] leading-7 text-ink-soft">{children}</div>
      </article>

      <footer className="anim-fade mt-8 flex flex-wrap gap-x-5 gap-y-2 px-1 pb-3 text-sm text-ink-soft" style={{ "--i": 2 } as React.CSSProperties}>
        <Link href="/about" className="underline decoration-rule underline-offset-4 hover:text-ink">
          Apie programą
        </Link>
        <Link href="/privacy" className="underline decoration-rule underline-offset-4 hover:text-ink">
          Privatumas
        </Link>
        <Link href="/terms" className="underline decoration-rule underline-offset-4 hover:text-ink">
          Naudojimo sąlygos
        </Link>
      </footer>
    </main>
  );
}

export function PublicSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-[1.45rem] font-bold leading-tight tracking-tight text-ink">{title}</h2>
      <div className="mt-2.5 space-y-4">{children}</div>
    </section>
  );
}

export function PublicList({ children }: { children: ReactNode }) {
  return <ul className="space-y-2 pl-5 marker:text-pen">{children}</ul>;
}
