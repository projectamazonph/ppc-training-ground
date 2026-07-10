import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const nextjs = require('eslint-config-next');
const aiSlopPlugin = require('./eslint-rules/no-ai-slop.js');
const tailwindPlugin = require('./eslint-rules/no-tailwind.js');

const config = [
  ...nextjs,
  // ── AI-slop guard ──────────────────────────────────────────────
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: { local: aiSlopPlugin },
    rules: { 'local/no-ai-slop': 'error' },
  },
  // ── Field Manual design-system guard ───────────────────────────
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { tailwind: tailwindPlugin },
    rules: {
      'tailwind/no-tailwind-classname': 'error',
      'tailwind/no-tailwind-imports': 'error',
      'tailwind/no-inline-hex-color': 'error',
    },
  },
];

export default config;
