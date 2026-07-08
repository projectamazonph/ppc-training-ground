# Google Stitch Prompt — AMPH Academy v2

## Instructions for Use

This document contains Stitch prompts for every page/screen of AMPH Academy v2. Feed each prompt section into Google Stitch (stitch.withgoogle.com) individually. Stitch generates HTML/CSS with Tailwind — we will convert the output to CSS Modules + design tokens for the Next.js project.

**Strategy:** Generate one screen at a time. Start with the landing page (most complex marketing surface), then auth pages, pricing, dashboard, course flow, tools, admin, and utility pages.

---

## MASTER DESIGN SYSTEM REFERENCE

Before generating any screen, Stitch needs this design system context:

```
Design system name: Field Manual
Aesthetic: Dense, scannable, utilitarian. Like a 1970s technical reference manual printed for people who actually have to use the information at 2am. Information-dense, hierarchical, typographically clear. NOT glassmorphism, NOT gradient orbs, NOT neon accents, NOT generic SaaS template.

Color palette:
- Background: #FAFAF7 (warm off-white, never pure white)
- Cards/Panels: #FFFFFF
- Subtle differentiation: #F4F3EE
- Primary text: #171717
- Secondary text: #404040
- Tertiary text/metadata: #737373
- Disabled/dividers: #D4D4D4
- Border: #E5E5E0
- Brand accent: #FF6B35 (orange — used for CTAs, active states, primary actions)
- Accent hover: #E55A2B
- Accent soft background: #FFE5D9
- Success: #0E7C3A
- Warning: #B45309
- Error/Danger: #B91C1C
- Info: #1E40AF

Typography:
- Display + Body: Space Grotesk (variable, 400-700)
- Mono: JetBrains Mono (for data, code, bid values)
- No serif, no script, no second body font
- Headings: font-weight 600, line-height 1.15, letter-spacing -0.01em
- Body: line-height 1.5
- Type scale: xs=0.75rem, sm=0.875rem, base=1rem, lg=1.125rem, xl=1.375rem, 2xl=1.75rem, 3xl=2.25rem, 4xl=3rem

Spacing: 4px base grid. Tokens: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80px
Radius: sm=4px, md=6px, lg=10px. No pill shapes. No 16px+ card radii.
Shadows: Barely-there. sm=0 1px 2px rgba(0,0,0,0.04), md=0 2px 4px rgba(0,0,0,0.06), lg=0 8px 16px rgba(0,0,0,0.08)

Buttons:
- Primary: Solid #FF6B35, white text, radius 6px. ONE per viewport.
- Secondary: 1px border #E5E5E0, #171717 text. Default for secondary actions.
- Ghost: No border, #404040 text, hover wash #F4F3EE. For tertiary/table actions.
- Sizes: sm=28px, md=36px, lg=44px height

Cards: White surface, 1px border #E5E5E0, no shadow by default. Interactive variant: lift 1px on hover + shadow-sm. NEVER nest cards inside cards.

Icons: Phosphor icon set, light weight only. Sizes: 16px inline, 20px button, 24px default, 32px hero.

Layout: 12-column max-width 1200px. Gutter 24px. Side margins clamp(16px, 4vw, 48px).

Anti-patterns to AVOID:
- No gradient text
- No glassmorphism / backdrop-blur decorative cards
- No cyan-on-dark or purple-to-blue gradients
- No neon glowing accents
- No generic card grids (icon + heading + text repeated)
- No centered-everything layouts
- No 3D illustrations or stock photos of smiling people
- No hero metric layouts (big number + small label + gradient accent)
- No rounded rectangles with thick colored border on one side
- No sparklines as decoration
```

---

## SCREEN 1: LANDING PAGE (Public)

