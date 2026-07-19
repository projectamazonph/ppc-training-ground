/**
 * Narrow helpers for Prisma runtime errors.
 *
 * Prisma throws `PrismaClientKnownRequestError` with a string `code`. We match
 * on the code without importing the class (keeps these usable from modules that
 * mock `@prisma/client`).
 */

import 'server-only';

/** True for a unique-constraint violation (P2002). */
export function isUniqueConstraintError(e: unknown): boolean {
  return (
    e instanceof Error &&
    'code' in e &&
    (e as { code?: unknown }).code === 'P2002'
  );
}
