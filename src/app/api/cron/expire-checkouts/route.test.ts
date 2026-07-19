import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSweep = vi.fn();
vi.mock('@/lib/enrollment', () => ({
  sweepExpiredCheckouts: (...args: unknown[]) => mockSweep(...args),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { GET } from './route';

function req(auth?: string): Request {
  const headers = new Headers();
  if (auth !== undefined) headers.set('authorization', auth);
  return new Request('http://localhost/api/cron/expire-checkouts', { headers });
}

describe('GET /api/cron/expire-checkouts', () => {
  const original = process.env.CRON_SECRET;
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
  });
  afterEach(() => {
    process.env.CRON_SECRET = original;
  });

  it('runs the sweep and returns the count with a valid secret', async () => {
    mockSweep.mockResolvedValue(4);

    const res = await GET(req('Bearer test-secret') as never);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ expired: 4 });
    expect(mockSweep).toHaveBeenCalledOnce();
  });

  it('rejects a request with a wrong secret and does not sweep', async () => {
    const res = await GET(req('Bearer nope') as never);

    expect(res.status).toBe(401);
    expect(mockSweep).not.toHaveBeenCalled();
  });

  it('rejects a request with no authorization header', async () => {
    const res = await GET(req() as never);

    expect(res.status).toBe(401);
    expect(mockSweep).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET;

    const res = await GET(req('Bearer test-secret') as never);

    expect(res.status).toBe(503);
    expect(mockSweep).not.toHaveBeenCalled();
  });
});