```
Generate a web landing page for "AMPH Academy" — an Amazon advertising training platform for Filipino virtual assistants.

Brand: AMPH Academy. Tagline: "Three courses. One outcome: become the Amazon ads specialist clients retain."

Page structure (top to bottom):

1. HEADER (sticky, 56px tall):
   - Left: "AMPH Academy" logotype (Space Grotesk 700, #171717)
   - Right: "Sign in" text link (#404040) + "Get started" button (primary, #FF6B35)
   - Bottom border: 1px #E5E5E0

2. HERO SECTION (generous spacing, 80px+ top padding):
   - Eyebrow text above heading: "AMAZON PPC TRAINING FOR FILIPINO VAs" (Space Grotesk, 0.75rem, uppercase, #737373, letter-spacing 0.05em)
   - Main heading: "Stop earning ₱15k/month. Start charging ₱60k–₱80k for Amazon ads." (Space Grotesk 600, clamp(2.25rem, 4vw, 3rem), #171717, max-width 700px, line-height 1.15)
   - Subheading: "AMPH Academy teaches Filipino VAs the Amazon advertising work that clients pay premium rates for. Practice with real campaign tools, not just theory videos." (1.125rem, #404040, max-width 560px, line-height 1.5)
   - Two CTAs side by side: "See pricing →" (primary button, #FF6B35) + "Try a free tool" (secondary button, bordered)
   - NO hero image. Text-only hero. Clean, direct, type-led.

3. SOCIAL PROOF BAR (subtle, full-width, #F4F3EE background):
   - Horizontal row of 4 stats in a single line: "500+ VAs trained" | "₱50M+ ad spend managed" | "60% average completion" | "4.8/5 student rating"
   - Style: Space Grotesk 600 for numbers, 400 for labels, #171717 numbers, #737373 labels
   - Separated by thin vertical dividers (1px #E5E5E0)

4. WHAT YOU LEARN (3-column grid):
   - Section heading: "What you learn" (h2, left-aligned)
   - 3 items in a grid (repeat(auto-fit, minmax(280px, 1fr))):
     a. "Campaign structure" — "How to build Sponsored Products campaigns that Amazon's algorithm rewards. SP, SB, SD, and BTV structures explained with real examples."
     b. "Bid optimization" — "When to raise bids, when to lower them, and when to leave the campaign alone. Practice with the Bid Elevator tool."
     c. "Search term triage" — "Cut wasted spend on irrelevant clicks without killing the keywords that convert. 20 real search terms to practice on."
   - Each item: heading (h3) + paragraph (#404040). NO cards. NO icons above headings. Just text in a clean grid with generous spacing.

5. THREE TIERS (pricing preview, not full pricing page):
   - Section heading: "Three tiers. One goal."
   - 3-column layout:
     a. "PPC Foundations" — ₱2,999 — "5 core modules, basic tools, quizzes, badges"
     b. "Accelerated Mastery" — ₱5,999 — "8 modules, all tools, all resources, recordings" — marked "Most popular" with an info badge
     c. "Ultimate Transformation" — ₱9,999 — "Everything + weekly live classes, 1-on-1 review, priority certificates"
   - Each tier: tier name (small caps eyebrow), price in large mono font (JetBrains Mono, ₱ symbol smaller), feature bullets, "Get started" button
   - The "Accelerated Mastery" tier gets a subtle accent border (#FF6B35 left border or top accent strip) to indicate "Most popular"

6. TOOLS SHOWCASE:
   - Section heading: "Practice with real tools"
   - Description: "Five interactive tools that simulate the Amazon Advertising Console. Not theory. Practice."
   - 5 items in a horizontal scrollable row or 3+2 grid:
     a. Campaign Builder — "Build SP, SB, SD, and BTV campaign structures"
     b. Bid Elevator — "Practice bid optimization across 10 scenarios"
     c. Search Term Triage — "Triage 20 real search terms per session"
     d. Listing Audit — "Audit product listings for ad readiness"
     e. Keyword Research — "Research and categorize keywords by intent"
   - Each tool: name + one-line description. Minimal. No screenshots (we don't have them yet).

7. RYAN SECTION (founder/authority):
   - Left-aligned text block (not centered, not a card)
   - "Built by someone who's done the work"
   - "Ryan has managed ₱50M+ in Amazon ad spend across 200+ client accounts since 2014. He built AMPH Academy because the training he wished existed when he started doesn't exist anywhere — especially not for Filipino VAs."
   - No photo. Text-only authority block.

8. CTA SECTION:
   - Full-width background #171717 (dark)
   - Heading: "Start earning ₱60k–₱80k/month" (white text)
   - Subtext: "Join 500+ Filipino VAs who specialized in Amazon advertising through AMPH Academy."
   - Single CTA button: "See pricing →" (#FF6B35 button on dark background)
   - Generous padding (64px vertical)

9. FOOTER:
   - Simple. 3 columns: "AMPH Academy" (brand + copyright), "Platform" (links: Pricing, Tools, Sign in), "Contact" (email link)
   - Top border 1px #E5E5E0, muted text (#737373)
```

