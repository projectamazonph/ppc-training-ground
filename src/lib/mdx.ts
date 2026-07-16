/**
 * MDX (markdown subset) -> HTML renderer for lesson content.
 *
 * Backed by `marked` (CommonMark + GFM) so lessons can use tables, ordered
 * and nested lists, links, and images, none of which the hand-rolled
 * predecessor of this module supported.
 *
 * No JSX/component support — pure markdown. Interactive components would
 * need a real MDX compile step; current AMPH content is markdown-only.
 *
 * Security: raw HTML (block or inline) is escaped rather than passed
 * through, and link/image URLs are restricted to http(s), mailto, and
 * relative/anchor paths — everything else is dropped to its text content.
 */

import { Marked, type Tokens } from 'marked';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeUrl(href: string): boolean {
  const trimmed = href.trim();
  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  ) {
    return true;
  }
  return /^(https?|mailto):/i.test(trimmed);
}

const renderer = new Marked({ gfm: true, breaks: false });

renderer.use({
  renderer: {
    html(token: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(token.text);
    },
    link({ href, title, tokens }: Tokens.Link) {
      const body = this.parser.parseInline(tokens);
      if (!isSafeUrl(href)) return body;
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(href)}"${titleAttr} rel="noopener noreferrer">${body}</a>`;
    },
    image({ href, title, text }: Tokens.Image) {
      if (!isSafeUrl(href)) return escapeHtml(text);
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${titleAttr}>`;
    },
  },
});

export function renderLesson(markdown: string): string {
  return renderer.parse(markdown, { async: false });
}
