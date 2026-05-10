-- ============================================================
-- ASHARA MUBARAKA SIGNAGE — Schema v7
--
-- Changes from v6:
--   + Events: name, year, is_archived, is_default
--   + Venue Master (reusable across events) with type fasal_city|relay_city
--   + Zones (child of venue) with is_cmz flag
--       - Only one CMZ per venue
--       - CMZ allowed only on fasal_city venues
--   + Event-Venue link (M:N)
--   + Users (ITS Number = username; super-admin approves)
--   + Roles + per-(event,venue,dept) role assignments
--   + Signup wizard intake table
--   + Usages get venue_id + zone_id
--   + Notifications table for status-change pings
-- ============================================================

drop view  if exists print_run_summary       cascade;
drop view  if exists pipeline_kanban         cascade;
drop view  if exists hod_dashboard           cascade;
drop view  if exists sign_history            cascade;
drop view  if exists user_scope              cascade;

drop table if exists notifications           cascade;
drop table if exists usage_status_history    cascade;
drop table if exists usages                  cascade;
drop table if exists usage_groups            cascade;
drop table if exists signs                   cascade;
drop table if exists sign_templates          cascade;
drop table if exists sizes                   cascade;
drop table if exists sign_types              cascade;
drop table if exists user_role_assignments   cascade;
drop table if exists signup_requests         cascade;
drop table if exists users                   cascade;
drop table if exists roles                   cascade;
drop table if exists event_venues            cascade;
drop table if exists zones                   cascade;
drop table if exists venues                  cascade;
drop table if exists departments             cascade;
drop table if exists events                  cascade;

create extension if not exists pgcrypto;

-- ============================================================
-- EVENTS
-- ============================================================
create table events (
  id uuid primary key default gen_random_uuid(),
  name             text not null,
  year             text not null,
  hijri_year       text,
  city             text,
  gregorian_year   int,
  notes            text,
  direction_colour text,
  place_colour     text,
  notice_colour    text,
  brand_primary    text,
  is_archived      boolean not null default false,
  is_default       boolean not null default false,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (name, year),
  constraint default_event_not_archived check (not (is_default and is_archived))
);

create unique index events_only_one_default
  on events ((true)) where is_default = true;

-- ============================================================
-- VENUES (reusable across events)
-- ============================================================
create table venues (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  type      text not null check (type in ('fasal_city', 'relay_city')),
  address   text,
  city      text,
  country   text,
  latitude  numeric,
  longitude numeric,
  capacity  int,
  notes     text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (name, city)
);
create index venues_type_idx on venues(type);

-- ============================================================
-- ZONES (child of venue)
-- ============================================================
create table zones (
  id       uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  name     text not null,
  is_cmz   boolean not null default false,
  notes    text,
  created_at timestamptz default now(),
  unique (venue_id, name)
);

create unique index zones_one_cmz_per_venue
  on zones (venue_id) where is_cmz = true;

create or replace function enforce_cmz_on_fasal_only()
returns trigger as $$
declare v_type text;
begin
  if new.is_cmz then
    select type into v_type from venues where id = new.venue_id;
    if v_type is distinct from 'fasal_city' then
      raise exception 'CMZ zone is only allowed on a fasal_city venue (got %)', v_type;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger zones_cmz_check
  before insert or update on zones
  for each row execute function enforce_cmz_on_fasal_only();

-- ============================================================
-- EVENT ↔ VENUE
-- ============================================================
create table event_venues (
  id       uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  venue_id uuid not null references venues(id) on delete restrict,
  notes    text,
  created_at timestamptz default now(),
  unique (event_id, venue_id)
);
create index event_venues_event_idx on event_venues(event_id);
create index event_venues_venue_idx on event_venues(venue_id);

-- ============================================================
-- DEPARTMENTS
-- ============================================================
create table departments (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  name_lisan    text,
  hod_name      text,
  hod_contact   text,
  display_order int default 0,
  created_at    timestamptz default now()
);

