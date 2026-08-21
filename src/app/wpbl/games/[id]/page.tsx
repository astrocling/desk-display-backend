import { GameDetailClient } from "@/components/wpbl/GameDetailClient";

export default async function WpblGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-4 py-8 pr-14">
      <GameDetailClient gameId={id} />
    </main>
  );
}
