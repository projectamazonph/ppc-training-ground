/**
 * no-ai-slop: bans AI-generated copy patterns.
 * See docs/voice-guide.md for the full rationale.
 *
 * Flat-config ESLint v9 plugin format.
 */
'use strict';

/* eslint-disable local/no-ai-slop -- this file is the canonical source of truth for banned phrases */

const BANNED_PHRASES = [
  // The obvious ones
  'leverage', 'delve', 'navigate the complexities',
  'cutting-edge', 'game-changing', 'revolutionize',
  'unlock the power', 'seamless', 'robust', 'comprehensive',
  'holistic', 'synergy', 'paradigm', 'ecosystem', 'empower',

  // The sneaky ones
  "it's not just", 'whether you\'re a beginner',
  "let's dive in", "let's explore", "let's break this down",
  "here's what you need to know", 'i hope this helps',
  'of course!', 'certainly!', 'great question!',
  'without further ado', 'in conclusion', 'to summarize',

  // The decorative ones
  'tapestry', 'vibrant', 'bustling', 'nestled', 'renowned',
  'breathtaking',

  // Cultural misfires
  'mabuhay',
];

function containsBanned(text) {
  if (typeof text !== 'string') return null;
  const lower = text.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

module.exports = {
  rules: {
    'no-ai-slop': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow AI-slop phrases from user-facing copy.',
          category: 'Possible Errors',
          recommended: false,
        },
        schema: [],
        messages: {
          banned: 'Banned AI-slop phrase: "{{phrase}}". See docs/voice-guide.md.',
        },
      },
      create(context) {
        function check(value, node) {
          const hit = containsBanned(value);
          if (hit) {
            context.report({
              node,
              messageId: 'banned',
              data: { phrase: hit },
            });
          }
        }

        return {
          Literal(node) {
            check(node.value, node);
          },
          TemplateElement(node) {
            if (node.value && node.value.cooked) {
              check(node.value.cooked, node);
            }
          },
          JSXText(node) {
            check(node.value, node);
          },
          JSXAttribute(node) {
            if (node.value && node.value.type === 'Literal') {
              check(node.value.value, node);
            }
          },
        };
      },
    },
  },
};
