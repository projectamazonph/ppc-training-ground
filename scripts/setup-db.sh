#!/usr/bin/env bash
# One-command database wiring for the stripped launch build.
#
# Usage:
#   DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... ./scripts/setup-db.sh
#
# Runs, in order: schema migrations, curriculum content import (courses,
# modules, lessons, quizzes), then the seed (admin account, pricing tiers,
# badges, live classes). The import must precede the seed — the seed's
# live-class step needs a published course to attach to. Everything is
# idempotent; safe to re-run.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${ADMIN_EMAIL:?ADMIN_EMAIL is required}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD is required}"

echo "==> prisma migrate deploy"
pnpm prisma:deploy

echo "==> importing curriculum content"
pnpm tsx scripts/import-amph-content.ts

echo "==> seeding admin, tiers, badges, live classes"
pnpm prisma db seed

echo "==> done. Sign in at /auth/signin as ${ADMIN_EMAIL}."
