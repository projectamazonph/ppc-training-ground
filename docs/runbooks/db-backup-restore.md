# Database Backup + Restore Runbook

**Status:** ✅ Active (Sprint 12 / STORY-054)
**Audience:** Ryan (and any future operator)
**Last verified:** 2026-07-13

This runbook covers (a) daily logical backups of the production Neon
PostgreSQL database, (b) the procedure to restore from a backup into a
scratch database, and (c) the restore drill that proves the backup is usable.

---

## 0. Pre-flight

- [ ] `DATABASE_URL` (production) is set in the operator's shell:
  ```bash
  export DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/amph_v2?sslmode=require"
  ```
- [ ] `psql` and `pg_dump` / `pg_restore` are installed locally (Postgres 16+ client tools).
  ```bash
  psql --version   # → psql (PostgreSQL) 16.x
  ```
- [ ] A scratch database is available (Neon project-branch or local Postgres). This runbook uses a scratch branch in Neon with `?sslmode=require`.
- [ ] You are authenticated with Vercel CLI and can run `vercel env pull .env.production`.

---

## 1. Backup strategy

### 1.1 Logical backups via `pg_dump`

Daily logical backups are run via a GitHub Actions cron job (see
`scripts/backup-prod.sh`). The job runs every day at **02:00 UTC** (10:00 PHT)
to minimize overlap with peak traffic in the Philippine morning.

**What is backed up:**
- Full schema (DDL)
- All table data
- Indexes (rebuilt by `pg_restore` automatically)
- Constraints and triggers

**What is NOT backed up:**
- Roles and permissions (Neon-managed)
- The branch's connection-pooler config (Neon-managed)

### 1.2 Storage of backups

Backups are uploaded to **Vercel Blob** (which we already use for course
content — Sprint 7). The bucket is `amph-prod-backups/` with a 30-day
lifecycle policy set in the Vercel dashboard.

**Path format:** `amph-prod-backups/db/YYYY-MM-DDTHH-mm-ssZ.dump`
**Retention:** 30 days (configurable via the Blob lifecycle rule).

### 1.3 Verification cron

A second GitHub Actions cron (`scripts/verify-backup.sh`, scheduled weekly)
downloads the most recent backup, restores it into a scratch Neon branch,
asserts the row count of `User` and `Enrollment` tables matches production,
then drops the scratch branch. This is the same logic as §3 below.

---

## 2. Run a one-off backup now

If you need a backup right now (e.g. before a risky migration):

```bash
# Local — assumes you have BLOB_READ_WRITE_TOKEN in your shell
export DATABASE_URL=$(vercel env pull .env.production --environment=production | grep DATABASE_URL | cut -d'"' -f2 | head -1)
./scripts/backup-prod.sh
```

The script:
1. Runs `pg_dump --no-owner --clean --if-exists -Fc -d "$DATABASE_URL"` to a temp file.
2. Uploads the file to Vercel Blob under `amph-prod-backups/db/manual/`.
3. Prints the Blob URL to stdout.
4. Exits 0 on success, 1 on any failure.

**Schedule it:** the GitHub Actions workflow `.github/workflows/db-backup.yml`
runs this same script on cron.

---

## 3. Restore drill (this is the STORY-054 acceptance test)

This procedure proves that a backup is restorable and that the data is intact.

### 3.1 Create a scratch database

In the Neon dashboard:
1. Open the `amph-v2` project.
2. Create a new branch called `restore-drill-<date>` (e.g. `restore-drill-2026-07-13`).
3. Copy the **pooler** connection string of the new branch. It will look like:
   ```
   postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/amph_v2?sslmode=require
   ```

Alternatively, use the Neon API:

```bash
curl -X POST 'https://console.neon.tech/api/v2/projects/<project-id>/branches' \
  -H 'Authorization: Bearer $NEON_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"branch": {"name": "restore-drill-2026-07-13"}}'
```

