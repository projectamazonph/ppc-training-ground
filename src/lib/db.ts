/**
 * Prisma client singleton + soft-delete query extension (ADR-012).
 *
 * Every query that goes through this client automatically filters out
 * soft-deleted records (`deletedAt: null`) for models that have a
 * `deletedAt` column. Bypass with `findUnique` on unique fields where the
 * caller genuinely needs the deleted record (rare).
 *
 * Prisma 7 requires a driver adapter and removed the `$use` middleware API
 * in favor of client extensions (`$extends`) — see ADR-012 for why this
 * filter exists and docs/decisions.md for the Prisma 7 upgrade note.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as Enums from './enums';
export { Enums };

// Models that participate in soft-delete. Adding a new model with a
// `deletedAt` column? Add it here too.
const SOFT_DELETE_MODELS = new Set([
  'User',
  'Course',
  'Module',
  'Lesson',
  'Enrollment',
  'ModuleProgress',
  'LessonProgress',
  'Quiz',
  'QuizQuestion',
  'QuizAttempt',
  'Badge',
  'UserBadge',
  'Certificate',
  'LiveClass',
  'LiveClassRegistration',
  'ToolSession',
  'ToolResult',
  'Resource',
  'ContentDraft',
  'PricingTier',
  'CheckoutSession',
  'Payment',
  'DiscountCode',
  'RefundRequest',
  'ProcessedWebhook',
  'Invoice',
  'TeamMember',
]);

const READ_OPERATIONS: ReadOp[] = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
];

type ReadOp =
  | 'findUnique'
  | 'findUniqueOrThrow'
  | 'findFirst'
  | 'findFirstOrThrow'
  | 'findMany'
  | 'count'
  | 'aggregate'
  | 'groupBy';

/** @visibleForTesting */
export function injectDeletedAtFilter(params: Record<string, unknown>): void {
  if (!params) params = {};
  const where = (params.where as Record<string, unknown> | undefined) ?? {};

  if (where.deletedAt === undefined) {
    where.deletedAt = null;
    params.where = where;
  } else if (
    where.deletedAt &&
    typeof where.deletedAt === 'object' &&
    'not' in (where.deletedAt as Record<string, unknown>)
  ) {
    // Caller is explicitly filtering for deleted records — leave alone.
    return;
  }
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set.');
  }
  return url;
}

function createPrismaClient() {
  const adapter = new PrismaPg(getDatabaseUrl());
  const client = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (model && SOFT_DELETE_MODELS.has(model) && READ_OPERATIONS.includes(operation as ReadOp)) {
            injectDeletedAtFilter(args as Record<string, unknown>);
          }
          return query(args);
        },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

// Re-export Prisma namespace for convenience in callers.
export { Prisma };
export type { PrismaClient } from '@prisma/client';
