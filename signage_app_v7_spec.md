# Ashara Mubaraka Signage — App Spec v7

Companion to `schema_v7.sql`. Maps every requirement from the brief to schema tables, UI screens, and role permissions.

---

## 1. Architecture (no separate API service)

```
┌──────────────────┐   HTTPS/JWT   ┌──────────────────┐   SQL    ┌──────────────┐
│   React (Vite)   │ ────────────► │   PostgREST      │ ───────► │  PostgreSQL  │
│   + Tailwind     │               │  (auto REST API) │          │  (self-host) │
└──────────────────┘               └──────────────────┘          └──────────────┘
        │                                  ▲
        │  /rpc/login, /rpc/signup         │  pgjwt + RLS
        └──────────────────────────────────┘
```

- **PostgREST** turns the Postgres schema into a REST API automatically. No Node/Express layer to maintain.
- **Auth**: Postgres functions `login(its_number, password)` and `signup(...)` issue JWTs using `pgjwt`. JWTs carry `user_id`, `role`, and scope claims.
- **RBAC**: Postgres Row-Level Security policies enforce who can see/write what. The React app is "thin" — it cannot bypass RLS even if a developer forgets a check.

If self-hosting PostgREST is too heavy, a lightweight alternative is **Hasura** (GraphQL) or **Supabase self-hosted** (which bundles PostgREST + GoTrue auth + a UI). The schema is portable to all three.

---

## 2. Roles & permissions

| Role (DB name) | UI label | Scope | Can do |
|---|---|---|---|
| `super_admin` | Super Admin | global | Everything. Approves new signups, assigns roles, manages all masters, archives/unarchives events, sets default event, switches between events, resets passwords, disables users |
| `signage_hod` | Signage HOD | (event, venue) | Approves/rejects sign requests for **all departments** at their venue; can also place orders on behalf of any dept at their venue; can create new signs |
| `signage_production` | Signage Production | event | Change status: approved → designing → printing → ready |
| `department_user` | Department HOD | (event, venue, department) | Creates sign-order requests for their dept at their venue. Can also propose a brand-new sign as part of an order — Signage HOD's approval covers both the new sign and the order |
| `viewer` | Viewer | event | Read-only |

Approval rule (refined per your answer): a request is approved by **a Signage HOD whose (event, venue) matches the request's (event, venue)**, OR a `super_admin`. Cross-venue approval is no longer allowed — each venue has its own HOD.

---

## 3. Event configuration

**Requirement → Schema**

| Requirement | Schema |
|---|---|
| Name | `events.name` |
| Year | `events.year` (hijri or gregorian, free text) |
| Tag multiple venues | `event_venues` join table |
| Per venue: zones | `zones` (child of `venues`) |
| Mark venue as fasal city or relay city | `venues.type` |
| In fasal city, mark one zone as CMZ | `zones.is_cmz` + trigger `enforce_cmz_on_fasal_only` + partial unique index |
| Archive / unarchive | `events.is_archived` |
| One default event for signup | `events.is_default` + partial unique index `events_only_one_default` |

**UI: `/admin/events`**
- List of events with archive toggle, "Set as default" radio, edit button
- Edit drawer: tabs for **Details**, **Venues** (multi-select from venue master), **Zones per venue** (per tagged venue, toggle CMZ for fasal_city venues), **Brand colours** (existing v6 picker)

---

## 4. Venue Master

**Requirement → Schema**

| Requirement | Schema |
|---|---|
| Name | `venues.name` |
| Type (fasal_city / relay_city) | `venues.type` |
| Address / city | `venues.address`, `venues.city`, `venues.country` |
| Multiple zones | `zones` table, FK to venue |
| (Optional) coords, capacity | `venues.latitude/longitude/capacity` |

**UI: `/admin/venues`** — table with name, type, city, # zones. Drawer to edit name/type/address and manage zones inline. CMZ toggle is greyed out unless type = fasal_city.

---