### 3.2 Pick a backup to restore

List recent backups in the Blob bucket:

```bash
# Pull latest backup blob URL
curl -sS -H "Authorization: Bearer $BLOB_READ_WRITE_TOKEN" \
  'https://blob.vercel-storage.com?prefix=amph-prod-backups/db&limit=10' | jq '.blobs[].url'
```

Pick the most recent one, e.g.
`https://<id>.public.blob.vercel-storage.com/amph-prod-backups/db/2026-07-13T02-00-00Z.dump`.

### 3.3 Restore into scratch DB

```bash
export SCRATCH_URL="postgresql://user:pass@ep-yyy-pooler.region.aws.neon.tech/amph_v2?sslmode=require"
export BACKUP_URL="https://<id>.public.blob.vercel-storage.com/amph-prod-backups/db/2026-07-13T02-00-00Z.dump"

./scripts/restore-prod.sh "$SCRATCH_URL" "$BACKUP_URL"
```

The script downloads the dump, runs `pg_restore --clean --if-exists --no-owner -d "$SCRATCH_URL"`,
then runs the row-count assertions (see §3.4).

### 3.4 Row-count assertions (the proof)

After restore, the script asserts:

| Table | Acceptance |
|-------|------------|
| `User` | row count must match production within **1%** |
| `Enrollment` | row count must match production within **1%** |
| `Course` | row count must match production within **1%** |
| `Module` | row count must match production within **1%** |
| `Lesson` | row count must match production within **1%** |
| `ToolSession` | row count must match production within **5%** (write-heavy; small drift OK) |

If any assertion fails, the script exits 1 and prints a diff. Do **not** rely
on the backup until the diff is understood.

### 3.5 Clean up the scratch branch

```bash
curl -X DELETE 'https://console.neon.tech/api/v2/projects/<project-id>/branches/restore-drill-2026-07-13' \
  -H 'Authorization: Bearer $NEON_API_KEY'
```

Or in the Neon dashboard → Branches → `restore-drill-<date>` → Delete.

---

## 4. Restore in an emergency (production data is corrupt)

If production itself needs to be restored from a backup:

> **STOP.** Restoring production means accepting data loss for transactions
> after the backup's timestamp. Confirm with whoever owns the product before
> proceeding. This is a last-resort procedure.

1. Take a fresh backup of the current (corrupt) state first — you may want it
   for forensics.
2. Identify the backup to restore. Prefer the **last clean backup before the
   incident**.
3. Restore into a scratch DB first (§3). Confirm it looks right.
4. When ready to swap production:
   - Option A (preferred): point the production app at the scratch DB
     connection string via Vercel env var update. No data migration needed.
   - Option B: drop the production branch and rename the scratch branch to
     the production branch in Neon. Faster but more invasive.
5. Restart the Vercel deployment so all serverless instances pick up the new
   `DATABASE_URL`.
6. Notify in `#amph-launch` Slack: "Production restored from `<backup-URL>`
   at <UTC time>; expect data loss between <backup-time> and <incident-time>."

---

## 5. Schedule (where the cron lives)

The actual cron is in `.github/workflows/db-backup.yml` (Sprint 12 deliverable):

```yaml
name: db-backup
on:
  schedule:
    - cron: '0 2 * * *'   # 02:00 UTC daily
  workflow_dispatch:        # manual trigger
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm install -g @vercel/blob-cli   # or use direct API
      - name: Run backup
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          BLOB_READ_WRITE_TOKEN: ${{ secrets.BLOB_READ_WRITE_TOKEN }}
        run: ./scripts/backup-prod.sh
```

Secrets required in **GitHub repo settings → Secrets and variables → Actions**:

- `DATABASE_URL` — production Neon pooler URL
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob production token

---

## 6. Change log

| Date | Change | Author |
|------|--------|--------|
| 2026-07-13 | Initial runbook authored (Sprint 12 / STORY-054) | Ryan |