-- Run after ../supabase/delta-07-field-map.sql.
-- Existing pins continue opening Google Maps at their coordinates.
begin;
alter table public.field_places add column if not exists google_maps_url text;
commit;
