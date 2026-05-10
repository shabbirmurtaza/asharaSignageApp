# Ashara Mubaraka Signage

Multi-event, multi-venue signage planning + production tracker. Departments request signs; Signage HODs approve per venue; Production moves them through `pending → approved → designing → printing → ready`.

## Architecture

```
React (Vite + TS + Tailwind) ──HTTPS/JWT──► PostgREST ──SQL──► PostgreSQL (RLS)
        │                                          ▲
        └─/rpc/login, /rpc/signup_request, etc.────┘
```

No Node/Express layer. PostgREST exposes the schema as REST. Auth = Postgres `login()` SECURITY DEFINER returning a `pgjwt`-signed JWT. Authorization = Row-Level Security policies. The React client cannot bypass RLS.

## Repo layout

```
signage-app/
├── db/                          Postgres + PostgREST stack
│   ├── docker-compose.yml       asharasignage-postgres + asharasignage-postgrest
│   ├── .env.example             POSTGRES_*, AUTHENTICATOR_PASSWORD, JWT_SECRET
│   ├── schema_v7.sql            authoritative DDL (do not edit)
│   ├── 01_extensions.sql        pgcrypto + inline pgjwt + roles
│   ├── 02_auth_functions.sql    login/signup/approve/reject/admin RPCs/create_sign_and_order
│   ├── 03_rls_policies.sql      RLS on every table + auth_user_id/auth_role helpers
│   ├── seed_signs.sql           187 signs + 199 historical usages
│   ├── seed_bootstrap_admin.sql ITS=00000000 / pw=changeme super_admin
│   └── README.md                full bring-up + verification
├── web/                         Vite + React 18 + TS + Tailwind 3
│   ├── src/
│   │   ├── lib/                 api.ts, auth.ts, rbac.ts
│   │   ├── stores/              eventScope, toast (zustand)
│   │   ├── components/          AppShell, Sidebar, MobileSidebar, TopBar, NotificationBell, EventSwitcher, StatusPill, TypeBadge, RoleBadge, EmptyState, Skeleton, Toaster
│   │   ├── features/
│   │   │   ├── department/      api + hooks + notifications
│   │   │   ├── hod/             api + hooks + scope + drawers
│   │   │   ├── production/      api + hooks + transitions + KanbanCard/Column
│   │   │   ├── library/         api + hooks
│   │   │   └── admin/           api + hooks + reusable components
│   │   ├── pages/
│   │   │   ├── Login.tsx, Signup.tsx (5-step wizard)
│   │   │   ├── department/      MyRequests, NewRequest, RequestDetail
│   │   │   ├── hod/             Dashboard, Approvals
│   │   │   ├── production/      Pipeline (4-column Kanban, native HTML5 DnD)
│   │   │   ├── library/         SignLibrary, SignDetail, SignNew
│   │   │   └── admin/           Events, Venues, Departments, Sizes, Users, UserDetail, SignupApprovals
│   │   ├── types/db.ts          generated from PostgREST OpenAPI
│   │   └── App.tsx, main.tsx
│   ├── scripts/generate-types.mjs    Swagger 2 → OAS3 → openapi-typescript
│   ├── package.json
│   ├── tailwind.config.js
│   └── README.md
├── signage_app_v7_spec.md       requirement → table → screen → role spec
├── signage_app_prototype_v2.html visual design reference
├── claude_code_prompt.md        original build prompt
└── data_loading_README.md       SQL load order + verification queries
```

## Bring-up

### 1. Backend stack

```bash
cd db
cp .env.example .env
# Generate JWT secret (≥32 chars):
openssl rand -base64 48
# Paste into .env as JWT_SECRET

docker compose up -d
docker compose exec postgres pg_isready -U signage
```

### 2. Load SQL (in order)

```bash
cd db
set -a; source .env; set +a
EXEC="docker compose exec -T -e PGPASSWORD=$POSTGRES_PASSWORD postgres \
      psql -v ON_ERROR_STOP=1 -U $POSTGRES_USER -d $POSTGRES_DB"

$EXEC -f /sql/schema_v7.sql
$EXEC -c "set signage.authenticator_password = '$AUTHENTICATOR_PASSWORD';" -f /sql/01_extensions.sql
$EXEC -c "alter role authenticator with login password '$AUTHENTICATOR_PASSWORD';"
$EXEC -c "alter database $POSTGRES_DB set app.jwt_secret = '$JWT_SECRET';"
$EXEC -f /sql/02_auth_functions.sql
$EXEC -f /sql/03_rls_policies.sql
sed 's/select id from zones z join venues v/select z.id from zones z join venues v/g' \
    seed_signs.sql | $EXEC
$EXEC -f /sql/seed_bootstrap_admin.sql
docker compose kill -s SIGUSR1 postgrest && docker compose start postgrest
```

