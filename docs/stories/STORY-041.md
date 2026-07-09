# STORY-041 · Marketing + auth cluster: mobile-first refactor

**Sprint:** 9
**Points:** 1
**Epic:** Mobile
**Owner:** Ryan
**Dependencies:** STORY-039, STORY-040

## Goal

Re-author 5 public pages to be mobile-first using Field Manual tokens + responsive helpers. Source-of-truth prototypes live at `/workspace/amph-v2-stitch/generated/mobile/`.

## Acceptance criteria

- [ ] All 5 pages render correctly at 390px and 1280px without horizontal scroll.
- [ ] Each page uses `.stack-mobile` / `.cards-mobile` as appropriate.
- [ ] No Tailwind class leakage (per STORY-038 lint).
- [ ] No inline hex values (per STORY-038 lint).
- [ ] Each page matches the semantic markup of its `generated/mobile/*.html` prototype.

## Pages

| Route | File | Prototype source | Desktop source |
|---|---|---|---|
| `/` (Landing) | `src/app/page.tsx` | Stitch `9b9f7eb...` Refined Mobile (FIRST-TASK: generate `generated/mobile/landing-mobile.html` from this) | Stitch `d20de9fbcb0e...` |
| `/pricing` | `src/app/(public)/pricing/page.tsx` | `generated/mobile/pricing-mobile.html` ✅ already built | Stitch `f0ae1a40802a...` |
| `/auth/signin` | `src/app/(public)/auth/signin/page.tsx` | `generated/mobile/signin-mobile.html` ✅ | Stitch `61c9890a0695...` |
| `/auth/signup` | `src/app/(public)/auth/signup/page.tsx` | `generated/mobile/signup-mobile.html` ✅ | Stitch `f0e723833a5b...` |
| `/checkout/complete` | `src/app/(public)/checkout/complete/page.tsx` | `generated/mobile/checkout-success-mobile.html` ✅ | Stitch `be193fd3ffba...` |

## First task

Before any code work, generate `generated/mobile/landing-mobile.html` from Stitch `9b9f7eb...` (Refined Mobile Layout) using the existing pattern at `/workspace/amph-v2-stitch/scripts/build_mobile.py`. This is the only screen in this cluster without a local prototype.

```bash
cd /workspace/amph-v2-stitch
# Add a `landing_mobile()` function to scripts/build_mobile.py following the
# pricing_mobile pattern. The source-of-truth HTML lives in the Stitch download:
# https://contribution.usercontent.google.com/download?c=...9b9f7eb...
# Reference: see /root/workspace/amph-v2-stitch/html/9b9f7eb109c444b7a3c27ccfcf2ffa7e.html
python3 scripts/build_mobile.py
# Output: generated/mobile/landing-mobile.html
```

## Steps per page

For each of the 5 routes:

1. Open `src/app/(public)/.../page.tsx` (or `src/app/page.tsx`).
2. Open the corresponding prototype at `/workspace/amph-v2-stitch/generated/mobile/`.
3. Port the semantic markup (header / nav / hero / pricing tiers / forms / CTA sections) into the Next.js page component.
4. Replace `import './landing.module.css'` style strings with the responsive helpers from STORY-039 (`stack-mobile`, `cards-mobile`).
5. Use `var(--side-pad)` for horizontal padding instead of hardcoded values.
6. Add `<TopBar />` (existing `src/components/ui/TopBar.tsx`) if not already present.
7. Run `pnpm typecheck && pnpm dev` — manual visual test at 390px and 1280px.

## File-level breakdown

### `src/app/page.tsx` (Landing)

Hero section: left-aligned (per design brief), eyebrow + heading + sub + CTA. Right column at desktop = decorative ₱80k in JetBrains Mono with `--color-accent-soft` background. Mobile: stack vertically, hide decorative number or show below heading.

Pricing preview (3 tiers): featured (Accelerated) center 50%, others stacked. Use `.cards-mobile`.

Tools showcase: zigzag rows — text/image alternating. Each row: 60/40 split at desktop, stacked at mobile. Use `.stack-mobile`.

Ryan section: left-aligned text, decorative ₱50M+ on the right at desktop. Mobile: hide decorative.

CTA section: dark `--color-text-primary` background, left-aligned heading + single CTA.

Footer: 3 columns at desktop (Brand / Platform / Contact), stacked at mobile.

### `src/app/(public)/pricing/page.tsx`

3 tier cards: Foundations (entry), Accelerated (best value, accent border + shadow), Ultimate (all-in). Use `.cards-mobile`. Accelerated card is `featured` with `border-color: var(--color-accent); box-shadow: var(--shadow-md);` and a "Most chosen" pill above.

### `src/app/(public)/auth/signin/page.tsx`

Centered 400px card. Email + password with show/hide toggle. "Remember me" + "Forgot?" row. Primary button full-width. "New to AMPH?" link below.

Mobile: same. Page padding `var(--space-9)` at top to center card vertically.

### `src/app/(public)/auth/signup/page.tsx`

Full name + email + password fields with helper text below password (8+ chars, 1 number, 1 letter). Terms checkbox. Primary button full-width.

### `src/app/(public)/checkout/complete/page.tsx`

Success state: centered checkmark in `--color-accent-soft` circle, "You're in" heading, receipt card with order summary, primary CTA to first lesson.

## Pitfalls

- **Landing page decorative numbers** — Stitch uses huge `₱80k` decorative elements. On mobile these are visual noise. Hide at `<768px` via CSS.
- **Sign In form has 5 distinct elements** — easy to break the field order. Match prototype exactly.
- **Checkout success email** — `checkout.pricingTier?.name` returns a Prisma `String` object wrapper, not `string`. Coerce with template literal `\`${value}\`` (per Sprint 8 notes).
- **Footer 3-col → 1-col** — use `.cards-mobile` or stack explicitly.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm dev
# Each route, DevTools → Responsive → 390px and 1280px → manual visual test
# Sign in flow: submit form, verify redirect to /dashboard
# Sign up flow: register new account
# Pricing: click "Choose Foundations" → checkout (test in staging only, not with real card)
# Checkout complete: visit /checkout/complete?ref=test → verify receipt card renders
```

## Definition of Done

- [ ] 5 pages render correctly at 390px and 1280px
- [ ] `pnpm typecheck && pnpm lint` exit 0
- [ ] No Tailwind class leakage (per STORY-038)
- [ ] PR title: `feat(mobile): STORY-041 marketing + auth cluster mobile-first refactor`