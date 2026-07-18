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
    toolSession: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
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

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn().mockResolvedValue({ id: 'u1', email: 'test@test.com', name: 'Test', role: 'STUDENT', xp: 0, level: 1, streakDays: 0 }),
  requireAuth: vi.fn().mockResolvedValue({ id: 'u1', email: 'test@test.com', name: 'Test', role: 'STUDENT', xp: 0, level: 1, streakDays: 0 }),
}));

import { db } from '@/lib/db';
import { saveToolSession, loadToolSession } from '@/app/actions/tools';

describe('tool session actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetScenario.mockReturnValue({ id: 's1', name: 'Scenario 1' });
  });

  it('saveToolSession rejects session not found', async () => {
    (db.toolSession.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await saveToolSession({ sessionId: 'missing', state: {} });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Session not found.');
  });

  it('saveToolSession rejects forbidden owner', async () => {
    (db.toolSession.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1', userId: 'other', status: 'IN_PROGRESS', scenarioId: 's1', toolType: 'CAMPAIGN_BUILDER', state: '{}', createdAt: new Date(), updatedAt: new Date(),
    });
    // getSession mock returns u1, but session has userId: 'other' -> Forbidden
    const result = await saveToolSession({ sessionId: 's1', state: {} });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('Forbidden.');
  });

  it('saveToolSession freezes edits once the session leaves IN_PROGRESS (atomic guard)', async () => {
    (db.toolSession.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1', userId: 'u1', status: 'IN_PROGRESS', scenarioId: 's1', toolType: 'CAMPAIGN_BUILDER', state: '{}', timeSpentSeconds: 0, createdAt: new Date(), updatedAt: new Date(),
    });
    // A concurrent submit transitioned the session between the read and the
    // guarded update, so the status-guarded updateMany matches zero rows.
    (db.toolSession.updateMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
    const result = await saveToolSession({ sessionId: 's1', state: { a: 1 } });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('This session has been submitted and can no longer be edited.');
  });

  it('saveToolSession writes through the IN_PROGRESS-guarded update', async () => {
    (db.toolSession.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 's1', userId: 'u1', status: 'IN_PROGRESS', scenarioId: 's1', toolType: 'CAMPAIGN_BUILDER', state: '{}', timeSpentSeconds: 0, createdAt: new Date(), updatedAt: new Date(),
    });
    (db.toolSession.updateMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    const result = await saveToolSession({ sessionId: 's1', state: { a: 1 } });
    expect(result.success).toBe(true);
    expect(db.toolSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'IN_PROGRESS' }) }),
    );
  });

  it('loadToolSession returns null for missing session', async () => {
    (db.toolSession.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect(await loadToolSession('missing')).toBeNull();
  });
});