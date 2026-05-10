# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-05-09

## User Preferences

- Caveman mode (full) active by default. Drop articles/filler/pleasantries.
- Wants parallel agent teams when work is genuinely independent. Single agent OK when steps are sequentially dependent (Steps 1, 2 of build).
- Replaces spec files mid-build (v3 revision); always re-read source-of-truth files before continuing.
- Prefers pnpm. Docker Compose for local stack. Container project name: `asharasignage`.
- Senior full stack standards. No hand-holding on bugs.

## Key Learnings

- **Project:** asharaSignageApp — Ashara Mubaraka Signage planner.
- **Architecture:** React (Vite + TS + Tailwind) → PostgREST → Postgres. NO Node/Express layer. Auth via Postgres `login()` SECURITY DEFINER returning pgjwt-signed JWT. RBAC via RLS only.
- **Repo layout:** `signage-app/db/` + `signage-app/web/`. Spec files at `signage-app/` root.
- **Source-of-truth files (do NOT modify):** `db/schema_v7.sql`, `db/seed_signs.sql`, `db/seed_bootstrap_admin.sql`. Spec replaced as v3 — re-read each session.
- **Roles (v3):** `super_admin`, `signage_hod` (event,venue — NO dept), `signage_production` (event), `department_user` (event,venue,dept — UI label "Department HOD"), `viewer` (event).
- **Status machine:** `pending → approved → designing → printing → ready` + `rejected`/`cancelled`. Transition allowance encoded in RLS via `can_transition()`.
- **PostgREST RPC arg convention:** all params prefixed `p_` (e.g. `p_its_number`, `p_password`).
- **JWT claims:** `{role:'authenticated', user_id, its_number, primary_role, assignments[], exp}`. Assignments: `{role, event_id, venue_id, department_id}`.
- **Frontend stack pinned:** React 18, TS 5, Tailwind 3, react-router 7, zod 4, zustand 5, react-query 5, react-hook-form, zod, jwt-decode, lucide-react. NO axios, NO supabase-js, NO shadcn/MUI.
- **Type generation:** `pnpm types:generate` runs `scripts/generate-types.mjs` which converts PostgREST Swagger 2 → OAS3 → openapi-typescript. Run when schema changes.
- **OpenWolf hooks auto-update** `anatomy.md`, `memory.md`, `buglog.json` via `.wolf/hooks/`. Cerebrum needs manual updates.
- **Container names:** `asharasignage-postgres`, `asharasignage-postgrest` (compose project `asharasignage`). Volume: `asharasignage_pgdata`.

## Do-Not-Repeat
- [2026-05-09] **Anonymous signup wizard cannot read `departments` / `venues` / `event_venues` tables directly** — RLS `auth_active()` blocks `web_anon`. Solution: SECURITY DEFINER RPCs (`list_departments_for_signup()`, `list_venues_for_signup(p_event_id)`) granted to `web_anon`. Don't grant SELECT on the tables; keep RLS intact.
- [2026-05-09] **Zod 4 dropped `z.SafeParseReturnType` export.** Use `{ success: boolean; error?: z.ZodError }` shape or `ReturnType<typeof schema.safeParse>` for typed helper sigs.
- [2026-05-09] **`@hookform/resolvers` is NOT installed.** Validate via `schema.safeParse` + `setError` pattern in onSubmit; do not import resolver lib.


