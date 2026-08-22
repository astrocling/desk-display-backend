/** Display WPBL positions in uppercase (e.g. cf → CF, dh/1b → DH/1B). */
export function formatWpblPosition(
  position: string | null | undefined,
): string | null {
  const trimmed = position?.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}
