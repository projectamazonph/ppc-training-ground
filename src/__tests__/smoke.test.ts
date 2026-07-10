import { describe, it, expect } from 'vitest';

describe('amph-v2 smoke', () => {
  it('zod parses a simple schema', () => {
    const { z } = require('zod');
    const schema = z.object({ name: z.string() });
    expect(schema.parse({ name: 'ok' })).toEqual({ name: 'ok' });
  });

  it('amph-v2 package.json exists at project root', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    expect(fs.existsSync(path.join(process.cwd(), 'package.json'))).toBe(true);
  });
});
