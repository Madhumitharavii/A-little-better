-- A Little Better — settings table fix for generic upsert
--
-- The generic sync push helper (src/lib/sync/syncService.ts pushRow)
-- always upserts with `onConflict: 'id'`, which requires a real
-- UNIQUE constraint/index on `id` alone. Every other table's primary
-- key is `id` by itself, so this already works — but `settings`'s
-- primary key is the composite (user_id, id), so `id` alone had no
-- matching constraint and ON CONFLICT (id) would fail at the
-- database level.
--
-- By convention (see src/lib/sync/mapping.ts settingsToRemote) the
-- remote settings row's `id` is always set to the user's own id,
-- which is naturally unique per row already — this just declares
-- that to Postgres so ON CONFLICT (id) has something to match.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'settings_id_unique'
  ) then
    alter table public.settings add constraint settings_id_unique unique (id);
  end if;
end $$;
