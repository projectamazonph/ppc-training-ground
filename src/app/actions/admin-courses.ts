'use server';

import { db } from '@/lib/db';
import { auditLog } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';

export async function updateCourseAction(courseId: string, data: {
  title?: string;
  description?: string;
  isPublished?: boolean;
  sortOrder?: number;
}) {
  await db.course.update({ where: { id: courseId }, data });
  await auditLog({ action: 'UPDATE_COURSE', entityType: 'Course', entityId: courseId, metadata: { fields: Object.keys(data) } });
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath('/admin/courses');
}

export async function addModuleAction(courseId: string, data: {
  title: string;
  description?: string;
}) {
  const lastModule = await db.module.findFirst({
    where: { courseId },
    orderBy: { moduleNumber: 'desc' },
  });
  const moduleNumber = (lastModule?.moduleNumber ?? 0) + 1;

  const module = await db.module.create({
    data: {
      courseId,
      moduleNumber,
      title: data.title,
      slug: `${courseId}-m${moduleNumber}-${data.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
      description: data.description ?? '',
      order: moduleNumber,
    },
  });
  await auditLog({ action: 'ADD_MODULE', entityType: 'Module', entityId: module.id, metadata: { courseId } });
  revalidatePath(`/admin/courses/${courseId}`);
}
