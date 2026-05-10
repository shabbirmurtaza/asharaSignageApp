# DB service — Ashara Signage

Postgres 16 + PostgREST 12 (no Node/Express layer). Auth and RBAC live entirely in Postgres.

## Layout

```
db/
├── docker-compose.yml          postgres + postgrest
├── .env.example                copy to .env, fill in JWT_SECRET
├── schema_v7.sql               authoritative DDL (do not edit)
├── 01_extensions.sql           pgcrypto, roles (web_anon/authenticator/authenticated), inline pgjwt
├── 02_auth_functions.sql       login / signup_request / approve_signup / reject_signup /
│                              get_default_event / admin_reset_password / disable_user /
│                              enable_user / create_sign_and_order
├── 03_rls_policies.sql         row-level security on every table
├── seed_signs.sql              ~187 signs + ~199 historical usages
└── seed_bootstrap_admin.sql    ITS=00000000 / password=changeme super_admin
```

## Bring-up

### 1. Configure env

```bash
cp .env.example .env
# Generate a strong JWT secret (>=32 chars):
openssl rand -base64 48
# Paste it as JWT_SECRET in .env
```

### 2. Start containers

```bash
docker compose up -d
docker compose exec postgres pg_isready -U signage
```

### 3. Load SQL in order

`pgcrypto` is required by `schema_v7.sql` (it uses `gen_random_uuid()`), but `schema_v7.sql` already does `create extension if not exists pgcrypto`. The roles created in `01_extensions.sql` are referenced by `03_rls_policies.sql`, so the safe order is:

```bash
# pull env vars into the shell (or pass them inline)
set -a; source .env; set +a

EXEC="docker compose exec -T -e PGPASSWORD=$POSTGRES_PASSWORD postgres \
      psql -v ON_ERROR_STOP=1 -U $POSTGRES_USER -d $POSTGRES_DB"

# 1. Schema (drops & recreates, includes masters seed)
$EXEC -f /sql/schema_v7.sql

# 2. Extensions + roles. The authenticator password is read from the
#    Postgres GUC `signage.authenticator_password` set via -c (psql -v
#    rejects names with dots, so do NOT pass it as -v).
$EXEC -c "set signage.authenticator_password = '$AUTHENTICATOR_PASSWORD';" \
        -f /sql/01_extensions.sql

# If the authenticator role already existed with a stale password,
# fix it:
$EXEC -c "alter role authenticator with login password '$AUTHENTICATOR_PASSWORD';"

# 3. Configure the JWT secret as a database GUC so login() can read it
$EXEC -c "alter database $POSTGRES_DB set app.jwt_secret = '$JWT_SECRET';"

# 4. Auth functions (need pgjwt + the GUC)
$EXEC -f /sql/02_auth_functions.sql

# 5. RLS policies
$EXEC -f /sql/03_rls_policies.sql

# 6. Catalogue seed (signs + historical usages)
# NOTE: seed_signs.sql has 199 inserts of the form
#   `select id from zones z join venues v on v.id=z.venue_id ...`
# which is ambiguous on PG16 (both tables expose `id`). Pipe through sed
# to qualify it without modifying the file:
sed 's/select id from zones z join venues v/select z.id from zones z join venues v/g' \
    seed_signs.sql | $EXEC

# 7. Bootstrap super_admin
$EXEC -f /sql/seed_bootstrap_admin.sql

# 8. Reload PostgREST schema cache so it sees the new RPCs
docker compose kill -s SIGUSR1 postgrest
```

### 4. Verify

```bash
$EXEC -c "
  select 'roles' as t, count(*) from roles
  union all select 'sign_types',     count(*) from sign_types
  union all select 'events',         count(*) from events
  union all select 'departments',    count(*) from departments
  union all select 'venues',         count(*) from venues
  union all select 'zones',          count(*) from zones
  union all select 'event_venues',   count(*) from event_venues
  union all select 'sign_templates', count(*) from sign_templates
  union all select 'sizes',          count(*) from sizes
  union all select 'signs',          count(*) from signs
  union all select 'usages',         count(*) from usages
  union all select 'users',          count(*) from users
  union all select 'role_asgmts',    count(*) from user_role_assignments;
"
```

Expected:

| t              | count |
| -------------- | ----- |
| roles          | 5     |
| sign_types     | 7     |
| events         | 3     |
| departments    | 32    |
| venues         | 2     |
| zones          | 5     |
| event_venues   | 2     |
| sign_templates | 6     |
| sizes          | 6     |
| signs          | 187   |
| usages         | 199   |
| users          | 1     |
| role_asgmts    | 1     |

### 5. Smoke-test the API

```bash
# Anonymous: login
curl -sS http://localhost:3000/rpc/login \
  -H 'Content-Type: application/json' \
  -d '{"p_its_number":"00000000","p_password":"changeme"}'
# → "<jwt>"

# Authenticated: read events
TOKEN=$(curl -sS http://localhost:3000/rpc/login \
  -H 'Content-Type: application/json' \
  -d '{"p_its_number":"00000000","p_password":"changeme"}' | tr -d '"')

curl -sS http://localhost:3000/events \
  -H "Authorization: Bearer $TOKEN" | head
```

## Roles (v3)

| Schema name | UI label | Scope | Notes |
| --- | --- | --- | --- |
| `super_admin` | Super Admin | global | null event/venue/dept |
| `signage_hod` | Signage HOD | (event, venue) | covers all departments at the venue — `department_id` must be NULL |
| `signage_production` | Signage Production | (event) | moves status approved → designing → printing → ready |
| `department_user` | **Department HOD** | (event, venue, department) | UI calls this "Department HOD"; schema name is `department_user` for back-compat |
| `viewer` | Viewer | (event) | read-only |

The role-scope trigger (`enforce_role_scope_rules`) rejects any insert that violates these scopes.

## RPC inventory

| Function | Caller | Purpose |
| --- | --- | --- |
| `signup_request(its,name,email,contact,password,event,venue,dept)` | web_anon | wizard intake row |
| `login(its,password)` | web_anon | returns signed JWT |
| `get_default_event()` | web_anon, authenticated | event used by the signup wizard |
| `approve_signup(request_id, role_name)` | super_admin | promotes signup_request → user + role assignment (drops dept for signage_hod) |
| `reject_signup(request_id, note)` | super_admin | marks request rejected |
| `admin_reset_password(user_id, new_password)` | super_admin | bcrypt-rehash + notify user |
| `disable_user(user_id)` | super_admin | sets status=disabled |
| `enable_user(user_id)` | super_admin | sets status=active |
| `create_sign_and_order(event,venue,zone,dept,sign_type,name,desc_lisan,size,qty,notes)` | department_user / signage_hod / super_admin | atomic sign + usage_group + pending usage in one txn; reuses an existing atomic sign with the same canonical_name |

## Test credentials

| ITS Number | Password   | Role         |
| ---------- | ---------- | ------------ |
| `00000000` | `changeme` | `super_admin`|

Change the password immediately for any non-dev environment.

## Reset

```bash
docker compose down -v   # nukes the volume
docker compose up -d
# then re-run the load steps above
```
