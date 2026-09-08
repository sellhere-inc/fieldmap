-- Run after ../supabase/delta-07-field-map.sql in the Supabase SQL editor.
-- General notes are shared by the field team, independent of map contacts.
begin;
create table if not exists public.field_general_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  content text not null default '',
  pinned boolean not null default false,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.field_general_notes enable row level security;
revoke all on public.field_general_notes from anon, authenticated;
grant select, insert, update, delete on public.field_general_notes to authenticated;
drop policy if exists field_general_notes_member on public.field_general_notes;
create policy field_general_notes_member on public.field_general_notes
  for all to authenticated
  using (private.is_field_member()) with check (private.is_field_member());
drop trigger if exists field_general_notes_touch on public.field_general_notes;
create trigger field_general_notes_touch before update on public.field_general_notes
  for each row execute function public.touch_field_place();
commit;
