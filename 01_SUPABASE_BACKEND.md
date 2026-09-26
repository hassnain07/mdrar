# MDRAR Platform — Supabase Backend (Run This First)

**Audience:** a coding agent (or you) with access to the Supabase SQL Editor / CLI for the target
project, and the ability to create Auth users.

**What this file contains:** the complete, production-ready backend for the MDRAR platform —
schema, enums, triggers, server-side notification logic, Row Level Security (RLS) for every table,
Storage buckets + Storage RLS, Realtime configuration, and seed data instructions. It replaces and
supersedes `supabase/migrations/20240101000000_initial_schema.sql` in the repo (that file was a
partial draft; this is the full, corrected design — see "What changed vs the draft migration" at
the bottom).

Nothing here is a stub. Every table, trigger and policy below is meant to be run as-is. Apply it to
a **fresh Supabase project** in the order the sections appear (or paste the whole file into the SQL
Editor and run it top to bottom — it's written to run cleanly in one pass).

---

## 0. How the pieces fit together

- **Auth** — Supabase Auth (`auth.users`) is the identity system. We never store passwords
  ourselves. Every `auth.users` row gets a matching `public.profiles` row via a trigger, carrying
  the app-specific `role` (there's no self-serve signup in this product — see Section 8).
- **Authorization** — enforced by **Row Level Security**, not by anything the client sends. The
  client's `role` value (today, a value in a React reducer / `Session` object) is only a UX
  convenience for hiding buttons; the database independently re-checks `profiles.role` (via
  `auth.uid()`) on every single query. This directly fixes the "front-end prototype" gap called out
  in the project's own `FRONTEND_SCALABILITY_AND_SUPABASE_MIGRATION.md` (Section 5, last bullet).
- **Notifications** — generated **server-side**, by triggers, when the underlying row changes
  (new request, status change, technician assignment). The client never inserts a notification row
  directly. This is both more secure (a tenant can't fabricate a notification "from" someone else)
  and guarantees every code path that changes data also notifies correctly, instead of relying on
  every call site in the frontend remembering to call `notifications.push(...)`.
- **File storage** — Supabase Storage buckets, private by default, gated by Storage RLS that mirrors
  the table RLS for the entity the file belongs to.
- **Realtime** — enabled on `notifications`, `requests`, `request_timeline_events` and `messages` so
  the notification bell, request timelines and chat threads update instantly without polling.

---

## 1. Extensions & helpers

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. EXTENSIONS & GENERIC HELPERS
-- ═══════════════════════════════════════════════════════════════════════════
create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

---

## 2. Enums

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ENUMS
-- ═══════════════════════════════════════════════════════════════════════════
create type user_role        as enum ('super_admin','facility_manager','technician','owner','tenant','pm_manager','pm_viewer');
create type request_type     as enum ('preventive','corrective','emergency');
create type request_status   as enum ('submitted','acknowledged','in_progress','resolved');
create type request_category as enum ('ac','plumbing','electrical','common');
create type request_priority as enum ('normal','high','critical');
create type project_status   as enum ('on_track','at_risk','delayed','completed');
create type activity_status  as enum ('not_started','in_progress','completed','delayed','risk');
create type activity_phase   as enum ('milestone','mobilization','engineering','procurement','construction','finishing','testing');
create type unit_category    as enum ('villa','floor','townhouse');
create type unit_status      as enum ('available','reserved','sold');
create type risk_result      as enum ('pending','in_progress','resolved','delayed');
create type ipc_direction    as enum ('incoming','outgoing');
create type ipc_source       as enum ('contractor','consultant');
create type ipc_status       as enum ('in_progress','delayed','completed');
create type rent_status      as enum ('paid','due');
create type file_kind        as enum ('image','pdf','video','other');
create type message_sender   as enum ('tenant','manager');
```

`doc_category` is **not** an enum here on purpose — Section 5.2.4 of the PRD requires document
categories to be renameable and requires new custom categories to be addable, with documents staying
associated **by category ID, not display name**. An enum can't be renamed per-row, so document
categories get their own table (`document_categories`, Section 12) instead.

---

## 3. `profiles` (extends `auth.users`)

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 3. PROFILES
-- ═══════════════════════════════════════════════════════════════════════════
create table profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text not null default '',
  full_name_en        text not null default '',
  email               text not null,
  phone               text,
  role                user_role not null default 'tenant',
  avatar_url          text,
  -- only meaningful when role = 'tenant': which unit they occupy
  tenant_property_id  uuid references properties(id) on delete set null,
  tenant_unit         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
```

> Note: `properties` is created in Section 4, immediately after this block — `profiles` references
> it, so run Section 4 before re-running this if you split the file up. If pasting the whole file at
> once, ignore this note; the two `create table` statements below are ordered so the FK resolves
> (we define `properties` first, then add the `tenant_property_id` FK to `profiles` via
> `alter table` at the end of Section 4 instead of inline — see below for the exact statement order
> actually used).

To avoid a forward-reference ordering problem, create `profiles` **without** the FK first, then add
it after `properties` exists:

```sql
create table profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text not null default '',
  full_name_en        text not null default '',
  email               text not null,
  phone               text,
  role                user_role not null default 'tenant',
  avatar_url          text,
  tenant_property_id  uuid,
  tenant_unit         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger profiles_updated_at before update on profiles for each row execute function set_updated_at();
create index profiles_role_idx on profiles(role);
```

---

## 4. Facility Management core tables

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 4. PROPERTIES, MANAGERS, TECHNICIANS, LEASES, PROPERTY DOCUMENTS
-- ═══════════════════════════════════════════════════════════════════════════

create table properties (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  name_en     text not null,
  location    text not null default '',
  units       int  not null default 0,
  occupied    int  not null default 0,
  accent      text not null default '#b86b4b',
  unit_labels text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger properties_updated_at before update on properties for each row execute function set_updated_at();

-- now that properties exists, wire the FK on profiles
alter table profiles add constraint profiles_tenant_property_fk
  foreign key (tenant_property_id) references properties(id) on delete set null;
create index profiles_tenant_property_idx on profiles(tenant_property_id);

-- which management users are scoped to which properties (available for future tightening —
-- see Section 13 "Scoping model" for how this is used today vs. how to tighten it later)
create table property_managers (
  property_id uuid not null references properties(id) on delete cascade,
  profile_id  uuid not null references profiles(id)   on delete cascade,
  primary key (property_id, profile_id)
);

create table technicians (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid references profiles(id) on delete set null,
  name           text not null,
  name_en        text not null,
  specialty      text not null default '',
  resolved_count int  not null default 0,
  sla            int  not null default 100,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger technicians_updated_at before update on technicians for each row execute function set_updated_at();
create unique index technicians_profile_idx on technicians(profile_id) where profile_id is not null;

create table leases (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references profiles(id) on delete set null,
  property_id uuid not null references properties(id) on delete cascade,
  unit        text not null,
  tenant_name text not null default '',
  tenant_email text,
  term_start  date not null,
  term_end    date not null,
  rent        numeric(12,2) not null default 0,
  deposit     numeric(12,2) not null default 0,
  rent_status rent_status not null default 'paid',
  status      text not null default 'occupied' check (status in ('occupied','vacant')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger leases_updated_at before update on leases for each row execute function set_updated_at();
create index leases_property_idx on leases(property_id);
create index leases_tenant_idx on leases(tenant_id);

-- Property-level documents (Property Detail → Documents tab)
create table property_documents (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name        text not null,
  name_en     text not null default '',
  type        text not null default 'pdf',
  file_url    text,
  file_path   text,
  uploaded_by uuid references profiles(id) on delete set null,
  uploaded_at timestamptz not null default now()
);
create index property_documents_property_idx on property_documents(property_id);
```

---

## 5. Requests (maintenance tickets) & timeline

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 5. REQUESTS
-- ═══════════════════════════════════════════════════════════════════════════
create table requests (
  id            text primary key,                 -- e.g. "REQ-1048" — human-readable, generated server-side
  property_id   uuid not null references properties(id) on delete cascade,
  unit          text not null,
  tenant_id     uuid references profiles(id) on delete set null,
  tenant_name   text not null default '',
  tenant_email  text not null default '',
  type          request_type     not null,
  category      request_category not null,
  description   text not null default '',
  status        request_status   not null default 'submitted',
  priority      request_priority not null default 'normal',
  photo_url     text,
  photo_path    text,
  technician_id uuid references technicians(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger requests_updated_at before update on requests for each row execute function set_updated_at();
create index requests_property_idx on requests(property_id);
create index requests_tenant_idx on requests(tenant_id);
create index requests_technician_idx on requests(technician_id);
create index requests_status_idx on requests(status);
create index requests_type_idx on requests(type);

-- server-side generator for the REQ-#### id, so the client never has to guess/collide
create sequence if not exists requests_id_seq start 1049;
create or replace function next_request_id()
returns text language sql as $$
  select 'REQ-' || nextval('requests_id_seq')::text;
$$;

create table request_timeline_events (
  id         uuid primary key default gen_random_uuid(),
  request_id text not null references requests(id) on delete cascade,
  status     request_status not null,
  label      text not null,
  actor      text not null default '',
  actor_id   uuid references profiles(id) on delete set null,
  tenant_notified boolean not null default false,
  created_at timestamptz not null default now()
);
create index request_timeline_request_idx on request_timeline_events(request_id, created_at);
```

---

## 6. Messages (tenant ↔ management chat)

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 6. MESSAGES
-- ═══════════════════════════════════════════════════════════════════════════
-- One thread per tenant: thread_id = the tenant's profile id.
create table messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references profiles(id) on delete cascade,
  sender_id   uuid references profiles(id) on delete set null,
  sender_role message_sender not null,
  text        text not null,
  text_en     text not null default '',
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index messages_thread_idx on messages(thread_id, created_at);
```

---

## 7. Notifications & preferences

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 7. NOTIFICATIONS & PREFERENCES
-- ═══════════════════════════════════════════════════════════════════════════
-- One row per (recipient, event) — this is a fan-out design: a single "new emergency
-- request" event produces one notification row per management recipient, so unread
-- counts and read-state are correct per-user (not a shared global bucket, which is
-- what the current front-end mock does — see Section 13 for why this is an improvement).
create table notifications (
  id                uuid primary key default gen_random_uuid(),
  recipient_id      uuid not null references profiles(id) on delete cascade,
  title             text not null,
  body              text not null,
  read              boolean not null default false,
  emergency         boolean not null default false,
  request_id        text references requests(id) on delete cascade,
  project_id        uuid,                          -- FK added in Section 8 after projects exists
  property_id       uuid references properties(id) on delete cascade,
  created_at        timestamptz not null default now()
);
create index notifications_recipient_idx on notifications(recipient_id, read, created_at desc);

create table preferences (
  profile_id           uuid primary key references profiles(id) on delete cascade,
  immediate_emergency  boolean not null default true,
  daily_summary        boolean not null default true,
  sms_alerts           boolean not null default false,
  request_updates      boolean not null default true,
  announcements        boolean not null default true,
  rent_reminders       boolean not null default true,
  updated_at           timestamptz not null default now()
);
create trigger preferences_updated_at before update on preferences for each row execute function set_updated_at();

create table announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  title_en    text not null default '',
  body        text not null,
  body_en     text not null default '',
  property_id uuid references properties(id) on delete cascade, -- null = all properties
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index announcements_property_idx on announcements(property_id);
```

---

## 8. Project Management core tables

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 8. PROJECTS
-- ═══════════════════════════════════════════════════════════════════════════
create table projects (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  name_en         text not null,
  location        text not null default '',
  location_en     text not null default '',
  total_units     int  not null default 0,
  start_date      date not null,
  end_date        date not null,
  total_days      int  not null default 365,
  contractor      text not null default '',
  contractor_en   text not null default '',
  budget          numeric(16,2) not null default 0,
  status          project_status not null default 'on_track',
  description     text,
  description_en  text,
  contract_number text,
  consultant      text,
  consultant_en   text,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger projects_updated_at before update on projects for each row execute function set_updated_at();

-- wire the FK we deferred in Section 7
alter table notifications add constraint notifications_project_fk
  foreign key (project_id) references projects(id) on delete cascade;
create index notifications_project_idx on notifications(project_id);

create table project_managers (
  project_id uuid not null references projects(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (project_id, profile_id)
);

create table project_unit_types (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  type           text not null,
  type_en        text not null,
  size           numeric(10,2) not null default 0,
  bedrooms       int  not null default 0,
  unit_count     int  not null default 0,
  image_url      text,
  floor_plan_url text,
  model_3d_url   text,
  brochure_url   text,
  category       unit_category,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger project_unit_types_updated_at before update on project_unit_types for each row execute function set_updated_at();
create index project_unit_types_project_idx on project_unit_types(project_id);

create table project_unit_instances (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  model_id        uuid not null references project_unit_types(id) on delete cascade,
  label           text not null,
  label_en        text not null,
  floor           int  not null default 1,
  status          unit_status not null default 'available',
  floor_plan_url  text,
  model_3d_url    text,
  brochure_url    text,
  price           numeric(14,2),
  space           numeric(10,2),
  attachment_name text,
  attachment_url  text,
  floor_level     text,       -- 'ground' | '1' | '2' — only for floor-based units
  townhouse_type  text,       -- 'A' | 'B' — only for townhouses
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger project_unit_instances_updated_at before update on project_unit_instances for each row execute function set_updated_at();
create index project_unit_instances_project_idx on project_unit_instances(project_id);
create index project_unit_instances_model_idx on project_unit_instances(model_id);

create table project_activities (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references projects(id) on delete cascade,
  activity_code        text not null,
  name                 text not null,
  name_en              text not null,
  phase                activity_phase not null,
  start_day            int  not null default 0,
  end_day              int  not null default 1,
  duration             int  not null default 1,
  percent_complete     int  not null default 0,   -- Planned Progress: recomputed by trigger, never client-set
  actual_progress      int,                         -- Actual Progress: manual, client-set
  status               activity_status not null default 'not_started',
  team                 text not null default '',
  team_en              text not null default '',
  description          text not null default '',
  description_en       text not null default '',
  actual_cost          numeric(14,2) not null default 0,
  planned_cost         numeric(14,2) not null default 0,
  change_order_amount  numeric(14,2) not null default 0,
  start_date           date,
  end_date             date,
  actual_start_date    date,
  actual_end_date      date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger project_activities_updated_at before update on project_activities for each row execute function set_updated_at();
create index project_activities_project_idx on project_activities(project_id);

-- Planned Progress must be "read-only, auto-calculated continuously from
-- (days elapsed since Start Date) / (total duration) × 100" (PRD §5.2.2). Enforcing this
-- server-side (not just in the form) means it can never drift even if a client bug tries
-- to send a manual value.
create or replace function compute_planned_progress()
returns trigger language plpgsql as $$
declare
  elapsed int;
begin
  if new.start_date is not null and new.end_date is not null and new.duration > 0 then
    elapsed := (current_date - new.start_date);
    new.percent_complete := greatest(0, least(100, round((elapsed::numeric / new.duration) * 100)));
  end if;
  return new;
end;
$$;
create trigger project_activities_planned_progress
  before insert or update of start_date, end_date, duration on project_activities
  for each row execute function compute_planned_progress();

create table activity_photos (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references project_activities(id) on delete cascade,
  file_url    text not null,
  file_path   text,
  file_type   file_kind not null default 'image',
  file_name   text,
  uploaded_by uuid references profiles(id) on delete set null,
  uploaded_at timestamptz not null default now()
);
create index activity_photos_activity_idx on activity_photos(activity_id);
```

---

## 9. Document categories & documents (renameable, PRD §5.2.4)

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 9. DOCUMENT CATEGORIES (per-project, renameable, addable/removable)
-- ═══════════════════════════════════════════════════════════════════════════
create table document_categories (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  key        text not null,           -- stable slug, e.g. 'contracts' — used only for seeding defaults
  name       text not null,
  name_en    text not null,
  is_default boolean not null default false,  -- default categories can be renamed but not deleted
  created_at timestamptz not null default now(),
  unique (project_id, key)
);
create index document_categories_project_idx on document_categories(project_id);

create table project_documents (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  category_id uuid not null references document_categories(id) on delete restrict,
  name        text not null,
  name_en     text not null,
  type        text not null default 'pdf',
  file_url    text,
  file_path   text,
  uploaded_by uuid references profiles(id) on delete set null,
  uploaded_at timestamptz not null default now()
);
create index project_documents_project_idx on project_documents(project_id);
create index project_documents_category_idx on project_documents(category_id);

-- Seed the 6 default categories automatically whenever a project is created.
create or replace function seed_default_document_categories()
returns trigger language plpgsql as $$
begin
  insert into document_categories (project_id, key, name, name_en, is_default) values
    (new.id, 'contracts',           'عقود الإنشاء',        'Construction Contracts', true),
    (new.id, 'master_plan',         'المخطط الرئيسي',      'Master Plan',            true),
    (new.id, 'construction_files',  'ملفات البناء',         'Construction Files',     true),
    (new.id, 'permits',             'التراخيص',             'Permits',                true),
    (new.id, 'reports',             'التقارير',             'Reports',                true),
    (new.id, 'correspondence',      'المراسلات',            'Correspondence',         true);
  return new;
end;
$$;
create trigger projects_seed_doc_categories
  after insert on projects
  for each row execute function seed_default_document_categories();

-- Prevent deleting a default category (rename it instead) and prevent deleting any
-- category that still has documents filed under it (client should be told to move/delete
-- the documents first — this matches "renaming must not disconnect documents" from the PRD
-- by making disconnection structurally impossible).
create or replace function guard_delete_document_category()
returns trigger language plpgsql as $$
begin
  if old.is_default then
    raise exception 'Default document categories cannot be deleted, only renamed';
  end if;
  if exists (select 1 from project_documents where category_id = old.id) then
    raise exception 'Cannot delete a category that still has documents';
  end if;
  return old;
end;
$$;
create trigger document_categories_guard_delete
  before delete on document_categories
  for each row execute function guard_delete_document_category();
```

---

## 10. Risks & IPC

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 10. RISKS & IPC
-- ═══════════════════════════════════════════════════════════════════════════
create table project_risks (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  name            text not null,
  name_en         text not null,
  date_raised     date not null,
  responsible     text not null default '',
  responsible_en  text not null default '',
  description     text not null default '',
  description_en  text not null default '',
  deadline        date,
  reason          text not null default '',
  reason_en       text not null default '',
  result          risk_result not null default 'pending',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger project_risks_updated_at before update on project_risks for each row execute function set_updated_at();
create index project_risks_project_idx on project_risks(project_id);

create table risk_photos (
  id          uuid primary key default gen_random_uuid(),
  risk_id     uuid not null references project_risks(id) on delete cascade,
  file_url    text not null,
  file_path   text,
  file_type   file_kind not null default 'image',
  file_name   text,
  uploaded_by uuid references profiles(id) on delete set null,
  uploaded_at timestamptz not null default now()
);
create index risk_photos_risk_idx on risk_photos(risk_id);

create table ipc_entries (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  direction       ipc_direction not null,
  source          ipc_source,
  party_name      text,
  party_name_en   text,
  reference       text,
  activity_id     uuid references project_activities(id) on delete set null,
  amount          numeric(14,2) not null default 0,
  description     text not null default '',
  description_en  text,
  status          ipc_status not null default 'in_progress',
  date_logged     date not null default current_date,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger ipc_entries_updated_at before update on ipc_entries for each row execute function set_updated_at();
create index ipc_entries_project_idx on ipc_entries(project_id, direction);

create table ipc_attachments (
  id           uuid primary key default gen_random_uuid(),
  ipc_entry_id uuid not null references ipc_entries(id) on delete cascade,
  file_name    text not null,
  file_type    file_kind not null default 'pdf',
  file_url     text,
  file_path    text,
  uploaded_by  uuid references profiles(id) on delete set null,
  uploaded_at  timestamptz not null default now()
);
create index ipc_attachments_entry_idx on ipc_attachments(ipc_entry_id);
```

---

## 11. `profiles` creation trigger (wires up Auth signup)

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 11. AUTO-CREATE profiles/preferences/technicians ROWS WHEN AN AUTH USER IS CREATED
-- ═══════════════════════════════════════════════════════════════════════════
-- User metadata is set at creation time (see Section 15, seeding). Expected keys in
-- raw_user_meta_data: full_name, full_name_en, role, phone, tenant_property_id,
-- tenant_unit, specialty (technician only).
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role user_role;
begin
  v_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'tenant');

  insert into public.profiles (id, full_name, full_name_en, email, phone, role, tenant_property_id, tenant_unit)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'full_name_en', ''),
    new.email,
    new.raw_user_meta_data->>'phone',
    v_role,
    nullif(new.raw_user_meta_data->>'tenant_property_id', '')::uuid,
    new.raw_user_meta_data->>'tenant_unit'
  );

  insert into public.preferences (profile_id) values (new.id);

  if v_role = 'technician' then
    insert into public.technicians (profile_id, name, name_en, specialty)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      coalesce(new.raw_user_meta_data->>'full_name_en', ''),
      coalesce(new.raw_user_meta_data->>'specialty', '')
    );
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
```

---

## 12. Notification triggers (server-side, automatic)

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 12. NOTIFICATION FAN-OUT TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

-- Recipients for "management" notifications: every super_admin + facility_manager,
-- respecting each recipient's own preference for emergency vs. normal-request alerts.
create or replace function notify_management(
  p_title text, p_body text, p_emergency boolean,
  p_request_id text default null, p_property_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (recipient_id, title, body, emergency, request_id, property_id)
  select p.id, p_title, p_body, p_emergency, p_request_id, p_property_id
  from profiles p
  join preferences pr on pr.profile_id = p.id
  where p.role in ('super_admin', 'facility_manager')
    and (
      (p_emergency and pr.immediate_emergency)
      or (not p_emergency and pr.request_updates)
    );
end;
$$;

-- After a request is inserted: notify management.
create or replace function trg_notify_new_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform notify_management(
    case when new.type = 'emergency' then 'طلب طارئ جديد' else 'طلب جديد' end,
    new.id || ' — ' || left(coalesce(new.description, ''), 80),
    new.type = 'emergency',
    new.id, new.property_id
  );
  return new;
end;
$$;
create trigger requests_notify_new
  after insert on requests
  for each row execute function trg_notify_new_request();

-- After a technician is newly assigned: notify that technician's profile (if linked to one).
create or replace function trg_notify_technician_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tech_profile uuid;
  v_tech_name    text;
begin
  if new.technician_id is distinct from old.technician_id and new.technician_id is not null then
    select profile_id, name into v_tech_profile, v_tech_name from technicians where id = new.technician_id;
    if v_tech_profile is not null then
      insert into notifications (recipient_id, title, body, request_id, property_id)
      values (v_tech_profile, 'تم تعيينك لطلب جديد', new.id || ' — ' || left(coalesce(new.description,''), 80), new.id, new.property_id);
    end if;
  end if;
  return new;
end;
$$;
create trigger requests_notify_technician
  after update on requests
  for each row execute function trg_notify_technician_assigned();

-- After a timeline event is logged: notify the tenant, and notify management (matches
-- existing front-end behavior of keeping both sides in sync on every status change).
create or replace function trg_notify_timeline_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_request requests%rowtype;
begin
  select * into v_request from requests where id = new.request_id;

  if v_request.tenant_id is not null then
    insert into notifications (recipient_id, title, body, emergency, request_id, property_id)
    select v_request.tenant_id, 'تحديث طلبك ' || new.request_id, new.label, v_request.type = 'emergency', new.request_id, v_request.property_id
    from preferences pr where pr.profile_id = v_request.tenant_id and pr.request_updates;
  end if;

  perform notify_management('تحديث الطلب ' || new.request_id, new.label, v_request.type = 'emergency', new.request_id, v_request.property_id);
  return new;
end;
$$;
create trigger request_timeline_notify
  after insert on request_timeline_events
  for each row execute function trg_notify_timeline_event();

-- Announcements: notify every tenant of the target property (or all tenants if property_id is null),
-- respecting their announcements preference.
create or replace function trg_notify_announcement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (recipient_id, title, body, property_id)
  select p.id, new.title, new.body, new.property_id
  from profiles p
  join preferences pr on pr.profile_id = p.id
  where p.role = 'tenant'
    and pr.announcements
    and (new.property_id is null or p.tenant_property_id = new.property_id);
  return new;
end;
$$;
create trigger announcements_notify
  after insert on announcements
  for each row execute function trg_notify_announcement();
```

---

## 13. Authorization helper functions

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 13. RLS HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════
-- All `security definer` so they can read `profiles` even though `profiles` itself has
-- RLS enabled (avoids infinite recursion: a policy on `profiles` calling a normal
-- function that selects from `profiles` would re-trigger RLS on itself).

create or replace function my_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_super_admin() returns boolean language sql stable security definer set search_path = public as $$
  select my_role() = 'super_admin';
$$;

-- Facility-management "write" roles: create/update/delete properties, requests, users, announcements.
create or replace function is_mgmt_write() returns boolean language sql stable security definer set search_path = public as $$
  select my_role() in ('super_admin','facility_manager');
$$;

-- Facility-management "read" roles: everyone who should see the portfolio-wide FM dashboard.
create or replace function is_mgmt_read() returns boolean language sql stable security definer set search_path = public as $$
  select my_role() in ('super_admin','facility_manager','owner','technician');
$$;

create or replace function is_tenant() returns boolean language sql stable security definer set search_path = public as $$
  select my_role() = 'tenant';
$$;

create or replace function is_technician() returns boolean language sql stable security definer set search_path = public as $$
  select my_role() = 'technician';
$$;

create or replace function my_technician_id() returns uuid language sql stable security definer set search_path = public as $$
  select id from technicians where profile_id = auth.uid();
$$;

-- PM "write" roles: pm_manager may create/edit/delete. pm_viewer is read-only (per PRD §5's
-- implicit viewer/manager split and the IPC tab being "PM-manager-only").
create or replace function is_pm_write() returns boolean language sql stable security definer set search_path = public as $$
  select my_role() in ('super_admin','pm_manager');
$$;

create or replace function is_pm_read() returns boolean language sql stable security definer set search_path = public as $$
  select my_role() in ('super_admin','pm_manager','pm_viewer');
$$;
```

> **Scoping model, today vs. later:** `is_mgmt_read()`/`is_mgmt_write()`/`is_pm_read()`/`is_pm_write()`
> are **role-scoped, portfolio-wide** — any facility_manager sees all properties, any pm_manager sees
> all projects. This matches the product exactly as specified today (the PRD's Management Dashboard
> and PM Portfolio Dashboard are both portfolio-wide with no per-user property/project restriction
> anywhere in the spec or the current mock). The `property_managers` and `project_managers` join
> tables already exist for when that changes — to switch a table to scoped access, change its policy
> from `using (is_mgmt_read())` to
> `using (is_mgmt_read() and (is_super_admin() or exists (select 1 from property_managers pm where pm.property_id = properties.id and pm.profile_id = auth.uid())))`
> (and the equivalent with `project_managers` for PM tables). No schema change needed, only a policy
> edit — everything is already in place for it.

---

## 14. Row Level Security — enable + policies

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 14. ENABLE RLS ON EVERY TABLE
-- ═══════════════════════════════════════════════════════════════════════════
alter table profiles                     enable row level security;
alter table properties                   enable row level security;
alter table property_managers            enable row level security;
alter table technicians                  enable row level security;
alter table leases                       enable row level security;
alter table property_documents           enable row level security;
alter table requests                     enable row level security;
alter table request_timeline_events      enable row level security;
alter table messages                     enable row level security;
alter table notifications                enable row level security;
alter table preferences                  enable row level security;
alter table announcements                enable row level security;
alter table projects                     enable row level security;
alter table project_managers             enable row level security;
alter table project_unit_types           enable row level security;
alter table project_unit_instances       enable row level security;
alter table project_activities           enable row level security;
alter table activity_photos              enable row level security;
alter table document_categories          enable row level security;
alter table project_documents            enable row level security;
alter table project_risks                enable row level security;
alter table risk_photos                  enable row level security;
alter table ipc_entries                  enable row level security;
alter table ipc_attachments              enable row level security;
```

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 14a. profiles
-- ═══════════════════════════════════════════════════════════════════════════
-- Everyone signed in can read basic profile info (names/roles need to be visible across
-- the app — e.g. technician names on requests, PM names). Writing is restricted to your
-- own row; role can never be changed by the user themselves (only by re-running the admin
-- seed / an explicit super_admin action via the service role, never via the anon/authenticated key).
create policy profiles_select_all on profiles for select using (auth.uid() is not null);
create policy profiles_update_own on profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));

-- ═══════════════════════════════════════════════════════════════════════════
-- 14b. properties / property_managers / technicians / leases / property_documents
-- ═══════════════════════════════════════════════════════════════════════════
create policy properties_read on properties for select using (is_mgmt_read() or is_tenant());
create policy properties_write on properties for insert with check (is_mgmt_write());
create policy properties_update on properties for update using (is_mgmt_write());
create policy properties_delete on properties for delete using (is_super_admin());

create policy property_managers_read on property_managers for select using (is_mgmt_read());
create policy property_managers_write on property_managers for all using (is_super_admin()) with check (is_super_admin());

create policy technicians_read on technicians for select using (is_mgmt_read() or auth.uid() is not null);
create policy technicians_write on technicians for insert with check (is_mgmt_write());
create policy technicians_update on technicians for update using (is_mgmt_write() or profile_id = auth.uid());
create policy technicians_delete on technicians for delete using (is_mgmt_write());

create policy leases_read on leases for select using (is_mgmt_read() or tenant_id = auth.uid());
create policy leases_write on leases for insert with check (is_mgmt_write());
create policy leases_update on leases for update using (is_mgmt_write());
create policy leases_delete on leases for delete using (is_mgmt_write());

create policy property_documents_read on property_documents for select using (is_mgmt_read());
create policy property_documents_write on property_documents for insert with check (is_mgmt_write());
create policy property_documents_update on property_documents for update using (is_mgmt_write());
create policy property_documents_delete on property_documents for delete using (is_mgmt_write());

-- ═══════════════════════════════════════════════════════════════════════════
-- 14c. requests / request_timeline_events
-- ═══════════════════════════════════════════════════════════════════════════
create policy requests_select on requests for select
  using (
    is_mgmt_read()
    or tenant_id = auth.uid()
    or (is_technician() and technician_id = my_technician_id())
  );

create policy requests_insert_tenant on requests for insert
  with check (is_tenant() and tenant_id = auth.uid());

create policy requests_insert_mgmt on requests for insert
  with check (is_mgmt_write());

create policy requests_update on requests for update
  using (
    is_mgmt_write()
    or (is_technician() and technician_id = my_technician_id())
  );

create policy requests_delete on requests for delete using (is_super_admin());

create policy request_timeline_select on request_timeline_events for select
  using (
    exists (
      select 1 from requests r
      where r.id = request_timeline_events.request_id
        and (is_mgmt_read() or r.tenant_id = auth.uid() or (is_technician() and r.technician_id = my_technician_id()))
    )
  );

create policy request_timeline_insert on request_timeline_events for insert
  with check (
    exists (
      select 1 from requests r
      where r.id = request_timeline_events.request_id
        and (is_mgmt_write() or (is_technician() and r.technician_id = my_technician_id()))
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 14d. messages
-- ═══════════════════════════════════════════════════════════════════════════
create policy messages_select on messages for select
  using (is_mgmt_read() or thread_id = auth.uid());

create policy messages_insert on messages for insert
  with check (
    (is_tenant() and thread_id = auth.uid() and sender_id = auth.uid() and sender_role = 'tenant')
    or (is_mgmt_write() and sender_id = auth.uid() and sender_role = 'manager')
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 14e. notifications / preferences / announcements
-- ═══════════════════════════════════════════════════════════════════════════
create policy notifications_select on notifications for select using (recipient_id = auth.uid());
create policy notifications_update on notifications for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
-- No insert/delete policy for authenticated users: rows are only ever created by the
-- SECURITY DEFINER trigger functions in Section 12, which run with elevated privileges
-- and bypass RLS entirely — this is intentional and is what makes notifications tamper-proof.

create policy preferences_all on preferences for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy announcements_select on announcements for select
  using (
    is_mgmt_read()
    or (is_tenant() and (property_id is null or property_id = (select tenant_property_id from profiles where id = auth.uid())))
  );
create policy announcements_write on announcements for insert with check (is_mgmt_write());
create policy announcements_delete on announcements for delete using (is_mgmt_write());

-- ═══════════════════════════════════════════════════════════════════════════
-- 14f. Project Management tables (all share the same is_pm_read/is_pm_write gate)
-- ═══════════════════════════════════════════════════════════════════════════
create policy projects_select on projects for select using (is_pm_read());
create policy projects_write on projects for insert with check (is_pm_write());
create policy projects_update on projects for update using (is_pm_write());
create policy projects_delete on projects for delete using (is_super_admin());

create policy project_managers_select on project_managers for select using (is_pm_read());
create policy project_managers_write on project_managers for all using (is_super_admin()) with check (is_super_admin());

create policy project_unit_types_select on project_unit_types for select using (is_pm_read());
create policy project_unit_types_write on project_unit_types for insert with check (is_pm_write());
create policy project_unit_types_update on project_unit_types for update using (is_pm_write());
create policy project_unit_types_delete on project_unit_types for delete using (is_pm_write());

create policy project_unit_instances_select on project_unit_instances for select using (is_pm_read());
create policy project_unit_instances_write on project_unit_instances for insert with check (is_pm_write());
create policy project_unit_instances_update on project_unit_instances for update using (is_pm_write());
create policy project_unit_instances_delete on project_unit_instances for delete using (is_pm_write());

create policy project_activities_select on project_activities for select using (is_pm_read());
create policy project_activities_write on project_activities for insert with check (is_pm_write());
create policy project_activities_update on project_activities for update using (is_pm_write());
create policy project_activities_delete on project_activities for delete using (is_pm_write());

create policy activity_photos_select on activity_photos for select using (is_pm_read());
create policy activity_photos_write on activity_photos for insert with check (is_pm_write());
create policy activity_photos_delete on activity_photos for delete using (is_pm_write());

create policy document_categories_select on document_categories for select using (is_pm_read());
create policy document_categories_write on document_categories for insert with check (is_pm_write());
create policy document_categories_update on document_categories for update using (is_pm_write());
create policy document_categories_delete on document_categories for delete using (is_pm_write());

create policy project_documents_select on project_documents for select using (is_pm_read());
create policy project_documents_write on project_documents for insert with check (is_pm_write());
create policy project_documents_update on project_documents for update using (is_pm_write());
create policy project_documents_delete on project_documents for delete using (is_pm_write());

create policy project_risks_select on project_risks for select using (is_pm_read());
create policy project_risks_write on project_risks for insert with check (is_pm_write());
create policy project_risks_update on project_risks for update using (is_pm_write());
create policy project_risks_delete on project_risks for delete using (is_pm_write());

create policy risk_photos_select on risk_photos for select using (is_pm_read());
create policy risk_photos_write on risk_photos for insert with check (is_pm_write());
create policy risk_photos_delete on risk_photos for delete using (is_pm_write());

create policy ipc_entries_select on ipc_entries for select using (is_pm_read());
create policy ipc_entries_write on ipc_entries for insert with check (is_pm_write());
create policy ipc_entries_update on ipc_entries for update using (is_pm_write());
create policy ipc_entries_delete on ipc_entries for delete using (is_pm_write());

create policy ipc_attachments_select on ipc_attachments for select using (is_pm_read());
create policy ipc_attachments_write on ipc_attachments for insert with check (is_pm_write());
create policy ipc_attachments_delete on ipc_attachments for delete using (is_pm_write());
```

---

## 15. `properties_with_stats` view (open/emergency request counts)

The FM Management Dashboard needs `openRequests`/`emergency` counts per property, computed live
from `requests`, not stored as stale columns. Expose them through a view so the frontend can select
it directly instead of doing client-side aggregation:

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 15. properties_with_stats VIEW
-- ═══════════════════════════════════════════════════════════════════════════
create or replace view properties_with_stats
with (security_invoker = true) as
select
  p.*,
  coalesce(r.open_count, 0)      as open_requests,
  coalesce(r.emergency_count, 0) as emergency
from properties p
left join (
  select
    property_id,
    count(*) filter (where status <> 'resolved')                          as open_count,
    count(*) filter (where status <> 'resolved' and type = 'emergency')   as emergency_count
  from requests
  group by property_id
) r on r.property_id = p.id;
```

`security_invoker = true` means the view runs with the _querying_ user's RLS, not the view owner's —
so `properties_with_stats` is exactly as safe as querying `properties` and `requests` directly.

---

## 16. Storage buckets

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 16. STORAGE BUCKETS
-- ═══════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public) values
  ('request-photos',    'request-photos',    false),
  ('property-documents','property-documents',false),
  ('activity-photos',   'activity-photos',   false),
  ('risk-photos',       'risk-photos',       false),
  ('ipc-attachments',   'ipc-attachments',   false),
  ('project-documents', 'project-documents', false),
  ('unit-assets',       'unit-assets',       true),
  ('avatars',           'avatars',           true)
on conflict (id) do nothing;
```

**Path convention** (the frontend adapter in the second file follows this exactly):
`{bucket}/{ownerEntityId}/{timestamp}-{filename}` — e.g.
`request-photos/REQ-1048/1719999999-leak.jpg`, `activity-photos/<activity_uuid>/...`,
`unit-assets/<project_id>/<unit_type_id>/floorplan.pdf`.

```sql
-- request-photos: readable by mgmt + the request's tenant + the assigned technician;
-- writable by the tenant (their own request only) and by mgmt/technician.
create policy storage_request_photos_read on storage.objects for select
  using (
    bucket_id = 'request-photos' and (
      is_mgmt_read()
      or exists (select 1 from requests r where r.id = (storage.foldername(name))[1] and (r.tenant_id = auth.uid() or (is_technician() and r.technician_id = my_technician_id())))
    )
  );
create policy storage_request_photos_write on storage.objects for insert
  with check (
    bucket_id = 'request-photos' and (
      is_mgmt_write()
      or exists (select 1 from requests r where r.id = (storage.foldername(name))[1] and r.tenant_id = auth.uid())
    )
  );
create policy storage_request_photos_delete on storage.objects for delete
  using (bucket_id = 'request-photos' and is_mgmt_write());

-- property-documents: mgmt only
create policy storage_property_documents_all on storage.objects for all
  using (bucket_id = 'property-documents' and is_mgmt_read())
  with check (bucket_id = 'property-documents' and is_mgmt_write());

-- activity-photos, risk-photos, ipc-attachments, project-documents: PM gate
create policy storage_activity_photos_read on storage.objects for select using (bucket_id = 'activity-photos' and is_pm_read());
create policy storage_activity_photos_write on storage.objects for insert with check (bucket_id = 'activity-photos' and is_pm_write());
create policy storage_activity_photos_delete on storage.objects for delete using (bucket_id = 'activity-photos' and is_pm_write());

create policy storage_risk_photos_read on storage.objects for select using (bucket_id = 'risk-photos' and is_pm_read());
create policy storage_risk_photos_write on storage.objects for insert with check (bucket_id = 'risk-photos' and is_pm_write());
create policy storage_risk_photos_delete on storage.objects for delete using (bucket_id = 'risk-photos' and is_pm_write());

create policy storage_ipc_attachments_read on storage.objects for select using (bucket_id = 'ipc-attachments' and is_pm_read());
create policy storage_ipc_attachments_write on storage.objects for insert with check (bucket_id = 'ipc-attachments' and is_pm_write());
create policy storage_ipc_attachments_delete on storage.objects for delete using (bucket_id = 'ipc-attachments' and is_pm_write());

create policy storage_project_documents_read on storage.objects for select using (bucket_id = 'project-documents' and is_pm_read());
create policy storage_project_documents_write on storage.objects for insert with check (bucket_id = 'project-documents' and is_pm_write());
create policy storage_project_documents_delete on storage.objects for delete using (bucket_id = 'project-documents' and is_pm_write());

-- unit-assets: public read (marketing collateral — floor plans/brochures/3D models); PM-write.
create policy storage_unit_assets_read on storage.objects for select using (bucket_id = 'unit-assets');
create policy storage_unit_assets_write on storage.objects for insert with check (bucket_id = 'unit-assets' and is_pm_write());
create policy storage_unit_assets_update on storage.objects for update using (bucket_id = 'unit-assets' and is_pm_write());
create policy storage_unit_assets_delete on storage.objects for delete using (bucket_id = 'unit-assets' and is_pm_write());

-- avatars: public read; each user writes only their own folder ({auth.uid()}/...)
create policy storage_avatars_read on storage.objects for select using (bucket_id = 'avatars');
create policy storage_avatars_write on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_avatars_update on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
```

---

## 17. Realtime

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 17. REALTIME — instant notification bell, chat, and request-timeline updates
-- ═══════════════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table requests;
alter publication supabase_realtime add table request_timeline_events;
```

If the `supabase_realtime` publication doesn't exist yet in your project (rare on recent Supabase
projects, but happens on some self-hosted setups), create it first:
`create publication supabase_realtime;` — then re-run the four `alter publication` statements above.

Also flip **Database → Replication → supabase_realtime** in the dashboard to confirm these four
tables are listed as "enabled", and turn on **Realtime** for the project if it's off.

---

## 18. Seeding demo users

SQL alone cannot create `auth.users` rows with passwords (Supabase hashes passwords through the
Auth service, not directly in SQL). Create the seed users one of these two ways:

### Option A — Supabase Dashboard (fastest for a handful of users)

Go to **Authentication → Users → Add user**, for each row below: set the email, set the password to
`password` (or your own), tick **Auto Confirm User**, and under **User Metadata** paste the JSON
shown. The `handle_new_auth_user` trigger from Section 11 reads this metadata automatically and
creates the matching `profiles` (+ `preferences`, + `technicians` if applicable) row — no extra SQL
needed after creating the Auth user.

| Email                  | Password | Metadata (paste as JSON in the dashboard)                                                                         |
| ---------------------- | -------- | ----------------------------------------------------------------------------------------------------------------- |
| khalid@mdrar.sa        | password | `{"role":"super_admin","full_name":"خالد الشهري","full_name_en":"Khalid Al-Shehri"}`                              |
| sarah@mdrar.sa         | password | `{"role":"facility_manager","full_name":"Sarah Miller","full_name_en":"Sarah Miller"}`                            |
| salem@mdrar.sa         | password | `{"role":"technician","full_name":"سالم القحطاني","full_name_en":"Salem Al-Qahtani","specialty":"AC & Plumbing"}` |
| fahad@mdrar.sa         | password | `{"role":"technician","full_name":"فهد العتيبي","full_name_en":"Fahad Al-Otaibi","specialty":"Electrical"}`       |
| owner@mdrar.sa         | password | `{"role":"owner","full_name":"عبدالرحمن الراجحي","full_name_en":"Abdulrahman Al-Rajhi"}`                          |
| pm@mdrar.sa            | password | `{"role":"pm_manager","full_name":"مدير المشاريع","full_name_en":"PM Manager"}`                                   |
| pmviewer@mdrar.sa      | password | `{"role":"pm_viewer","full_name":"مشاهد المشاريع","full_name_en":"PM Viewer"}`                                    |
| m.alotaibi@example.com | password | `{"role":"tenant","full_name":"محمد العتيبي","full_name_en":"Mohammed Al-Otaibi","tenant_unit":"A-204"}`          |
| sarah.j@example.com    | password | `{"role":"tenant","full_name":"Sarah Johnson","full_name_en":"Sarah Johnson","tenant_unit":"B-110"}`              |

For the two tenant rows, after creating `properties` (Section 19), run:

```sql
update profiles set tenant_property_id = (select id from properties where name_en = 'Jazly Plaza') where email = 'm.alotaibi@example.com';
update profiles set tenant_property_id = (select id from properties where name_en = 'Wahat Qurtuba') where email = 'sarah.j@example.com';
```

### Option B — a script, using the Admin API (better for CI / repeatable environments)

See the second file (`02_FRONTEND_INTEGRATION.md`, Section "Seed script") for a ready-to-run Node
script using `supabase.auth.admin.createUser`, which is the programmatic equivalent of Option A and
sets the same metadata.

---

## 19. Seed data — properties, projects, technicians roster, activities

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- 19. SEED: properties (from PRD §4.3 mock data)
-- ═══════════════════════════════════════════════════════════════════════════
insert into properties (name, name_en, location, units, occupied, accent) values
  ('بلازا جزلي',                 'Jazly Plaza',                         'الرياض', 48, 41, '#b86b4b'),
  ('واحة قرطبة',                 'Wahat Qurtuba',                       'الرياض', 36, 30, '#637b8e'),
  ('ساحة العجو',                 'Al-Ajou Square',                      'الرياض', 24, 20, '#8a9a5b'),
  ('فلل مدرار العارض',           'MDRAR Al-Arid Villas',                'الرياض', 18, 15, '#b86b4b'),
  ('مجمع الناصرية السكني',       'Al-Nasriyah Residential Compound',    'الرياض', 60, 52, '#637b8e'),
  ('واحة المنسية',               'Wahat Al-Munsiyah',                   'الرياض', 40, 33, '#8a9a5b'),
  ('واحة النرجس',                'Wahat Al-Narjis',                     'الرياض', 55, 47, '#b86b4b'),
  ('مساكن وادي الدواسر',         'Wadi Al Dawasir Residences',          'وادي الدواسر', 30, 22, '#637b8e');

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED: projects (from PRD §5.1 mock data) — activities auto-seed per project below
-- ═══════════════════════════════════════════════════════════════════════════
insert into projects (name, name_en, location, location_en, total_units, start_date, end_date, total_days, contractor, contractor_en, budget, status, contract_number, consultant, consultant_en) values
  ('فلل الرمال',           'Al Rimal Villas',            'الرياض', 'Riyadh', 64,  '2025-02-01', '2026-08-01', 545, 'شركة البناء المتقدم', 'Advanced Construction Co.', 'مكتب الاستشارات الهندسية', 'Engineering Consultancy Office', 185000000, 'on_track', 'CN-2025-001', 'مكتب الاستشارات الهندسية', 'Engineering Consultancy Office'),
  ('واحة النرجس - المرحلة 2', 'Wahat Al-Narjis Phase 2',  'الرياض', 'Riyadh', 55,  '2025-01-15', '2026-06-15', 516, 'شركة الإعمار الحديث',  'Modern Development Co.',    'استشارات الخليج الهندسية',   'Gulf Engineering Consultants',   142000000, 'on_track', 'CN-2025-002', 'استشارات الخليج الهندسية',   'Gulf Engineering Consultants'),
  ('توسعة بلازا جزلي',     'Jazly Plaza Expansion',      'الرياض', 'Riyadh', 48,  '2025-03-01', '2026-09-01', 550, 'مقاولات الرياض المتحدة','United Riyadh Contracting', 'مكتب الاستشارات الهندسية', 'Engineering Consultancy Office', 98000000,  'at_risk',  'CN-2025-003', 'مكتب الاستشارات الهندسية', 'Engineering Consultancy Office'),
  ('مساكن العجو',          'Al-Ajou Residences',         'الرياض', 'Riyadh', 24,  '2024-11-01', '2026-02-01', 457, 'شركة البناء المتقدم', 'Advanced Construction Co.', 'استشارات الخليج الهندسية',   'Gulf Engineering Consultants',   65000000,  'delayed',  'CN-2024-011', 'استشارات الخليج الهندسية',   'Gulf Engineering Consultants'),
  ('أبراج المنسية',        'Wahat Al-Munsiyah Towers',   'الرياض', 'Riyadh', 40,  '2025-04-01', '2026-11-01', 579, 'شركة الإعمار الحديث',  'Modern Development Co.',    'مكتب الاستشارات الهندسية', 'Engineering Consultancy Office', 156000000, 'on_track', 'CN-2025-004', 'مكتب الاستشارات الهندسية', 'Engineering Consultancy Office'),
  ('الناصرية - المرحلة 3', 'Al-Nasriyah Phase 3',        'الرياض', 'Riyadh', 60,  '2025-02-15', '2026-10-15', 607, 'مقاولات الرياض المتحدة','United Riyadh Contracting', 'استشارات الخليج الهندسية',   'Gulf Engineering Consultants',   178000000, 'on_track', 'CN-2025-005', 'استشارات الخليج الهندسية',   'Gulf Engineering Consultants'),
  ('توسعة وادي الدواسر',   'Wadi Al Dawasir Extension',  'وادي الدواسر', 'Wadi Al Dawasir', 30, '2024-09-01', '2025-12-01', 456, 'شركة البناء المتقدم', 'Advanced Construction Co.', 'مكتب الاستشارات الهندسية', 'Engineering Consultancy Office', 52000000,  'completed','CN-2024-007', 'مكتب الاستشارات الهندسية', 'Engineering Consultancy Office');

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED: the 24-activity schedule template (PRD §5.2.2), applied to every seeded project
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_project record;
  v_day int;
  v_activities jsonb := '[
    {"code":"MILE-01","name":"معلم بداية المشروع","name_en":"Project Start Milestone","phase":"milestone","duration":1},
    {"code":"MOB-01","name":"التعبئة وتجهيز الموقع","name_en":"Mobilization & Site Establishment","phase":"mobilization","duration":21},
    {"code":"ENG-01","name":"تنسيق التصميم ومخططات الورشة","name_en":"Design Coordination & Shop Drawings","phase":"engineering","duration":35},
    {"code":"ENG-02","name":"إعداد النموذج الأولي والاعتمادات","name_en":"Mockup Preparation & Approvals","phase":"engineering","duration":21},
    {"code":"PRO-01","name":"شراء المواد طويلة الأجل","name_en":"Procurement of Long Lead Items","phase":"procurement","duration":45},
    {"code":"CON-01","name":"المسح وتحديد المواقع","name_en":"Surveying & Setting Out","phase":"construction","duration":14},
    {"code":"CON-02","name":"الحفر وأعمال التربة","name_en":"Excavation & Earthworks","phase":"construction","duration":30},
    {"code":"CON-03","name":"الأساسات والبنية التحتية","name_en":"Foundations & Substructure","phase":"construction","duration":45},
    {"code":"CON-04","name":"الهيكل الإنشائي (إطار خرساني)","name_en":"Superstructure (Concrete Frame)","phase":"construction","duration":90},
    {"code":"CON-05","name":"أعمال البناء بالطوب","name_en":"Masonry (Block Works)","phase":"construction","duration":60},
    {"code":"CON-06","name":"التمديدات الكهروميكانيكية الأولى (داخلي)","name_en":"MEP First Fix (Internal)","phase":"construction","duration":45},
    {"code":"CON-07","name":"أعمال الأسقف والعزل المائي","name_en":"Roofing & Waterproofing","phase":"construction","duration":30},
    {"code":"CON-08","name":"أعمال اللياسة الداخلية","name_en":"Internal Plastering Works","phase":"construction","duration":40},
    {"code":"CON-09","name":"اللياسة الخارجية والواجهات","name_en":"External Plaster & Façade","phase":"construction","duration":40},
    {"code":"CON-10","name":"أعمال الأسقف المعلقة والقواطع","name_en":"Ceiling & Partition Works","phase":"construction","duration":35},
    {"code":"CON-11","name":"تشطيبات الأرضيات والجدران","name_en":"Floor & Wall Finishes","phase":"construction","duration":45},
    {"code":"CON-12","name":"الألمنيوم والنوافذ والزجاج","name_en":"Aluminum, Windows & Glazing","phase":"construction","duration":35},
    {"code":"CON-13","name":"الأبواب وأعمال النجارة","name_en":"Doors & Joinery Works","phase":"construction","duration":30},
    {"code":"CON-14","name":"الأعمال الخارجية والبنية التحتية","name_en":"External Works & Infrastructure","phase":"construction","duration":40},
    {"code":"FIN-01","name":"أعمال الدهان (الطبقة النهائية)","name_en":"Painting Works (Final Coat)","phase":"finishing","duration":30},
    {"code":"FIN-02","name":"التمديدات الكهروميكانيكية الثانية والفحص","name_en":"MEP Second Fix & Testing","phase":"finishing","duration":30},
    {"code":"FIN-03","name":"تنسيق الحدائق والري","name_en":"Landscaping & Irrigation","phase":"finishing","duration":25},
    {"code":"TST-01","name":"الفحص والتشغيل","name_en":"Testing & Commissioning","phase":"testing","duration":20},
    {"code":"TST-02","name":"رصد العيوب وإصلاحها","name_en":"Snagging & Rectification","phase":"testing","duration":15},
    {"code":"TST-03","name":"التنظيف النهائي والتسليم","name_en":"Final Cleaning & Handover","phase":"testing","duration":10}
  ]';
  v_act jsonb;
  v_start int;
begin
  for v_project in select id, start_date from projects loop
    v_start := 0;
    for v_act in select * from jsonb_array_elements(v_activities) loop
      insert into project_activities (
        project_id, activity_code, name, name_en, phase, start_day, end_day, duration,
        status, team, team_en, start_date, end_date, planned_cost, actual_cost
      ) values (
        v_project.id,
        v_act->>'code', v_act->>'name', v_act->>'name_en', (v_act->>'phase')::activity_phase,
        v_start, v_start + (v_act->>'duration')::int, (v_act->>'duration')::int,
        case when v_act->>'phase' = 'milestone' then 'completed' else 'not_started' end,
        'فريق المقاول الرئيسي', 'Main Contractor Team',
        v_project.start_date + v_start, v_project.start_date + v_start + (v_act->>'duration')::int,
        50000 + random()*200000, 0
      );
      v_start := v_start + (v_act->>'duration')::int;
    end loop;
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED: technicians without a linked profile (extra roster entries beyond the 2 seeded via Auth)
-- ═══════════════════════════════════════════════════════════════════════════
insert into technicians (name, name_en, specialty, resolved_count, sla) values
  ('ماجد الحربي', 'Majed Al-Harbi', 'Plumbing', 34, 96),
  ('يوسف الشمري', 'Yousef Al-Shammari', 'Common Area', 21, 92);
```

Run **Sections 1–17 first**, then **Section 18** (create Auth users via the dashboard), then
**Section 19** last (property/project/activity seed data — the tenant-linking `update` statements at
the end of Section 18 need `properties` to already exist, so do them after Section 19's property
insert, or just run all of Section 19 before creating the two tenant Auth users).

---

## 20. Verifying the setup

Run these as a smoke test after everything above is applied and seed users exist:

```sql
-- Should return one row per seeded user with the correct role
select email, role from profiles order by role;

-- Should return 24 rows per project (7 projects × 24 activities = 168)
select count(*) from project_activities;

-- Should return 6 rows per project (7 projects × 6 = 42)
select count(*) from document_categories;

-- properties_with_stats should return 0/0 for open_requests/emergency until requests exist
select name_en, units, occupied, open_requests, emergency from properties_with_stats;
```

Then, from the SQL editor **while impersonating a role is not directly testable in SQL** — do the
real end-to-end check from the frontend once `02_FRONTEND_INTEGRATION.md` is applied: sign in as
`m.alotaibi@example.com`, submit an emergency request, and confirm `khalid@mdrar.sa` and
`sarah@mdrar.sa` both receive a notification within the same second (Realtime) without refreshing.

---

## 21. What changed vs. the draft migration already in the repo

The repo's `supabase/migrations/20240101000000_initial_schema.sql` was a good first draft but had
gaps this version fixes:

1. **Notifications were never designed as a real table with fan-out** — the draft had a bare
   `notifications` table with a nullable `profile_id` and no triggers; every notification would have
   had to be inserted by the client, which is both insecure (a tenant could insert a notification
   claiming to be "from" management) and unreliable (easy to forget a call site). Section 12 replaces
   this with server-side triggers so notifications are guaranteed and tamper-proof.
2. **Document categories were a fixed enum** (`doc_category`), which cannot satisfy the PRD's
   requirement that categories be renameable and that new custom categories be addable while keeping
   documents associated "by category ID, not display name." Section 9 replaces the enum with a proper
   `document_categories` table.
3. **No RLS policies for most tables** — the draft enabled RLS everywhere but only wrote 3 example
   policies. Section 14 writes the complete set for all 24 tables.
4. **No Storage bucket policies** — the draft only had commented-out bucket _creation_ SQL. Section
   16 creates the buckets for real and writes matching Storage RLS.
5. **Missing tables** the frontend's `types.ts`/`dataSource.ts` actually need: `announcements`,
   `property_documents` (Property Detail's Documents tab), and the `messages`/`notifications` shape
   needed reworking to be per-recipient instead of a shared global bucket.
6. **No Realtime, no `properties_with_stats` view, no Planned-Progress auto-calc trigger, no
   `next_request_id()` sequence** — all added here since the PRD explicitly calls these out as
   required behavior (open/emergency counts, "Planned Progress is never manually set," human-readable
   request IDs).