---

## SCREEN 2: SIGN IN PAGE

```
Generate a sign-in page for "AMPH Academy".

Page structure:
- Centered layout, max-width 400px, vertically centered (min-height 100vh with flex centering)
- Background: #FAFAF7
- Card container: white (#FFFFFF), padding 32px, border 1px #E5E5E0, radius 6px
- Header inside card:
  - "AMPH Academy" logotype (centered, Space Grotesk 700, #171717)
  - "Sign in to your account" (h1, centered, Space Grotesk 600, 1.75rem)
- Form:
  - Email field: label "Email" above input, input has border #E5E5E0, radius 4px, padding 12px, font 1rem, placeholder "you@example.com"
  - Password field: label "Password" above input, same styling, with show/hide toggle (eye icon)
  - "Sign in" button: primary (#FF6B35), full width, 44px height
- Below form:
  - "Don't have an account? Get started" — link to /auth/signup (#FF6B35)
- Error state (if applicable): red text below the field, "Email or password is incorrect. Try again."
- Footer text below card: "AMPH Academy © 2026 Project Amazon PH"
```

---

## SCREEN 3: SIGN UP PAGE

```
Generate a sign-up page for "AMPH Academy".

Page structure:
- Same centered layout as sign-in (max-width 400px, vertically centered)
- Background: #FAFAF7
- Card: white, padding 32px, border 1px #E5E5E0, radius 6px
- Header:
  - "AMPH Academy" logotype (centered)
  - "Create your account" (h1, centered, Space Grotesk 600, 1.75rem)
  - "Start your path to ₱60k–₱80k/month" (subtitle, #737373, centered)
- Form:
  - Full name field: label "Full name", placeholder "Juan Dela Cruz"
  - Email field: label "Email", placeholder "you@example.com" (may be pre-filled from checkout flow)
  - Password field: label "Password", with hint "At least 8 characters" below in #737373
  - Confirm password field: label "Confirm password"
  - "Create account" button: primary (#FF6B35), full width
- Below form:
  - "Already have an account? Sign in" — link to /auth/signin
- Error state: inline below field, red text
```

---

## SCREEN 4: PRICING PAGE

```
Generate a pricing page for "AMPH Academy" — Amazon PPC training for Filipino VAs.

Page structure:

1. HEADER SECTION (centered text, generous top padding 80px):
   - Eyebrow: "PRICING" (uppercase, 0.75rem, #737373, letter-spacing 0.05em)
   - Heading: "Pick the tier that matches where you are." (h1, centered, clamp(1.75rem, 3vw, 2.25rem))
   - Subtext: "Three months from now you'll either be earning ₱60,000 a month doing Amazon PPC work, or you'll be explaining to your family why that 'side hustle' didn't pan out. The tier doesn't change what we teach — it changes how fast you get unstuck." (#404040, max-width 640px, centered)

2. TIER CARDS (3 columns, max-width 1000px centered):
   Each card: white background, 1px border #E5E5E0, radius 6px, padding 32px
   
   a. PPC FOUNDATIONS — ₱2,999
      - Eyebrow: "PPC FOUNDATIONS" (uppercase, 0.75rem, #737373)
      - Price: ₱2,999 (JetBrains Mono, 2.25rem, #171717) with "one-time" label (#737373)
      - Description: "Start here if you're new to Amazon ads or want a solid foundation."
      - Feature bullets:
        - 5 core modules (15 lessons)
        - Campaign Builder tool (SP scenarios)
        - Bid Elevator tool (basic scenarios)
        - Quizzes with instant feedback
        - 2 completion badges
        - Certificate of completion
      - CTA button: "Get started" (secondary style — bordered)
      - Fine print: "Pay via GCash, Maya, credit card, or bank transfer"

   b. ACCELERATED MASTERY — ₱5,999 (FEATURED)
      - Same card structure but with: "Most popular" badge (info variant, #1E40AF background)
      - Subtle left border accent: 3px solid #FF6B35
      - Eyebrow: "ACCELERATED MASTERY"
      - Price: ₱5,999
      - Description: "The fastest path to Amazon ads specialist. Everything in Foundations plus the advanced tools."
      - Feature bullets:
        - 8 modules (31 lessons)
        - All 5 interactive tools (full scenario packs)
        - All downloadable resources
        - Session recordings
        - 4 completion badges
        - Priority certificate
      - CTA button: "Get started" (primary style — #FF6B35 filled)
      - Fine print: "Pay via GCash, Maya, credit card, or bank transfer"

   c. ULTIMATE TRANSFORMATION — ₱9,999
      - Eyebrow: "ULTIMATE TRANSFORMATION"
      - Price: ₱9,999
      - Description: "For VAs who want the full package — including live coaching and portfolio review."
      - Feature bullets:
        - Everything in Accelerated Mastery
        - Weekly live classes with Ryan
        - 1-on-1 portfolio review every month
        - Priority certificate
        - All 5 badges
        - Direct message access to Ryan
      - CTA button: "Get started" (secondary style)
      - Fine print: "Pay via GCash, Maya, credit card, or bank transfer"

3. FAQ SECTION:
   - Heading: "Questions"
   - 3 accordion items using <details>/<summary>:
     a. "Do you offer refunds?" — "Yes. Request within 14 days of purchase; we'll review and process within five business days. After 14 days, refunds are case-by-case."
     b. "Is this a subscription?" — "No. One-time payment. You keep access to the course and any future updates while your enrollment is active."
     c. "What if I don't have any Amazon ads experience yet?" — "Start with PPC Foundations. The first three modules build the mental model from scratch — you don't need prior campaign work to follow along."
   - Style: summary has cursor pointer, padding 16px 0, border-bottom 1px #E5E5E0, Space Grotesk 500
   - Content: #404040, padding 16px 0
```

