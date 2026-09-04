"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type PlayerNameLinkProps = {
  playerId: string | null | undefined;
  name: string;
  className?: string;
  children?: ReactNode;
};

/** Link a player name to `/wpbl/players/{id}` when an id is known. */
export function PlayerNameLink({
  playerId,
  name,
  className,
  children,
}: PlayerNameLinkProps) {
  const content = children ?? name;
  if (!playerId) {
    return <span className={className}>{content}</span>;
  }

  return (
    <Link
      href={`/wpbl/players/${encodeURIComponent(playerId)}`}
      className={
        className ??
        "text-inherit underline-offset-2 hover:text-[var(--wpbl-highlight)] hover:underline"
      }
    >
      {content}
    </Link>
  );
}
