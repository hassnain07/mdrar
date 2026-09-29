-- ═══════════════════════════════════════════════════════════════════════════
-- MDRAR DATABASE RESET SCRIPT
-- Clears ALL data and creates a single super_admin user.
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → paste this entire script → Run
--
-- SUPER ADMIN CREDENTIALS AFTER RESET:
--   Email    : admin@mdrar.sa
--   Password : Admin@1234
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 1: Disable triggers so cascades don't conflict
-- ───────────────────────────────────────────────────────────────────────────
set session_replication_role = replica;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 2: Truncate every application table (leaf → root order)
-- ───────────────────────────────────────────────────────────────────────────
truncate table
  ipc_attachments,
  ipc_entries,
  risk_photos,
  project_risks,
  project_documents,
  document_categories,
  activity_photos,
  project_activities,
  project_unit_instances,
  project_unit_types,
  project_managers,
  projects,
  request_timeline_events,
  requests,
  messages,
  notifications,
  announcements,
  preferences,
  property_documents,
  leases,
  technicians,
  property_managers,
  properties,
  profiles
cascade;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 3: Delete ALL auth users
-- ───────────────────────────────────────────────────────────────────────────
delete from auth.identities;
delete from auth.sessions;
delete from auth.refresh_tokens;
delete from auth.mfa_factors;
delete from auth.users;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 4: Reset the request ID sequence
-- ───────────────────────────────────────────────────────────────────────────
alter sequence if exists requests_id_seq restart with 1001;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 5: Re-enable triggers
-- ───────────────────────────────────────────────────────────────────────────
set session_replication_role = default;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 6: Create the super_admin auth user
--   We insert directly into auth.users with a bcrypt-hashed password.
--   The on_auth_user_created trigger will auto-create the profile + preferences.
-- ───────────────────────────────────────────────────────────────────────────
do $$
declare
  v_uid uuid := gen_random_uuid();
  v_now timestamptz := now();
begin
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) values (
    v_uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@mdrar.sa',
    crypt('Admin@1234', gen_salt('bf')),
    v_now,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"مدير النظام","full_name_en":"System Administrator","role":"super_admin"}'::jsonb,
    v_now,
    v_now,
    '',
    '',
    '',
    ''
  );

  -- Also insert the identity record so email/password login works
  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    v_uid,
    'admin@mdrar.sa',
    jsonb_build_object('sub', v_uid::text, 'email', 'admin@mdrar.sa'),
    'email',
    v_now,
    v_now,
    v_now
  );
end;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 7: Verify — should return exactly 1 row
-- ───────────────────────────────────────────────────────────────────────────
select
  u.email,
  p.full_name_en  as name,
  p.role,
  u.created_at
from auth.users u
join public.profiles p on p.id = u.id;
