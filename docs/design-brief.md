# Design Brief — Project Amazon PH Academy v2

**Taste direction:** Field Manual
**Owner:** Ryan Roland Dabao
**Date:** 2026-07-07

---

## The Direction, In One Line

Dense, scannable, slightly utilitarian. Like a 1970s technical reference manual printed for people who actually have to use the information at 2am.

## What This Is NOT

- Not glassmorphism with gradient orbs.
- Not cyan-on-dark with neon accents.
- Not a portfolio site with oversized hero text and 80% white space.
- Not an "AI-built SaaS" template that looks like every other AI-built SaaS template.

## What This IS

A training platform. The student is here to learn Amazon advertising, not to admire the design. The interface should get out of the way of the content. Density is a feature, not a bug.

Reference points (for inspiration, not copying):

- **Old technical manuals** (think: 1970s electronics service manuals, Federal Express waybills, military field guides). Information-dense, hierarchical, typographically clear.
- **Modern trading terminals** (think: Bloomberg Terminal aesthetics, but lighter). Information first, decoration last.
- **Stripe Press** (typography-led, no decorative gradients, hierarchy through type scale).
- **Linear** (restrained color, deliberate motion, density without claustrophobia).

## Color System

A small palette. Use it with discipline.

### Base

| Token | Value | Use |
|-------|-------|-----|
| `--surface-0` | `#FAFAF7` | App background (warm off-white, never pure white) |
| `--surface-1` | `#FFFFFF` | Cards, panels, elevated content |
| `--surface-2` | `#F4F3EE` | Subtle differentiation, hover states |
| `--surface-3` | `#1A1A1A` | Dark mode background |
| `--ink-900` | `#171717` | Primary text |
| `--ink-700` | `#404040` | Secondary text |
| `--ink-500` | `#737373` | Tertiary text, metadata |
| `--ink-300` | `#D4D4D4` | Disabled, dividers |
| `--border` | `#E5E5E0` | Default border, 1px |

### Brand

| Token | Value | Use |
|-------|-------|-----|
| `--accent` | `#FF6B35` | Primary actions, active states, brand color |
| `--accent-soft` | `#FFE5D9` | Subtle backgrounds, hover washes |
| `--success` | `#0E7C3A` | Completed states, correct answers |
| `--warning` | `#B45309` | Pending, attention needed |
| `--danger` | `#B91C1C` | Errors, destructive actions, wrong answers |

### Rule

Two surfaces + one accent + one ink level. That's a card. Anything more is decoration.

## Typography

### Pairing

- **Display + body:** Space Grotesk (variable, weights 400–700)
- **Mono:** JetBrains Mono (variable, for code, bid values, data)

No second body font. No serif. No script.

### Scale

Modular, fluid. Base size 16px.

| Token | Value | Use |
|-------|-------|-----|
| `--text-xs` | `0.75rem` | Metadata, timestamps, captions |
| `--text-sm` | `0.875rem` | Secondary labels, helper text |
| `--text-base` | `1rem` | Body text |
| `--text-lg` | `1.125rem` | Lead paragraphs, important body |
| `--text-xl` | `1.375rem` | Section headings (h3) |
| `--text-2xl` | `1.75rem` | Page section headings (h2) |
| `--text-3xl` | `2.25rem` | Page titles (h1) |
| `--text-4xl` | `3rem` | Hero text (landing only) |

Line height: 1.5 for body, 1.15 for headings. Letter-spacing: `-0.01em` on display sizes, normal elsewhere.

### Loading

Self-host via `next/font`. No Google Fonts CDN. Set `display: swap`. Preload only `Space Grotesk 400` and `700`.

## Spacing

4px base. Semantic tokens:

| Token | Value | Use |
|-------|-------|-----|
| `--space-1` | `4px` | Tight inline spacing |
| `--space-2` | `8px` | Component internal padding |
| `--space-3` | `12px` | Tight groupings |
| `--space-4` | `16px` | Default component padding |
| `--space-6` | `24px` | Section internal padding |
| `--space-8` | `32px` | Between components |
| `--space-12` | `48px` | Between sections |
| `--space-16` | `64px` | Major page breaks |

`gap` instead of `margin` for sibling spacing. No magic numbers in component code.

## Radius

Small, deliberate. Rounded but not pill-y.

| Token | Value | Use |
|-------|-------|-----|
| `--radius-sm` | `4px` | Inputs, badges, small chips |
| `--radius-md` | `6px` | Buttons, cards |
| `--radius-lg` | `10px` | Modals, larger surfaces |

No fully-rounded buttons. No 16px+ card radii.

## Elevation

Subtle. Shadow should be barely-there, not "depth as design."

