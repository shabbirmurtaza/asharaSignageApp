# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-05-10T07:18:03.267Z
> Files: 103 tracked | Anatomy hits: 0 | Misses: 0

## ../../../.claude-sub/plans/

- `foamy-foraging-shannon.md` — Hard-link signs to departments (~2422 tok)

## ./

- `.gitignore` — Git ignore rules (~79 tok)
- `CLAUDE.md` — CLAUDE.md (~2272 tok)
- `DESIGN.md` — DESIGN.md — Ashara Mubaraka Signage System (~4490 tok)
- `PRODUCT.md` — Product (~1474 tok)

## .claude/

- `CLAUDE.local.md` — Local Configuration (~82 tok)
- `settings.json` (~441 tok)

## .claude/rules/

- `openwolf.md` (~313 tok)

## .codegraph/

- `.gitignore` — Git ignore rules (~47 tok)
- `config.json` (~808 tok)

## signage-app/

- `README.md` — Project documentation (~2411 tok)
- `signage_app_v7_spec.md` — Ashara Mubaraka Signage — App Spec v7 (~3098 tok)

## signage-app/db/

- `01_extensions.sql` — ============================================================ (~1062 tok)
- `02_auth_functions.sql` — ============================================================ (~5215 tok)
- `03_rls_policies.sql` — ============================================================ (~4905 tok)
- `docker-compose.yml` — Docker Compose services (~314 tok)
- `README.md` — Project documentation (~1706 tok)
- `schema_v7.sql` — ============================================================ (~8052 tok)
- `seed_signs.sql` — ============================================================ (~50832 tok)

## signage-app/web/

- `index.html` — Ashara Signage (~98 tok)
- `package.json` — Node.js package manifest (~340 tok)
- `README.md` — Project documentation (~1007 tok)
- `tailwind.config.js` (~758 tok)
- `tsconfig.app.json` (~233 tok)
- `vite.config.ts` — https://vite.dev/config/ (~89 tok)

## signage-app/web/scripts/

- `generate-types.mjs` — PostgREST 12 still emits Swagger 2.0; openapi-typescript v7 only accepts (~428 tok)

## signage-app/web/src/

- `App.tsx` — HomeRedirect (~1257 tok)
- `index.css` — Styles: 42 rules, 34 vars (~1823 tok)
- `main.tsx` — queryClient (~229 tok)

## signage-app/web/src/components/

- `AppShell.tsx` — AppShell (~413 tok)
- `EmptyState.tsx` — EmptyState (~153 tok)
- `EventSwitcher.tsx` — EventSwitcher (~438 tok)
- `NotificationBell.tsx` — ICONS (~1252 tok)
- `RequireAuth.tsx` — If set, only these roles (or super_admin) may enter. (~204 tok)
- `RoleBadge.tsx` — RoleBadge (~180 tok)
- `Sidebar.tsx` — useSections (~2700 tok)
- `Skeleton.tsx` — Skeleton (~53 tok)
- `StatusPill.tsx` — StatusPill (~56 tok)
- `Toaster.tsx` — ICONS (~349 tok)
- `TopBar.tsx` — TopBar (~876 tok)
- `TypeBadge.tsx` — LABEL (~164 tok)

## signage-app/web/src/features/admin/

- `api.ts` — Super Admin API layer (PostgREST + RPC). (~3647 tok)
- `hooks.ts` — Exports useEvents, useEvent, useCreateEvent, useUpdateEvent + 34 more (~3072 tok)

## signage-app/web/src/features/admin/components/

- `ApproveSignupDrawer.tsx` — ROLES — renders form, modal (~980 tok)
- `AssignmentRow.tsx` — Existing assignment id, or undefined for unsaved row. (~1326 tok)
- `AssignmentsEditor.tsx` — emptyDraft — renders table (~1266 tok)
- `Button.tsx` — VARIANTS (~275 tok)
- `Drawer.tsx` — W (~486 tok)
- `EventDrawer.tsx` — DEFAULT_STATE — renders modal (~1087 tok)
- `EventForm.tsx` — DEFAULT — renders form (~1453 tok)
- `EventVenuesTab.tsx` — EventVenuesTab (~742 tok)
- `EventZonesTab.tsx` — VenueZones (~671 tok)
- `FormField.tsx` — FormField (~215 tok)
- `Modal.tsx` — Modal (~358 tok)
- `PageHeader.tsx` — PageHeader (~144 tok)
- `RejectSignupModal.tsx` — RejectSignupModal — renders form, modal (~516 tok)
- `ResetPasswordModal.tsx` — generatePassword — renders form, modal (~871 tok)
- `StatusBadge.tsx` — COLOR (~202 tok)
- `VenueDrawer.tsx` — empty — renders form, modal (~1524 tok)
- `ZoneCount.tsx` — ZoneCount (~54 tok)
- `ZonesEditor.tsx` — ZonesEditor (~855 tok)