---

## SCREEN 5: STUDENT DASHBOARD

```
Generate a student dashboard for "AMPH Academy" — the main screen after sign-in.

Layout: Full-width with sidebar navigation on the left (collapsible on mobile).

1. SIDEBAR (240px wide, white background, border-right 1px #E5E5E0):
   - Top: "AMPH Academy" logotype
   - Nav items (vertical list):
     - "Dashboard" (active — #FF6B35 text + #FFE5D9 background wash)
     - "Courses"
     - "Tools"
     - "Live Classes"
     - "Certificates"
     - "Payments"
   - Each item: 16px Phosphor icon + label, padding 10px 16px, radius 6px
   - Bottom: "Sign out" link

2. MAIN CONTENT (padding 32px, background #FAFAF7):
   - Header: "Welcome, [Name]" (h1) + progress summary below: "12 of 31 lessons complete • 3 in progress" (#737373)
   
   - STATS ROW (4 cards in a row, each card: white, border, radius 6px, padding 20px):
     a. "2,450" (Space Grotesk 600, 1.75rem) + "XP earned" (#737373)
     b. "Level 4" + "Current level"
     c. "12" + "Day streak"
     d. "3" + "Courses"
   
   - COURSES SECTION:
     - Heading: "Courses" (h2, margin-bottom 16px)
     - Course cards in a grid (repeat(auto-fit, minmax(320px, 1fr))):
       Each card: white, border, radius 6px, padding 24px, interactive (hover lift)
       - Top row: Course title (h3) + difficulty badge (right-aligned)
       - Description text (#404040)
       - Progress bar: thin bar (4px height, #F4F3EE background, #FF6B35 fill, radius 2px)
       - Below bar: "12 / 31 lessons" (left) + "39% complete" (right) — both #737373
   
   - TOOLS SECTION:
     - Heading: "Tools" (h2)
     - Description: "Practice real Amazon Advertising Console workflows with synthetic data." (#737373)
     - "Open the tools →" link (#FF6B35)
```

---

## SCREEN 6: COURSE DETAIL PAGE

```
Generate a course detail page for "AMPH Academy".

Layout: Full-width with sidebar (same as dashboard), main content area.

1. SIDEBAR: Same as dashboard (with "Courses" active)

2. MAIN CONTENT:
   - Breadcrumb: "← Dashboard" (link, #737373, small text)
   - Course header:
     - Title: "PPC Foundations" (h1)
     - Description: "Master the fundamentals of Amazon Sponsored Products advertising."
     - Meta row: "Beginner" badge (default) + "5 modules" badge + "15 lessons" badge + "₱2,999 tier" badge
   
   - MODULE LIST (vertical, each module is a section):
     Each module:
     - Module heading: "Module 1: Understanding Amazon Ads" (h2, with module number)
     - Lesson list below (vertical list, each lesson is a row):
       Each lesson row:
       - Left: Checkmark icon (green if complete, gray outline if not) + Lesson title
       - Right: "5 min" badge (info) + "50 XP" badge (success)
       - If locked: Lock icon + "Unlock with PPC Foundations" (#737373)
       - Divider between lessons (1px #E5E5E0)
     - Separator between modules (thicker divider or spacing)
   
   - PROGRESS SECTION (at bottom):
     - "Your progress" heading
     - Progress bar (same style as dashboard)
     - "4 of 15 lessons complete • 27%"
```

