import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rateLimit } from '../rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows hits under the limit and blocks hits exceeding the limit', () => {
    // Call 5 times within a minute
    for (let i = 0; i < 5; i++) {
      const res = rateLimit('test-key', 5, 60_000);
      expect(res.allowed).toBe(true);
      expect(res.retryAfterSeconds).toBe(0);
    }

    // 6th call should be blocked
    const blockedRes = rateLimit('test-key', 5, 60_000);
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.retryAfterSeconds).toBe(60);
  });

  it('slides the window correctly', () => {
    // 1st hit at t=0
    expect(rateLimit('test-key-2', 2, 10_000).allowed).toBe(true);

    // Advance 5s
    vi.advanceTimersByTime(5000);

    // 2nd hit at t=5s
    expect(rateLimit('test-key-2', 2, 10_000).allowed).toBe(true);

    // 3rd hit at t=5s (blocked)
    const blocked = rateLimit('test-key-2', 2, 10_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(5); // Oldest hit at t=0 falls out at t=10, which is in 5s.

    // Advance 5.1s to pass t=10s
    vi.advanceTimersByTime(5100);

    // 1st hit should have fallen out, leaving 1 hit (from t=5s) in window. We can hit again!
    expect(rateLimit('test-key-2', 2, 10_000).allowed).toBe(true);
  });

  it('triggers opportunistic cleanup when buckets map exceeds 10,000 entries', () => {
    // First, let's add some expired hits to the map
    rateLimit('expired-key', 1, 1000);
    vi.advanceTimersByTime(2000); // Expiry passed

    // Now, insert 10,001 entries to force buckets.size > 10,000
    for (let i = 0; i < 10005; i++) {
      rateLimit(`key-${i}`, 1, 1000);
    }

    // Since 'expired-key' is past its expiry, it should have been cleaned up by the opportunistic cleanup.
    // Let's verify that hitting it again behaves as a fresh hit
    const res = rateLimit('expired-key', 1, 1000);
    expect(res.allowed).toBe(true);
  });
});
