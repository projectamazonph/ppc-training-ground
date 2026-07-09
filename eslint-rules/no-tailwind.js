/**
 * no-tailwind — ESLint plugin enforcing Field Manual design system.
 *
 * Rules:
 *   no-tailwind-classname     — blocks Tailwind utility classes in className=
 *   no-tailwind-imports       — blocks cdn.tailwindcss.com and tailwind.config imports
 *   no-inline-hex-color       — blocks inline hex colors outside tokens.css
 */

const TAILWIND_UTILITIES = /\b(bg-|text-|flex|grid|gap-|w-|h-|p-|m-|rounded-|border-|shadow-|font-|leading-|tracking-|overflow-|position-|z-|opacity-|cursor-|select-|sr-|transition-|animate-|from-|to-|via-|dark:|hover:|focus:|active:|disabled:)/;

const PDF_GENERATOR_FILES = /cert-pdf|receipt-pdf/;
const EMAIL_TEMPLATE_FILES = /email\.tsx$/;

function isTokensFile(filename) {
  return filename && filename.includes('src/styles/tokens.css');
}

function isPdfGenerator(filename) {
  return filename && PDF_GENERATOR_FILES.test(filename);
}

function isEmailTemplate(filename) {
  return filename && EMAIL_TEMPLATE_FILES.test(filename);
}

/** Rule: no-tailwind-classname */
const noTailwindClassname = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow Tailwind utility classes in className attributes',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      tailwind:
        'Tailwind class "{{ cls }}" detected in className. Use CSS Modules or design tokens (globals.css).',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.name !== 'className') return;

        const val = node.value;
        // className="bg-red-500 text-white"
        if (val && val.type === 'Literal' && typeof val.value === 'string') {
          const classes = val.value.split(/\s+/);
          for (const cls of classes) {
            if (TAILWIND_UTILITIES.test(cls)) {
              context.report({ node, messageId: 'tailwind', data: { cls } });
            }
          }
        }
        // className={`bg-red-500 ${foo}`}
        if (val && val.type === 'JSXExpressionContainer') {
          const expr = val.expression;
          if (expr.type === 'TemplateLiteral') {
            for (const q of expr.quasis) {
              const classes = q.value.raw.split(/\s+/);
              for (const cls of classes) {
                if (cls && TAILWIND_UTILITIES.test(cls)) {
                  context.report({ node, messageId: 'tailwind', data: { cls } });
                }
              }
            }
          }
        }
      },
    };
  },
};

/** Rule: no-tailwind-imports */
const noTailwindImports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow Tailwind CSS CDN and config imports',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      cdn: 'Tailwind CDN (cdn.tailwindcss.com) is forbidden. Use CSS Modules + design tokens.',
      config: 'tailwind.config import is forbidden. Use CSS Modules + design tokens.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename();
    if (isTokensFile(filename)) return {};

    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        if (node.value.includes('cdn.tailwindcss.com')) {
          context.report({ node, messageId: 'cdn' });
        }
      },
      ImportDeclaration(node) {
        const src = node.source.value;
        if (typeof src === 'string' && src.includes('tailwind.config')) {
          context.report({ node, messageId: 'config' });
        }
      },
      'CallExpression[callee.name="require"]'(node) {
        const arg = node.arguments[0];
        if (arg && arg.type === 'Literal' && typeof arg.value === 'string') {
          if (arg.value.includes('tailwind.config')) {
            context.report({ node, messageId: 'config' });
          }
        }
      },
    };
  },
};

/** Rule: no-inline-hex-color */
const noInlineHexColor = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow inline hex color values outside src/styles/tokens.css',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      hex: 'Hex color "{{ color }}" in style prop. Use a CSS custom property from tokens.css (var(--accent), var(--ink-700), etc.).',
    },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename();
    if (isTokensFile(filename)) return {};
    if (isPdfGenerator(filename)) return {};
    if (isEmailTemplate(filename)) return {};

    const HEX_RE = /['"]#([0-9A-Fa-f]{3,8})['"]/;

    return {
      JSXAttribute(node) {
        if (node.name.name !== 'style') return;
        const src = context.getSourceCode().getText(node.value);
        const m = src.match(HEX_RE);
        if (m) {
          context.report({
            node,
            messageId: 'hex',
            data: { color: m[0] },
          });
        }
      },
      Property(node) {
        const key = node.key;
        const isStyleKey =
          (key.type === 'Identifier' && key.name === 'style') ||
          (key.type === 'Literal' && key.value === 'style');
        if (!isStyleKey) return;

        if (
          node.value &&
          (node.value.type === 'ObjectExpression' ||
            node.value.type === 'ArrayExpression')
        ) {
          const src = context.getSourceCode().getText(node.value);
          const m = src.match(HEX_RE);
          if (m) {
            context.report({
              node,
              messageId: 'hex',
              data: { color: m[0] },
            });
          }
        }
      },
    };
  },
};

module.exports = {
  rules: {
    'no-tailwind-classname': noTailwindClassname,
    'no-tailwind-imports': noTailwindImports,
    'no-inline-hex-color': noInlineHexColor,
  },
};