---

## SCREEN 7: LESSON PAGE

```
Generate a lesson reading page for "AMPH Academy".

Layout: Full-width with sidebar, main content with constrained reading width.

1. SIDEBAR: Same as dashboard (with "Courses" active)

2. MAIN CONTENT (max-width 720px, centered in main area):
   - Back link: "← PPC Foundations" (#737373, small)
   - Header:
     - Badges row: "Module 1 · Lesson 3" (default) + "8 min" (info) + "+50 XP" (success)
     - Title: "Sponsored Products: Your First Campaign Type" (h1)
   
   - Article body (reading-optimized):
     - Max-width 65ch
     - Font: Space Grotesk 400, 1rem, line-height 1.6
     - Headings within article: h2 (1.75rem), h3 (1.375rem)
     - Code blocks: JetBrains Mono, #F4F3EE background, padding 16px, radius 4px
     - Lists: standard, with 8px spacing
     - Links: #FF6B35
     - Strong text: font-weight 600
   
   - Actions section:
     - If incomplete: "Mark as complete (+50 XP)" button (primary, #FF6B35)
     - If complete: "Lesson complete" badge (success, green)
   
   - Quiz card (if lesson has quiz):
     - White card, border, padding 24px
     - "Knowledge check" heading
     - "This lesson has a quiz. Pass with 80% or higher to count this lesson as complete." (#404040)
     - "Take the quiz →" button (primary)
   
   - Prev/Next navigation (bottom):
     - Two columns: "Previous" (left) and "Next" (right)
     - Each: direction label (small, #737373) + lesson title (Space Grotesk 500)
     - Arrow icon (CaretLeft/CaretRight)
```

---

## SCREEN 8: QUIZ PAGE

```
Generate a quiz page for "AMPH Academy".

Layout: Full-width with sidebar, centered content.

1. SIDEBAR: Same as dashboard

2. MAIN CONTENT (max-width 640px, centered):
   - Back link: "← Back to lesson"
   - Header:
     - "Module 1 · Lesson 3" badge
     - "Knowledge check" (h1)
     - "Answer all 5 questions. Pass with 80% or higher to earn completion credit." (#404040)
   
   - Question cards (one per question, vertical stack):
     Each question:
     - Question number + text: "1. What does ACoS measure?" (Space Grotesk 500)
     - 4 answer options as radio buttons:
       a. "Ad Cost of Sale — ad spend divided by ad sales"
       b. "Average Cost of Shopping — total spend per order"
       c. "Ad Click Optimization Score — quality rating"
       d. "Annual Campaign Operating Spend — yearly budget"
     - Each option: radio input + label, padding 12px 16px, border 1px #E5E5E0, radius 4px, full width
     - Selected state: border #FF6B35, background #FFE5D9
     - Correct answer (after submit): green border #0E7C3A, background #DCFCE7
     - Wrong answer (after submit): red border #B91C1C, background #FEE2E2, with explanation text below
     - Explanation text (after submit): "#404040, font-size 0.875rem, margin-top 8px"
   
   - Submit section:
     - "Submit answers" button (primary, full width, disabled until all questions answered)
     - After submit: show score "4/5 — 80% — Passed!" or "3/5 — 60% — Not quite"
     - If passed: "Continue to next lesson →" button
     - If failed: "Try again" button
```

---

## SCREEN 9: TOOLS INDEX PAGE

