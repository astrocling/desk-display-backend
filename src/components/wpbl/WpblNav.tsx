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

  const onDetail =
    pathname.startsWith("/wpbl/games/") ||
    pathname.startsWith("/wpbl/players/");

  return (
    <nav className="wpbl-nav mt-5" aria-label="WPBL sections">
      {LINKS.map((link) => {
        const active = !onDetail && link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={active ? "wpbl-nav-link wpbl-nav-link--active" : "wpbl-nav-link"}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
