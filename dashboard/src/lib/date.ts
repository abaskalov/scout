import { LOCALE_MAP, type Locale } from '../i18n';

/**
 * Parse date string from API into a Date object.
 * SQLite datetime('now') returns "2026-03-16 18:47:23" (UTC, no Z suffix).
 * ISO strings have "T" and "Z". Handle both formats.
 */
export function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  // Already ISO with Z or timezone offset
  if (dateStr.includes('T') || dateStr.includes('Z') || dateStr.includes('+')) {
    return new Date(dateStr);
  }
  // SQLite format "YYYY-MM-DD HH:MM:SS" — treat as UTC
  return new Date(dateStr.replace(' ', 'T') + 'Z');
}

/**
 * Format date for display in user's timezone.
 */
export function formatDate(dateStr: string, locale: Locale = 'ru'): string {
  const d = parseDate(dateStr);
  return d.toLocaleString(LOCALE_MAP[locale], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Short date format (date only).
 */
export function formatDateShort(dateStr: string, locale: Locale = 'ru'): string {
  const d = parseDate(dateStr);
  return d.toLocaleDateString(LOCALE_MAP[locale], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