```
Generate a tools index page for "AMPH Academy" — listing all 5 interactive tools.

Layout: Full-width with sidebar, main content.

1. SIDEBAR: Same as dashboard (with "Tools" active)

2. MAIN CONTENT:
   - Header:
     - "Tools" (h1)
     - "Practice real Amazon Advertising Console workflows with synthetic data." (#404040)
   
   - Tool cards (grid: repeat(auto-fit, minmax(320px, 1fr)), gap 24px):
     Each card: white, border, radius 6px, padding 24px, interactive
     - Tool name (h3): "Campaign Builder"
     - Description: "Build SP, SB, SD, and BTV campaign structures step by step."
     - Meta: "5 scenarios" badge + "SP · SB · SD · BTV" badge
     - "Open tool →" link (#FF6B35)
   
   - Five tools:
     1. Campaign Builder — "Build SP, SB, SD, and BTV campaign structures step by step." — 5 scenarios
     2. Bid Elevator — "Practice bid optimization across 10 real-world scenarios." — 10 scenarios
     3. Search Term Triage — "Triage 20 search terms per session. Keep, pause, or negate." — 2 scenarios
     4. Listing Audit — "Audit product listings for ad readiness and optimization." — 5 scenarios
     5. Keyword Research — "Research, categorize, and prioritize keywords by intent." — 5 scenarios
```

---

## SCREEN 10: TOOL SCENARIO PAGE (Campaign Builder Example)

```
Generate a tool scenario page for "AMPH Academy" — Campaign Builder wizard.

Layout: Full-width with sidebar, main content.

1. SIDEBAR: Same as dashboard (with "Tools" active)

2. MAIN CONTENT:
   - Breadcrumb: "← Tools" + "Campaign Builder"
   - Header:
     - "Campaign Builder" (h1)
     - "Scenario: Launch a new Sponsored Products campaign for a wireless earbuds product" (subtitle, #404040)
     - Meta: "Step 2 of 5" progress indicator
   
   - PROGRESS STEPS (horizontal, 5 steps):
     Steps: "Campaign type" → "Campaign settings" → "Ad group" → "Keywords" → "Review"
     Current step: #FF6B35 with filled circle
     Completed steps: #0E7C3A with checkmark
     Upcoming: #D4D4D4 with empty circle
     Connected by a thin line between circles
   
   - WIZARD CONTENT (white card, padding 32px):
     - "Campaign settings" heading (h2)
     - Form fields:
       - Campaign name: text input (label above, placeholder "SP-WirelessEarbuds-Launch")
       - Daily budget: number input with ₱ prefix (placeholder "1000")
       - Start date: date input
       - Targeting: radio group ("Automatic" / "Manual")
     - Helper text below fields in #737373 where needed
   
   - NAVIGATION (bottom of card):
     - "Back" (secondary button, left)
     - "Continue to ad group →" (primary button, right)
   
   - SIMULATION PANEL (right side or below, if room):
     - "Your campaign so far" summary
     - Campaign type: "Sponsored Products"
     - Budget: "₱1,000/day"
     - Targeting: "Automatic"
     - This updates as the user progresses through steps
```

---

## SCREEN 11: ADMIN DASHBOARD

```
Generate an admin dashboard for "AMPH Academy".

Layout: Full-width with admin sidebar, main content.

1. ADMIN SIDEBAR (240px, white, border-right):
   - Top: "AMPH Academy" + "Admin" badge (danger variant, small)
   - Nav items:
     - "Dashboard" (active)
     - "Users"
     - "Courses"
     - "Content"
     - "Payments"
     - "Refunds"
     - "Live Classes"
     - "Badges"
     - "Settings"
   - Each item: Phosphor icon + label

2. MAIN CONTENT (padding 32px, #FAFAF7):
   - Header: "Admin Dashboard" (h1) + "Welcome, Ryan" subtitle
   
   - STATS ROW (4 cards):
     a. "127" + "Total users"
     b. "3" + "Published courses"
     c. "5" + "Badges"
     d. "₱284,500" + "Total revenue"
   
   - RECENT ACTIVITY TABLE:
     - Heading: "Recent payments"
     - Table (compact, 40px rows):
       Columns: "Student" | "Tier" | "Amount" | "Date" | "Status"
       Rows:
       - "Juan D." | "Accelerated Mastery" | "₱5,999" | "Jul 10, 2026" | "Paid" (green badge)
       - "Maria S." | "PPC Foundations" | "₱2,999" | "Jul 10, 2026" | "Paid"
       - "Ana R." | "Ultimate" | "₱9,999" | "Jul 9, 2026" | "Paid"
     - Table style: header has bottom border only, left-aligned text, right-aligned numbers, no zebra striping
   
   - QUICK LINKS:
     - "View all users →" | "Manage courses →" | "Review refunds →"
```

