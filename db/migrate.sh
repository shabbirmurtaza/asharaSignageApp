#!/bin/bash
# Idempotent migration runner.
# Auth functions + RLS re-run every deploy (CREATE OR REPLACE / DROP IF EXISTS).
# Schema + seeds run only on first deploy (guarded by table existence check).

set -euo pipefail

DB_USER="${POSTGRES_USER}"
DB_NAME="${POSTGRES_DB}"
PSQL_CMD="docker compose exec -T postgres psql -U $DB_USER -d $DB_NAME"

echo "[migrate] extensions..."
$PSQL_CMD -f /sql/01_extensions.sql

# Check if schema has been applied by probing the `signs` table
SCHEMA_APPLIED=$($PSQL_CMD -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='signs'" 2>/dev/null | tr -d ' \n')

if [ "$SCHEMA_APPLIED" = "0" ]; then
    echo "[migrate] First run — applying schema, seeds..."
    $PSQL_CMD -f /sql/schema_v7.sql
    $PSQL_CMD -f /sql/seed_signs.sql
    $PSQL_CMD -f /sql/seed_bootstrap_admin.sql
else
    echo "[migrate] Schema exists — skipping destructive files."
fi

echo "[migrate] auth functions (idempotent)..."
$PSQL_CMD -f /sql/02_auth_functions.sql

echo "[migrate] RLS policies (idempotent)..."
$PSQL_CMD -f /sql/03_rls_policies.sql

echo "[migrate] restarting postgrest..."
docker compose restart postgrest

echo "[migrate] done."
