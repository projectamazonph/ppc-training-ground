# STORY-039 · Responsive breakpoint infrastructure + tokens module

**Sprint:** 9
**Points:** 1
**Epic:** Mobile
**Owner:** Ryan
**Dependencies:** STORY-038

## Goal

Add the breakpoint system + 3 reusable responsive helpers. Single source of truth for breakpoints, side padding, max widths, and the 3 most common responsive patterns.

## Acceptance criteria

- [ ] New file `src/styles/tokens.css` with `:root` containing:

  ```css
  :root {
    --bp-sm: 640px;
    --bp-md: 768px;
    --bp-lg: 1024px;
    --bp-xl: 1280px;
    --side-pad: clamp(16px, 4vw, 48px);
    --max-content: 1200px;
    --max-reading: 720px;
    --max-form: 640px;
  }
  ```

- [ ] Helper class `.stack-mobile` — vertical by default, horizontal at `≥1024px`.
- [ ] Helper class `.cards-mobile` — 1-col → 2-col → 3-col at `≥768px` / `≥1024px`.
- [ ] Helper class `.table-mobile` — full table at `≥768px`, card list at `<768px` with `data-label` on each `<td>`.
- [ ] `src/app/layout.tsx` imports `tokens.css` once at the root.
- [ ] Each helper documented with usage example in `src/styles/README.md`.
- [ ] `prefers-reduced-motion` block added to tokens.css (defensive — Field Manual motion rules require this).

## Files touched

| File | Action |
|---|---|
| `src/styles/tokens.css` | Create — breakpoint vars + 3 helpers + reduced-motion guard |
| `src/styles/README.md` | Create — documentation |
| `src/app/layout.tsx` | Modify — import tokens.css |

## Code shape

```css
:root {
  --bp-sm: 640px;
  --bp-md: 768px;
  --bp-lg: 1024px;
  --bp-xl: 1280px;
  --side-pad: clamp(16px, 4vw, 48px);
  --max-content: 1200px;
  --max-reading: 720px;
  --max-form: 640px;
}

.stack-mobile { display: flex; flex-direction: column; gap: var(--space-4); }
@media (min-width: 1024px) {
  .stack-mobile { flex-direction: row; gap: var(--space-6); align-items: center; }
}

.cards-mobile { display: grid; gap: var(--space-3); grid-template-columns: 1fr; }
@media (min-width: 768px) { .cards-mobile { grid-template-columns: repeat(2, 1fr); gap: var(--space-4); } }
@media (min-width: 1024px) { .cards-mobile { grid-template-columns: repeat(3, 1fr); gap: var(--space-5); } }

.table-mobile { width: 100%; border-collapse: collapse; }
.table-mobile thead th { text-align: left; padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border); }
.table-mobile tbody td { padding: var(--space-4); border-bottom: 1px solid var(--color-border); }
@media (max-width: 767px) {
  .table-mobile thead { display: none; }
  .table-mobile tbody tr { display: block; padding: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-md); margin-bottom: var(--space-3); background: var(--color-card); }
  .table-mobile tbody td { display: flex; justify-content: space-between; align-items: center; padding: var(--space-2) 0; border-bottom: 0; gap: var(--space-3); }
  .table-mobile tbody td::before { content: attr(data-label); font-size: var(--fs-xs); color: var(--color-text-tertiary); text-transform: uppercase; font-weight: 600; letter-spacing: 0.04em; }
}
```

## Pitfalls

- **Adding helpers but never using them defeats the purpose.** Each helper must be adopted by ≥1 page in this same sprint (STORIES-041/042).
- **`prefers-reduced-motion` global block.** Per-component framer-motion already handles this; CSS block is the fallback.

## Verification

```bash
pnpm dev
# Open http://localhost:3000
# Resize browser to 390 / 768 / 1280 — observe dashboard, tools index, pricing all respond
pnpm typecheck
```

## Definition of Done

- [ ] tokens.css + helpers added
- [ ] `src/styles/README.md` written
- [ ] Helper usage count ≥ 1 per helper
- [ ] PR title: `feat(mobile): STORY-039 responsive breakpoint infrastructure`