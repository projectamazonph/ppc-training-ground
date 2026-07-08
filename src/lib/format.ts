/**
 * Display formatters used across the app.
 *
 * These were duplicated inline in live-classes, payments, and admin
 * pages. Centralized here so changing the locale or currency convention
 * is a single edit.
 *
 * Convention: amounts passed in are in WHOLE PHP (not centavos) — matches
 * the Prisma `amountPhp` / `pricePhp` fields. If you have centavos,
 * divide by 100 first.
 */

/**
 * Format a whole-PHP amount as Philippine peso currency. Default locale
 * is en-PH; the result includes the ₱ symbol and 2 decimal places.
 */
export function formatPhp(amountPhp: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(amountPhp);
}

/**
 * Format a Date as a short human-readable date in en-PH locale.
 * Example: "Jul 10, 2026".
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Format a Date as a long human-readable date in en-PH locale.
 * Example: "July 10, 2026, 2:30 PM".
 */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format a BIR-compliant receipt number for display.
 * Example: "BS 00001-2026" — the 5-digit zero-padded sequence + year.
 */
export function formatReceiptNumber(sequence: number, year: number): string {
  return `BS ${String(sequence).padStart(5, '0')}-${year}`;
}