Verification (`db/README.md` § Verify) — counts should match: roles=5, sign_types=7, events=3, departments=32, venues=2, zones=5, event_venues=2, sign_templates=6, sizes=6, signs=187, usages=199, users=1, role_asgmts=1.

### 3. Frontend

```bash
cd web
cp .env.example .env.local      # VITE_POSTGREST_URL=http://localhost:3000
pnpm install
pnpm types:generate              # generates src/types/db.ts (run when schema changes)
pnpm dev                         # http://localhost:5173
```

### 4. Smoke test

```bash
curl -sS http://localhost:3000/rpc/login \
  -H 'Content-Type: application/json' \
  -d '{"p_its_number":"00000000","p_password":"changeme"}'
# → JWT string

# In browser:
# /login → ITS 00000000 / changeme → /admin/events
# /signup → walk wizard → super_admin approves at /admin/users/approvals
```

## Test credentials

| ITS Number | Password   | Role        | Notes                                  |
| ---------- | ---------- | ----------- | -------------------------------------- |
| `00000000` | `changeme` | super_admin | Bootstrap admin. Change immediately.   |

Additional users sign up via `/signup`; super_admin approves via `/admin/users/approvals`.

## Roles (v3)

| Schema name          | UI label          | Scope                        | Notes                                                         |
| -------------------- | ----------------- | ---------------------------- | ------------------------------------------------------------- |
| `super_admin`        | Super Admin       | global                       | Can do everything                                             |
| `signage_hod`        | Signage HOD       | (event, venue)               | NO department; approves all depts at the venue                |
| `signage_production` | Signage Production| (event)                      | Moves status `approved → designing → printing → ready`        |
| `department_user`    | **Department HOD**| (event, venue, department)   | UI labels this "Department HOD"; schema name unchanged        |
| `viewer`             | Viewer            | (event)                      | Read-only                                                     |

## Status machine

`pending → approved → designing → printing → ready` plus `rejected` and `cancelled`. Transitions enforced by RLS via `can_transition()`. UI hides disallowed transitions for UX; RLS is the security boundary.

## RPC inventory

See `db/README.md` § RPC inventory.

| Function                                | Caller            | Purpose                                                          |
| --------------------------------------- | ----------------- | ---------------------------------------------------------------- |
| `signup_request(...)`                   | web_anon          | Wizard intake row                                                |
| `login(its, password)`                  | web_anon          | Returns JWT                                                      |
| `get_default_event()`                   | any               | Event used by signup wizard                                      |
| `list_departments_for_signup()`         | web_anon          | Anonymous read                                                   |
| `list_venues_for_signup(event_id)`      | web_anon          | Anonymous read                                                   |
| `approve_signup(req_id, role)`          | super_admin       | Promotes signup → user + assignment (drops dept for signage_hod) |
| `reject_signup(req_id, note)`           | super_admin       | Marks rejected                                                   |
| `admin_reset_password(user_id, pw)`     | super_admin       | Bcrypt rehash + notify                                           |
| `disable_user(user_id)` / `enable_user` | super_admin       | Toggle status                                                    |
| `create_sign_and_order(...)`            | dept_user/hod/sa  | Atomic sign + usage_group + pending usage in one txn             |

## Frontend stack

- React 18 + TypeScript strict
- Vite 8
- Tailwind 3 (CSS variables from prototype HTML)
- react-router-dom 7
- @tanstack/react-query 5
- zustand 5 (client/UI state only — never server state)
- zod 4 (validation; no `@hookform/resolvers` — uses `safeParse` + `setError`)
- react-hook-form
- jwt-decode
- lucide-react

No axios, no `@supabase/supabase-js`, no UI lib (no shadcn/MUI). Plain `fetch` + thin typed wrapper in `src/lib/api.ts`.

## Reset

```bash
cd db
docker compose down -v          # nukes volume
docker compose up -d
# re-run § 2 SQL load
```

## Open items

- Migrations not yet versioned — `schema_v7.sql` is a destructive rebuild. Add Sqitch/Flyway/`node-pg-migrate` for production.
- Real venues/zones for 1447 Chennai not seeded — current seed is illustrative.
- "Force change on first login" not wired (initial password = ITS Number per spec).
- Notifications in-app only — no email/Slack yet.
- Two known schema bugs worked around at load time, not patched in `schema_v7.sql`:
  - `enforce_event_venue_link()` references `new.zone_id` on `usage_groups` — re-defined in `03_rls_policies.sql`.
  - `seed_signs.sql` ambiguous `select id from zones z join venues v` — `sed` rewrite at load time.

## OpenWolf

Project uses OpenWolf for context management. See `.wolf/OPENWOLF.md`. `cerebrum.md` carries cross-session learnings (role scopes, schema quirks, RPC arg conventions). `anatomy.md` + `memory.md` + `buglog.json` are auto-maintained by hooks.
