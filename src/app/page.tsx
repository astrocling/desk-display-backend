import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-start justify-center gap-3 p-8 font-sans">
      <h1 className="text-xl font-semibold">desk-display-backend</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        JSON APIs for the dial. Web radar fixture:
      </p>
      <Link
        href="/radar"
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
      >
        Open radar
      </Link>
    </main>
  );
}