-- ============================================================
-- ROLES
-- ============================================================
create table roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique
              check (name in ('super_admin','signage_hod','signage_production',
                              'department_user','viewer')),
  label       text not null,
  description text
);

-- ============================================================
-- USERS  (ITS Number = username)
-- ============================================================
create table users (
  id              uuid primary key default gen_random_uuid(),
  its_number      text not null unique,
  name            text not null,
  email           text not null unique,
  contact_number  text,
  password_hash   text not null,
  status          text not null default 'pending_approval'
                  check (status in ('pending_approval','active','rejected','disabled')),
  approved_by     uuid references users(id) on delete set null,
  approved_at     timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index users_status_idx on users(status);

-- ============================================================
-- SIGNUP REQUESTS  (wizard intake until SA approves)
-- ============================================================
create table signup_requests (
  id                     uuid primary key default gen_random_uuid(),
  its_number             text not null,
  name                   text not null,
  email                  text not null,
  contact_number         text,
  password_hash          text not null,
  requested_event_id     uuid references events(id)      on delete set null,
  requested_venue_id     uuid references venues(id)      on delete set null,
  requested_department_id uuid references departments(id) on delete set null,
  status                 text not null default 'pending'
                         check (status in ('pending','approved','rejected')),
  rejection_note         text,
  user_id                uuid references users(id) on delete set null,
  reviewed_by            uuid references users(id) on delete set null,
  reviewed_at            timestamptz,
  created_at             timestamptz default now()
);
create index signup_requests_status_idx on signup_requests(status);

-- ============================================================
-- USER ROLE ASSIGNMENTS
-- A user can have many (role, event, venue, dept?) tuples.
-- department_id required for department_user / signage_hod;
-- forbidden for super_admin (super_admin has global scope).
-- ============================================================
create table user_role_assignments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id)        on delete cascade,
  role_id       uuid not null references roles(id)        on delete restrict,
  event_id      uuid references events(id)               on delete cascade,
  venue_id      uuid references venues(id)               on delete cascade,
  department_id uuid references departments(id)          on delete set null,
  created_at    timestamptz default now(),
  unique (user_id, role_id, event_id, venue_id, department_id)
);

create index ura_user_idx       on user_role_assignments(user_id);
create index ura_event_idx      on user_role_assignments(event_id);
create index ura_venue_idx      on user_role_assignments(venue_id);
create index ura_department_idx on user_role_assignments(department_id);

create or replace function enforce_role_scope_rules()
returns trigger as $$
declare r_name text;
begin
  select name into r_name from roles where id = new.role_id;

  if r_name = 'super_admin' then
    if new.event_id is not null or new.venue_id is not null or new.department_id is not null then
      raise exception 'super_admin assignments must have null event/venue/department (global scope)';
    end if;
  elsif r_name = 'department_user' then
    -- Department HOD (UI label) — scoped to a specific dept at a specific venue in an event
    if new.event_id is null or new.venue_id is null or new.department_id is null then
      raise exception 'department_user requires event_id, venue_id, and department_id';
    end if;
  elsif r_name = 'signage_hod' then
    -- Signage HOD — approves all departments at their venue, so no department_id
    if new.event_id is null or new.venue_id is null then
      raise exception 'signage_hod requires event_id and venue_id';
    end if;
    if new.department_id is not null then
      raise exception 'signage_hod must NOT be scoped to a department (covers all departments at the venue)';
    end if;
  elsif r_name in ('signage_production','viewer') then
    if new.event_id is null then
      raise exception '% requires at least event_id', r_name;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger ura_scope_check
  before insert or update on user_role_assignments
  for each row execute function enforce_role_scope_rules();

-- ============================================================
-- SIGN_TYPES (4 ISO + 3 functional)
-- ============================================================
create table sign_types (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique
                check (name in ('prohibition','mandatory','warning','safe_condition',
                                'direction','place','notice')),
  description   text,
  colour_iso    text,
  is_iso        boolean not null default false,
  display_order int default 0,
  created_at    timestamptz default now()
);

