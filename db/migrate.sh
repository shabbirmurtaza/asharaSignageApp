#!/bin/bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Source .env if vars not already in environment
if [ -z "${POSTGRES_USER:-}" ]; then
    set -a && source "$APP_DIR/.env" && set +a
fi

PSQL_CMD="docker compose -f $APP_DIR/docker-compose.yml exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB"

echo "[migrate] extensions..."
$PSQL_CMD -f /sql/01_extensions.sql
$PSQL_CMD -c "ALTER ROLE authenticator WITH PASSWORD '$AUTHENTICATOR_PASSWORD';"

SCHEMA_APPLIED=$($PSQL_CMD -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='signs'" 2>/dev/null | tr -d ' \n')

if [ "$SCHEMA_APPLIED" = "0" ]; then
    echo "[migrate] No schema — applying schema_v7 (destructive rebuild)..."
    $PSQL_CMD -v ON_ERROR_STOP=1 -f /sql/schema_v7.sql
else
    echo "[migrate] Schema exists — skipping destructive schema_v7.sql."
fi

# Seeds gate on ROW COUNT, not table existence: a prior deploy can create the
# tables but fail before the (single-transaction) seeds commit, leaving empty
# tables that the old table-existence gate would skip forever. Both seed files
# are idempotent (on conflict do nothing), so re-running when empty is safe.
# ON_ERROR_STOP=1 makes a future seed failure fail the deploy loudly instead of
# silently leaving the table empty.
SIGNS_COUNT=$($PSQL_CMD -t -c "SELECT COUNT(*) FROM signs" 2>/dev/null | tr -d ' \n')
if [ "${SIGNS_COUNT:-0}" = "0" ]; then
    echo "[migrate] signs table empty — seeding signs..."
    $PSQL_CMD -v ON_ERROR_STOP=1 -f /sql/seed_signs.sql
else
    echo "[migrate] signs has $SIGNS_COUNT rows — skipping seed_signs.sql."
fi

USERS_COUNT=$($PSQL_CMD -t -c "SELECT COUNT(*) FROM users" 2>/dev/null | tr -d ' \n')
if [ "${USERS_COUNT:-0}" = "0" ]; then
    echo "[migrate] users table empty — seeding bootstrap admin..."
    $PSQL_CMD -v ON_ERROR_STOP=1 -f /sql/seed_bootstrap_admin.sql
else
    echo "[migrate] users has $USERS_COUNT rows — skipping seed_bootstrap_admin.sql."
fi

echo "[migrate] setting jwt_secret GUC..."
$PSQL_CMD -c "ALTER DATABASE $POSTGRES_DB SET app.jwt_secret = '$JWT_SECRET';"

echo "[migrate] auth functions..."
$PSQL_CMD -f /sql/02_auth_functions.sql

echo "[migrate] RLS policies..."
$PSQL_CMD -f /sql/03_rls_policies.sql

echo "[migrate] restarting postgrest..."
docker compose -f "$APP_DIR/docker-compose.yml" restart postgrest

echo "[migrate] done."