- [2026-05-09] **`schema_v7.sql` ships broken trigger `enforce_event_venue_link()`** — references `new.zone_id` on `usage_groups` (no such col). Workaround in `03_rls_policies.sql` re-defines via `row_to_json(new)->>...`. Don't expect schema_v7 to be clean.
- [2026-05-09] **`seed_signs.sql` has 199 ambiguous `select id from zones z join venues v` queries** — fails on PG16. Apply `sed 's/select id from zones z/select z.id from zones z/g'` at load time. Don't edit the file.
- [2026-05-09] **psql `-v` rejects names with dots.** GUCs like `signage.authenticator_password` must be set via `-c "set ...= '...';"` not `-v`.
- [2026-05-09] **PostgREST v12 single-claim GUC.** Helpers must read both `request.jwt.claims` (JSON) AND legacy `request.jwt.claim.<key>` to support tests.
- [2026-05-09] **`signage_hod` assignments must have `department_id IS NULL`** (v3 trigger). `approve_signup` drops dept regardless of request.
- [2026-05-09] **HOD approval venue-matched, not just event-matched.** RLS policy on usages UPDATE pending→approved checks `is_signage_hod_for(event,venue)`.
- [2026-05-09] **PostgREST SIGUSR1 reload can exit container** on v12 image. Always `docker compose start postgrest` after schema reload.
- [2026-05-09] **OpenWolf protocol initially ignored.** Sub-agents weren't told to read `.wolf/anatomy.md` / write `.wolf/memory.md`. Now baked into agent prompts.
- [2026-05-09] **First parallel-agents attempt failed** because Steps 1 + 2 had inherent sequential dependency. Parallelism only kicks in from Step 3+ (independent role-scoped feature trees).
- [2026-05-09] **`sign_history` view JSONB `history` does NOT include a date/timestamp** per usage entry. Only: event, venue, zone, department, qty, status, height, width. If a UI needs per-usage date, extend the view to include `u.created_at` — don't fake it client-side.
- [2026-05-09] **`sign_history.sign_type` is the text name, not the uuid.** Filter on names directly (e.g. `sign_type=in.(prohibition,warning)`); don't try to filter by `sign_type_id`.
- [2026-05-09] **PostgREST batch update by id list** uses `id=in.(uuid1,uuid2,...)` filter on PATCH; no JSON-array body. Single round-trip for `bulkApprove`. Don't loop on the client.
- [2026-05-09] **Embedded-resource filters in PostgREST** require dotted param keys (e.g. `usage.event_id=eq.<uuid>` after `select=*,usage:usages!inner(...)`). `!inner` is required for the parent filter to drop unrelated rows.
- [2026-05-09] **No `.input` / `.select` utility classes** in `index.css`. Keep form skin inline via Tailwind utilities or a local `inputCls` const. Don't pull in `@tailwindcss/forms`.
- [2026-05-09] **HOD scope is JWT-claim derived** — `useHodScope()` reads `useAuth().session.assignments`, filters `role==='signage_hod'` requiring both `event_id` + `venue_id`, persists active selection in localStorage `hod.selectedScope`.
- [2026-05-09] **`events.is_default` partial-unique index** prevents two defaults — `setDefaultEvent()` must clear all existing defaults before setting the new one (UPDATE both in sequence; trigger doesn't auto-clear).
- [2026-05-09] **`zones.is_cmz` partial-unique index per venue + fasal_city trigger** — to set a new CMZ, first clear the existing CMZ at that venue (UPDATE old to false), then set new to true. Trigger rejects CMZ on relay_city venues.
- [2026-05-09] **PostgREST embed FK disambiguation** — `signup_requests` has 3 FKs to other tables (`requested_event_id`, `requested_venue_id`, `requested_department_id`). Embeds must name the FK constraint: `event:events!signup_requests_requested_event_id_fkey(...)`. Without this, PostgREST 400s with "ambiguous embed".
- [2026-05-09] **PostgREST embeds need real (plural) table name, not FK column stem.** Schema tables are plural (`signs`, `sizes`, `events`, `venues`, `zones`, `departments`, `sign_types`). Writing `sign(...)` / `sign_type(...)` 400s with PGRST200 "no relationship found". Use alias to keep JS shape: `sign:signs(...)`, `sign_type:sign_types(...)`. Apply recursively in nested embeds. Affected files: `features/{department,hod,production}/api.ts` USAGE_SELECT consts.
- [2026-05-10] **Arabic font: Kanz al-Marjaan.** Self-hosted at `public/fonts/Kanz-al-Marjaan.ttf`. Registered via `@font-face` in `src/index.css` with `unicode-range` covering Arabic + presentation forms. Auto-applied to `[lang='ar']`, `[dir='rtl']`, and `.font-arabic`. Tailwind alias: `font-arabic`. DESIGN.md §3 previously specified Arial for Arabic — Kanz al-Marjaan supersedes; update DESIGN.md when convenient.
- [2026-05-09] **`isDepartmentUser`/`isSignageHod`/`isSignageProduction` short-circuit true for super_admin.** Don't use them to gate dept-only UI (e.g. Sidebar "New Request" link). Super_admin has no `department_user` assignment, so the dept page bombs with "No department assignment found." For role-only-nav, check `session.assignments.some(a => a.role==='department_user' && a.event_id && a.venue_id && a.department_id)` directly.
- [2026-05-09] **Server-side user-by-event filter via embed** — to list users whose assignments touch a given event, use `select=*,user_role_assignments!inner(event_id)` plus filter `user_role_assignments.event_id=eq.<uuid>`. Inner join is required so rows lacking matching assignments are dropped.
- [2026-05-09] **Approve-signup role-dept rule echoes trigger** — UI must hide the department field when role=signage_hod (the trigger drops it anyway, but showing it confuses operators). For super_admin, hide event/venue/dept entirely.
- [2026-05-09] **`EmptyState` prop is `body`, NOT `description`.** Component signature: `{ title, body?, action? }`. Don't pass `description=` — TS will reject.
- [2026-05-09] **Mobile sidebar pattern.** `Sidebar` exports both desktop `<Sidebar/>` (`hidden md:flex`) and `<MobileSidebar open onClose/>` (slide-from-left drawer with backdrop, `md:hidden`). `AppShell` owns `drawerOpen` state + ESC + body-scroll-lock + route-change auto-close. `TopBar` accepts optional `onOpenMenu` to render hamburger (`md:hidden`).
- [2026-05-09] **Toast everywhere convention.** `useToast()` returns `{ info, success, error }`. Pattern: `toast.success('<Verb> done.')` on mutation success; `toast.error(err instanceof ApiError ? err.message : 'Something went wrong.')` on failure. Page-level callers attach via TanStack `mutate(input, { onSuccess, onError })` when underlying hook is generic.

## Decision Log

- [2026-05-09] **No Node/Express API layer.** Architecture intentionally PostgREST-only. All multi-table mutations go through Postgres RPC functions, not JS-side request stitching. Reasoning: RLS is single source of truth; client cannot bypass.
- [2026-05-09] **camelCase in TS, snake_case in SQL.** Match each language's convention; do not unify.
- [2026-05-09] **Tailwind 3 not 4.** v4 changed config/PostCSS surface; `npx tailwindcss init -p` only works on v3.
- [2026-05-09] **react-router-dom 7 + zod 4 + zustand 5 latest.** APIs used are stable across these majors.
- [2026-05-09] **Prototype HTML is visual spec.** CSS variables + status pill colours + type badge colours pulled into `index.css`. BEM classes for status/type, Tailwind utilities everywhere else.
- [2026-05-09] **Container project rename `db` → `asharasignage`.** User-driven; tied to project identity.
- [2026-05-09] **Step 3 sequential, Steps 4-8 parallel.** Auth flow is one cohesive feature; role-scoped pages (dept/HOD/production/library/admin) are independent and can fan out.
