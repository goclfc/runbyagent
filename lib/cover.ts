/**
 * cover_url for library docs: a site-relative path starting with "/" or an https url, max 500 chars.
 * returns the cleaned value, null to clear, or undefined when the input is invalid.
 */
export function normalizeCoverUrl(value: unknown): string | null | undefined {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 500) return undefined;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  if (/^https:\/\/[^\s]+$/i.test(trimmed)) return trimmed;
  return undefined;
}
