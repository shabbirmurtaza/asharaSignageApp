# Claude Code build prompt — Ashara Mubaraka Signage App

Paste everything below this line into Claude Code. Attach `schema_v7.sql`, `signage_app_v7_spec.md`, `signage_app_prototype_v2.html`, and `signage_data_v5.xlsx` to the session.

---

You are building the **Ashara Mubaraka Signage** application end-to-end. Architecture is intentionally minimal:

```
React (Vite + TS + Tailwind)  ──►  PostgREST  ──►  PostgreSQL (self-hosted)
```

**No separate Node/Express API.** PostgREST exposes the schema as REST automatically. Auth is done with Postgres functions that issue JWTs (using the `pgjwt` extension), and Row-Level Security policies enforce all access control. The React app is "thin" — it only renders UI and calls PostgREST endpoints. If a check is missing in RLS, that's a bug to fix in SQL, not in JS.

## Inputs

- `schema_v7.sql` — full DDL with seeds. Run this first against a fresh Postgres database.
- `signage_app_v7_spec.md` — requirement → table → screen → role mapping. Read this before coding.
- `signage_app_prototype_v2.html` — design philosophy, colour palette, component patterns, copy tone. Treat it as the visual spec; do not invent your own design language.
- `signage_data_v5.xlsx` — historical signage data for 1447 Chennai. Use this to seed the `signs`, `sign_templates`, `sizes`, and `usages` tables after schema is loaded.

## Repo layout

Create a single repo with two top-level folders:

```
signage-app/
├── db/
│   ├── schema_v7.sql              # the file you've been given
│   ├── 01_extensions.sql          # pgcrypto, pgjwt
│   ├── 02_auth_functions.sql      # login(), signup_request(), approve_signup()
│   ├── 03_rls_policies.sql        # all RLS rules
│   ├── 04_seed_signs.sql          # generated from xlsx
│   ├── docker-compose.yml         # postgres + postgrest
│   ├── .env.example
│   └── README.md
├── web/
│   ├── package.json               # vite + react + ts + tailwind
│   ├── src/
│   │   ├── lib/
│   │   │   ├── api.ts             # postgrest client wrapper
│   │   │   ├── auth.ts            # JWT storage, decode, refresh
│   │   │   └── rbac.ts            # role helpers (canApprove, canEdit, etc.)
│   │   ├── components/            # reusable UI from the prototype
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Signup.tsx               # 5-step wizard
│   │   │   ├── department/MyRequests.tsx
│   │   │   ├── department/NewRequest.tsx
│   │   │   ├── hod/Approvals.tsx
│   │   │   ├── hod/Dashboard.tsx
│   │   │   ├── production/Pipeline.tsx
│   │   │   ├── library/SignLibrary.tsx
│   │   │   ├── library/SignDetail.tsx
│   │   │   └── admin/
│   │   │       ├── Events.tsx
│   │   │       ├── Venues.tsx
│   │   │       ├── Departments.tsx
│   │   │       ├── Sizes.tsx
│   │   │       ├── Users.tsx
│   │   │       └── SignupApprovals.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── tailwind.config.ts
└── README.md                      # how to run the whole thing
```

## Build steps

Do these in order. After each step, verify it works before moving on.

### Step 1 — DB service (db/)

