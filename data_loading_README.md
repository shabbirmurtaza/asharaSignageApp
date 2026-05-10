# Data Loading — How It Works

## TL;DR

`schema_v7.sql` alone gives you the masters but no signs and no users. You need to run **3 SQL files in order** for a working system:

```bash
psql $DATABASE_URL -f schema_v7.sql           # 1. Schema + masters
psql $DATABASE_URL -f seed_signs.sql          # 2. Signs + templates + usages from xlsx
psql $DATABASE_URL -f seed_bootstrap_admin.sql  # 3. First super_admin user
```

After this, real users sign up via the app and the super admin approves them.

---

## What populates what

```
┌──────────────────────────┐
│  schema_v7.sql           │  ────►  Tables + masters baseline
│                          │         • roles (5)
│                          │         • sign_types (7)
│                          │         • events (3, 1447 = default)
│                          │         • departments (32)
│                          │         • venues (2 placeholder)
│                          │         • zones (5 placeholder, 1 CMZ)
│                          │         • event_venues (2 links)
└──────────────────────────┘

┌──────────────────────────┐
│  seed_signs.sql          │  ────►  Catalogue data from xlsx
│  (generated from         │         • sign_templates (6)
│   signage_data_v5.xlsx)  │         • sizes (6)
│                          │         • signs (187)
│                          │         • usages (199, all on Saifee Nagar / CMZ)
└──────────────────────────┘

┌──────────────────────────┐
│  seed_bootstrap_admin.sql│  ────►  First user
│                          │         • users (1: ITS=00000000, password=changeme)
│                          │         • user_role_assignments (1: super_admin global)
└──────────────────────────┘

┌──────────────────────────┐
│  Live operation          │  ────►  Real data populates
│  via the React app       │         • signup_requests → users (after SA approval)
│                          │         • user_role_assignments (added by SA)
│                          │         • usage_groups + usages (from request flow)
│                          │         • usage_status_history (auto via trigger)
│                          │         • notifications (auto via trigger)
└──────────────────────────┘
```

---

## Things you should change before running

### 1. Replace placeholder venues + zones (in `schema_v7.sql`)

The file seeds `Saifee Nagar Chennai` and `Marina Relay` as placeholders. Find this block near the bottom:

```sql
insert into venues (name, type, city, country) values
  ('Saifee Nagar Chennai', 'fasal_city', 'Chennai', 'India'),
  ('Marina Relay',         'relay_city', 'Chennai', 'India');
```

Replace with your real venue list. Then update `seed_signs.sql` — it hardcodes `'Saifee Nagar Chennai'` and zone `'CMZ'` for the historical usages. Either keep the placeholder name to match, or change both.

### 2. Change the bootstrap admin password

In `seed_bootstrap_admin.sql`, change:

```sql
crypt('changeme', gen_salt('bf', 10))
```

to a real password before running in production. Or run as-is, log in, and change it via the UI on first login.

### 3. Confirm the data attribution assumption

`seed_signs.sql` attributes every historical usage to **Saifee Nagar Chennai → CMZ**, because the original xlsx didn't track venue or zone (those concepts are new in v7). If you want a different default — or if you have the real venue/zone for each historical usage — you'll need to either:

- edit the generated SQL (find/replace), or
- regenerate it from an updated xlsx with venue/zone columns.

---

## Verification queries

After running all three files:

```sql
-- Should match these counts
select 'roles' as t, count(*) from roles                        -- 5
union all select 'sign_types',     count(*) from sign_types        -- 7
union all select 'events',         count(*) from events            -- 3
union all select 'departments',    count(*) from departments       -- 32
union all select 'venues',         count(*) from venues            -- 2
union all select 'zones',          count(*) from zones             -- 5
union all select 'event_venues',   count(*) from event_venues      -- 2
union all select 'sign_templates', count(*) from sign_templates    -- 6
union all select 'sizes',          count(*) from sizes             -- 6
union all select 'signs',          count(*) from signs             -- 187
union all select 'usages',         count(*) from usages            -- 199
union all select 'users',          count(*) from users             -- 1
union all select 'role_asgmts',    count(*) from user_role_assignments;  -- 1

-- Default event check
select name, year, is_default, is_archived from events where is_default;
-- expect: Ashara Mubaraka 1447 / 1447 / true / false

-- CMZ uniqueness check
select v.name, z.name, z.is_cmz from zones z
  join venues v on v.id = z.venue_id where z.is_cmz;
-- expect: Saifee Nagar Chennai / CMZ / true  (exactly one row)

-- Bootstrap admin check
select user_name, role_name, event_id, venue_id, department_id
  from user_scope where its_number = '00000000';
-- expect: Bootstrap Super Admin / super_admin / null / null / null
```

---

## What does NOT get populated by these scripts

- **Real users** — they sign up via `/signup` in the app. Each becomes a `signup_requests` row, then a `users` + `user_role_assignments` row after super-admin approval.
- **New sign requests** — created via the app's department/HOD flows, become `usage_groups` + `usages` rows.
- **Status history + notifications** — auto-populated by triggers when usages change status. You don't insert into these tables directly.
- **Per-event brand colours** (`events.direction_colour` etc.) — set by super admin via the Event Setup screen once the Miqaat logo is finalised.

---

## If you need to reset

```bash
psql $DATABASE_URL -c "drop schema public cascade; create schema public;"
psql $DATABASE_URL -f schema_v7.sql
psql $DATABASE_URL -f seed_signs.sql
psql $DATABASE_URL -f seed_bootstrap_admin.sql
```

`schema_v7.sql` already starts with `drop table if exists ... cascade` for every table, so re-running it is safe — but `drop schema public cascade` is the cleanest reset because it also clears any extra objects you may have created.
