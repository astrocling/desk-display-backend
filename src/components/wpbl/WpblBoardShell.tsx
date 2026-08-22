"use client";

import Link from "next/link";

import { formatWpblUpdatedAt } from "./useWpblBoardData";

export function WpblSectionTitle({ children }: { children: string }) {
  return <h2 className="wpbl-section-label mb-3">{children}</h2>;
}

export function WpblSectionHeader({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="wpbl-section-label">{title}</h2>
      <Link href={href} className="wpbl-link text-xs">
        {linkLabel}
      </Link>
    </div>
  );
}

export function WpblUpdatedLine({
  updatedAt,
  hasLive,
}: {
  updatedAt?: string;
  hasLive?: boolean;
}) {
  if (!updatedAt && !hasLive) return null;
  return (
    <div className="text-xs wpbl-muted">
      {updatedAt ? <>Updated {formatWpblUpdatedAt(updatedAt)}</> : null}
      {hasLive ? (
        <span className="ml-2" style={{ color: "var(--wpbl-live)" }}>
          · Live
        </span>
      ) : null}
    </div>
  );
}

export function WpblBoardLoading() {
  return <p className="mt-8 text-sm wpbl-muted">Loading…</p>;
}

export function WpblBoardError({
  message,
  className = "mt-8",
}: {
  message: string;
  className?: string;
}) {
  return (
    <div className={`wpbl-alert ${className}`}>
      {message}
    </div>
  );
}
