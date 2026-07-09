# Design System Audit — Sprint 9 (STORY-038)

**Date:** 2026-07-12
**Auditor:** Vader (automated)
**Scope:** `src/**/*.tsx`, `src/**/*.ts`, `eslint-rules/`, `src/styles/globals.css`

---

## Summary

| Violation Type | Count | Status |
|---|---|---|
| Tailwind utility classes in className | 0 | ✅ Clean |
| Tailwind CDN / config imports | 0 | ✅ Clean |
| Inline hex colors (outside tokens.css) | 30 | ✅ Fixed — email template exception added |
| **Total** | **30** | **All resolved** |

---

## Findings

### 1. Tailwind Utility Classes (no-tailwind-classname)

**0 violations.** All `className` attributes use CSS Modules (`styles.*`) or semantic class names. No Tailwind utility classes detected.

### 2. Tailwind CDN / Config Imports (no-tailwind-imports)

**0 violations.** No references to `cdn.tailwindcss.com` or `tailwind.config` anywhere in source.

### 3. Inline Hex Colors (no-inline-hex-color)

**30 violations — all in `src/lib/email.tsx`.**

React Email templates require inline hex colors because email clients (Gmail, Outlook, Yahoo) do not support CSS custom properties. This is the same category of exception as PDF generators (`cert-pdf`, `receipt-pdf`).

**Fix applied:** Added `isEmailTemplate()` exception to `eslint-rules/no-tailwind.js` (line 13), matching filenames ending in `email.tsx`. Pattern follows the existing `isPdfGenerator()` exception.

| File | Violations | Hex Values Used |
|---|---|---|
| `src/lib/email.tsx` | 30 | `#F5F5F0`, `#1A1A2E`, `#FF6B35`, `#FFFFFF`, `#D4D4C8`, `#6B6B6B` |

These map to Field Manual tokens:
- `#F5F5F0` → `var(--surface-2)` (but must stay hex for email)
- `#1A1A2E` → Deep Navy (brand, not in tokens — email-only)
- `#FF6B35` → `var(--accent)`
- `#FFFFFF` → `var(--surface-1)`
- `#D4D4C8` → `var(--ink-300)`
- `#6B6B6B` → `var(--ink-500)`

---

## Files Modified

| File | Change |
|---|---|
| `eslint-rules/no-tailwind.js` | Added `EMAIL_TEMPLATE_FILES` regex + `isEmailTemplate()` function + exception in `noInlineHexColor` rule |

---

## Verification

```bash
$ pnpm lint
$ eslint .
# Exit 0, 0 errors, 0 warnings
```

---

## Conclusion

The codebase is clean. No Tailwind leakage. The only hex color violations are in email templates where CSS custom properties are unsupported. Exception added following the established pattern. All three ESLint guard rules are active and passing.
