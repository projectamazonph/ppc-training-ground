# Runbooks

Operational procedures for Project Amazon PH Academy v2. Each runbook is a step-by-step
guide written to be runnable by someone who did not write it.

| Runbook | Sprint / Story | Use when… |
|---------|----------------|-----------|
| [production-deploy.md](./production-deploy.md) | Sprint 12 / STORY-053 | Deploying `main` to Vercel production, including rollback |

## Conventions

- Every runbook has a **Pre-flight** section that must be 100% green before
  proceeding.
- Every step has a copy-pasteable command.
- Every gate has a clear pass/fail signal.
- Rollback (where applicable) is always **before** debugging in place.

## Adding a new runbook

1. Copy `production-deploy.md` as a template.
2. Number sections starting from `0.` for the pre-flight checklist.
3. Always end with a **Rollback** section if the procedure modifies production
   state.
4. Update the table above and the file's `Status:` header.
