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

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. PROFILES (without FK to properties — added after properties exists)
-- ═══════════════════════════════════════════════════════════════════════════
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

alter table profiles add constraint profiles_tenant_property_fk
  foreign key (tenant_property_id) references properties(id) on delete set null;
create index profiles_tenant_property_idx on profiles(tenant_property_id);

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
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references profiles(id) on delete set null,
  property_id  uuid not null references properties(id) on delete cascade,
  unit         text not null,
  tenant_name  text not null default '',
  tenant_email text,
  term_start   date not null,
  term_end     date not null,
  rent         numeric(12,2) not null default 0,
  deposit      numeric(12,2) not null default 0,
  rent_status  rent_status not null default 'paid',
  status       text not null default 'occupied' check (status in ('occupied','vacant')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger leases_updated_at before update on leases for each row execute function set_updated_at();
create index leases_property_idx on leases(property_id);
create index leases_tenant_idx on leases(tenant_id);

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

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. REQUESTS
-- ═══════════════════════════════════════════════════════════════════════════
create table requests (
  id            text primary key,
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. MESSAGES
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. NOTIFICATIONS & PREFERENCES & ANNOUNCEMENTS
-- ═══════════════════════════════════════════════════════════════════════════
create table notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  title        text not null,
  body         text not null,
  read         boolean not null default false,
  emergency    boolean not null default false,
  request_id   text references requests(id) on delete cascade,
  project_id   uuid,
  property_id  uuid references properties(id) on delete cascade,
  created_at   timestamptz not null default now()
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
  property_id uuid references properties(id) on delete cascade,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index announcements_property_idx on announcements(property_id);

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
  floor_level     text,
  townhouse_type  text,
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
  percent_complete     int  not null default 0,
  actual_progress      int,
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. DOCUMENT CATEGORIES & DOCUMENTS
-- ═══════════════════════════════════════════════════════════════════════════
create table document_categories (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  key        text not null,
  name       text not null,
  name_en    text not null,
  is_default boolean not null default false,
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. AUTO-CREATE profiles/preferences/technicians ON AUTH SIGNUP
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
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

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. NOTIFICATION TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════
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
    and ((p_emergency and pr.immediate_emergency) or (not p_emergency and pr.request_updates));
end;
$$;

create or replace function trg_notify_new_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform notify_management(
    case when new.type = 'emergency' then 'طلب طارئ جديد' else 'طلب جديد' end,
    new.id || ' — ' || left(coalesce(new.description, ''), 80),
    new.type = 'emergency', new.id, new.property_id
  );
  return new;
end;
$$;
create trigger requests_notify_new after insert on requests for each row execute function trg_notify_new_request();

create or replace function trg_notify_technician_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tech_profile uuid;
begin
  if new.technician_id is distinct from old.technician_id and new.technician_id is not null then
    select profile_id into v_tech_profile from technicians where id = new.technician_id;
    if v_tech_profile is not null then
      insert into notifications (recipient_id, title, body, request_id, property_id)
      values (v_tech_profile, 'تم تعيينك لطلب جديد', new.id || ' — ' || left(coalesce(new.description,''), 80), new.id, new.property_id);
    end if;
  end if;
  return new;
end;
$$;
create trigger requests_notify_technician after update on requests for each row execute function trg_notify_technician_assigned();

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
create trigger request_timeline_notify after insert on request_timeline_events for each row execute function trg_notify_timeline_event();

create or replace function trg_notify_announcement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (recipient_id, title, body, property_id)
  select p.id, new.title, new.body, new.property_id
  from profiles p
  join preferences pr on pr.profile_id = p.id
  where p.role = 'tenant' and pr.announcements
    and (new.property_id is null or p.tenant_property_id = new.property_id);
  return new;
end;
$$;
create trigger announcements_notify after insert on announcements for each row execute function trg_notify_announcement();

-- ═══════════════════════════════════════════════════════════════════════════
-- 13. RLS HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function my_role() returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;
create or replace function is_super_admin() returns boolean language sql stable security definer set search_path = public as $$
  select my_role() = 'super_admin';
$$;
create or replace function is_mgmt_write() returns boolean language sql stable security definer set search_path = public as $$
  select my_role() in ('super_admin','facility_manager');
$$;
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
create or replace function is_pm_write() returns boolean language sql stable security definer set search_path = public as $$
  select my_role() in ('super_admin','pm_manager');
$$;
create or replace function is_pm_read() returns boolean language sql stable security definer set search_path = public as $$
  select my_role() in ('super_admin','pm_manager','pm_viewer');
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 14. ENABLE RLS
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

-- profiles
create policy profiles_select_all on profiles for select using (auth.uid() is not null);
create policy profiles_update_own on profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));

-- properties
create policy properties_read   on properties for select using (is_mgmt_read() or is_tenant());
create policy properties_write  on properties for insert with check (is_mgmt_write());
create policy properties_update on properties for update using (is_mgmt_write());
create policy properties_delete on properties for delete using (is_super_admin());

-- property_managers
create policy property_managers_read  on property_managers for select using (is_mgmt_read());
create policy property_managers_write on property_managers for all using (is_super_admin()) with check (is_super_admin());

-- technicians
create policy technicians_read   on technicians for select using (is_mgmt_read() or auth.uid() is not null);
create policy technicians_write  on technicians for insert with check (is_mgmt_write());
create policy technicians_update on technicians for update using (is_mgmt_write() or profile_id = auth.uid());
create policy technicians_delete on technicians for delete using (is_mgmt_write());

-- leases
create policy leases_read   on leases for select using (is_mgmt_read() or tenant_id = auth.uid());
create policy leases_write  on leases for insert with check (is_mgmt_write());
create policy leases_update on leases for update using (is_mgmt_write());
create policy leases_delete on leases for delete using (is_mgmt_write());

-- property_documents
create policy property_documents_read   on property_documents for select using (is_mgmt_read());
create policy property_documents_write  on property_documents for insert with check (is_mgmt_write());
create policy property_documents_update on property_documents for update using (is_mgmt_write());
create policy property_documents_delete on property_documents for delete using (is_mgmt_write());

-- requests
create policy requests_select on requests for select using (is_mgmt_read() or tenant_id = auth.uid() or (is_technician() and technician_id = my_technician_id()));
create policy requests_insert_tenant on requests for insert with check (is_tenant() and tenant_id = auth.uid());
create policy requests_insert_mgmt   on requests for insert with check (is_mgmt_write());
create policy requests_update on requests for update using (is_mgmt_write() or (is_technician() and technician_id = my_technician_id()));
create policy requests_delete on requests for delete using (is_super_admin());

-- request_timeline_events
create policy request_timeline_select on request_timeline_events for select using (exists (select 1 from requests r where r.id = request_timeline_events.request_id and (is_mgmt_read() or r.tenant_id = auth.uid() or (is_technician() and r.technician_id = my_technician_id()))));
create policy request_timeline_insert on request_timeline_events for insert with check (exists (select 1 from requests r where r.id = request_timeline_events.request_id and (is_mgmt_write() or (is_technician() and r.technician_id = my_technician_id()))));

-- messages
create policy messages_select on messages for select using (is_mgmt_read() or thread_id = auth.uid());
create policy messages_insert on messages for insert with check ((is_tenant() and thread_id = auth.uid() and sender_id = auth.uid() and sender_role = 'tenant') or (is_mgmt_write() and sender_id = auth.uid() and sender_role = 'manager'));

-- notifications
create policy notifications_select on notifications for select using (recipient_id = auth.uid());
create policy notifications_update on notifications for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- preferences
create policy preferences_all on preferences for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- announcements
create policy announcements_select on announcements for select using (is_mgmt_read() or (is_tenant() and (property_id is null or property_id = (select tenant_property_id from profiles where id = auth.uid()))));
create policy announcements_write  on announcements for insert with check (is_mgmt_write());
create policy announcements_delete on announcements for delete using (is_mgmt_write());

-- projects
create policy projects_select on projects for select using (is_pm_read());
create policy projects_write  on projects for insert with check (is_pm_write());
create policy projects_update on projects for update using (is_pm_write());
create policy projects_delete on projects for delete using (is_super_admin());

-- project_managers
create policy project_managers_select on project_managers for select using (is_pm_read());
create policy project_managers_write  on project_managers for all using (is_super_admin()) with check (is_super_admin());

-- project_unit_types
create policy project_unit_types_select on project_unit_types for select using (is_pm_read());
create policy project_unit_types_write  on project_unit_types for insert with check (is_pm_write());
create policy project_unit_types_update on project_unit_types for update using (is_pm_write());
create policy project_unit_types_delete on project_unit_types for delete using (is_pm_write());

-- project_unit_instances
create policy project_unit_instances_select on project_unit_instances for select using (is_pm_read());
create policy project_unit_instances_write  on project_unit_instances for insert with check (is_pm_write());
create policy project_unit_instances_update on project_unit_instances for update using (is_pm_write());
create policy project_unit_instances_delete on project_unit_instances for delete using (is_pm_write());

-- project_activities
create policy project_activities_select on project_activities for select using (is_pm_read());
create policy project_activities_write  on project_activities for insert with check (is_pm_write());
create policy project_activities_update on project_activities for update using (is_pm_write());
create policy project_activities_delete on project_activities for delete using (is_pm_write());

-- activity_photos
create policy activity_photos_select on activity_photos for select using (is_pm_read());
create policy activity_photos_write  on activity_photos for insert with check (is_pm_write());
create policy activity_photos_delete on activity_photos for delete using (is_pm_write());

-- document_categories
create policy document_categories_select on document_categories for select using (is_pm_read());
create policy document_categories_write  on document_categories for insert with check (is_pm_write());
create policy document_categories_update on document_categories for update using (is_pm_write());
create policy document_categories_delete on document_categories for delete using (is_pm_write());

-- project_documents
create policy project_documents_select on project_documents for select using (is_pm_read());
create policy project_documents_write  on project_documents for insert with check (is_pm_write());
create policy project_documents_update on project_documents for update using (is_pm_write());
create policy project_documents_delete on project_documents for delete using (is_pm_write());

-- project_risks
create policy project_risks_select on project_risks for select using (is_pm_read());
create policy project_risks_write  on project_risks for insert with check (is_pm_write());
create policy project_risks_update on project_risks for update using (is_pm_write());
create policy project_risks_delete on project_risks for delete using (is_pm_write());

-- risk_photos
create policy risk_photos_select on risk_photos for select using (is_pm_read());
create policy risk_photos_write  on risk_photos for insert with check (is_pm_write());
create policy risk_photos_delete on risk_photos for delete using (is_pm_write());

-- ipc_entries
create policy ipc_entries_select on ipc_entries for select using (is_pm_read());
create policy ipc_entries_write  on ipc_entries for insert with check (is_pm_write());
create policy ipc_entries_update on ipc_entries for update using (is_pm_write());
create policy ipc_entries_delete on ipc_entries for delete using (is_pm_write());

-- ipc_attachments
create policy ipc_attachments_select on ipc_attachments for select using (is_pm_read());
create policy ipc_attachments_write  on ipc_attachments for insert with check (is_pm_write());
create policy ipc_attachments_delete on ipc_attachments for delete using (is_pm_write());

-- ═══════════════════════════════════════════════════════════════════════════
-- 15. properties_with_stats VIEW
-- ═══════════════════════════════════════════════════════════════════════════
create or replace view properties_with_stats with (security_invoker = true) as
select
  p.*,
  coalesce(r.open_count, 0)      as open_requests,
  coalesce(r.emergency_count, 0) as emergency
from properties p
left join (
  select
    property_id,
    count(*) filter (where status <> 'resolved')                        as open_count,
    count(*) filter (where status <> 'resolved' and type = 'emergency') as emergency_count
  from requests
  group by property_id
) r on r.property_id = p.id;

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

create policy storage_request_photos_read on storage.objects for select using (bucket_id = 'request-photos' and (is_mgmt_read() or exists (select 1 from requests r where r.id = (storage.foldername(name))[1] and (r.tenant_id = auth.uid() or (is_technician() and r.technician_id = my_technician_id())))));
create policy storage_request_photos_write on storage.objects for insert with check (bucket_id = 'request-photos' and (is_mgmt_write() or exists (select 1 from requests r where r.id = (storage.foldername(name))[1] and r.tenant_id = auth.uid())));
create policy storage_request_photos_delete on storage.objects for delete using (bucket_id = 'request-photos' and is_mgmt_write());

create policy storage_property_documents_all on storage.objects for all using (bucket_id = 'property-documents' and is_mgmt_read()) with check (bucket_id = 'property-documents' and is_mgmt_write());

create policy storage_activity_photos_read   on storage.objects for select using (bucket_id = 'activity-photos' and is_pm_read());
create policy storage_activity_photos_write  on storage.objects for insert with check (bucket_id = 'activity-photos' and is_pm_write());
create policy storage_activity_photos_delete on storage.objects for delete using (bucket_id = 'activity-photos' and is_pm_write());

create policy storage_risk_photos_read   on storage.objects for select using (bucket_id = 'risk-photos' and is_pm_read());
create policy storage_risk_photos_write  on storage.objects for insert with check (bucket_id = 'risk-photos' and is_pm_write());
create policy storage_risk_photos_delete on storage.objects for delete using (bucket_id = 'risk-photos' and is_pm_write());

create policy storage_ipc_attachments_read   on storage.objects for select using (bucket_id = 'ipc-attachments' and is_pm_read());
create policy storage_ipc_attachments_write  on storage.objects for insert with check (bucket_id = 'ipc-attachments' and is_pm_write());
create policy storage_ipc_attachments_delete on storage.objects for delete using (bucket_id = 'ipc-attachments' and is_pm_write());

create policy storage_project_documents_read   on storage.objects for select using (bucket_id = 'project-documents' and is_pm_read());
create policy storage_project_documents_write  on storage.objects for insert with check (bucket_id = 'project-documents' and is_pm_write());
create policy storage_project_documents_delete on storage.objects for delete using (bucket_id = 'project-documents' and is_pm_write());

create policy storage_unit_assets_read   on storage.objects for select using (bucket_id = 'unit-assets');
create policy storage_unit_assets_write  on storage.objects for insert with check (bucket_id = 'unit-assets' and is_pm_write());
create policy storage_unit_assets_update on storage.objects for update using (bucket_id = 'unit-assets' and is_pm_write());
create policy storage_unit_assets_delete on storage.objects for delete using (bucket_id = 'unit-assets' and is_pm_write());

create policy storage_avatars_read   on storage.objects for select using (bucket_id = 'avatars');
create policy storage_avatars_write  on storage.objects for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_avatars_update on storage.objects for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ═══════════════════════════════════════════════════════════════════════════
-- 17. REALTIME
-- ═══════════════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table requests;
alter publication supabase_realtime add table request_timeline_events;

-- ═══════════════════════════════════════════════════════════════════════════
-- 19. SEED DATA
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

insert into projects (name, name_en, location, location_en, total_units, start_date, end_date, total_days, contractor, contractor_en, budget, status, contract_number, consultant, consultant_en) values
  ('فلل الرمال',           'Al Rimal Villas',            'الرياض', 'Riyadh', 64,  '2025-02-01', '2026-08-01', 545, 'شركة البناء المتقدم', 'Advanced Construction Co.',  185000000, 'on_track', 'CN-2025-001', 'مكتب الاستشارات الهندسية', 'Engineering Consultancy Office'),
  ('واحة النرجس - المرحلة 2', 'Wahat Al-Narjis Phase 2',  'الرياض', 'Riyadh', 55,  '2025-01-15', '2026-06-15', 516, 'شركة الإعمار الحديث',  'Modern Development Co.',    142000000, 'on_track', 'CN-2025-002', 'استشارات الخليج الهندسية',   'Gulf Engineering Consultants'),
  ('توسعة بلازا جزلي',     'Jazly Plaza Expansion',      'الرياض', 'Riyadh', 48,  '2025-03-01', '2026-09-01', 550, 'مقاولات الرياض المتحدة','United Riyadh Contracting',  98000000,  'at_risk',  'CN-2025-003', 'مكتب الاستشارات الهندسية', 'Engineering Consultancy Office'),
  ('مساكن العجو',          'Al-Ajou Residences',         'الرياض', 'Riyadh', 24,  '2024-11-01', '2026-02-01', 457, 'شركة البناء المتقدم', 'Advanced Construction Co.',  65000000,  'delayed',  'CN-2024-011', 'استشارات الخليج الهندسية',   'Gulf Engineering Consultants'),
  ('أبراج المنسية',        'Wahat Al-Munsiyah Towers',   'الرياض', 'Riyadh', 40,  '2025-04-01', '2026-11-01', 579, 'شركة الإعمار الحديث',  'Modern Development Co.',    156000000, 'on_track', 'CN-2025-004', 'مكتب الاستشارات الهندسية', 'Engineering Consultancy Office'),
  ('الناصرية - المرحلة 3', 'Al-Nasriyah Phase 3',        'الرياض', 'Riyadh', 60,  '2025-02-15', '2026-10-15', 607, 'مقاولات الرياض المتحدة','United Riyadh Contracting',  178000000, 'on_track', 'CN-2025-005', 'استشارات الخليج الهندسية',   'Gulf Engineering Consultants'),
  ('توسعة وادي الدواسر',   'Wadi Al Dawasir Extension',  'وادي الدواسر', 'Wadi Al Dawasir', 30, '2024-09-01', '2025-12-01', 456, 'شركة البناء المتقدم', 'Advanced Construction Co.', 52000000, 'completed','CN-2024-007', 'مكتب الاستشارات الهندسية', 'Engineering Consultancy Office');

insert into technicians (name, name_en, specialty, resolved_count, sla) values
  ('ماجد الحربي', 'Majed Al-Harbi', 'Plumbing', 34, 96),
  ('يوسف الشمري', 'Yousef Al-Shammari', 'Common Area', 21, 92);
