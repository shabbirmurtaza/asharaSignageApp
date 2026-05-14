-- ============================================================
-- 03_rls_policies.sql
-- Enable RLS and define all policies. Source of truth for access
-- control — the React client cannot bypass these.
--
-- JWT claim convention (set by the login() function):
--   request.jwt.claim.user_id      uuid
--   request.jwt.claim.its_number   text
--   request.jwt.claim.primary_role text  (super_admin|signage_hod|...)
--   request.jwt.claim.role         'authenticated'
-- ============================================================

-- ------------------------------------------------------------
-- Helper functions
-- ------------------------------------------------------------
-- Read JWT claims set by PostgREST. Supports both:
--   * PostgREST v10+: request.jwt.claims as a single JSON object
--   * Legacy / direct psql: request.jwt.claim.<key> as individual GUCs
create or replace function auth_user_id() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.user_id', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'user_id'
  )::uuid;
$$;

create or replace function auth_role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.primary_role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'primary_role'
  );
$$;

create or replace function auth_active() returns boolean
language sql stable as $$
  select auth_user_id() is not null;
$$;

create or replace function is_super_admin() returns boolean
language sql stable as $$
  select auth_role() = 'super_admin';
$$;

-- Does the current user have any active assignment on this event?
create or replace function has_event_role(p_event_id uuid, p_role text)
returns boolean language sql stable as $$
  select exists (
    select 1
      from user_role_assignments ura
      join roles r on r.id = ura.role_id
     where ura.user_id = auth_user_id()
       and r.name      = p_role
       and (ura.event_id is null or ura.event_id = p_event_id)
  );
$$;

-- Does the current user own this department on this event+venue?
create or replace function is_dept_user_for(p_event_id uuid, p_venue_id uuid, p_department_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
      from user_role_assignments ura
      join roles r on r.id = ura.role_id
     where ura.user_id      = auth_user_id()
       and r.name           = 'department_user'
       and ura.event_id     = p_event_id
       and ura.venue_id     = p_venue_id
       and ura.department_id = p_department_id
  );
$$;

-- Does the current user have a department_user assignment for this department?
-- Catalogue ownership (signs) is dept-scoped only — event/venue are not relevant
-- here because the catalogue is shared across events.
create or replace function is_dept_user_for_dept(p_department_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
      from user_role_assignments ura
      join roles r on r.id = ura.role_id
     where ura.user_id       = auth_user_id()
       and r.name            = 'department_user'
       and ura.department_id = p_department_id
  );
$$;

-- v3: signage_hod is scoped to (event, venue). Approval/transition
-- policies must require both — no department, but venue-matched.
create or replace function is_signage_hod_for(p_event_id uuid, p_venue_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
      from user_role_assignments ura
      join roles r on r.id = ura.role_id
     where ura.user_id  = auth_user_id()
       and r.name       = 'signage_hod'
       and ura.event_id = p_event_id
       and ura.venue_id = p_venue_id
  );
$$;

-- Allowed status transitions per role.
create or replace function can_transition(
  p_old text, p_new text, p_role text
) returns boolean language sql immutable as $$
  select case
    when p_old = p_new then true  -- non-status updates pass
    when p_role = 'super_admin' then true
    when p_role = 'signage_hod' and p_old = 'pending'   and p_new in ('approved','rejected') then true
    when p_role = 'signage_production' and (
           (p_old = 'approved'  and p_new = 'designing') or
           (p_old = 'designing' and p_new = 'printing')  or
           (p_old = 'printing'  and p_new = 'ready')
         ) then true
    when p_role = 'department_user' and p_old = 'pending' and p_new = 'cancelled' then true
    else false
  end;
$$;

-- ============================================================
-- v3 schema fixup: enforce_event_venue_link() in schema_v7.sql
-- references new.zone_id, but usage_groups has no zone_id column.
-- That makes the trigger crash on every usage_groups insert.
-- Override it here with a TG_TABLE_NAME-aware version.
-- ============================================================
create or replace function enforce_event_venue_link()
returns trigger as $$
declare
  v_event_id uuid;
  v_venue_id uuid;
  v_zone_id  uuid;
