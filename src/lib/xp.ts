/**
 * Idempotent XP awards (audit C10).
 *
 * Every XP grant goes through `awardXpOnce`. The XpLedger row and the
 * User.xp increment commit in ONE transaction, and the ledger's unique
 * (userId, eventKey) index is the concurrency gate:
 *
 *   - The ledger insert is the FIRST statement in the transaction. If a
 *     concurrent request (or a webhook replay) already awarded this event,
 *     the insert violates the unique index, the whole transaction rolls
 *     back, and no XP is granted. We surface that as `false`.
 *   - On success, both writes are durable together — XP can never be
 *     incremented without a matching ledger entry, and vice versa.
 *
 * Callers must run any other side effects (marking a lesson complete,
 * transitioning a tool session) as their own idempotent writes; XP is the
 * only thing this function owns.
 */

import 'server-only';

import { db } from './db';
import { isUniqueConstraintError } from './prisma-errors';

/**
 * Award `amount` XP to `userId` exactly once for `eventKey`.
 *
 * @returns `true` if this call granted the XP, `false` if it was already
 *          granted for this event key (no-op).
 */
export async function awardXpOnce(
  userId: string,
  eventKey: string,
  amount: number,
  reason: string,
): Promise<boolean> {
  try {
    await db.$transaction(async (tx) => {
      // Ledger insert first — its unique index is the exactly-once gate.
      await tx.xpLedger.create({
        data: { userId, eventKey, amount, reason },
      });
      await tx.user.update({
        where: { id: userId },
        data: { xp: { increment: amount }, lastActiveAt: new Date() },
      });
    });
    return true;
  } catch (e) {
    if (isUniqueConstraintError(e)) return false;
    throw e;
  }
}
