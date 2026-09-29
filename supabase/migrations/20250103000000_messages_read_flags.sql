-- Migration: add per-role read tracking to messages
-- Replaces the single shared `read` column with two role-specific flags.

alter table messages
  add column if not exists read_by_manager boolean not null default false,
  add column if not exists read_by_tenant  boolean not null default false;

-- Messages sent by the manager are already "read" by the manager at insert time.
-- Messages sent by the tenant are already "read" by the tenant at insert time.
update messages set read_by_manager = true where sender_role = 'manager';
update messages set read_by_tenant  = true where sender_role = 'tenant';

-- Keep the old `read` column for backward compat but stop using it.
-- It can be dropped in a future migration once all clients are updated.