---

## SCREEN 12: ADMIN USER MANAGEMENT

```
Generate a user management page for the admin panel of "AMPH Academy".

Layout: Full-width with admin sidebar, main content.

1. ADMIN SIDEBAR: Same as admin dashboard (with "Users" active)

2. MAIN CONTENT:
   - Header row:
     - Left: "Users" (h1) + "127 total" count
     - Right: Search input (with magnifying glass icon) + filter dropdown ("All roles" / "Students" / "Admins")
   
   - USERS TABLE:
     Columns: "Name" | "Email" | "Role" | "Level" | "XP" | "Joined" | "Status" | "Actions"
     Rows (5 examples):
     - "Juan Dela Cruz" | "juan@email.com" | "Student" (badge) | "4" | "2,450" | "Jun 15, 2026" | "Active" (green) | "Edit" (ghost button)
     - "Maria Santos" | "maria@email.com" | "Student" | "7" | "8,200" | "May 20, 2026" | "Active" | "Edit"
     - "Ryan Dabao" | "ryan@projectamazonph.com" | "Admin" (info badge) | "1" | "0" | "Jul 1, 2026" | "Active" | "Edit"
     - "Ana Reyes" | "ana@email.com" | "Student" | "2" | "890" | "Jul 5, 2026" | "Active" | "Edit"
     - "Pedro Cruz" | "pedro@email.com" | "Student" | "1" | "150" | "Jul 8, 2026" | "Suspended" (danger badge) | "Edit"
   
   - Pagination: "Showing 1–10 of 127" + "← Previous" "Next →" buttons
```

---

## SCREEN 13: PAYMENTS PAGE (Student)

```
Generate a payments history page for "AMPH Academy" students.

Layout: Full-width with sidebar, main content.

1. STUDENT SIDEBAR: Same as dashboard (with "Payments" active)

2. MAIN CONTENT:
   - Header: "Payments" (h1) + "Your purchase history" subtitle
   
   - PAYMENT CARDS (vertical stack):
     Each payment: white card, border, padding 24px
     - Top row: Tier name (h3) + Status badge ("Paid" green / "Refunded" danger / "Pending" warning)
     - Amount: "₱5,999" (JetBrains Mono, 1.25rem)
     - Date: "July 10, 2026" + Payment ID: "pay_xxxxx"
     - Payment method: "GCash" or "Maya" or "Credit Card"
     - Actions: "Download receipt" (ghost button) + "Request refund" (ghost button, danger text)
   
   - Empty state (if no payments):
     - "No payments yet" (heading)
     - "Enroll in a course to get started. Pick the tier that matches where you are." (#404040)
     - "See pricing →" button (primary)
```

---

## SCREEN 14: CERTIFICATES PAGE

```
Generate a certificates page for "AMPH Academy" students.

Layout: Full-width with sidebar, main content.

1. STUDENT SIDEBAR: Same as dashboard (with "Certificates" active)

2. MAIN CONTENT:
   - Header: "Certificates" (h1) + "Your completed course certificates"
   
   - CERTIFICATE CARDS (grid: repeat(auto-fit, minmax(320px, 1fr))):
     Each card: white, border, padding 24px
     - Certificate title: "PPC Foundations — Completed"
     - Date: "Completed July 8, 2026"
     - Verification hash: "abc123def456" (JetBrains Mono, small, #737373)
     - Actions: "Download PDF" (primary button) + "Verify online" (ghost link)
   
   - Empty state:
     - "No certificates yet"
     - "Complete a course to earn your certificate. Each certificate has a unique verification code."
     - "Start learning →" button
```

---

## SCREEN 15: CHECKOUT COMPLETE PAGE

```
Generate a checkout success page for "AMPH Academy".

Layout: Centered, max-width 480px, vertically centered.

- Background: #FAFAF7
- Card: white, border, padding 48px, radius 6px, centered
- Success checkmark icon (large, #0E7C3A, centered)
- "Payment received" (h1, centered, Space Grotesk 600)
- "Your enrollment in Accelerated Mastery is active. You now have access to all 8 modules, 5 tools, and every resource in the tier." (#404040, centered)
- "₱5,999 paid via GCash" (JetBrains Mono, small, #737373)
- "Go to dashboard →" button (primary, centered)
- "Download receipt" link below (#FF6B35)
```

---

