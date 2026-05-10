-- ============================================================
-- 02_auth_functions.sql
-- Auth RPC functions exposed to PostgREST.
--
-- Prerequisite GUC: app.jwt_secret must be set on the database.
-- The README shows how (run with psql -v jwt_secret=... or
-- `ALTER DATABASE signage SET app.jwt_secret = '...';`).
--
-- All functions are SECURITY DEFINER so they bypass RLS for
-- the narrow operations they perform. They run as the database
-- owner and grant EXECUTE explicitly to web_anon / authenticated.
-- ============================================================

-- ------------------------------------------------------------
-- Helpers: read JWT claims set by PostgREST.
-- PostgREST v10+ exposes claims as a single JSON GUC
-- `request.jwt.claims`; older configs use one GUC per claim.
-- These helpers support both. They are also re-defined in
-- 03_rls_policies.sql so RLS predicates can use them.
-- ------------------------------------------------------------
create or replace function _jwt_claim_user_id() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.user_id', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'user_id'
  )::uuid;
$$;

create or replace function _jwt_claim_primary_role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.primary_role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'primary_role'
  );
$$;

-- ------------------------------------------------------------
-- Helper: highest-privileged role across a user's assignments
-- ------------------------------------------------------------
create or replace function _primary_role(p_user_id uuid)
returns text language sql stable as $$
  select r.name
    from user_role_assignments ura
    join roles r on r.id = ura.role_id
   where ura.user_id = p_user_id
   order by case r.name
     when 'super_admin'        then 1
     when 'signage_hod'        then 2
     when 'signage_production' then 3
     when 'department_user'    then 4
     when 'viewer'             then 5
     else 99
   end
   limit 1;
$$;

-- ------------------------------------------------------------
-- Helper: assignments array for JWT claim
-- ------------------------------------------------------------
create or replace function _assignments_json(p_user_id uuid)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'role',          r.name,
             'event_id',      ura.event_id,
             'venue_id',      ura.venue_id,
             'department_id', ura.department_id
           )
         ), '[]'::jsonb)
    from user_role_assignments ura
    join roles r on r.id = ura.role_id
   where ura.user_id = p_user_id;
$$;

