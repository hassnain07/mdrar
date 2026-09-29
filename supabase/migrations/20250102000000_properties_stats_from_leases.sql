-- Migration: recompute properties_with_stats.units / .occupied from leases table
-- instead of the static properties.units / properties.occupied columns.
-- Run this after 20250101000000_full_schema.sql.

create or replace view properties_with_stats with (security_invoker = true) as
select
  p.id,
  p.name,
  p.name_en,
  p.location,
  p.accent,
  p.unit_labels,
  p.created_at,
  p.updated_at,
  coalesce(u.unit_count, 0)      as units,
  coalesce(u.occupied_count, 0)  as occupied,
  coalesce(r.open_count, 0)      as open_requests,
  coalesce(r.emergency_count, 0) as emergency
from properties p
left join (
  select
    property_id,
    count(*)                                    as unit_count,
    count(*) filter (where status = 'occupied') as occupied_count
  from leases
  group by property_id
) u on u.property_id = p.id
left join (
  select
    property_id,
    count(*) filter (where status <> 'resolved')                        as open_count,
    count(*) filter (where status <> 'resolved' and type = 'emergency') as emergency_count
  from requests
  group by property_id
) r on r.property_id = p.id;
