# AI Feature Removal — Project Amazon PH Academy

**Status:** Approved
**Owner:** Ryan Roland Dabao
**Date:** 2026-07-07

---

## The Rule

> Project Amazon PH Academy uses zero external AI APIs. Zero AI features ship to production. No mentor chat, no AI-powered mistake analysis, no AI-generated content, no AI scoring.

This is a product decision, not a temporary cost-saving measure. The platform is human-authored content with deterministic, rule-based scoring.

## What To Remove

### Prisma Models

| Model | Action | Migration |
|-------|--------|-----------|
| `MentorConversation` | DELETE | Drop table, drop relation from User |
| `MentorMessage` | DELETE | Drop table, drop relation from MentorConversation |

### Relation Fields on `User`

| Field | Action |
|-------|--------|
| `mentorConversations` | DELETE |

### Files To Delete

```
src/app/actions/mentor.ts
src/app/actions/mistake-analysis.ts
src/lib/mentor.ts                    (if exists)
src/lib/mistake-analysis.ts           (if exists)
src/app/api/mentor/route.ts           (if exists)
src/app/api/mistake-analysis/route.ts (if exists)
src/app/(dashboard)/mentor/page.tsx  (if exists)
src/components/amph/mentor/*          (entire directory)
src/components/amph/mistake-analysis/* (entire directory)
```

### UI Surfaces To Remove

- Mentor chat page (any route under `/mentor`)
- "Ask the mentor" buttons on any page
- "AI mistake review" panel on quiz results
- "Get AI help" links on lessons or tools

### Test Files To Remove

```
tests/unit/mentor.test.ts
tests/unit/mistake-analysis.test.ts
tests/e2e/mentor.spec.ts
tests/e2e/mistake-analysis.spec.ts
```

### Dependencies To Remove

Check `package.json` for:

- `openai` (any version)
- `@anthropic-ai/sdk`
- `langchain` / `@langchain/*`
- `ai` (Vercel AI SDK)
- `replicate`
- Any package with `gpt`, `llm`, or `ai` in the name that's not a UI primitive

## Migration Plan

### Step 1: Inventory (1 hour)

Grep for AI usage:

```bash
# Find all files referencing AI features
grep -r -l -E "mentor|mistakeAnalysis|openai|anthropic|gpt-4|claude" \
  src/ prisma/ tests/ docs/

# Find all env vars related to AI
grep -r -E "OPENAI|ANTHROPIC|AI_API|MENTOR|MISTAKE" .env*
```

Document every hit in a removal checklist. Do not skip this step.

### Step 2: Database Migration (15 minutes, runs once)

Create `prisma/migrations/20260707_remove_mentor_models/migration.sql`:

```sql
-- DropForeignKey
DROP TABLE IF EXISTS "MentorMessage";
DROP TABLE IF EXISTS "MentorConversation";
```

Update `prisma/schema.prisma`:

1. Remove `MentorConversation` and `MentorMessage` models.
2. Remove `mentorConversations` relation from `User` model.

Run locally:

```bash
cd project
npx prisma migrate dev --name remove_mentor_models
```

Verify with `npx prisma studio` that the tables are gone.

### Step 3: Code Removal (3–4 hours)

In this order:

1. Remove Prisma model references (imports break first, easiest to find)
2. Remove action files
3. Remove API routes
4. Remove UI components
5. Remove page routes
6. Remove tests

After each step, run `pnpm tsc --noEmit` to catch broken references. Fix them before moving on.

### Step 4: Dependency Cleanup (30 minutes)

Remove from `package.json`:

```json
{
  "dependencies": {
    // DELETE any of these if present
    "openai": "...",
    "@anthropic-ai/sdk": "...",
    "langchain": "...",
    "ai": "..."
  }
}
```

Run `pnpm install` to update lockfile. Run `pnpm build` to verify no orphan references.

Remove from `.env.example` and `.env.production`:

```
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

If the production deployment has these set in Vercel, remove them via `vercel env rm`.

### Step 5: Documentation Cleanup (30 minutes)

Search and remove:

- Mentions of "AI mentor" in README, PRD, docs/bmad/*
- Mentions of "mistake analysis" in lesson content
- Links to mentor routes in any nav config
- Settings/preferences references to AI features

### Step 6: Verification (1 hour)

The grep that should now return zero results:

```bash
grep -r -l -E "mentor|mistakeAnalysis|mistake-analysis" \
  src/ prisma/ tests/ docs/ 2>/dev/null
# Expected: no output

grep -r -l -E "openai|anthropic|gpt-4|claude-(opus|sonnet|haiku)" \
  src/ prisma/ tests/ 2>/dev/null
# Expected: no output

grep -r -l -E "Mentor|MISTAKE_ANALYSIS" \
  src/app/actions/ 2>/dev/null
# Expected: no output
```

Build must succeed:

```bash
pnpm tsc --noEmit
pnpm build
```

Manual smoke test:

1. Sign in as a student
2. Navigate the dashboard
3. Confirm no mentor button, no AI panel, no chat UI anywhere
4. Take a quiz, confirm no "AI mistake review" appears

### Step 7: Commit and Deploy

Single commit message:

```
refactor: remove all AI features (mentor + mistake analysis)

- Drop MentorConversation and MentorMessage models
- Delete mentor.ts and mistake-analysis.ts action files
- Remove all related UI components and routes
- Strip AI dependencies from package.json
- Update documentation

Complies with platform rule: zero external AI features.
```

Deploy via the standard Vercel CI. Monitor Sentry for 24 hours after deploy to catch any orphaned references in production traffic.

## What Replaces The Removed Features

**Mentor chat** — replaced by nothing. Students ask questions in the Live Classes, in the ProjectAmazonPH Facebook Group, or via email support. The platform does not need an in-product chat.

**AI mistake analysis** — replaced by static "Common mistakes" sections in the quiz review UI. Written once by a human, shown to every student who fails. Lower cost, higher consistency, no hallucination risk.

See `lesson-content-pattern.md` for the template.

## Rollback

If something breaks, revert the migration:

```bash
# Local rollback
git revert HEAD
npx prisma migrate resolve --rolled-back 20260707_remove_mentor_models

# Production: redeploy previous commit via Vercel dashboard
```

The drop is destructive (table data is gone). If preserving historical conversations matters, export before deleting:

```bash
sqlite3 prisma/prod.db "SELECT * FROM MentorConversation" > mentor-export.csv
```