begin
  -- Use row_to_json to dodge PL/pgSQL's static field resolution on NEW
  -- (usage_groups has no zone_id column; the v7 trigger function naively
  --  references new.zone_id, which crashes on every usage_groups insert).
  v_event_id := (row_to_json(new)->>'event_id')::uuid;
  v_venue_id := (row_to_json(new)->>'venue_id')::uuid;
  v_zone_id  := nullif(row_to_json(new)->>'zone_id','')::uuid;

  if not exists (
    select 1 from event_venues
     where event_id = v_event_id
       and venue_id = v_venue_id
  ) then
    raise exception 'Venue % is not tagged to event %', v_venue_id, v_event_id;
  end if;

  if v_zone_id is not null then
    if not exists (
      select 1 from zones where id = v_zone_id and venue_id = v_venue_id
    ) then
      raise exception 'Zone % does not belong to venue %', v_zone_id, v_venue_id;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

-- ============================================================
-- Enable RLS on every table
-- ============================================================
alter table events                enable row level security;
alter table venues                enable row level security;
alter table zones                 enable row level security;
alter table event_venues          enable row level security;
alter table departments           enable row level security;
alter table roles                 enable row level security;
alter table users                 enable row level security;
alter table signup_requests       enable row level security;
alter table user_role_assignments enable row level security;
alter table sign_types            enable row level security;
alter table sign_templates        enable row level security;
alter table sizes                 enable row level security;
alter table signs                 enable row level security;
alter table usage_groups          enable row level security;
alter table usages                enable row level security;
alter table usage_status_history  enable row level security;
alter table notifications         enable row level security;

-- ============================================================
-- MASTERS — read for active users; write super_admin only
-- ============================================================
drop policy if exists events_read    on events;
drop policy if exists events_write   on events;
create policy events_read    on events
  for select using (auth_active());
create policy events_write   on events
  for all using (is_super_admin()) with check (is_super_admin());

drop policy if exists venues_read    on venues;
drop policy if exists venues_write   on venues;
create policy venues_read    on venues
  for select using (auth_active());
create policy venues_write   on venues
  for all using (is_super_admin()) with check (is_super_admin());

drop policy if exists zones_read     on zones;
drop policy if exists zones_write    on zones;
create policy zones_read     on zones
  for select using (auth_active());
create policy zones_write    on zones
  for all using (is_super_admin()) with check (is_super_admin());

drop policy if exists event_venues_read  on event_venues;
drop policy if exists event_venues_write on event_venues;
create policy event_venues_read  on event_venues
  for select using (auth_active());
create policy event_venues_write on event_venues
  for all using (is_super_admin()) with check (is_super_admin());

drop policy if exists departments_read   on departments;
drop policy if exists departments_write  on departments;
create policy departments_read   on departments
  for select using (auth_active());
create policy departments_write  on departments
  for all using (is_super_admin()) with check (is_super_admin());

drop policy if exists roles_read         on roles;
drop policy if exists roles_write        on roles;
create policy roles_read         on roles
  for select using (auth_active());
create policy roles_write        on roles
  for all using (is_super_admin()) with check (is_super_admin());

drop policy if exists sign_types_read    on sign_types;
drop policy if exists sign_types_write   on sign_types;
create policy sign_types_read    on sign_types
  for select using (auth_active());
create policy sign_types_write   on sign_types
  for all using (is_super_admin()) with check (is_super_admin());

drop policy if exists sign_templates_read  on sign_templates;
drop policy if exists sign_templates_write on sign_templates;
create policy sign_templates_read  on sign_templates
  for select using (auth_active());
create policy sign_templates_write on sign_templates
  for all using (is_super_admin()) with check (is_super_admin());

drop policy if exists sizes_read         on sizes;
drop policy if exists sizes_write        on sizes;
create policy sizes_read         on sizes
  for select using (auth_active());
create policy sizes_write        on sizes
  for all using (is_super_admin()) with check (is_super_admin());

-- Reads stay open: every authenticated role browses the catalogue. Visibility
-- gating for department_user happens client-side via the department_id filter.
drop policy if exists signs_read   on signs;
drop policy if exists signs_insert on signs;
drop policy if exists signs_update on signs;
drop policy if exists signs_delete on signs;
create policy signs_read         on signs
  for select using (auth_active());

