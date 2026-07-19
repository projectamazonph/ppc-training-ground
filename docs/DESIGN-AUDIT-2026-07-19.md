# Design Spec vs Implementation Audit - 2026-07-19

Auditor: Dusk
Date: 2026-07-19
Scope: Stitch reference samples (33 HTML files) vs live implementation vs design brief

---

## Executive Summary

The implementation is more spec-compliant than the stitch samples. The stitch explored a more aggressive military field manual aesthetic with Tailwind, Material Symbols, and decorative effects. The implementation chose restraint - CSS Modules, Phosphor icons, no decorative gradients - which is correct for a training platform serving Filipino VAs.

Key gaps are in content/sections, not in code quality.

## What Works Well

- Token system: clean, complete CSS custom properties matching the design brief
- Typography: Space Grotesk + JetBrains Mono, no unauthorized additions
- Reduced motion: global rule plus per-component overrides
- Responsive layout: zig-zag simulators, grid breakpoints, safe-area-inset-bottom
- Button discipline: primary + secondary, translateY(-1px) on active
- Z-index scale: semantic 100-600, no arbitrary 9999 values

## Stitch Elements Correctly NOT in Implementation

| Stitch Element | Why Excluded |
|---|---|
| Material Symbols icons | Brief mandates Phosphor |
| Tailwind CSS | Stack is CSS Modules |
| cursor: crosshair | Decorative |
| Scan-line background | Decorative gradient |
| active:scale-95 | Spring-like, brief says no bounce |
| scale-105 on pricing | Decorative transform |
| CDN Google Fonts | Brief says self-host via next/font |
| border-t-4 on cards | Decorative |
| Military jargon in UI | Voice guide says plain-spoken |

## Gaps: Missing Sections (High Leverage)

### 1. Stats Bar Missing

Stitch has a 4-column stats bar below hero (500+ VAs, Php50M+ spend, 60% completion, 4.8/5 rating). Implementation has none. Social proof is the strongest conversion lever for a Php3k-Php10k purchase. The data exists. Filed as Issue #52.

### 2. Instructor Authority Section Missing

Stitch has a Principal Instructor block with photo, bio, and credentials. Implementation has none. Trust is essential for a career-training purchase. Filed as Issue #53.

## Gaps: Conversion and Accessibility (Medium Leverage)

### 3. Hero Stat Hidden on Mobile

.heroDecorative { display: none } hides the Php60k-Php80k/mo stat on mobile. Strongest social proof invisible where most VAs browse. Filed as Issue #54.

### 4. Skip-to-Content Link Missing

globals.css defines .skip-link but page.tsx never renders it. WCAG 2.4.1 violation. Filed as Issue #55.

### 5. Pricing Section Is a Teaser

Stitch has full 3-column pricing. Implementation has text + link. Showing tiers reduces friction. Filed as Issue #56.

## Gaps: Polish (Low Leverage)

### 6. text-wrap: balance Missing

Add text-wrap: balance to h1-h3 in globals.css. Filed as Issue #57.

### 7. Coming Soon May Undermine Confidence

Two tools listed as Coming soon highlights incompleteness. Consider reducing prominence. Filed as Issue #58.

## Token Audit

Primary: Stitch uses #ab3500, implementation uses #FF6B35 (brief-specified). Implementation is correct. Surface, border, radius, fonts all match.

## Priority Order

1. Stats bar - highest ROI, data exists
2. Instructor authority - trust-building
3. Mobile hero stat - conversion on primary viewport
4. Skip-to-content - WCAG, 5 minutes of work
5. Pricing comparison - reduce friction
6. text-wrap: balance - trivial polish
7. Coming Soon prominence - consider moving