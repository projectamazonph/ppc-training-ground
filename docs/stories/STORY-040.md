# STORY-040 · Mobile BottomNav shared component

**Sprint:** 9
**Points:** 1
**Epic:** Mobile
**Owner:** Ryan
**Dependencies:** STORY-039

## Goal

Mobile shell for the student app. Fixed bottom on `<1024px`, hidden on desktop. Used by Student Dashboard, Tools Index, Course Detail, Certificates, Payments.

## Acceptance criteria

- [ ] New component `src/components/ui/BottomNav.tsx` + `BottomNav.module.css`.
- [ ] Props: `active: 'home' | 'courses' | 'tools' | 'profile'`, optional `hrefOverrides?: Partial<Record<Slot, string>>`.
- [ ] 4 slots: Home (Dashboard), Courses, Tools, Profile. Each has Phosphor icon (`House`, `Books`, `Toolbox`, `UserCircle`), all `weight="light"`.
- [ ] Active state: `color: var(--color-accent)`.
- [ ] Mobile-only via `@media (min-width: 1024px) { .bottom-nav { display: none; } }`.
- [ ] Safe-area handling: `padding-bottom: max(env(safe-area-inset-bottom), 0)` on the nav root.
- [ ] Storybook/preview demo at `src/app/_dev/bottom-nav/page.tsx` showing 4 active states.

## Files touched

| File | Action |
|---|---|
| `src/components/ui/BottomNav.tsx` | Create |
| `src/components/ui/BottomNav.module.css` | Create |
| `src/components/ui/index.ts` | Modify — export BottomNav |
| `src/app/_dev/bottom-nav/page.tsx` | Create — preview page |

## Code shape

```tsx
'use client';

import { House, Books, Toolbox, UserCircle } from '@phosphor-icons/react';
import Link from 'next/link';
import clsx from 'clsx';
import styles from './BottomNav.module.css';

export type BottomNavSlot = 'home' | 'courses' | 'tools' | 'profile';

export interface BottomNavProps {
  active: BottomNavSlot;
  hrefOverrides?: Partial<Record<BottomNavSlot, string>>;
}

const SLOTS: Array<{ key: BottomNavSlot; label: string; href: string; Icon: typeof House }> = [
  { key: 'home',    label: 'Home',    href: '/dashboard',         Icon: House },
  { key: 'courses', label: 'Courses', href: '/dashboard/courses', Icon: Books },
  { key: 'tools',   label: 'Tools',   href: '/dashboard/tools',   Icon: Toolbox },
  { key: 'profile', label: 'Profile', href: '/dashboard/payments', Icon: UserCircle },
];

export function BottomNav({ active, hrefOverrides = {} }: BottomNavProps) {
  return (
    <nav className={styles.bottomNav} aria-label="Primary">
      {SLOTS.map(({ key, label, href, Icon }) => (
        <Link
          key={key}
          href={hrefOverrides[key] ?? href}
          className={clsx(styles.slot, active === key && styles.active)}
          aria-current={active === key ? 'page' : undefined}
        >
          <Icon size={22} weight="light" aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
```

```css
/* BottomNav.module.css */
.bottomNav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  background: var(--color-card);
  border-top: 1px solid var(--color-border);
  padding-bottom: max(env(safe-area-inset-bottom), 0);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  height: calc(56px + env(safe-area-inset-bottom));
}

.slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 56px;
  font-size: var(--fs-xs);
  font-weight: 500;
  color: var(--color-text-tertiary);
}

.active { color: var(--color-accent); }

@media (min-width: 1024px) { .bottomNav { display: none; } }
```

## Pitfalls

- **Active tab aria attribute** — must use `aria-current="page"`, not just `aria-label`.
- **NavSidebar exists** — STORY-040's BottomNav is the mobile companion. Do NOT replace the desktop sidebar.
- **Page padding adjustment** — pages using BottomNav need `padding-bottom: calc(56px + env(safe-area-inset-bottom))` so content doesn't hide under nav. Add this to a `.page-with-bottom-nav` helper or to each consuming page's CSS module.
- **Phosphor icon names** — `Toolbox` exists in `@phosphor-icons/react` ≥2.0; verify version before import.

## Verification

```bash
pnpm dev
# Open http://localhost:3000/_dev/bottom-nav — verify 4 slots render
# Open http://localhost:3000/dashboard in mobile viewport — nav visible at bottom
# Open same URL at 1280px — nav hidden
pnpm typecheck
```

## Definition of Done

- [ ] Component + CSS Module + index.ts export
- [ ] Preview page renders 4 active states
- [ ] PR title: `feat(mobile): STORY-040 BottomNav shared component`