## signage-app/web/src/features/department/

- `api.ts` — Department HOD API layer (PostgREST). (~1751 tok)
- `hooks.ts` — Exports useMyRequests, useUsageDetail, useCancelUsage, useSubmitOrder + 4 more (~676 tok)
- `notifications.ts` — Exports NotificationRow, listMyNotifications, markNotificationRead, useNotifications, useMarkNotific (~445 tok)

## signage-app/web/src/features/hod/

- `api.ts` — Signage HOD API surface — thin wrapper over PostgREST. (~2838 tok)
- `hooks.ts` — TanStack Query hooks for the Signage HOD feature tree. (~1535 tok)
- `PlaceOrderDrawer.tsx` — "Place order on behalf" — venue-locked, dept-pickable form. (~1739 tok)
- `RejectModal.tsx` — Reject-with-note modal. Note is required, min 5 chars (matches the (~755 tok)
- `scope.ts` — Resolves the (event_id, venue_id) pair for the active signage_hod (~820 tok)

## signage-app/web/src/features/library/

- `api.ts` — Sign Library API. (~848 tok)
- `hooks.ts` — Exports useSigns, useSignDetail, useSignTypes (~232 tok)

## signage-app/web/src/features/production/

- `api.ts` — PostgREST calls for the production pipeline. (~394 tok)
- `hooks.ts` — TanStack Query hooks for the production pipeline. (~550 tok)
- `KanbanCard.tsx` — formatRelative (~1450 tok)
- `KanbanColumn.tsx` — KanbanColumn (~608 tok)
- `transitions.ts` — Pure transition rules for the production Kanban. (~396 tok)

## signage-app/web/src/hooks/

- `useChromeEvent.ts` — Resolves the "current event" for chrome surfaces (sidebar, topbar, login). (~492 tok)
- `useDefaultEvent.ts` — Exports DefaultEventRow, useDefaultEvent (~182 tok)

## signage-app/web/src/lib/

- `accent.ts` — Per-event accent color helpers. (~501 tok)
- `api.ts` — Thin PostgREST client over plain fetch. (~1737 tok)
- `auth.ts` — JWT-based session. The JWT is issued by the Postgres login() function (~769 tok)
- `rbac.ts` — Pure role/scope helpers. UX-only — RLS is the source of truth. (~1246 tok)

## signage-app/web/src/pages/

- `Login.tsx` — schema — renders form (~2004 tok)
- `Signup.tsx` — personalSchema — renders form (~7102 tok)
- `Stub.tsx` — Stub (~267 tok)

## signage-app/web/src/pages/admin/

- `Departments.tsx` — AdminDepartmentsPage — renders table (~2328 tok)
- `Events.tsx` — AdminEventsPage — renders table (~1357 tok)
- `SignupApprovals.tsx` — AdminSignupApprovalsPage — renders table (~1247 tok)
- `Sizes.tsx` — empty — renders table (~1993 tok)
- `UserDetail.tsx` — AdminUserDetailPage (~884 tok)
- `Users.tsx` — AdminUsersPage — renders table (~1189 tok)
- `Venues.tsx` — AdminVenuesPage — renders table (~1176 tok)

## signage-app/web/src/pages/department/

- `MyRequests.tsx` — formatDate — renders table (~2044 tok)
- `NewRequest.tsx` — pickSchema — renders form (~3810 tok)
- `RequestDetail.tsx` — formatDateTime (~1826 tok)

## signage-app/web/src/pages/hod/

- `Approvals.tsx` — Pending-approvals queue grouped by department, with bulk-approve and (~2617 tok)
- `Dashboard.tsx` — Signage HOD dashboard — KPI strip + recent activity for the active venue. (~2720 tok)

## signage-app/web/src/pages/library/

- `SignDetail.tsx` — groupByEvent — renders table (~1824 tok)
- `SignLibrary.tsx` — VARIABLE_OPTIONS — renders table (~4856 tok)
- `SignNew.tsx` — Catalogue maintenance — adds a sign without ordering it. Visible to (~1931 tok)

## signage-app/web/src/pages/production/

- `Pipeline.tsx` — Resolves the event id for the pipeline: (~2508 tok)

## signage-app/web/src/stores/

- `eventScope.ts` — Selected-event scope. Only super_admin uses this; for everyone else, scope (~302 tok)
- `toast.ts` — Exports ToastKind, ToastEntry, useToastStore, useToast (~258 tok)