## SCREEN 16: LIVE CLASSES PAGE

```
Generate a live classes page for "AMPH Academy" students (Ultimate tier).

Layout: Full-width with sidebar, main content.

1. STUDENT SIDEBAR: Same as dashboard (with "Live Classes" active)

2. MAIN CONTENT:
   - Header: "Live Classes" (h1) + "Weekly coaching sessions with Ryan" subtitle
   
   - UPCOMING CLASSES:
     Class card: white, border, padding 24px
     - Title: "Campaign Optimization Workshop"
     - Date/Time: "Thursday, July 17, 2026 at 7:00 PM PST" (JetBrains Mono)
     - Description: "Bring your campaign data. We'll review real accounts and optimize live."
     - Status badge: "Upcoming" (info) or "Live now" (success, pulsing)
     - "Register" button (primary) if not registered, "Registered" badge if already registered
   
   - PAST RECORDINGS (if Ultimate tier):
     - "Recordings" heading
     - List of past sessions with "Watch recording" link
```

---

## SCREEN 17: REFUND REQUEST PAGE

```
Generate a refund request page for "AMPH Academy" students.

Layout: Full-width with sidebar, centered content.

1. STUDENT SIDEBAR: Same as dashboard

2. MAIN CONTENT (max-width 560px, centered):
   - Back link: "← Payments"
   - Header: "Request a refund" (h1)
   
   - Payment summary card:
     - "Accelerated Mastery — ₱5,999"
     - "Paid July 10, 2026 via GCash"
   
   - Form:
     - Reason field: textarea (label "Reason for refund", placeholder "Tell us why you're requesting a refund")
     - "Submit refund request" button (primary)
     - Fine print: "Refunds are reviewed within 5 business days. You'll receive an email when a decision is made."
```

---

## SCREEN 18: VERIFY CERTIFICATE (Public)

```
Generate a certificate verification page for "AMPH Academy" — public, no auth.

Layout: Centered, max-width 480px.

- Background: #FAFAF7
- Card: white, border, padding 32px, centered
- "Verify certificate" heading (h1, centered)
- Verification hash displayed: "abc123def456" (JetBrains Mono, centered)
- Certificate details:
  - "Issued to: Juan Dela Cruz"
  - "Course: PPC Foundations"
  - "Completed: July 8, 2026"
  - "Status: Valid" (green badge)
- "This certificate was issued by AMPH Academy and can be verified at this URL."
```

---

## MULTI-SCREEN FLOW PROMPT

For Stitch's multi-screen prototype feature, use this combined prompt:

```
Create a multi-screen prototype for "AMPH Academy" — an Amazon PPC training platform.

The prototype should connect these screens with interaction hotspots:

1. LANDING PAGE → Click "Get started" → SIGN UP PAGE
2. LANDING PAGE → Click "Sign in" → SIGN IN PAGE
3. LANDING PAGE → Click "See pricing" → PRICING PAGE
4. SIGN IN PAGE → Submit form → STUDENT DASHBOARD
5. SIGN UP PAGE → Submit form → STUDENT DASHBOARD
6. STUDENT DASHBOARD → Click course card → COURSE DETAIL
7. COURSE DETAIL → Click lesson → LESSON PAGE
8. LESSON PAGE → Click "Take the quiz" → QUIZ PAGE
9. STUDENT DASHBOARD → Click "Tools" → TOOLS INDEX
10. TOOLS INDEX → Click tool card → TOOL SCENARIO
11. PRICING PAGE → Click "Get started" → CHECKOUT (simplified)
12. CHECKOUT → Payment success → CHECKOUT COMPLETE

Design system: Field Manual. Dense, scannable, utilitarian. Off-white #FAFAF7 background, orange #FF6B35 accent. Space Grotesk font. No glassmorphism, no gradients, no decorative elements. Information density is a feature.
```

---

## POST-STITCH WORKFLOW

After generating each screen in Stitch:

1. **Export HTML/CSS** — Stitch generates static HTML with Tailwind
2. **Convert to CSS Modules** — Replace Tailwind classes with design token references from globals.css
3. **Convert to React components** — Wrap in Next.js page components
4. **Wire up data** — Connect to existing server actions and Prisma queries
5. **Test** — Verify against the design brief anti-AI-slop checklist

The Stitch output is the **visual starting point**, not the final product. We adapt the design to our CSS Module system, component library, and server-side data flow.