1. Write `db/docker-compose.yml` that brings up Postgres 16 and PostgREST 12, with PostgREST configured to connect to the DB and use a `JWT_SECRET` from env.
2. Write `db/01_extensions.sql` that creates `pgcrypto` and `pgjwt` (https://github.com/michelp/pgjwt — install via SQL extension).
3. Run the provided `schema_v7.sql` against the DB.
4. Write `db/02_auth_functions.sql` with these SECURITY DEFINER functions, callable via PostgREST RPC:
   - `signup_request(its_number, name, email, contact_number, password, requested_event_id, requested_venue_id, requested_department_id)` — inserts into `signup_requests` with bcrypt-hashed password.
   - `approve_signup(signup_request_id, role_name)` — super-admin only; creates `users` row, creates `user_role_assignments` (department_id from request only if role is `department_user`; null for `signage_hod`), marks request approved, inserts `signup_approved` notification.
   - `reject_signup(signup_request_id, note)` — super-admin only.
   - `login(its_number, password)` — verifies bcrypt hash, rejects if `users.status != 'active'`, returns a JWT containing `user_id`, `role` (most-privileged role name), and `assignments` array.
   - `create_sign_and_order(canonical_name, description_lisan, sign_type_name, template_id, slot_values, department_id, event_id, venue_id, zone_id, size_id, qty)` — single transaction that inserts a new `signs` row (or finds existing by name) + a `usages` row in `pending`. Returns both IDs.
   - `admin_reset_password(target_user_id, new_password)` — super-admin only; bcrypt-hashes and updates `users.password_hash`; inserts a `generic` notification.
   - `disable_user(target_user_id)` / `enable_user(target_user_id)` — super-admin only; flips `users.status`.
5. Write `db/03_rls_policies.sql`. Enable RLS on every table. Helper functions read claims from `current_setting('request.jwt.claim.<x>', true)`. Implement policies per `signage_app_v7_spec.md` § 9.
6. Convert `signage_data_v5.xlsx` to `db/04_seed_signs.sql`:
   - Read each sheet (departments, sign_types, sign_templates, sizes, signs, usages).
   - The schema already seeds `departments` and `sign_types` and `events` — skip duplicates by name.
   - Map xlsx string IDs (`D001`, `T05`, `SG0001` …) to UUIDs by name where possible. Write the SQL to do this with `(select id from <table> where name=…)` lookups so the seed is portable.
   - For `usages`, every row needs a `venue_id`. Since the xlsx predates venues, attribute everything to `Saifee Nagar Chennai` (the seeded fasal-city venue) and pick zone `CMZ`. Document this assumption at the top of the file.
   - Also create one super_admin user (ITS=`00000000`, password=`changeme`) and one signage_hod user per department that has signs, with predictable test passwords printed in the README.
7. Run all 4 SQL files in order. Verify with: `select count(*) from signs;` (expect ~187), `select count(*) from usages;`, `select * from user_scope limit 5;`.

### Step 2 — React skeleton (web/)

1. `pnpm create vite web --template react-ts`. Install: `tailwindcss`, `react-router-dom`, `@tanstack/react-query`, `zod`, `zustand` (or use react-query for server state and useState for UI), `lucide-react`.
2. Configure Tailwind. Pull the CSS variables (`--bg`, `--text`, `--info-bg`, etc.) from `signage_app_prototype_v2.html` into `index.css` so the app inherits the prototype's look.
3. `src/lib/api.ts` — a wrapper around `fetch` that:
   - Reads `VITE_POSTGREST_URL` from env.
   - Attaches `Authorization: Bearer <jwt>` from `localStorage`.
   - Provides typed helpers: `db.from('events').select(...)`, `db.from('usages').insert(...)`, `db.rpc('login', { ... })`. (Do not use `@supabase/supabase-js`; PostgREST + a thin custom client is enough.)
4. `src/lib/auth.ts` — `login()`, `logout()`, `getCurrentUser()`, `useAuth()` hook. Decode JWT to read role + assignments (use `jwt-decode`).
5. `src/lib/rbac.ts` — pure functions: `isSuperAdmin(user)`, `canApprove(user, event_id)`, `canChangeStatus(user, from, to)`, `visibleEvents(user, allEvents)`.

### Step 3 — Auth & sign-up

1. `/login` — ITS Number + password form. Calls `db.rpc('login', ...)`, stores JWT, redirects by role.
2. `/signup` — 5-step wizard matching the spec:
   - Step 1: Name, Email, ITS Number, Contact Number
   - Step 2: Password + Confirm Password
   - Step 3: Department (dropdown from `departments`)
   - Step 4: Venue (dropdown from venues tagged to the **default event** — query `event_venues` where `event.is_default=true`)
   - Step 5: Review → POST `db.rpc('signup_request', ...)`
   - Note: The user picks venue + department as the **requested** scope. The super admin reviews, picks the actual role on approval, and the department is only persisted on the assignment if the assigned role is `department_user`. If SA assigns `signage_hod`, the department from the request is dropped (HOD has no dept scope).
   - Success screen: "Awaiting super admin approval. You'll receive an email when approved."
3. After login, route by role:
   - `super_admin` → `/admin/events`
   - `signage_hod` → `/hod/dashboard`
   - `signage_production` → `/production/pipeline`
   - `department_user` → `/my/requests`
   - `viewer` → `/library`

### Step 4 — Department HOD flows

The role is `department_user` in the schema; the UI label is **"Department HOD"** everywhere it's user-facing.

1. `/my/requests` — list of usages where `created_by = me`. Status pills (use the prototype's colours). Each row links to detail.
2. `/my/requests/new` — replicate the prototype's "Reorder all" + new-sign creation flow. The form has two modes:
   - **Pick existing sign + size + qty** — inserts a `usages` row with `status='pending'`.
   - **Create new sign** (toggle in the same form) — reveals fields for `canonical_name`, `description_lisan`, optional `template_id` + `slot_values`, and `sign_type`. Submitting calls a single RPC `create_sign_and_order(...)` that inserts both the `signs` row and the `usages` row in one transaction. Both go pending until the venue's Signage HOD approves them together.
3. Notifications bell in the top-right — polls `notifications where user_id=me and read_at is null`. Click to mark read.

### Step 5 — Signage HOD flows

Signage HOD is scoped to **(event, venue)**, not department. They see and approve requests from all departments at their venue.

1. `/hod/dashboard` — replicate prototype's HOD dashboard, filtered to the user's venue. The Signage HOD can place orders on behalf of any department at their venue (use the dept switcher pattern from the prototype's admin role).
2. `/hod/approvals` — pending queue for the user's venue, grouped by department. Bulk approve, individual reject with note. RLS rejects approvals where `(event_id, venue_id)` of the request doesn't match any of the user's `signage_hod` assignments.
3. `/library/new` — Signage HOD can create signs directly into the catalogue without placing an order, for catalogue maintenance.

### Step 6 — Production role

1. `/production/pipeline` — replicate the Kanban board. Drag a card between columns → update `usages.status`. Allowed transitions enforced by an RLS policy + a check function (don't trust the client).

### Step 7 — Sign Library

1. `/library` — browse all signs from `sign_history` view. Filters by sign_type, variable/constant. Search by name.
2. `/library/:id` — detail page showing which event/venue/zone/dept used this sign and how many times. This is the "track sign usage per event" requirement.

### Step 8 — Super Admin

1. **Event switcher** in the top bar, visible only to super_admin. Lists all non-archived events plus an "All events" option. Selection persists in localStorage. Every list/dashboard filters by the selected `event_id`; "All events" disables the filter and is required for cross-event reporting on `sign_history` and `print_run_summary`.
2. `/admin/events` — list with archive toggle and "Set as default" radio. Edit drawer with tabs: Details, Venues (multi-select tag from `venues`), Zones-per-venue (toggle CMZ for fasal_city venues), Brand colours.
3. `/admin/venues` — CRUD on venue master. Type radio (fasal_city / relay_city). Inline zones with CMZ toggle (CMZ option greyed out unless type = fasal_city; the DB trigger enforces this anyway).
4. `/admin/departments`, `/admin/sizes` — basic CRUD tables.
5. `/admin/users` — table of users with status toggle (active / disabled) and per-user assignment management.
6. `/admin/users/:id` — detail page with:
   - Add/remove role assignments (a multi-row editor; each row picks role + event + venue + dept where required by the role).
   - **Reset password** button → modal with "Generate random" + "Set" actions; calls `admin_reset_password(target_user_id, new_password)` RPC. The new password is shown once, copyable.
   - **Disable user** toggle → flips `users.status` between `active` and `disabled`. Login function rejects disabled users.
7. `/admin/users/approvals` — pending signup queue. Approve drawer asks for the role to assign and confirms event/venue/dept (pre-filled from the request). For `signage_hod` selection, dept field is hidden (HOD has no dept scope).

### Step 9 — Polish

- Toasts on every mutation (use the prototype's toast component pattern).
- Empty states (use the prototype's pattern).
- Mobile responsive (sidebar collapses to a top bar at <900px, like the prototype).
- Loading skeletons for every list.

### Step 10 — README

A root `README.md` with:
- Architecture diagram (one paragraph).
- `cd db && docker compose up` to start Postgres + PostgREST.
- How to run the SQL files in order.
- `cd web && pnpm install && pnpm dev` to start the frontend.
- Test credentials from the seed.
- Where to put the `.env`s.

## Constraints

- **Do not write any backend Node/Express code.** All data access goes through PostgREST. Auth = Postgres functions returning JWTs. RBAC = RLS.
- **Do not use Supabase JS SDK.** Plain `fetch` + a small typed wrapper.
- **Use the prototype's design language**, not your own. Copy CSS variables, spacing, component patterns from `signage_app_prototype_v2.html`. Use Tailwind utility classes that map to those tokens.
- **All access control lives in the database.** Every page also checks role for UX (hide buttons), but RLS is the source of truth.
- **TypeScript strict mode on.** Generate types from the schema using `openapi-typescript` against PostgREST's auto-generated OpenAPI spec — don't hand-write DB types.
- **Keep PRs small.** After each step above, summarise what you did and ask before continuing.

## When in doubt

- Re-read `signage_app_v7_spec.md` for any business rule.
- Re-read `signage_app_prototype_v2.html` for any visual/UX question.
- Ask me before adding a library not already specified.

Start with Step 1.
