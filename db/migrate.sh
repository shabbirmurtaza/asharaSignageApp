#!/bin/bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Source .env if vars not already in environment
if [ -z "${POSTGRES_USER:-}" ]; then
    set -a && source "$APP_DIR/.env" && set +a
fi

PSQL_CMD="docker compose -f $APP_DIR/docker-compose.yml exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB"

echo "[migrate] extensions..."
$PSQL_CMD -v "signage.authenticator_password=$AUTHENTICATOR_PASSWORD" -f /sql/01_extensions.sql

SCHEMA_APPLIED=$($PSQL_CMD -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='signs'" 2>/dev/null | tr -d ' \n')

if [ "$SCHEMA_APPLIED" = "0" ]; then
    echo "[migrate] First run — applying schema, seeds..."
    $PSQL_CMD -f /sql/schema_v7.sql
    $PSQL_CMD -f /sql/seed_signs.sql
    $PSQL_CMD -f /sql/seed_bootstrap_admin.sql
else
    echo "[migrate] Schema exists — skipping destructive files."
fi

echo "[migrate] auth functions..."
$PSQL_CMD -f /sql/02_auth_functions.sql

echo "[migrate] RLS policies..."
$PSQL_CMD -f /sql/03_rls_policies.sql

echo "[migrate] restarting postgrest..."
docker compose -f "$APP_DIR/docker-compose.yml" restart postgrest

echo "[migrate] done."
