import { GameDetailClient } from "@/components/wpbl/GameDetailClient";
import { WpblThemeToggle } from "@/components/wpbl/WpblThemeToggle";

export default async function WpblGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-5xl px-4 py-8">
      <div className="flex justify-end">
        <WpblThemeToggle />
      </div>
      <GameDetailClient gameId={id} />
    </main>
  );
}
