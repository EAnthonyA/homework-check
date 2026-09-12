"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Settings } from "lucide-react";
import type { Role } from "@/lib/repo";

function NavLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-14 flex-1 items-center justify-center gap-2 text-[0.8125rem] font-semibold transition-colors ${
        active ? "text-pen-deep" : "text-ink-faint hover:text-ink"
      }`}
    >
      {icon}
      {label}
      <span
        className={`absolute bottom-0 h-[3px] w-10 rounded-t-full transition-colors ${
          active ? "bg-pen" : "bg-transparent"
        }`}
      />
    </Link>
  );
}

export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const homeHref = role === "parent" ? "/dashboard" : "/kid";
  const homeLabel = role === "parent" ? "Šiandien" : "Mano darbai";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-rule bg-sheet/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-[600px]">
        <NavLink
          href={homeHref}
          active={pathname === homeHref}
          icon={<BookOpen className="h-[1.15rem] w-[1.15rem]" />}
          label={homeLabel}
        />
        <NavLink
          href="/settings"
          active={pathname === "/settings"}
          icon={<Settings className="h-[1.15rem] w-[1.15rem]" />}
          label="Nustatymai"
        />
      </div>
    </nav>
  );
}