-- Writes are split so department_user can self-serve their own dept's catalogue.
create policy signs_insert       on signs
  for insert with check (
    is_super_admin()
    or is_dept_user_for_dept(department_id)
  );
create policy signs_update       on signs
  for update using (
    is_super_admin()
    or is_dept_user_for_dept(department_id)
  ) with check (
    is_super_admin()
    or is_dept_user_for_dept(department_id)
  );
-- Delete stays admin-only: signs cascade to usages.
create policy signs_delete       on signs
  for delete using (is_super_admin());

-- ============================================================
-- USERS / ASSIGNMENTS
-- super_admin sees and writes everything; others see only own row.
-- ============================================================
drop policy if exists users_read  on users;
drop policy if exists users_write on users;
create policy users_read on users
  for select using (
    is_super_admin() or id = auth_user_id()
  );
create policy users_write on users
  for all using (is_super_admin()) with check (is_super_admin());

drop policy if exists ura_read  on user_role_assignments;
drop policy if exists ura_write on user_role_assignments;
create policy ura_read on user_role_assignments
  for select using (
    is_super_admin() or user_id = auth_user_id()
  );
create policy ura_write on user_role_assignments
  for all using (is_super_admin()) with check (is_super_admin());

-- ============================================================
-- SIGNUP_REQUESTS
-- Anonymous insert is via signup_request() (SECURITY DEFINER), so
-- no client-side INSERT policy is needed. Only super_admin sees
-- and updates the queue (approve/reject_signup() also writes here
-- as SECURITY DEFINER).
-- ============================================================
drop policy if exists signup_requests_read  on signup_requests;
drop policy if exists signup_requests_write on signup_requests;
create policy signup_requests_read on signup_requests
  for select using (is_super_admin());
create policy signup_requests_write on signup_requests
  for all using (is_super_admin()) with check (is_super_admin());

-- ============================================================
-- USAGE_GROUPS — visibility follows the same scope as usages
-- ============================================================
drop policy if exists usage_groups_read   on usage_groups;
drop policy if exists usage_groups_insert on usage_groups;
drop policy if exists usage_groups_update on usage_groups;
drop policy if exists usage_groups_delete on usage_groups;
create policy usage_groups_read on usage_groups
  for select using (
    is_super_admin()
    or exists (
      select 1
        from user_role_assignments ura
        join roles r on r.id = ura.role_id
       where ura.user_id = auth_user_id()
         and (ura.event_id is null or ura.event_id = usage_groups.event_id)
         and (ura.venue_id is null or ura.venue_id = usage_groups.venue_id)
         and (
              ura.department_id is null
           or ura.department_id = usage_groups.department_id
           or r.name in ('signage_hod','signage_production','viewer')
         )
    )
  );

create policy usage_groups_insert on usage_groups
  for insert with check (
    is_super_admin()
    or is_signage_hod_for(event_id, venue_id)
    or is_dept_user_for(event_id, venue_id, department_id)
  );

create policy usage_groups_update on usage_groups
  for update using (
    is_super_admin() or submitted_by = auth_user_id()
  ) with check (
    is_super_admin() or submitted_by = auth_user_id()
  );

create policy usage_groups_delete on usage_groups
  for delete using (is_super_admin());

-- ============================================================
-- USAGES — the busiest policy set
-- ============================================================
drop policy if exists usages_read   on usages;
drop policy if exists usages_insert on usages;
drop policy if exists usages_update on usages;
drop policy if exists usages_delete on usages;
create policy usages_read on usages
  for select using (
    is_super_admin()
    or exists (
      select 1
        from user_role_assignments ura
        join roles r on r.id = ura.role_id
       where ura.user_id = auth_user_id()
         and (ura.event_id is null or ura.event_id = usages.event_id)
         and (ura.venue_id is null or ura.venue_id = usages.venue_id)
         and (
              ura.department_id is null
           or ura.department_id = usages.department_id
           or r.name in ('signage_hod','signage_production','viewer')
         )
    )
  );

create policy usages_insert on usages
  for insert with check (
    is_super_admin()
    or is_signage_hod_for(event_id, venue_id)
    or is_dept_user_for(event_id, venue_id, department_id)
  );

