import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: { auditLog: { create: vi.fn() } },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

import { auditLog } from '@/lib/admin-audit';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { headers } from 'next/headers';

describe('admin-audit.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates audit log with actor from requireAdmin', async () => {
    (requireAdmin as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'admin-1' });
    (headers as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => null,
    });

    await auditLog({ action: 'UPDATE_COURSE', entityType: 'Course', entityId: 'c1' });

    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'UPDATE_COURSE',
        entityType: 'Course',
        entityId: 'c1',
        metadata: null,
        ipAddress: null,
        userAgent: null,
      },
    });
  });

  it('includes metadata JSON when provided', async () => {
    (requireAdmin as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'admin-1' });
    (headers as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: () => null,
    });

    await auditLog({
      action: 'UPDATE_COURSE',
      entityType: 'Course',
      entityId: 'c1',
      metadata: { field: 'title', old: 'Old', new: 'New' },
    });

    const call = (db.auditLog.create as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(JSON.parse(call.data.metadata)).toEqual({ field: 'title', old: 'Old', new: 'New' });
  });

  it('captures IP and user-agent from headers', async () => {
    (requireAdmin as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'admin-1' });
    (headers as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      get: (h: string) => {
        if (h === 'x-forwarded-for') return '192.168.1.1';
        if (h === 'user-agent') return 'TestAgent/1.0';
        return null;
      },
    });

    await auditLog({ action: 'LOGIN', entityType: 'Session', entityId: 's1' });

    const call = (db.auditLog.create as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(call.data.ipAddress).toBe('192.168.1.1');
    expect(call.data.userAgent).toBe('TestAgent/1.0');
  });
});
