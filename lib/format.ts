export function formatCents(cents: number): string {
  if (cents === 0) return '$0';
  if (cents < 100000) return `$${Math.round(cents / 100)}`;
  if (cents < 10000000) {
    const k = (cents / 100000).toFixed(1);
    return `$${k.replace('.0', '')}k`;
  }
  return `$${Math.round(cents / 100000)}k`;
}
