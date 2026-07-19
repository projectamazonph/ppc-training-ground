/**
 * Server actions for authentication: signup, signin, signout.
 */

'use server';

import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import {
  hashPassword,
  verifyPassword,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  getSession,
} from '@/lib/auth';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';
import {
  hashClaimToken,
  PLACEHOLDER_PASSWORD_PREFIX,
} from '@/lib/claim-token';
import {
  createSafeAction,
  signUpSchema,
  signInSchema,
  type ActionResult,
} from '@/lib/validation';

// ---------------------------------------------------------------------------
// Sign up
// ---------------------------------------------------------------------------

export const signUpAction = createSafeAction(signUpSchema, async (data) => {
  const rl = rateLimit(`signup:${data.email.toLowerCase()}`, 5, 60_000);
  if (!rl.allowed) {
    throw new Error(`Too many attempts. Try again in ${rl.retryAfterSeconds}s.`);
  }

  const existing = await db.user.findUnique({ where: { email: data.email } });

  // Two sign-up cases:
  //   1. New email — create a fresh STUDENT user.
  //   2. Existing email with a `placeholder_` passwordHash — guest checkout
  //      created this account. The buyer may claim it ONLY by presenting the
  //      single-use claim token that was emailed to that address (C5/C6).
  //      Merely knowing the email is not enough — that was an account-takeover
  //      hole. The token is consumed atomically.
  //   3. Existing email with a real passwordHash — email is taken.
  if (existing) {
    const isPlaceholder =
      existing.passwordHash?.startsWith(PLACEHOLDER_PASSWORD_PREFIX) ?? false;
    if (!isPlaceholder) {
      throw new Error('An account with that email already exists.');
    }
    if (!data.claimToken) {
      throw new Error(
        'To finish your account, use the claim link we emailed you after checkout.',
      );
    }

    const newHash = await hashPassword(data.password);
    // Atomic consume: the update only matches while the account is still an
    // unclaimed placeholder AND the token hash + expiry are valid. Two
    // concurrent claims both compute the same guard, but only one UPDATE
    // matches a still-placeholder row — the other affects zero rows. This
    // closes the "both requests set a different password" race (C6).
    const consumed = await db.user.updateMany({
      where: {
        id: existing.id,
        passwordHash: { startsWith: PLACEHOLDER_PASSWORD_PREFIX },
        claimTokenHash: hashClaimToken(data.claimToken),
        claimTokenExpiresAt: { gt: new Date() },
      },
      data: {
        name: data.name ?? existing.name,
        passwordHash: newHash,
        emailVerified: new Date(),
        claimTokenHash: null,
        claimTokenExpiresAt: null,
      },
    });
    if (consumed.count !== 1) {
      throw new Error(
        'This claim link is invalid or has expired. Request a new one from support.',
      );
    }

    const token = await signToken({
      sub: existing.id,
      email: existing.email,
      role: existing.role,
      name: data.name ?? existing.name,
    });
    await setAuthCookie(token);
    return { userId: existing.id };
  }

  const user = await db.user.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash: await hashPassword(data.password),
      role: 'STUDENT',
      status: 'ACTIVE',
      emailVerified: new Date(),
    },
  });

  const token = await signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });
  await setAuthCookie(token);

  return { userId: user.id };
});

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------

export const signInAction = createSafeAction(signInSchema, async (data) => {
  // Rate-limit BEFORE any DB or scrypt work — the sync scrypt verify is
  // exactly what an attacker would use to burn the event loop.
  const rl = rateLimit(`signin:${data.email.toLowerCase()}`, 5, 60_000);
  if (!rl.allowed) {
    throw new Error(`Too many attempts. Try again in ${rl.retryAfterSeconds}s.`);
  }

  const user = await db.user.findUnique({ where: { email: data.email } });
  if (!user || !user.passwordHash) {
    throw new Error('Email or password is incorrect.');
  }

  if (user.status !== 'ACTIVE') {
    throw new Error('This account is suspended. Contact support.');
  }

  if (!(await verifyPassword(data.password, user.passwordHash))) {
    throw new Error('Email or password is incorrect.');
  }

  // NOTE: do NOT gate sign-in on emailVerified until a real verification
  // flow exists (send + verify endpoint + backfill for pre-existing users).
  // The 2026-07-15 gate locked out all users created before it while
  // pointing at a verification email that is never sent — see
  // docs/security/code-audit-2026-07-15.md (H5).

  // Update last active on sign-in
  try {
    await db.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to update lastActiveAt on sign-in');
  }

  const token = await signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });
  await setAuthCookie(token);

  return { userId: user.id, role: user.role };
});

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------

export async function signOutAction(): Promise<ActionResult<{ ok: true }>> {
  await clearAuthCookie();
  return { success: true, data: { ok: true } };
}

// ---------------------------------------------------------------------------
// Form-action wrappers (for progressive enhancement — work without JS)
// ---------------------------------------------------------------------------

export async function signUpFormAction(formData: FormData): Promise<void> {
  const result = await signUpAction({
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword') || formData.get('password'),
    name: formData.get('name') || undefined,
    claimToken: formData.get('claimToken') || undefined,
  });

  if (result.success) {
    redirect('/');
  }

  // On failure, redirect back to signup with error query param
  const error = result.success ? '' : encodeURIComponent(result.error);
  redirect(`/auth/signup?error=${error}`);
}

export async function signInFormAction(formData: FormData): Promise<void> {
  const result = await signInAction({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (result.success) {
    // Admin goes to admin dashboard, others to home
    if (result.data.role === 'ADMIN') {
      redirect('/admin');
    }
    redirect('/');
  }

  const error = result.success ? '' : encodeURIComponent(result.error);
  redirect(`/auth/signin?error=${error}`);
}

export async function signOutFormAction(): Promise<void> {
  await signOutAction();
  redirect('/');
}