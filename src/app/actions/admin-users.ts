'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { auditLog } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';

const userIdSchema = z.string().min(1, 'User ID required.');

async function adminGuard() {
  await requireAdmin();
}

export async function suspendUserAction(userId: string) {
  userIdSchema.parse(userId);
  await adminGuard();
  await db.user.update({
    where: { id: userId },
    data: { status: 'SUSPENDED' },
  });
  await auditLog({
    action: 'SUSPEND_USER',
    entityType: 'User',
    entityId: userId,
  });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath('/admin/users');
}

export async function reactivateUserAction(userId: string) {
  userIdSchema.parse(userId);
  await adminGuard();
  await db.user.update({
    where: { id: userId },
    data: { status: 'ACTIVE' },
  });
  await auditLog({
    action: 'REACTIVATE_USER',
    entityType: 'User',
    entityId: userId,
  });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath('/admin/users');
}

export async function deleteUserAction(userId: string) {
  userIdSchema.parse(userId);
  await adminGuard();
  await db.user.update({
    where: { id: userId },
    data: { status: 'DELETED', deletedAt: new Date() },
  });
  await auditLog({
    action: 'DELETE_USER',
    entityType: 'User',
    entityId: userId,
  });
  revalidatePath('/admin/users');
}
