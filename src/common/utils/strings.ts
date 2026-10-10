import { randomBytes, randomInt } from 'node:crypto';

const SLUG_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

/** Short lowercase suffix used to make slugs unique, e.g. "k7m2". */
export function randomSlugSuffix(length = 4): string {
  return Array.from({ length }, () => SLUG_ALPHABET[randomInt(SLUG_ALPHABET.length)]).join('');
}

/** "Kaveen & Ishara" -> "kaveen-ishara". Non-latin text falls back to `fallback`. */
export function slugify(input: string, fallback = 'wedding', maxLength = 60): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return slug || fallback;
}

/** URL-safe random string, e.g. for guest invite codes. */
export function randomToken(bytes = 9): string {
  return randomBytes(bytes).toString('base64url');
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}
