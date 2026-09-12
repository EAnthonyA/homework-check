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
      className={`flex min-h-14 flex-1 items-center justify-center gap-2 text-sm font-medium transition-colors ${
        active ? "text-primary" : "text-ink-soft hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const homeHref = role === "parent" ? "/dashboard" : "/kid";
  const homeLabel = role === "parent" ? "Šiandien" : "Mano darbai";

  return (
    <nav className="fixed inset-x-0 bottom-0 border-t border-black/5 bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-xl">
        <NavLink
          href={homeHref}
          active={pathname === homeHref}
          icon={<BookOpen className="h-5 w-5" />}
          label={homeLabel}
        />
        <NavLink
          href="/settings"
          active={pathname === "/settings"}
          icon={<Settings className="h-5 w-5" />}
          label="Nustatymai"
        />
      </div>
    </nav>
  );
}
