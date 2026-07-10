import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetScenario = vi.fn();

vi.mock('@/engine/campaign-builder/scenarios', () => ({
  getScenarioById: (...args: unknown[]) => mockGetScenario(...args),
}))

vi.mock('@/engine/bid-elevator/scenarios', () => ({
  getScenarioById: (...args: unknown[]) => mockGetScenario(...args),
}))

vi.mock('@/engine/str-triage/scenarios', () => ({
  getScenarioById: (...args: unknown[]) => mockGetScenario(...args),
}))

vi.mock('@/engine/listing-audit/scenarios', () => ({
  getScenarioById: (...args: unknown[]) => mockGetScenario(...args),
}))

vi.mock('@/engine/keyword-research/scenarios', () => ({
  getScenarioById: (...args: unknown[]) => mockGetScenario(...args),
}))

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    toolSession: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: () => undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

// Mock getSession to return a test user - this is what requireAuth calls internally
vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue({ id: 'u1', email: 'test@test.com', name: 'Test', role: 'STUDENT', xp: 0, level: 1, streakDays: 0 }),
}));

import { db } from '@/lib/db';
import { saveToolSession, loadToolSession } from '@/app/actions/tools';

describe('tool session actions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetScenario.mockReturnValue({ id: 's1', name: 'Scenario 1' });
  });

  it('saveToolSession rejects session not found', async () => {
    (db.toolSession.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await saveToolSession({ sessionId: 'missing', state: {} });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Session not found.');
  });

  it('saveToolSession rejects forbidden owner', async () => {
    (db.toolSession.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1', userId: 'other', status: 'IN_PROGRESS', scenarioId: 's1', toolType: 'CAMPAIGN_BUILDER', state: '{}', createdAt: new Date(), updatedAt: new Date(),
    });
    // getSession mock returns u1, but session has userId: 'other' -> Forbidden
    const result = await saveToolSession({ sessionId: 's1', state: {} });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Forbidden.');
  });

  it('loadToolSession returns null for missing session', async () => {
    (db.toolSession.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect(await loadToolSession('missing')).toBeNull();
  });
});