# STORY-038 · Design-system audit + token purge pass

**Sprint:** 9
**Points:** 1
**Epic:** Polish
**Owner:** Ryan
**Dependencies:** None (must land first)

## Goal

Audit every component and page for pattern violations; write ESLint rules + a `--fix` codemod to block regressions. Audit report at `docs/design-audit-s9.md`.

## Why first

Every other Sprint 9 story modifies components. Without a clean baseline, the mobile refactor will inherit and propagate existing leakage. Audit first → fix during mobile refactor → lint enforcement prevents regression.

## Acceptance criteria

- [ ] `docs/design-audit-s9.md` lists every offending line by file:line with the proposed Field Manual token replacement.
- [ ] ESLint rule `no-tailwind-classname` added to `eslint.config.mjs`. Blocks Tailwind utility classes (`bg-*`, `text-*`, `flex`, `grid`, `gap-*`, `w-*`, `h-*`, `p-*`, `m-*`, `rounded-*`, `border-*`). Active in `pnpm lint`.
- [ ] ESLint rule `no-restricted-syntax` blocks the literal `cdn.tailwindcss.com` and `tailwind.config` import strings.
- [ ] ESLint rule `no-inline-hex-color` blocks `color: "#..."`, `background: "#..."`, `backgroundColor: "#..."` outside `src/styles/tokens.css`. Allows `#000` for placeholder stubs.
- [ ] Codemod script `scripts/codemod/token-purge.ts` rewrites the top 50 most common patterns to Field Manual tokens. Idempotent.
- [ ] `pnpm lint:purge` exits 0 (custom npm script wiring the new rules).
- [ ] Audit report includes per-file count of each violation type.

## Files touched

| File | Action |
|---|---|
| `docs/design-audit-s9.md` | Create |
| `eslint.config.mjs` | Add 3 new rules |
| `package.json` | Add `lint:purge` script |
| `scripts/codemod/token-purge.ts` | Create |
| `src/components/**/*.tsx`, `src/app/**/*.tsx` | Auto-fix via codemod + manual review |

## Pitfalls

- **Tailwind overlap with valid class names** — `flex` is a valid Tailwind class but also a common shorthand. ESLint rule scoped to `className=` only.
- **Phosphor icons render via `<svg>` with `stroke-width="1.5"`** — not Tailwind, valid SVG attribute. Rule must be `className`-specific.
- **Codemod safety** — auto-rewrite only on 1:1 obvious mappings; ambiguous → manual review queue.
- **Tokens file exception** — `src/styles/tokens.css` defines tokens; ESLint must path-exclude.

## Verification

```bash
pnpm lint:purge
pnpm typecheck
grep -rn 'className=.*\bbg-' src/ | wc -l   # should be 0
grep -rn 'color: "#' src/ --include='*.tsx' --include='*.ts' --include='*.module.css' | wc -l
```

## Definition of Done

- [ ] All acceptance criteria checked
- [ ] Audit report committed
- [ ] PR title: `chore(polish): STORY-038 design system audit + token purge`