## 5. Sign Master, Size Master, Department Master

These exist already in v6 and are unchanged structurally. v7 adds `name_lisan` to `departments` to match the brief's "Name LuD (Arabic)" requirement.

| Master | Schema | Fields |
|---|---|---|
| Sign Master | `signs` | `canonical_name` (English), `description_lisan` (LuD/Arabic), **`department_id` (NOT NULL)** |
| Size Master | `sizes` | `name`, `height`, `width` (sqft is generated) |
| Department Master | `departments` | `name`, `name_lisan` |

**Sign ownership.** Every sign is hard-linked to exactly one department via `signs.department_id` (NOT NULL FK to `departments`). This drives the catalogue's RLS:

- **Read:** all authenticated roles browse the full catalogue.
- **Write (insert/update):** `super_admin`, or a `department_user` whose URA matches `signs.department_id`. `signage_hod` and `signage_production` cannot author signs.
- **Delete:** `super_admin` only (signs cascade to `usages`).

UI consequence: when a `department_user` opens `/library` or the order picker in `/my/requests/new`, the list is filtered to their dept; when they open `/library/new`, the dept field is locked to their dept.

UI: standard CRUD tables under `/admin/masters/...`.

---

## 6. Sign-up wizard

**Requirement → Schema**

The wizard collects: Name, Email, ITS Number, Contact Number, Department, Venue. Password = ITS Number initially; user must confirm. A super admin then approves and **assigns the role** (e.g. `department_user` vs `signage_hod`).

| Wizard field | Schema |
|---|---|
| Name | `signup_requests.name` |
| Email | `signup_requests.email` |
| ITS Number | `signup_requests.its_number` (becomes `users.its_number` = username) |
| Contact Number | `signup_requests.contact_number` |
| Department | `signup_requests.requested_department_id` |
| Venue | `signup_requests.requested_venue_id` |
| (Event — defaulted) | `signup_requests.requested_event_id` (= the `is_default` event) |
| Password / confirm | hashed → `signup_requests.password_hash` |

Flow:
1. POST `/rpc/signup_request` → row in `signup_requests`, status=`pending`.
2. Super admin sees pending list at `/admin/users/approvals`.
3. On approve: SA picks the **role** (`department_user`, `signage_hod`, etc.), confirms event/venue/dept. SQL function:
   - Creates `users` row (status=`active`, password from request).
   - Creates `user_role_assignments` with the chosen scope.
   - Sets `signup_requests.status='approved'`.
   - Creates `notifications` row of type `signup_approved`.
4. User can now log in.

**UI**

- `/signup` — 5-step wizard (Personal → Credentials → Department → Venue → Review)
- `/login` — ITS Number + password
- `/admin/users/approvals` — pending list with "Approve & assign role" drawer
- `/admin/users` — full user management (status toggle, add/remove role assignments)

---

## 7. Workflow & status

Status values (unchanged from v6): `pending → approved → designing → printing → ready` plus `rejected`, `cancelled`.

| Transition | Who can do it |
|---|---|
| pending → approved | signage_hod whose (event, venue) match the request, OR super_admin |
| pending → rejected | signage_hod whose (event, venue) match the request, OR super_admin |
| approved → designing | signage_production (on event) |
| designing → printing | signage_production (on event) |
| printing → ready | signage_production (on event) |
| any → cancelled | creator (Department HOD) before approval; or super_admin |

The `track_usage_status` trigger writes every change to `usage_status_history` AND inserts a `notifications` row for the request's creator on every status change — this is how Department users get the updates the brief calls out.

**UI**

- Department user dashboard `/my/requests` — list of own requests with status pills + a notifications bell
- HOD `/approvals` — pending queue grouped by department, bulk approve, individual reject with note
- Production `/pipeline` — Kanban (existing v6 prototype) with drag-between-columns updating `usages.status`

---

## 8. Sign-template usage tracking (per-event reference)

