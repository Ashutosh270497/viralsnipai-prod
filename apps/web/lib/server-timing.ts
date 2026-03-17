export function parseServerTimingMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const match = header.match(/dur=([\d.]+)/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}
