-- Run after ../supabase/delta-07-field-map.sql.
-- Tags supplement the existing Farmer / Buyer / Warehouse types.
begin;
create table if not exists public.field_tags (
  name text primary key check (char_length(name) between 1 and 64),
  created_at timestamptz not null default now()
);
create unique index if not exists field_tags_name_lower on public.field_tags (lower(name));
alter table public.field_tags enable row level security;
revoke all on public.field_tags from anon, authenticated;
grant select, insert on public.field_tags to authenticated;
drop policy if exists field_tags_read on public.field_tags;
create policy field_tags_read on public.field_tags for select to authenticated
  using (private.is_field_member());
drop policy if exists field_tags_create on public.field_tags;
create policy field_tags_create on public.field_tags for insert to authenticated
  with check (private.is_field_member());

alter table public.field_places add column if not exists tags text[] not null default '{}';

-- Runs inside the pin write: a failed pin save cannot leave half-saved tags.
-- Reuses the first spelling of a tag and avoids case-insensitive duplicates.
create or replace function public.save_field_place_tags()
returns trigger language plpgsql set search_path = public as $$
declare
  input_tag text;
  canonical_tag text;
  cleaned text[] := '{}';
begin
  foreach input_tag in array coalesce(new.tags, '{}'::text[]) loop
    input_tag := btrim(regexp_replace(input_tag, '\s+', ' ', 'g'));
    if input_tag is null or input_tag = '' then continue; end if;
    insert into public.field_tags (name) values (input_tag) on conflict do nothing;
    select name into strict canonical_tag from public.field_tags where lower(name) = lower(input_tag);
    if not (canonical_tag = any(cleaned)) then
      cleaned := array_append(cleaned, canonical_tag);
    end if;
  end loop;
  new.tags := cleaned;
  return new;
end;
$$;
revoke execute on function public.save_field_place_tags() from public;
drop trigger if exists field_places_tags on public.field_places;
create trigger field_places_tags before insert or update of tags on public.field_places
  for each row execute function public.save_field_place_tags();
commit;