Already covered by `sign_history` view — it now also surfaces `venue` and `zone`, so users can answer "where did we use this sign last year?" not just "in which event".

UI: `/library/<sign_id>` shows a table of past usages by event / venue / zone / department / qty.

---

## 9. RLS policies (sketch)

```sql
-- Departments masters: read for any active user, write super_admin only
create policy dept_read   on departments for select using (auth_active());
create policy dept_write  on departments for all    using (auth_role() = 'super_admin');

-- Usages: a user can see usages whose (event, venue, dept?) is in their assignments
create policy usages_read on usages for select using (
  auth_role() = 'super_admin'
  or exists (
    select 1 from user_role_assignments ura
     where ura.user_id  = auth_user_id()
       and (ura.event_id is null or ura.event_id = usages.event_id)
       and (ura.venue_id is null or ura.venue_id = usages.venue_id)
       and (
            ura.department_id is null
         or ura.department_id = usages.department_id
         or (select name from roles where id = ura.role_id) in
            ('signage_hod','signage_production','viewer')
       )
  )
);
```

Helper SQL functions `auth_user_id()`, `auth_role()`, `auth_active()` read from JWT claims (`current_setting('request.jwt.claim.user_id')`).

---

## 10. New flows added in this revision

### 10.1 Single-step new-sign creation

When a Department HOD needs a sign that isn't in the catalogue, they create it as part of placing the order — one form, one transaction:

- The form has a "Sign not in list?" toggle that reveals fields for `canonical_name`, `description_lisan`, `sign_type`, and (optional) `template` + `slot_values`.
- Submitting inserts a new `signs` row AND a `usages` row referencing it, both within a single SQL transaction (use a wrapper RPC `create_sign_and_order(...)`).
- The `usages` row enters `pending`. When Signage HOD approves it, the new sign is implicitly accepted into the catalogue too.
- If the request is rejected, the `signs` row remains (it's a definition, not an order), so duplicate creation by a different department won't happen — the next dept will see it in the catalogue.

Signage HOD can also create a sign directly via `/library/new` without placing an order, for catalogue maintenance.

### 10.2 Super Admin event switcher

A top-bar dropdown visible only to super_admin, listing all non-archived events plus an "All events" option. The selected event is stored in the JWT on login or in localStorage on switch, and propagates as a filter to every list/dashboard. "All events" disables the filter and is useful for cross-event reporting on `sign_history` and `print_run_summary`.

Implementation: a `useEventContext()` hook in React reads the current selection; queries include `event_id=eq.<selected>` unless "All events" is active.

### 10.3 Password reset (super_admin)

RPC: `admin_reset_password(target_user_id uuid, new_password text)` — SECURITY DEFINER, super-admin only, bcrypt-hashes the new password into `users.password_hash`, inserts a `notifications` row of type `generic` with title "Password reset by admin".

UI: button on `/admin/users/:id` — modal with a "Generate" button (auto-fills with a random 10-char string) and a "Set" button to submit. The new password is shown once and can be copied; super admin shares it with the user out-of-band.

### 10.4 Disable / revoke access

Two options, both available on `/admin/users/:id`:

- **Soft disable** — sets `users.status = 'disabled'`. Login function rejects with "account disabled". Reversible by setting back to `'active'`.
- **Revoke specific role assignment** — deletes a single row from `user_role_assignments` (e.g. remove someone from one venue but keep their other roles). This is the day-to-day tool.

Hard delete of users is not exposed in the UI — it would orphan history. Use disable instead.

---

## 11. Open items

- **Migrations**: schema_v7 is a destructive rebuild. For production we'll need a versioned migration tool (Sqitch, Flyway, or `node-pg-migrate`).
- **Seed real venues + zones for 1447 Chennai** — v7 seeds illustrative ones; replace before pilot.
- **Password policy**: brief says ITS Number = initial password. Force-change-on-first-login is recommended; not yet wired in v7.
- **Email**: notifications are in-app only. Email/Slack integration is post-pilot.
