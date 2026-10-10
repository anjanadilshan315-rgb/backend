/**
 * MySQL returns JSON columns as objects, MariaDB returns them as strings.
 * This normalises both to a value (or the fallback when empty / invalid).
 */
export function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function toJsonColumn(value: unknown): string | null {
  return value === null || value === undefined ? null : JSON.stringify(value);
}
