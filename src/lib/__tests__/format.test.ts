import { describe, it, expect } from 'vitest';
import { formatPhp, formatDate, formatDateTime, formatReceiptNumber } from '@/lib/format';

describe('format.ts', () => {
  it('formatPhp takes centavos and returns PHP currency string', () => {
    expect(formatPhp(299900)).toBe('₱2,999.00');
  });

  it('formatPhp handles zero and sub-peso amounts', () => {
    expect(formatPhp(0)).toBe('₱0.00');
    expect(formatPhp(9950)).toBe('₱99.50');
  });

  it('formatDate returns short en-PH date', () => {
    const d = new Date(Date.UTC(2026, 6, 10));
    expect(formatDate(d)).toBe('Jul 10, 2026');
  });

  it('formatDateTime returns long en-PH date with time', () => {
    const d = new Date(Date.UTC(2026, 6, 10, 14, 30));
    const out = formatDateTime(d);
    expect(out).toContain('2026');
    expect(out).toContain('July 10');
    // en-PH converts to local PH time, so we assert date parts only
    expect(out).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
  });

  it('formatReceiptNumber zero-pads sequence', () => {
    expect(formatReceiptNumber(7, 2026)).toBe('BS 00007-2026');
  });
});
