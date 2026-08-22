"use client";

import Link from "next/link";

import { formatWpblUpdatedAt } from "./useWpblBoardData";

export function WpblSectionTitle({ children }: { children: string }) {
  return (
    <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
      {children}
    </h2>
  );
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
      <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <Link
        href={href}
        className="text-xs font-medium text-slate-600 underline-offset-2 hover:underline dark:text-slate-300"
      >
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
    <div className="text-xs text-slate-500">
      {updatedAt ? <>Updated {formatWpblUpdatedAt(updatedAt)}</> : null}
      {hasLive ? (
        <span className="ml-2 text-red-600 dark:text-red-400">· Live</span>
      ) : null}
    </div>
  );
}

export function WpblBoardLoading() {
  return <p className="mt-8 text-sm text-slate-500">Loading…</p>;
}

export function WpblBoardError({
  message,
  className = "mt-8",
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 ${className}`}
    >
      {message}
    </div>
  );
}
