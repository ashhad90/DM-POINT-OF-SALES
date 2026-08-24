-- ============================================================
-- Demo users — run AFTER schema.sql (safe to re-run).
-- Creates two auth users with known passwords and ensures
-- their profiles rows exist with the right roles.
--
--   Admin:   admin@pos.local   / admin12345
--   Cashier: cashier@pos.local / cashier123
-- ============================================================

create extension if not exists "pgcrypto";

-- Admin user
insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@pos.local',
  crypt('admin12345', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"role":"admin","full_name":"Store Admin"}',
  now(),
  now()
where not exists (select 1 from auth.users where email = 'admin@pos.local');

-- Cashier user
insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'cashier@pos.local',
  crypt('cashier123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"role":"cashier","full_name":"Cashier User"}',
  now(),
  now()
where not exists (select 1 from auth.users where email = 'cashier@pos.local');

-- Ensure profile rows match (works whether the trigger fired or not)
insert into public.profiles (id, full_name, role)
select id, raw_user_meta_data->>'full_name', raw_user_meta_data->>'role'
from auth.users
where email in ('admin@pos.local', 'cashier@pos.local')
on conflict (id) do update set
  full_name = excluded.full_name,
  role = excluded.role;
