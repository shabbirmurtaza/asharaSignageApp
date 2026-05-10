# CLAUDE.md

Guidance for Claude when working in this repository. Read before making changes.


## OpenWolf

@.wolf/OPENWOLF.md

This project uses OpenWolf for context management. Read and follow `.wolf/OPENWOLF.md` every session. Check `.wolf/cerebrum.md` before generating code. Check `.wolf/anatomy.md` before reading files.


## What this project is

The **Ashara Mubaraka Signage** app — a multi-event, multi-venue, multi-department signage planning and production tracker. Departments submit signs they need for an event; signage HODs approve them; production tracks each sign through a pipeline (`pending → approved → designing → printing → ready`).

Authoritative specs live in:

- `schema_v7.sql` — Postgres schema (tables, views, RLS policies, triggers).
- `signage_app_v7_spec.md` — requirements → schema → UI mapping. **Read this before adding any feature.**

The v6 prototype (`signage_app_prototype_v2.html`) is reference-only — vanilla JS, all state baked in, vocabulary correct but architecture obsolete.


## Architecture

```
React (Vite) ──HTTPS/JWT──► PostgREST ──SQL──► PostgreSQL (RLS)
        │                          ▲
        └──/rpc/login, /rpc/signup_request, etc.──┘
```

**There is no separate Node/Express API layer.** PostgREST exposes the schema directly. Auth is a Postgres function (`login(its_number, password)`) that returns a JWT via `pgjwt`. All authorization is enforced by **Row-Level Security in Postgres** — the React client cannot bypass it.

Practical consequences for the frontend:

- The `api/` layer is a thin axios wrapper over PostgREST endpoints (`/usages`, `/signs`, `/rpc/<function_name>`). It is NOT a custom REST API we control.
- Filtering, ordering, embedding related rows is done with PostgREST query syntax (`?event_id=eq.<uuid>&select=*,department(name)`) — not by writing custom backend routes.
- Mutations that span multiple tables go through Postgres RPC functions (`/rpc/approve_signup_request`, `/rpc/submit_usage_group`, etc.), not by stitching multiple requests on the client.
- If a screen needs data the schema doesn't expose cleanly, **add a Postgres view or RPC** rather than fetching extra and joining in JS.


## Domain vocabulary (use these names exactly)

These match the schema. Don't invent synonyms.

- **Event** — one Ashara Mubaraka (e.g. "1447 / Chennai"). Has per-event brand colours. Exactly one event has `is_default = true` (used for signup).
- **Venue** — physical location. Type is `fasal_city` or `relay_city`. An event tags multiple venues via `event_venues`.
- **Zone** — child of a venue. In a `fasal_city` venue, exactly one zone may be marked `is_cmz` (enforced by trigger + partial unique index).
- **Department** — one of 32 canonical departments (Mawaid, Karama, Tazyeen, etc.). Has `name` and `name_lisan` (Arabic/LuD).
- **Sign** — atomic ("constant", standalone) or composite ("variable", instance of a `sign_template` with `slot_values`).
- **Sign type** — `prohibition`, `mandatory`, `warning`, `safe_condition` (ISO 7010, locked colours), plus `direction`, `place`, `notice` (functional, colour comes from event).
- **Usage** — one line item: a sign used by a department, at an event/venue/zone, with quantity, size, and status. **The `usages` table drives almost every screen.**
- **Usage group** — a bundle a department user submits in one go.
- **Signup request** — pending row in `signup_requests` awaiting super_admin approval. On approval, becomes a `users` row plus `user_role_assignments`.

### Status machine

`pending → approved → designing → printing → ready`, plus `rejected` and `cancelled`. Transitions are role-gated — see spec §7.

### Roles (v7)

`super_admin`, `signage_hod`, `signage_production`, `department_user`, `viewer`. **The v6 prototype's role names (`hod`, `admin`, `designer`, `production`) are obsolete** — translate when porting prototype logic.

Approval rule: any `signage_hod` on the event (not venue-restricted), or `super_admin`, can approve a pending request.

### Key views to read from (don't reinvent these joins client-side)

- `hod_dashboard` — what an HOD sees, filtered server-side by RLS.
- `pipeline_kanban` — the production board.
- `sign_history` — per-sign usage across events/venues/zones.
- `print_run_summary` — approved items grouped by design (variable templates collapse with all variants).


## Stack

