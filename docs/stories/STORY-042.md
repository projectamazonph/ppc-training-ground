# STORY-042 · Student app shell + course flow + tools index: mobile-first refactor

**Sprint:** 9
**Points:** 1
**Epic:** Mobile
**Owner:** Ryan
**Dependencies:** STORY-039, STORY-040, STORY-041

## Goal

Re-author the student-facing app shell using `BottomNav` and the responsive helpers. Cover 7 routes that students interact with daily.

## Acceptance criteria

- [ ] All 7 pages render correctly at 390px and 1280px.
- [ ] BottomNav visible on `<1024px` for: Dashboard, Course Detail, Tools Index.
- [ ] TopBar visible across all 7 pages (already wired, just verify).
- [ ] Dashboard stat row uses `.cards-mobile` (1 → 2 → 4 cols).
- [ ] Certificates grid uses `.cards-mobile`.
- [ ] Payments History table uses `.table-mobile`.
- [ ] No Tailwind class leakage, no inline hex (per STORY-038 lint).

## Pages

| Route | File | Mobile prototype | Desktop reference |
|---|---|---|---|
| `/dashboard` | `src/app/(dashboard)/dashboard/page.tsx` | **NOT YET BUILT** — first-task: generate from Stitch `663ad1dc...` | Stitch `91703ccb...` Refined |
| `/dashboard/courses/[slug]` | `src/app/(dashboard)/courses/[courseSlug]/page.tsx` | `generated/mobile/course-detail-mobile.html` ✅ | Stitch `69c4bfc0261...` |
| `/dashboard/courses/[slug]/lessons/[slug]` | `src/app/(dashboard)/courses/[courseSlug]/lessons/[lessonSlug]/page.tsx` | `generated/mobile/lesson-mobile.html` ✅ | Stitch `a53a0423c5b...` |
| `/dashboard/courses/[slug]/lessons/[slug]/quiz` | `src/app/(dashboard)/courses/[courseSlug]/lessons/[lessonSlug]/quiz/page.tsx` | `generated/mobile/quiz-mobile.html` ✅ | Stitch `d66dff2a6416...` |
| `/dashboard/tools` | `src/app/(dashboard)/tools/page.tsx` | `generated/mobile/tools-index-mobile.html` ✅ | Stitch `3d2e12d9f593...` |
| `/dashboard/certificates` | `src/app/(dashboard)/certificates/page.tsx` | `generated/mobile/certificates-mobile.html` ✅ | Stitch `ac27cc9a...` Refined |
| `/dashboard/payments` | `src/app/(dashboard)/payments/page.tsx` | `generated/mobile/payments-history-mobile.html` ✅ | Stitch `60379bc8b050...` |

## First task

Generate `generated/mobile/dashboard-mobile.html` from Stitch `663ad1dc...` (Student Dashboard Mobile) — the only screen in this cluster without a local prototype.

```bash
cd /workspace/amph-v2-stitch
# Add `dashboard_mobile()` function to scripts/build_mobile.py
# Reference Stitch HTML: /workspace/amph-v2-stitch/html/663ad1dca0be484195da6fd13936d329.html
python3 scripts/build_mobile.py
```

## Per-page implementation

### Dashboard `/dashboard`

Already exists at `src/app/(dashboard)/dashboard/page.tsx`. Refactor to:
- Add `<BottomNav active="home" />` (visible at `<1024px`)
- Replace existing stat row grid classes with `.cards-mobile` for 1 → 2 → 4 cols
- Top progress card stays prominent
- "Continue learning" section: course cards in `.cards-mobile`

### Course Detail `/dashboard/courses/[slug]`

Refactor at `src/app/(dashboard)/courses/[courseSlug]/page.tsx`:
- Add `<BottomNav active="courses" />`
- Instructor card → standard `.card`
- "Your progress" panel with `.progress` + continue CTA
- Curriculum: `<details>` accordions on mobile, expanded `<div>`s on desktop

### Lesson `/dashboard/courses/[slug]/lessons/[slug]`

Refactor at `src/app/(dashboard)/courses/[courseSlug]/lessons/[lessonSlug]/page.tsx`:
- Eyebrow + title + duration/video meta row
- Article body: max-width `var(--max-reading)`, line-height 1.55
- "Common mistake" callouts in `.panel` with `--color-warning` eyebrow
- "Up next: Quiz" CTA panel at bottom
- No BottomNav (lesson reader is a focused mode)

### Quiz `/dashboard/courses/[slug]/lessons/[slug]/quiz`

Refactor at the same dir + `/quiz/page.tsx`:
- Progress bar + question number + timer
- 4 radio options as `.card` with hover state
- "Submit & next →" sticky bottom button at mobile (`.sticky-cta` helper — add to tokens.css in STORY-039 if missing)

### Tools Index `/dashboard/tools`

Refactor at `src/app/(dashboard)/tools/page.tsx`:
- Add `<BottomNav active="tools" />`
- 5 tool cards in `.cards-mobile` (1 → 2 → 3 cols)
- Each card: icon, status pill, description, last activity

### Certificates `/dashboard/certificates`

Refactor at `src/app/(dashboard)/certificates/page.tsx`:
- Cards in `.cards-mobile` — verified, locked, locked
- Verified cards: green border, "Download PDF" + "Share on LinkedIn" buttons
- Locked cards: opacity 0.6, progress bar if in-progress

### Payments History `/dashboard/payments`

Refactor at `src/app/(dashboard)/payments/page.tsx`:
- Lifetime spend card at top
- History table with `.table-mobile` (cards on mobile, full table on desktop)
- Each row: amount, status pill, date/method

## File-level changes

### `src/styles/tokens.css` (additions in STORY-039)

Add a sticky CTA helper if not already present:

```css
.sticky-cta {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 40;
  background: var(--color-card);
  border-top: 1px solid var(--color-border);
  padding: var(--space-3) var(--side-pad) calc(var(--space-3) + env(safe-area-inset-bottom));
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: var(--space-3);
}

@media (min-width: 1024px) { .sticky-cta { display: none; } }

.page-with-cta { padding-bottom: calc(80px + env(safe-area-inset-bottom)); }
@media (min-width: 1024px) { .page-with-cta { padding-bottom: 0; } }
```

## Pitfalls

- **BottomNav must not collide with existing NavSidebar** — desktop sidebar stays at ≥1024px, BottomNav appears at <1024px. They never co-display.
- **Server vs Client component split** — page.tsx is server (fetches data); BottomNav must be `'use client'` because of usePathname or active prop. Or pass active from page → client wrapper.
- **Mobile Dashboard data fetch** — server component fetches user progress. Cache via `revalidatePath` after lesson completion (already wired).
- **Existing TopBar** — kept. BottomNav is purely additive at mobile.
- **Existing admin components** — do not touch. Different route group.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm dev
# Each route at 390px:
#   - BottomNav visible at bottom (Dashboard, Course Detail, Tools Index)
#   - Stat row stacks to 1 col, expands to 2/4 at larger viewports
#   - Curriculum accordions expand/collapse
# Each route at 1280px:
#   - NavSidebar visible (already wired) or TopBar
#   - Stat row shows 4 cols
#   - Curriculum expanded by default
```

## Definition of Done

- [ ] All 7 pages render correctly at 390px and 1280px
- [ ] BottomNav + TopBar coexist without overlap
- [ ] `.cards-mobile`, `.table-mobile`, `.stack-mobile` used appropriately
- [ ] `pnpm typecheck && pnpm lint` exit 0
- [ ] PR title: `feat(mobile): STORY-042 student app shell + course flow + tools index mobile-first refactor`