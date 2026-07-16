import { describe, it, expect, vi } from 'vitest';

vi.mock('@prisma/client', () => ({
  PrismaClient: class FakePrismaClient {
    constructor() {}
    $extends() {
      return this;
    }
  },
  Prisma: {},
}));

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: class FakePrismaPg {
    constructor() {}
  },
}));

// Re-import after the mock is in place so PrismaClient doesn't throw
import { injectDeletedAtFilter } from '@/lib/db';

describe('db.ts — injectDeletedAtFilter', () => {
  it('injects deletedAt: null when where is empty', () => {
    const params: Record<string, unknown> = {};
    injectDeletedAtFilter(params);
    expect(params).toEqual({ where: { deletedAt: null } });
  });

  it('injects deletedAt: null when where has no deletedAt', () => {
    const params: Record<string, unknown> = { where: { status: 'active' } };
    injectDeletedAtFilter(params);
    expect(params).toEqual({ where: { status: 'active', deletedAt: null } });
  });

  it('leaves params alone when deletedAt is explicitly set (non-null)', () => {
    const params: Record<string, unknown> = { where: { deletedAt: { not: null } } };
    injectDeletedAtFilter(params);
    // Should not overwrite explicit deletedAt queries
    expect(params).toEqual({ where: { deletedAt: { not: null } } });
  });

  it('leaves params alone when deletedAt is an explicit date value', () => {
    const date = new Date('2025-01-01');
    const params: Record<string, unknown> = { where: { deletedAt: date } };
    injectDeletedAtFilter(params);
    expect(params.where).toEqual({ deletedAt: date });
  });

  it('does not inject when deletedAt is already null', () => {
    const params: Record<string, unknown> = { where: { deletedAt: null } };
    injectDeletedAtFilter(params);
    expect(params).toEqual({ where: { deletedAt: null } });
  });

  it('handles params without a where key', () => {
    const params: Record<string, unknown> = { include: { posts: true } };
    injectDeletedAtFilter(params);
    expect(params).toEqual({ where: { deletedAt: null }, include: { posts: true } });
  });
});