-- ============================================================
-- SIGN_TEMPLATES
-- ============================================================
create table sign_templates (
  id             uuid primary key default gen_random_uuid(),
  name           text not null unique,
  display_name   text not null,
  pattern_en     text not null,
  pattern_lisan  text,
  pattern_arabic text,
  sign_type_id   uuid not null references sign_types(id) on delete restrict,
  slot_schema    jsonb not null,
  notes          text,
  created_at     timestamptz default now()
);

-- ============================================================
-- SIZES
-- ============================================================
create table sizes (
  id     uuid primary key default gen_random_uuid(),
  name   text,
  height numeric not null,
  width  numeric not null,
  label  text,
  sqft   numeric generated always as (round((height * width) / 144.0, 2)) stored,
  unique (height, width)
);

-- ============================================================
-- SIGNS (atomic or composite)
-- ============================================================
create table signs (
  id                    uuid primary key default gen_random_uuid(),
  template_id           uuid references sign_templates(id) on delete restrict,
  slot_values           jsonb,
  canonical_name        text not null,
  description_lisan     text,
  description_arabic    text,
  sign_type_id          uuid not null references sign_types(id) on delete restrict,
  -- Hard ownership: every sign belongs to exactly one department.
  -- Department users can only see/manage their own dept's signs (see RLS).
  department_id         uuid not null references departments(id) on delete restrict,
  notes                 text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create unique index signs_composite_unique
  on signs (template_id, slot_values) where template_id is not null;
create unique index signs_atomic_unique
  on signs (lower(canonical_name)) where template_id is null;
create index signs_type_idx       on signs(sign_type_id);
create index signs_template_idx   on signs(template_id);
create index signs_department_idx on signs(department_id);

-- ============================================================
-- USAGE_GROUPS — HOD/department-user submission bundle
-- ============================================================
create table usage_groups (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id)       on delete cascade,
  venue_id      uuid not null references venues(id)       on delete restrict,
  department_id uuid not null references departments(id)  on delete restrict,
  submitted_by  uuid references users(id) on delete set null,
  hod_name      text,
  notes         text,
  submitted_at  timestamptz,
  created_at    timestamptz default now()
);
create index usage_groups_event_idx on usage_groups(event_id);
create index usage_groups_venue_idx on usage_groups(venue_id);
create index usage_groups_dept_idx  on usage_groups(department_id);

-- ============================================================
-- USAGES — historical record + workflow status (now venue+zone scoped)
-- ============================================================
create table usages (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid references usage_groups(id) on delete set null,
  sign_id        uuid not null references signs(id) on delete cascade,
  department_id  uuid not null references departments(id) on delete restrict,
  event_id       uuid not null references events(id) on delete cascade,
  venue_id       uuid not null references venues(id) on delete restrict,
  zone_id        uuid references zones(id) on delete set null,
  size_id        uuid references sizes(id) on delete set null,

  qty            int not null check (qty >= 0),
  material       text,
  design_link    text,

  status         text not null default 'pending'
                 check (status in ('pending','approved','designing','printing',
                                   'ready','rejected','cancelled')),
  rejection_note text,

  submitted_at   timestamptz,
  approved_at    timestamptz,
  printed_at     timestamptz,
  ready_at       timestamptz,

  notes          text,
  created_by     uuid references users(id) on delete set null,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create index usages_sign_idx        on usages(sign_id);
create index usages_dept_idx        on usages(department_id);
create index usages_event_idx       on usages(event_id);
create index usages_venue_idx       on usages(venue_id);
create index usages_zone_idx        on usages(zone_id);
create index usages_status_idx      on usages(status);
create index usages_event_dept_idx  on usages(event_id, department_id);
create index usages_event_venue_idx on usages(event_id, venue_id);
create index usages_group_idx       on usages(group_id);

-- Enforce: usage's (event, venue) must be in event_venues
create or replace function enforce_event_venue_link()
returns trigger as $$
begin
  if not exists (
    select 1 from event_venues
     where event_id = new.event_id
       and venue_id = new.venue_id
  ) then
    raise exception 'Venue % is not tagged to event %', new.venue_id, new.event_id;
  end if;

  -- zone (if given) must belong to that venue
  if new.zone_id is not null then
    if not exists (
      select 1 from zones where id = new.zone_id and venue_id = new.venue_id
    ) then
      raise exception 'Zone % does not belong to venue %', new.zone_id, new.venue_id;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger usages_event_venue_check
  before insert or update on usages
  for each row execute function enforce_event_venue_link();

create trigger usage_groups_event_venue_check
  before insert or update on usage_groups
  for each row execute function enforce_event_venue_link();

-- ============================================================
-- USAGE_STATUS_HISTORY — audit log
-- ============================================================
create table usage_status_history (
  id              uuid primary key default gen_random_uuid(),
  usage_id        uuid not null references usages(id) on delete cascade,
  from_status     text,
  to_status       text not null,
  changed_by      uuid references users(id) on delete set null,
  changed_by_name text,
  comment         text,
  changed_at      timestamptz default now()
);

-- ============================================================
-- NOTIFICATIONS — status-change pings to requester
-- ============================================================
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  usage_id    uuid references usages(id) on delete cascade,
  type        text not null
              check (type in ('status_change','signup_approved','signup_rejected',
                              'request_approved','request_rejected','generic')),
  title       text not null,
  body        text,
  read_at     timestamptz,
  created_at  timestamptz default now()
);
create index notifications_user_idx   on notifications(user_id);
create index notifications_unread_idx on notifications(user_id) where read_at is null;