| Token | Value | Use |
|-------|-------|-----|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` | Inputs, hover lift |
| `--shadow-md` | `0 2px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` | Cards |
| `--shadow-lg` | `0 8px 16px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)` | Modals, popovers |

## Motion

Two durations, two easings. That's it.

| Token | Value | Use |
|-------|-------|-----|
| `--duration-fast` | `120ms` | Hover, focus, button press |
| `--duration-base` | `220ms` | State changes, panel open/close |
| `--duration-slow` | `400ms` | Page transitions, list stagger |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Elements entering |
| `--ease-in` | `cubic-bezier(0.7, 0, 0.84, 0)` | Elements leaving |

No bounce. No elastic. No spring physics. Real deceleration looks like `--ease-out`, not like a ball.

`transform` and `opacity` only. Never animate `height`, `width`, `padding`, `margin`. For accordions, use `grid-template-rows: 0fr → 1fr`.

Always respect `prefers-reduced-motion: reduce`. Disable transforms, keep opacity changes only.

## Layout

### Grid

12-column max-width 1200px. Gutter 24px. Side margins fluid `clamp(16px, 4vw, 48px)`.

### Page Composition

Every page has three regions: header, primary content, optional sidebar. Sidebar collapses to bottom-sheet on `< 1024px`.

### Headers

Compact. 56px tall. Title left, primary action right, breadcrumbs in the breadcrumb region (not in the page header).

### Density

Information density is a feature. Tables, lists, dashboards can be tight. Marketing pages can breathe. Different rules for different surfaces.

## Components

### Buttons

Three variants:

- **Primary:** Solid `--accent`, white text. Use sparingly — one per view.
- **Secondary:** Bordered, ink text. Default for secondary actions.
- **Ghost:** No border, ink text, hover wash. For tertiary actions, in-table actions.

Sizes: sm (28px), md (36px), lg (44px). Never below 28px on mobile.

Icon button: 32px square, ghost, with `aria-label`. Focus ring on keyboard focus only.

### Cards

Default: white surface, 1px border, no shadow. Hover (interactive only): lift 1px, shadow-sm.

Never nest cards. Use dividers, never cards inside cards.

### Inputs

Label above input. Required indicator in label, not placeholder. Placeholder is example value, not instruction.

Validation: validate on blur, show inline error below input with `aria-describedby`. Never on every keystroke.

### Tables

Default: 40px row height, left-aligned text, right-aligned numbers. Header has bottom border only. Zebra striping off.

Sortable columns: click header, indicator appears (arrow up/down), transition is instant. Filter row above if needed.

### Modals

Use sparingly. For destructive actions, use inline undo with toast, not a modal.

When unavoidable: native `<dialog>` element, max-width 480px, backdrop blur optional.

### Toasts

Bottom-right on desktop, top-center on mobile. Auto-dismiss after 4 seconds for success, persist until dismissed for errors. Stack up to 3.

## Iconography

Phosphor (light weight) only. No other icon set. Import as `@phosphor-icons/react`.

Sizes: 16px (inline), 20px (button), 24px (default), 32px (hero). Stroke width 1.5 for the `light` variant.

Icon button requires `aria-label`. Decorative icon (next to text) needs `aria-hidden="true"`.

## Content Surfaces

### Marketing Pages (landing, pricing, about)

- Generous spacing (`--space-12` minimum between sections)
- Fluid type (`clamp()` for headings)
- One hero per page
- Real screenshots, not abstract illustrations
- One CTA per viewport

### Application Pages (dashboard, lessons, tools)

- Compact spacing (`--space-4` to `--space-6`)
- Fixed type scale (no fluid)
- Information density high
- Sidebar + breadcrumb + content

### Admin Pages

- Most compact (`--space-3` to `--space-4`)
- Tables over cards
- Inline editing over modal editing
- Bulk actions in toolbar

## The Anti-AI-Slop Test

Before shipping any component, ask:

1. Would someone believe "AI made this" if I showed them?
2. Is there a gradient used for decoration only?
3. Is there glass-blur used where it adds no value?
4. Is the hero a giant centered headline with a gradient accent?
5. Are all the cards the same size with icon + heading + text?
6. Is there a 3D illustration or stock photo of a smiling person?

If the answer is yes to any of these, redesign.

## Component Library

Extract to `packages/ui/` (shared across AMPH-Academy, ppc-companion, Interview-lab, ad-console):

- `Button`, `IconButton`
- `Card`, `Surface`, `Divider`
- `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`
- `Modal`, `Toast`, `Tooltip`, `Popover`
- `Tabs`, `Accordion`
- `Table`, `DataGrid`
- `Avatar`, `Badge`, `Tag`
- `Skeleton`, `EmptyState`, `ErrorState`
- `NavSidebar`, `TopBar`, `Breadcrumbs`
- `Pagination`

Every component has: prop types, default export, Storybook story, unit test, accessibility test.

## Accessibility

WCAG 2.1 AA. Non-negotiable.

- Color contrast 4.5:1 minimum for body, 3:1 for large text and UI components.
- All interactive elements keyboard-accessible.
- Focus rings on `:focus-visible`, never `outline: none` without replacement.
- ARIA labels on icon-only buttons.
- Form labels associated via `for`/`id`.
- Skip-to-content link first in tab order.
- Reduced motion respected.
- Touch targets 44×44px minimum on mobile.

## Performance Budgets (enforced in CI)

| Metric | Budget |
|--------|--------|
| Initial route JS | < 150KB gzipped |
| Largest route JS | < 350KB gzipped |
| LCP | < 2.5s on 4G |
| FID | < 100ms |
| CLS | < 0.1 |
| Lighthouse Performance | ≥ 85 |
| Lighthouse Accessibility | ≥ 90 |

Lighthouse CI runs on every PR. Build fails if any budget is exceeded.