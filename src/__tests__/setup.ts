import { vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: () => undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: async () => ({
    get: (key: string) => {
      if (key === 'x-forwarded-for') return '127.0.0.1';
      return undefined;
    },
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));
