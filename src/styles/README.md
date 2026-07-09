# AMPH v2 — Field Manual Styles

## Tokens (`globals.css`)

All design tokens live in `src/styles/globals.css` as CSS custom properties on `:root`. Dark mode overrides via `prefers-color-scheme: dark`.

### Breakpoints

| Token | Value | Use |
|---|---|---|
| `--bp-sm` | 640px | Small phone landscape |
| `--bp-md` | 768px | Tablet portrait |
| `--bp-lg` | 1024px | Laptop — desktop layout kicks in |
| `--bp-xl` | 1280px | Wide laptop — max design canvas |

### Layout

| Token | Value | Use |
|---|---|---|
| `--side-pad` | `clamp(16px, 4vw, 48px)` | Horizontal page padding |
| `--max-content` | 1200px | Max width for content sections |
| `--max-reading` | 720px | Max width for long-form text |
| `--max-form` | 640px | Max width for forms |

## Responsive Helpers

Three utility classes for common mobile-first patterns. All defined in `globals.css`.

### `.stack-mobile`

Vertical by default, horizontal at ≥1024px. Use for hero sections with image + text, feature rows, or any side-by-side content.

```html
<div class="stack-mobile">
  <div>Text content</div>
  <img src="..." alt="..." />
</div>
```

### `.cards-mobile`

1 column → 2 columns at 768px → 3 columns at 1024px. Use for pricing tiers, tool grids, feature cards.

```html
<div class="cards-mobile">
  <div class="card">...</div>
  <div class="card">...</div>
  <div class="card">...</div>
</div>
```

### `.table-mobile`

Full table at ≥768px. At <768px, thead hides and each row becomes a card with `data-label` attributes showing field names.

```html
<table class="table-mobile">
  <thead><tr><th>Name</th><th>Status</th></tr></thead>
  <tbody>
    <tr>
      <td data-label="Name">PPC Foundations</td>
      <td data-label="Status">Active</td>
    </tr>
  </tbody>
</table>
```
