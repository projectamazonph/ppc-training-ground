import { vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: () => undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: async () => ({
    get: () => null,
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));
