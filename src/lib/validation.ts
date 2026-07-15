/**
 * Zod validation schemas + safe action wrapper for server actions.
 *
 * Pattern:
 *   const result = await createSafeAction(signUpSchema, async (data) => {
 *     // ...validated data, throws bubble up as ActionResult.error
 *     return success({ userId: newUser.id });
 *   })(formData);
 *
 * Returns ActionResult<T> for type-safe UI handling.
 */

import 'server-only';

import { z, type ZodSchema } from 'zod';
import { logger } from '@/lib/logger';

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// ---------------------------------------------------------------------------
// Auth schemas
// ---------------------------------------------------------------------------

export const signUpSchema = z
  .object({
    email: z.string().email('Enter a valid email. Example: [email protected]'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .max(128, 'Password is too long.'),
    confirmPassword: z.string(),
    name: z.string().min(1, 'Enter your name.').max(100).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const signInSchema = z.object({
  email: z.string().email('Enter a valid email.'),
  password: z.string().min(1, 'Enter your password.'),
});

// ---------------------------------------------------------------------------
// Safe action wrapper
// ---------------------------------------------------------------------------

type Handler<TSchema extends ZodSchema, TResult> = (
  data: z.infer<TSchema>
) => Promise<TResult>;

export function createSafeAction<TSchema extends ZodSchema, TResult>(
  schema: TSchema,
  handler: Handler<TSchema, TResult>
) {
  return async (input: unknown): Promise<ActionResult<TResult>> => {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || '_';
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return {
        success: false,
        error: 'Check the form for errors.',
        fieldErrors,
      };
    }

    try {
      const data = await handler(parsed.data);
      return { success: true, data };
    } catch (e) {
      // Only intentional, user-facing errors (plain `new Error(...)` thrown
      // by action handlers) surface their message. Anything subclassed —
      // PrismaClientKnownRequestError, TypeError, fetch failures — is an
      // internal fault whose text must not reach the client.
      const isUserFacing =
        e instanceof Error && (e.constructor === Error || e.name === 'Error');
      const message = isUserFacing
        ? (e as Error).message
        : 'Something went wrong. Please try again.';
      logger.error({ err: e }, 'Action handler error');
      return { success: false, error: message };
    }
  };
}