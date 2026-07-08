'use server';

import { db } from '@/lib/db';
import { auditLog } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';

export async function updateUserAction(
  userId: string,
  data: { name?: string; role?: 'ADMIN' | 'USER' }
) {
  const updated = await db.user.update({
    where: { id: userId },
    data: { name: data.name },
  });
  if (data.role) {
    await db.user.update({
      where: { id: userId },
      data: { role: data.role },
    });
  }
  await auditLog({
    action: 'UPDATE_USER',
    entityType: 'User',
    entityId: userId,
    metadata: { fields: Object.keys(data) },
  });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath('/admin/users');
}

export async function suspendUserAction(userId: string) {
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
