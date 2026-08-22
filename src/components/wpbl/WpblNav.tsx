"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/wpbl", label: "Home", match: (path: string) => path === "/wpbl" },
  {
    href: "/wpbl/standings",
    label: "Standings",
    match: (path: string) => path.startsWith("/wpbl/standings"),
  },
  {
    href: "/wpbl/schedule",
    label: "Schedule",
    match: (path: string) => path.startsWith("/wpbl/schedule"),
  },
  {
    href: "/wpbl/stats",
    label: "Stats",
    match: (path: string) => path.startsWith("/wpbl/stats"),
  },
] as const;

export function WpblNav() {
  const pathname = usePathname() ?? "/wpbl";

  // Game / player detail: keep nav for jumps, but don't highlight a board tab.
  const onDetail =
    pathname.startsWith("/wpbl/games/") ||
    pathname.startsWith("/wpbl/players/");

  return (
    <nav
      className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200 pb-px dark:border-slate-700 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="WPBL sections"
    >
      {LINKS.map((link) => {
        const active = !onDetail && link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-50"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