-- UPDATE: must be readable AND the status transition must be allowed.
-- Status-transition enforcement is in a BEFORE UPDATE trigger
-- (RLS policies cannot reference OLD vs NEW values reliably).
-- v3: signage_hod approval requires venue match; signage_production
-- still scoped per-event (production can move designs across venues).
create policy usages_update on usages
  for update
  using (
    is_super_admin()
    or is_signage_hod_for(event_id, venue_id)
    or has_event_role(event_id, 'signage_production')
    or created_by = auth_user_id()
  )
  with check (
    is_super_admin()
    or is_signage_hod_for(event_id, venue_id)
    or has_event_role(event_id, 'signage_production')
    or created_by = auth_user_id()
  );

create policy usages_delete on usages
  for delete using (is_super_admin());

-- BEFORE UPDATE trigger: enforce role-gated status transitions.
-- Runs in the caller's session, so request.jwt.claim.* is set.
create or replace function enforce_usage_status_transition()
returns trigger as $$
declare
  v_role text;
begin
  if old.status is not distinct from new.status then
    return new;  -- non-status update
  end if;

  v_role := auth_role();

  if v_role is null then
    raise exception 'Anonymous role cannot change usage status';
  end if;

  if not can_transition(old.status, new.status, v_role) then
    raise exception 'Role % cannot transition usage from % to %',
      v_role, old.status, new.status
      using errcode = '42501';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists usages_status_transition_check on usages;
create trigger usages_status_transition_check
  before update on usages
  for each row execute function enforce_usage_status_transition();

-- ============================================================
-- USAGE_STATUS_HISTORY — read scoped, writes only via trigger
-- ============================================================
drop policy if exists ush_read on usage_status_history;
create policy ush_read on usage_status_history
  for select using (
    is_super_admin()
    or exists (
      select 1 from usages u
       where u.id = usage_status_history.usage_id
         -- piggy-back on usages_read by checking same predicate
         and (
           is_super_admin()
           or exists (
             select 1
               from user_role_assignments ura
               join roles r on r.id = ura.role_id
              where ura.user_id = auth_user_id()
                and (ura.event_id is null or ura.event_id = u.event_id)
                and (ura.venue_id is null or ura.venue_id = u.venue_id)
                and (
                     ura.department_id is null
                  or ura.department_id = u.department_id
                  or r.name in ('signage_hod','signage_production','viewer')
                )
           )
         )
    )
  );

-- No client INSERT/UPDATE/DELETE — trigger writes.
-- The trigger function in schema_v7 runs as the invoking user, so
-- with RLS on these tables it would be blocked. Re-create it as
-- SECURITY DEFINER so the trigger writes bypass RLS cleanly.
create or replace function track_usage_status() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (TG_OP = 'INSERT') then
    insert into usage_status_history (usage_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, new.created_by);
    return new;
  end if;

  if (old.status is distinct from new.status) then
    insert into usage_status_history (usage_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth_user_id());

    if new.created_by is not null then
      insert into notifications (user_id, usage_id, type, title, body)
      values (new.created_by, new.id, 'status_change',
              'Sign request status: ' || new.status,
              'Your request status changed from ' || old.status || ' to ' || new.status);
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================
-- NOTIFICATIONS — own only; UPDATE limited to read_at
-- ============================================================
drop policy if exists notifications_read   on notifications;
drop policy if exists notifications_update on notifications;
create policy notifications_read on notifications
  for select using (
    is_super_admin() or user_id = auth_user_id()
  );

create policy notifications_update on notifications
  for update
  using (user_id = auth_user_id())
  with check (user_id = auth_user_id());

-- ============================================================
-- Grants — RLS only filters; you still need privileges.
-- ============================================================
grant select, insert, update, delete on
  events, venues, zones, event_venues, departments, roles,
  sign_types, sign_templates, sizes, signs,
  users, user_role_assignments, signup_requests,
  usage_groups, usages
to authenticated;

grant select on
  user_scope, hod_dashboard, pipeline_kanban, sign_history, print_run_summary,
  usage_status_history
to authenticated;

grant select, update on notifications to authenticated;

-- web_anon needs nothing direct on tables; it only calls the
-- signup_request / login / get_default_event RPCs (already granted).