-- ============================================================
-- TRIGGERS — updated_at, status history, status notifications
-- ============================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger events_updated_at  before update on events  for each row execute function set_updated_at();
create trigger venues_updated_at  before update on venues  for each row execute function set_updated_at();
create trigger users_updated_at   before update on users   for each row execute function set_updated_at();
create trigger signs_updated_at   before update on signs   for each row execute function set_updated_at();
create trigger usages_updated_at  before update on usages  for each row execute function set_updated_at();

create or replace function track_usage_status() returns trigger as $$
declare requester uuid;
begin
  if (TG_OP = 'INSERT') then
    insert into usage_status_history (usage_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, new.created_by);
    return new;
  end if;

  if (old.status is distinct from new.status) then
    insert into usage_status_history (usage_id, from_status, to_status)
    values (new.id, old.status, new.status);

    -- notify the user who created the usage
    if new.created_by is not null then
      insert into notifications (user_id, usage_id, type, title, body)
      values (new.created_by, new.id, 'status_change',
              'Sign request status: ' || new.status,
              'Your request status changed from ' || old.status || ' to ' || new.status);
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger usages_status_track
  after insert or update on usages
  for each row execute function track_usage_status();

-- ============================================================
-- VIEWS
-- ============================================================
create view sign_history as
select
  s.id,
  s.canonical_name,
  s.template_id,
  t.display_name as template_display_name,
  st.name as sign_type,
  s.description_lisan,
  s.description_arabic,
  s.slot_values,
  s.department_id,
  sd.name        as department_name,
  sd.name_lisan  as department_name_lisan,
  count(distinct u.event_id) as years_used,
  count(u.id) as total_orders,
  coalesce(sum(u.qty), 0) as total_qty_all_time,
  max(e.year) as last_used_year,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'event',      e.name || ' / ' || e.year,
        'venue',      v.name,
        'zone',       z.name,
        'department', d.name,
        'qty',        u.qty,
        'status',     u.status,
        'height',     sz.height,
        'width',      sz.width
      ) order by e.year desc, u.qty desc
    ) filter (where u.id is not null),
    '[]'::jsonb
  ) as history
from signs s
join sign_types st           on st.id = s.sign_type_id
join departments sd          on sd.id = s.department_id
left join sign_templates t   on t.id = s.template_id
left join usages u           on u.sign_id = s.id
left join events e           on e.id = u.event_id
left join venues v           on v.id = u.venue_id
left join zones z            on z.id = u.zone_id
left join departments d      on d.id = u.department_id
left join sizes sz           on sz.id = u.size_id
group by s.id, t.display_name, st.name, sd.name, sd.name_lisan;

