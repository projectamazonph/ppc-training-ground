'use server';

import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { headers } from 'next/headers';

/**
 * Create an AuditLog entry for an admin action.
 * Always called from a Server Action so headers() is safe.
 */
export async function auditLog(params: {
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  const actor = await requireAdmin();
  const heads = await headers();

  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      ipAddress: heads.get('x-forwarded-for') ?? heads.get('x-real-ip') ?? null,
      userAgent: heads.get('user-agent') ?? null,
    },
  });
}