- React 18 + TypeScript (strict)
- Vite
- Tailwind CSS
- Zustand (client/global state only)
- TanStack Query (server state)
- Axios (PostgREST client)
- React Hook Form + Zod


## Folder structure

```
src/
├── api/         # axios client + PostgREST request functions, no UI
├── components/  # shared UI primitives
├── features/    # feature folders: approvals, pipeline, library, signup, ...
├── hooks/       # reusable hooks (incl. TanStack Query hooks)
├── lib/         # auth, jwt, postgrest helpers
├── pages/       # route components, thin
├── services/    # cross-feature business logic
├── stores/      # Zustand stores
├── types/       # generated + hand-written types (incl. DB types)
└── utils/
```

Use `@/` aliases. No deep relative imports.


## Code rules

### TypeScript

- Strict mode. No `any`. Prefer explicit types.
- Generate DB types from the schema into `types/db.ts`. Do not hand-maintain row shapes that mirror tables.

### Components

- Functional components only. No class components.
- Named exports only.
- Keep under ~150 lines. Split when growing.
- No prop drilling — lift to a feature hook, context, or Zustand store.
- No API calls inside JSX or component bodies — use a TanStack Query hook from `hooks/` or `features/<x>/hooks/`.

### State

- **Server state → TanStack Query.** Never duplicate it in Zustand.
- **Client state (UI toggles, selections, drawer open/closed) → Zustand or local `useState`.**
- Auth/session state → a single Zustand store reading the JWT; refreshed on login/logout.

### API layer (`src/api/`)

- One centralized axios instance with the PostgREST base URL and a JWT interceptor.
- Files contain HTTP request functions only. No toasts, no navigation, no UI.
- Use PostgREST's filter/embed syntax; don't refetch and join in JS.
- Multi-table mutations → call an RPC function. If one doesn't exist, **add it to the schema** rather than chaining requests on the client.

```ts
// good
export const getUsagesForEvent = async (eventId: string) => {
  const res = await api.get('/usages', {
    params: {
      event_id: `eq.${eventId}`,
      select: '*,sign(canonical_name),department(name),size(label)',
      order: 'created_at.desc',
    },
  });
  return res.data;
};

export const approveSignupRequest = async (input: ApproveSignupInput) => {
  const res = await api.post('/rpc/approve_signup_request', input);
  return res.data;
};
```

### Forms

- React Hook Form + Zod, schemas separate from components.
- Zod schemas should mirror the Postgres CHECK constraints (status enums, sign type enums, venue type, etc.). Single source of truth is the schema; keep Zod in sync when the schema changes.

### Styling

- Tailwind utilities. No inline styles unless dynamic (e.g. event brand colours from the DB).
- Reuse shared UI primitives from `components/`.
- Status pills, type badges, role badges — one shared component each, not inlined per screen.

### Auth & RLS

- The client trusts RLS. **Don't add client-side permission checks as the security boundary** — they're for UX (hiding buttons), not safety.
- Every request must include the JWT. The axios interceptor handles it; don't bypass.
- Role-conditional UI reads from the auth store's parsed JWT claims (`role`, `user_id`, scope), not from a separate `/me` call when avoidable.


## Forbidden

- Class components.
- Redux (unless explicitly required — TanStack Query + Zustand cover it).
- Direct state mutation.
- API calls inside JSX or component bodies.
- `any`.
- Mixing UI and business logic.
- Hardcoded API keys, JWT secrets, or DB URLs (env vars only).
- Deleting existing tests.
- Translating prototype `D027` / `SG0184` style IDs by hand — use the seed data.
- Adding a custom Express/Node API layer "to make this easier." The architecture is intentionally PostgREST-only.


## Preferred patterns

- Composition over inheritance.
- Reusable hooks (`useUsages`, `useApprovalQueue`, `usePipelineBoard`).
- Centralized configs (axios, query client, Tailwind theme).
- Declarative code, early returns, small pure functions.
- async/await over `.then()`.
- When adding a feature, walk the spec: **requirement → schema → RPC/view → API function → query hook → component → page.** If any link is missing, add it at the right layer.


## Open items from spec §10 (be aware)

- Migrations are not yet versioned — schema_v7 is a destructive rebuild. Don't write code that assumes migration history exists yet.
- Real venues/zones for 1447 Chennai are not seeded; current seed is illustrative.
- "Force change on first login" (initial password = ITS number) is not wired up — flag if you touch the auth flow.
- Notifications are in-app only; no email/Slack yet.