create view hod_dashboard as
select
  d.id            as department_id,
  d.name          as department_name,
  e.id            as event_id,
  e.name          as event_name,
  e.year          as event_year,
  e.city          as event_city,
  v.id            as venue_id,
  v.name          as venue_name,
  v.type          as venue_type,
  z.id            as zone_id,
  z.name          as zone_name,
  z.is_cmz        as zone_is_cmz,
  s.id            as sign_id,
  s.canonical_name,
  s.template_id,
  t.name          as template_name,
  t.display_name  as template_display_name,
  s.slot_values,
  st.name         as sign_type,
  st.is_iso,
  st.colour_iso,
  case
    when st.is_iso then st.colour_iso
    when st.name = 'direction' then e.direction_colour
    when st.name = 'place'     then e.place_colour
    when st.name = 'notice'    then e.notice_colour
  end as resolved_colour,
  u.id            as usage_id,
  u.qty,
  u.status,
  sz.id           as size_id,
  sz.label        as size_label
from usages u
join signs s         on s.id = u.sign_id
join sign_types st   on st.id = s.sign_type_id
left join sign_templates t on t.id = s.template_id
join departments d   on d.id = u.department_id
join events e        on e.id = u.event_id
join venues v        on v.id = u.venue_id
left join zones z    on z.id = u.zone_id
left join sizes sz   on sz.id = u.size_id;

create view pipeline_kanban as
select
  u.id as usage_id,
  u.status,
  u.qty,
  u.rejection_note,
  s.canonical_name,
  s.template_id is not null as is_variable,
  st.name as sign_type,
  d.name as department_name,
  v.name as venue_name,
  v.type as venue_type,
  z.name as zone_name,
  e.name || ' / ' || e.year as event_label,
  sz.label as size_label,
  u.submitted_at,
  u.approved_at,
  u.created_at
from usages u
join signs s         on s.id = u.sign_id
join sign_types st   on st.id = s.sign_type_id
join departments d   on d.id = u.department_id
join events e        on e.id = u.event_id
join venues v        on v.id = u.venue_id
left join zones z    on z.id = u.zone_id
left join sizes sz   on sz.id = u.size_id;

create view print_run_summary as
select
  e.name || ' / ' || e.year as event_label,
  v.name as venue_name,
  coalesce(t.display_name, 'Atomic: ' || s.canonical_name) as design_unit,
  t.id as template_id,
  s.id as sign_id,
  st.name as sign_type,
  count(u.id) as line_items,
  sum(u.qty) as total_prints,
  jsonb_agg(distinct s.slot_values) filter (where s.slot_values is not null) as variant_values,
  jsonb_agg(distinct sz.label) as sizes
from usages u
join signs s         on s.id = u.sign_id
join sign_types st   on st.id = s.sign_type_id
left join sign_templates t on t.id = s.template_id
join events e        on e.id = u.event_id
join venues v        on v.id = u.venue_id
left join sizes sz   on sz.id = u.size_id
where u.status in ('approved','designing','printing','ready')
group by e.name, e.year, v.name, t.id, t.display_name, s.id, s.canonical_name, st.name;

-- A handy view: what scopes does each user have?
create view user_scope as
select
  u.id            as user_id,
  u.its_number,
  u.name          as user_name,
  u.email,
  u.status        as user_status,
  r.name          as role_name,
  r.label         as role_label,
  ura.event_id,   e.name as event_name, e.year as event_year,
  ura.venue_id,   v.name as venue_name, v.type as venue_type,
  ura.department_id, d.name as department_name
from users u
join user_role_assignments ura on ura.user_id = u.id
join roles r        on r.id = ura.role_id
left join events e  on e.id = ura.event_id
left join venues v  on v.id = ura.venue_id
left join departments d on d.id = ura.department_id;