-- ============================================================
-- signup_request — anonymous user submits intake; SA approves
-- ============================================================
create or replace function signup_request(
  p_its_number       text,
  p_name             text,
  p_email            text,
  p_contact_number   text,
  p_password         text,
  p_event_id         uuid,
  p_venue_id         uuid,
  p_department_id    uuid
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;

  if exists (select 1 from users where its_number = p_its_number) then
    raise exception 'An account with this ITS Number already exists';
  end if;

  if exists (
    select 1 from signup_requests
     where its_number = p_its_number and status = 'pending'
  ) then
    raise exception 'A pending signup request already exists for this ITS Number';
  end if;

  insert into signup_requests (
    its_number, name, email, contact_number, password_hash,
    requested_event_id, requested_venue_id, requested_department_id, status
  ) values (
    p_its_number, p_name, p_email, p_contact_number,
    crypt(p_password, gen_salt('bf', 10)),
    p_event_id, p_venue_id, p_department_id, 'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ============================================================
-- approve_signup — super_admin only
-- ============================================================
create or replace function approve_signup(
  p_request_id uuid,
  p_role_name  text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id  uuid;
  v_req      signup_requests%rowtype;
  v_role_id  uuid;
  v_caller   uuid;
begin
  v_caller := _jwt_claim_user_id();

  if _jwt_claim_primary_role() is distinct from 'super_admin' then
    raise exception 'Only super_admin can approve signups';
  end if;

  select * into v_req from signup_requests where id = p_request_id for update;
  if not found then
    raise exception 'Signup request % not found', p_request_id;
  end if;

  if v_req.status <> 'pending' then
    raise exception 'Signup request % is not pending (status=%)', p_request_id, v_req.status;
  end if;

  select id into v_role_id from roles where name = p_role_name;
  if v_role_id is null then
    raise exception 'Unknown role %', p_role_name;
  end if;

  insert into users (
    its_number, name, email, contact_number, password_hash,
    status, approved_by, approved_at
  ) values (
    v_req.its_number, v_req.name, v_req.email, v_req.contact_number,
    v_req.password_hash, 'active', v_caller, now()
  )
  returning id into v_user_id;

  -- v3 role-scope rules (enforced by trigger enforce_role_scope_rules):
  --   super_admin     → null event/venue/dept
  --   signage_hod     → event + venue, NO department (HOD covers all depts at the venue)
  --   department_user → event + venue + department
  --   signage_production / viewer → at least event_id
  insert into user_role_assignments (
    user_id, role_id, event_id, venue_id, department_id
  ) values (
    v_user_id, v_role_id,
    case when p_role_name = 'super_admin' then null else v_req.requested_event_id end,
    case when p_role_name = 'super_admin' then null else v_req.requested_venue_id end,
    case when p_role_name = 'department_user'
         then v_req.requested_department_id else null end
  );

  update signup_requests
     set status      = 'approved',
         user_id     = v_user_id,
         reviewed_by = v_caller,
         reviewed_at = now()
   where id = p_request_id;

  insert into notifications (user_id, type, title, body)
  values (
    v_user_id,
    'signup_approved',
    'Your signup has been approved',
    'You can now log in with your ITS Number and the password you set during signup.'
  );

  return v_user_id;
end;
$$;

-- ============================================================
-- reject_signup — super_admin only
-- ============================================================
create or replace function reject_signup(
  p_request_id uuid,
  p_note       text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid;
begin
  v_caller := _jwt_claim_user_id();

  if _jwt_claim_primary_role() is distinct from 'super_admin' then
    raise exception 'Only super_admin can reject signups';
  end if;

  update signup_requests
     set status         = 'rejected',
         rejection_note = p_note,
         reviewed_by    = v_caller,
         reviewed_at    = now()
   where id = p_request_id
     and status = 'pending';

  if not found then
    raise exception 'Signup request % not found or not pending', p_request_id;
  end if;
end;
$$;

-- ============================================================
-- login — verify password, return signed JWT
-- ============================================================
create or replace function login(
  p_its_number text,
  p_password   text
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user        users%rowtype;
  v_primary     text;
  v_assignments jsonb;
  v_secret      text;
  v_payload     json;
begin
  select * into v_user
    from users
   where its_number = p_its_number
     and status     = 'active';

  if not found or v_user.password_hash <> crypt(p_password, v_user.password_hash) then
    raise exception 'Invalid ITS Number or password' using errcode = '28P01';
  end if;

  v_primary     := _primary_role(v_user.id);
  v_assignments := _assignments_json(v_user.id);

  if v_primary is null then
    raise exception 'User has no role assignments; contact super admin';
  end if;

  v_secret := current_setting('app.jwt_secret', true);
  if v_secret is null or length(v_secret) < 32 then
    raise exception 'app.jwt_secret is not configured (>=32 chars required)';
  end if;

  v_payload := json_build_object(
    'role',         'authenticated',
    'user_id',      v_user.id,
    'its_number',   v_user.its_number,
    'primary_role', v_primary,
    'assignments',  v_assignments,
    'exp',          extract(epoch from now() + interval '12 hours')::int
  );

  return sign(v_payload, v_secret, 'HS256');
end;
$$;

-- ============================================================
-- get_default_event — readable without auth (for signup wizard)
-- ============================================================
create or replace function get_default_event()
returns table (
  id              uuid,
  name            text,
  year            text,
  city            text,
  brand_primary   text
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select id, name, year, city, brand_primary
    from events
   where is_default = true and is_archived = false
   limit 1;
$$;

-- ============================================================
-- list_departments_for_signup — readable without auth (signup wizard)
-- Departments are static reference data; safe to expose anonymously.
-- ============================================================
create or replace function list_departments_for_signup()
returns table (
  id        uuid,
  name      text,
  name_lisan text
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select id, name, name_lisan
    from departments
   order by name asc;
$$;

-- ============================================================
-- list_venues_for_signup — readable without auth (signup wizard)
-- Returns venues attached to a given event. Anonymous users need this
-- to populate the venue dropdown before they have a JWT.
-- ============================================================
create or replace function list_venues_for_signup(p_event_id uuid)
returns table (
  id     uuid,
  name   text,
  type   text,
  city   text
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select v.id, v.name, v.type::text, v.city
    from venues v
    join event_venues ev on ev.venue_id = v.id
   where ev.event_id = p_event_id
   order by v.name asc;
$$;

-- ============================================================
-- admin_reset_password — super_admin only
-- ============================================================
create or replace function admin_reset_password(
  p_user_id     uuid,
  p_new_password text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if _jwt_claim_primary_role() is distinct from 'super_admin' then
    raise exception 'Only super_admin can reset passwords' using errcode = '42501';
  end if;

  if length(coalesce(p_new_password, '')) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;

  update users
     set password_hash = crypt(p_new_password, gen_salt('bf', 10))
   where id = p_user_id;

  if not found then
    raise exception 'User % not found', p_user_id;
  end if;

  insert into notifications (user_id, type, title, body)
  values (p_user_id, 'generic', 'Password reset by admin',
          'Your password was reset by a super admin. Use the new password shared with you out-of-band to log in.');
end;
$$;

-- ============================================================
-- disable_user — super_admin only
-- ============================================================
create or replace function disable_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if _jwt_claim_primary_role() is distinct from 'super_admin' then
    raise exception 'Only super_admin can disable users' using errcode = '42501';
  end if;

  update users set status = 'disabled' where id = p_user_id;

  if not found then
    raise exception 'User % not found', p_user_id;
  end if;
end;
$$;

-- ============================================================
-- enable_user — super_admin only
-- ============================================================
create or replace function enable_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if _jwt_claim_primary_role() is distinct from 'super_admin' then
    raise exception 'Only super_admin can enable users' using errcode = '42501';
  end if;

  update users set status = 'active' where id = p_user_id;

  if not found then
    raise exception 'User % not found', p_user_id;
  end if;
end;
$$;

-- ============================================================
-- create_sign_and_order — single-transaction new sign + order
-- Called by department_user / signage_hod / super_admin.
-- Inserts an atomic (template-less) sign, a usage_groups row, and
-- a pending usages row, all in one transaction. SECURITY DEFINER so
-- it bypasses RLS for the multi-table insert; we re-check authority
-- against user_role_assignments instead.
-- ============================================================
create or replace function create_sign_and_order(
  p_event_id           uuid,
  p_venue_id           uuid,
  p_zone_id            uuid,
  p_department_id      uuid,
  p_sign_type_id       uuid,
  p_canonical_name     text,
  p_description_lisan  text,
  p_size_id            uuid,
  p_quantity           int,
  p_notes              text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller   uuid;
  v_role     text;
  v_authorised boolean := false;
  v_sign_id  uuid;
  v_group_id uuid;
  v_usage_id uuid;
begin
  v_caller := _jwt_claim_user_id();
  v_role   := _jwt_claim_primary_role();

  if v_caller is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'Quantity must be >= 1';
  end if;

  if length(coalesce(p_canonical_name, '')) = 0 then
    raise exception 'canonical_name is required';
  end if;

  -- Authority check
  if v_role = 'super_admin' then
    v_authorised := true;
  else
    -- department_user matching event+venue+dept
    v_authorised := exists (
      select 1
        from user_role_assignments ura
        join roles r on r.id = ura.role_id
       where ura.user_id      = v_caller
         and r.name           = 'department_user'
         and ura.event_id     = p_event_id
         and ura.venue_id     = p_venue_id
         and ura.department_id = p_department_id
    );

    -- signage_hod matching event+venue (covers all depts at venue)
    if not v_authorised then
      v_authorised := exists (
        select 1
          from user_role_assignments ura
          join roles r on r.id = ura.role_id
         where ura.user_id  = v_caller
           and r.name       = 'signage_hod'
           and ura.event_id = p_event_id
           and ura.venue_id = p_venue_id
      );
    end if;
  end if;

  if not v_authorised then
    raise exception 'Caller has no scope to create orders for event=% venue=% dept=%',
      p_event_id, p_venue_id, p_department_id using errcode = '42501';
  end if;

  -- Reuse an existing atomic sign with the same canonical name (case-insensitive),
  -- otherwise insert a new one. This honours the signs_atomic_unique partial index.
  select id into v_sign_id
    from signs
   where template_id is null
     and lower(canonical_name) = lower(p_canonical_name)
   limit 1;

  if v_sign_id is null then
    insert into signs (
      template_id, slot_values, canonical_name, description_lisan,
      sign_type_id, department_id
    ) values (
      null, null, p_canonical_name, p_description_lisan,
      p_sign_type_id, p_department_id
    )
    returning id into v_sign_id;
  end if;

  -- Usage group (one per call)
  insert into usage_groups (event_id, venue_id, department_id, submitted_by, submitted_at, notes)
  values (p_event_id, p_venue_id, p_department_id, v_caller, now(), p_notes)
  returning id into v_group_id;

  -- Usage (pending)
  insert into usages (
    group_id, sign_id, department_id, event_id, venue_id, zone_id,
    size_id, qty, status, submitted_at, notes, created_by
  ) values (
    v_group_id, v_sign_id, p_department_id, p_event_id, p_venue_id, p_zone_id,
    p_size_id, p_quantity, 'pending', now(), p_notes, v_caller
  )
  returning id into v_usage_id;

  return v_usage_id;
end;
$$;

-- ============================================================
-- Grants
-- ============================================================
revoke all on function signup_request(text,text,text,text,text,uuid,uuid,uuid) from public;
revoke all on function approve_signup(uuid,text)                                from public;
revoke all on function reject_signup(uuid,text)                                  from public;
revoke all on function login(text,text)                                          from public;
revoke all on function get_default_event()                                       from public;
revoke all on function list_departments_for_signup()                             from public;
revoke all on function list_venues_for_signup(uuid)                              from public;
revoke all on function admin_reset_password(uuid,text)                           from public;
revoke all on function disable_user(uuid)                                        from public;
revoke all on function enable_user(uuid)                                         from public;
revoke all on function create_sign_and_order(uuid,uuid,uuid,uuid,uuid,text,text,uuid,int,text) from public;

grant execute on function signup_request(text,text,text,text,text,uuid,uuid,uuid) to web_anon;
grant execute on function login(text,text)                                       to web_anon;
grant execute on function get_default_event()                                    to web_anon, authenticated;
grant execute on function list_departments_for_signup()                          to web_anon, authenticated;
grant execute on function list_venues_for_signup(uuid)                           to web_anon, authenticated;
grant execute on function approve_signup(uuid,text)                              to authenticated;
grant execute on function reject_signup(uuid,text)                               to authenticated;
grant execute on function admin_reset_password(uuid,text)                        to authenticated;
grant execute on function disable_user(uuid)                                     to authenticated;
grant execute on function enable_user(uuid)                                      to authenticated;
grant execute on function create_sign_and_order(uuid,uuid,uuid,uuid,uuid,text,text,uuid,int,text) to authenticated;
