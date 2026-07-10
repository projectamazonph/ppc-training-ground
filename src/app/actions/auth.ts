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
  const existing = await db.user.findUnique({ where: { email: data.email } });

  // Two sign-up cases:
  //   1. New email — create a fresh STUDENT user.
  //   2. Existing email with `placeholder_<uuid>` passwordHash — guest checkout
  //      created this account; the user is now claiming it by setting a real
  //      password. Upgrade in place: replace hash, set name, mark verified.
  //   3. Existing email with a real passwordHash — email is taken.
  if (existing) {
    const isPlaceholder =
      existing.passwordHash && existing.passwordHash.startsWith('placeholder_');
    if (!isPlaceholder) {
      throw new Error('An account with that email already exists.');
    }
    const upgraded = await db.user.update({
      where: { id: existing.id },
      data: {
        name: data.name ?? existing.name,
        passwordHash: hashPassword(data.password),
        emailVerified: new Date(),
      },
    });
    const token = await signToken({
      sub: upgraded.id,
      email: upgraded.email,
      role: upgraded.role,
      name: upgraded.name,
    });
    await setAuthCookie(token);
    return { userId: upgraded.id };
  }

  const user = await db.user.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash: hashPassword(data.password),
      role: 'STUDENT',
      status: 'ACTIVE',
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
  const user = await db.user.findUnique({ where: { email: data.email } });
  if (!user || !user.passwordHash) {
    throw new Error('Email or password is incorrect.');
  }

  if (user.status !== 'ACTIVE') {
    throw new Error('This account is suspended. Contact support.');
  }

  if (!verifyPassword(data.password, user.passwordHash)) {
    throw new Error('Email or password is incorrect.');
  }

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
    name: formData.get('name') || undefined,
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

// Convenience for sign-out button
export async function getCurrentUser() {
  return getSession();
}