-- ============================================================
-- SEED: roles
-- ============================================================
insert into roles (name, label, description) values
  ('super_admin',        'Super Admin',         'Global access; approves users, manages all masters, can switch between events'),
  ('signage_hod',        'Signage HOD',         'Approves sign requests for all departments at their assigned event+venue'),
  ('signage_production', 'Signage Production',  'Updates production status: designing → printing → ready'),
  ('department_user',    'Department HOD',      'Places sign orders on behalf of their department at a specific event+venue'),
  ('viewer',             'Viewer',              'Read-only on the assigned event');

-- ============================================================
-- SEED: sign_types
-- ============================================================
insert into sign_types (name, description, colour_iso, is_iso, display_order) values
  ('prohibition',    'Forbids an action',                              '#A32D2D', true, 1),
  ('warning',        'Warns of a hazard',                              '#BA7517', true, 2),
  ('mandatory',      'Requires an action',                             '#185FA5', true, 3),
  ('safe_condition', 'Indicates safe condition / emergency equipment', '#3B6D11', true, 4),
  ('direction',      'Wayfinding / directional',                        null,     false, 5),
  ('place',          'Names of places, rooms, mohallas',                null,     false, 6),
  ('notice',         'General information',                             null,     false, 7);

-- ============================================================
-- SEED: events  (1447 Chennai is the default)
-- ============================================================
insert into events (name, year, hijri_year, city, gregorian_year, notes, is_default) values
  ('Ashara Mubaraka 1445', '1445', '1445', 'Dubai',   2024, 'No signage data captured', false),
  ('Ashara Mubaraka 1446', '1446', '1446', 'Karachi', 2025, 'No signage data captured', false),
  ('Ashara Mubaraka 1447', '1447', '1447', 'Chennai', 2026, 'First fully tracked event', true);

-- ============================================================
-- SEED: departments (32 canonical)
-- ============================================================
insert into departments (name, display_order) values
  ('Zakireen', 1),
  ('Signage / Venue Maps', 2),
  ('Bethak', 3),
  ('Mazaraat', 4),
  ('Al-Vazarat Follow Up', 5),
  ('PMO', 6),
  ('Qasar Mubarak', 7),
  ('Zones', 8),
  ('Tazyeen', 9),
  ('Laundry', 10),
  ('Human Resources', 11),
  ('ITS', 12),
  ('Waaz Talaqqi & Ohbat', 13),
  ('Communications', 14),
  ('Sehat, Medical', 15),
  ('Food Hygiene & Safety', 16),
  ('Karama', 17),
  ('Security', 18),
  ('Accommodation', 19),
  ('Fire Safety / HSE', 20),
  ('Central Office', 21),
  ('IT Services', 22),
  ('Mumineen Mehmaan Reception', 23),
  ('Nazafat', 24),
  ('Flow Management', 25),
  ('Transport', 26),
  ('Mawaid', 27),
  ('AVRP', 28),
  ('Construction', 29),
  ('PR / Govt Relations', 30),
  ('Procurement', 31),
  ('Finance', 32);

-- ============================================================
-- SEED: example venue + zones for 1447 Chennai
-- (REPLACE these with real data once known)
-- ============================================================
insert into venues (name, type, city, country) values
  ('Saifee Nagar Chennai', 'fasal_city', 'Chennai', 'India'),
  ('Marina Relay',         'relay_city', 'Chennai', 'India');

-- Tag both venues to the 1447 event
insert into event_venues (event_id, venue_id)
select e.id, v.id
  from events e, venues v
 where e.year = '1447' and v.name in ('Saifee Nagar Chennai','Marina Relay');

-- Add zones; mark one as CMZ on the fasal city
insert into zones (venue_id, name, is_cmz)
select v.id, z.name, z.is_cmz from venues v
  join (values
    ('Saifee Nagar Chennai', 'CMZ',           true),
    ('Saifee Nagar Chennai', 'Zone A',        false),
    ('Saifee Nagar Chennai', 'Zone B',        false),
    ('Marina Relay',         'Hall 1',        false),
    ('Marina Relay',         'Hall 2',        false)
  ) as z(venue_name, name, is_cmz) on z.venue_name = v.name;

-- ============================================================
-- DONE.
-- ============================================================
