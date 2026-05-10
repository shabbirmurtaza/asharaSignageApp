-- ============================================================
-- BOOTSTRAP: seed the first super_admin user
-- Run AFTER schema_v7.sql.
--
-- Without this, the system has no users, so nobody can log in
-- and nobody can approve signups. This file creates one super_admin
-- so you can log in and start operating.
--
-- Default credentials:
--   ITS Number:  00000000
--   Password:    changeme
--
-- The password is hashed with pgcrypto's crypt() using bf (blowfish/bcrypt).
-- Login function should verify with: crypt(input_password, password_hash) = password_hash
--
-- CHANGE THIS PASSWORD IMMEDIATELY in production.
-- ============================================================

create extension if not exists pgcrypto;

insert into users (its_number, name, email, password_hash, status, approved_at)
values (
  '00000000',
  'Bootstrap Super Admin',
  'admin@example.com',
  crypt('changeme', gen_salt('bf', 10)),
  'active',
  now()
)
on conflict (its_number) do nothing;

-- Self-approve: set approved_by = own id (super admin approved themselves at bootstrap)
update users
   set approved_by = id
 where its_number = '00000000'
   and approved_by is null;

-- Assign super_admin role (global scope: null event/venue/department)
insert into user_role_assignments (user_id, role_id, event_id, venue_id, department_id)
select
  (select id from users where its_number = '00000000'),
  (select id from roles where name = 'super_admin'),
  null, null, null
on conflict do nothing;

-- ============================================================
-- Sanity checks
-- ============================================================
-- select * from user_scope where its_number = '00000000';
-- expect: 1 row with role_name = 'super_admin', null event/venue/dept
