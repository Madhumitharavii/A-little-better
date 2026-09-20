-- A Little Better — initial sync-foundation schema
--
-- This migration mirrors the local Dexie entities in src/db/schema.ts
-- so a future sync feature has somewhere to push/pull. It does NOT
-- implement sync itself — see src/lib/sync/ for the (unwired) service
-- layer this schema supports.
--
-- Every table:
--   - is owned by exactly one auth.users row (user_id), enforced by
--     Row Level Security so a person can only ever see their own data
--   - carries device_id (informational: which device wrote this row
--     last) and synced_at (server-assigned, for incremental pulls)
--   - uses soft deletes (deleted_at) to match the local app's pattern,
--     so a delete on one device can be learned about on another
--     instead of a row silently vanishing
--
-- Apply with the Supabase CLI (`supabase db push`) or paste into the
-- SQL editor in the Supabase dashboard.

-- ---------------------------------------------------------------
-- care_entries — Today's daily check-in items
-- ---------------------------------------------------------------
create table if not exists public.care_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  item_key text not null,
  status text not null,
  skip_reason text,
  value_minutes integer,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text,
  synced_at timestamptz not null default now()
);
create index if not exists care_entries_user_idx on public.care_entries (user_id);
create index if not exists care_entries_user_synced_idx on public.care_entries (user_id, synced_at);
create unique index if not exists care_entries_user_date_item_idx on public.care_entries (user_id, date, item_key);

-- ---------------------------------------------------------------
-- daily_reflections — Today's gratitude/small-win/evening notes
-- ---------------------------------------------------------------
create table if not exists public.daily_reflections (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  gratitude text,
  small_win text,
  evening_good_thing text,
  evening_leave_for_tomorrow text,
  evening_mood text,
  evening_done boolean,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text,
  synced_at timestamptz not null default now()
);
create index if not exists daily_reflections_user_idx on public.daily_reflections (user_id);
create index if not exists daily_reflections_user_synced_idx on public.daily_reflections (user_id, synced_at);
create unique index if not exists daily_reflections_user_date_idx on public.daily_reflections (user_id, date);

-- ---------------------------------------------------------------
-- journal_entries
-- ---------------------------------------------------------------
create table if not exists public.journal_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  title text,
  body text not null,
  mood text,
  tags text[],
  source_tool text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text,
  synced_at timestamptz not null default now()
);
create index if not exists journal_entries_user_idx on public.journal_entries (user_id);
create index if not exists journal_entries_user_synced_idx on public.journal_entries (user_id, synced_at);

-- ---------------------------------------------------------------
-- life_items — books, movies, series, artwork, experiences, wishes
--
-- Shared columns are pulled out for querying; everything category-
-- specific (author, year, seasons, imageIds, status, ...) lives in
-- `payload`. This mirrors the local discriminated-union type and
-- means a new LIFE field never needs its own migration — a
-- deliberate tradeoff for an actively-evolving part of the schema.
-- ---------------------------------------------------------------
create table if not exists public.life_items (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  favorite boolean,
  notes text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text,
  synced_at timestamptz not null default now()
);
create index if not exists life_items_user_idx on public.life_items (user_id);
create index if not exists life_items_user_type_idx on public.life_items (user_id, type);
create index if not exists life_items_user_synced_idx on public.life_items (user_id, synced_at);

-- ---------------------------------------------------------------
-- life_images — metadata only; bytes live in Storage (see below)
-- ---------------------------------------------------------------
create table if not exists public.life_images (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text,
  synced_at timestamptz not null default now()
);
create index if not exists life_images_user_idx on public.life_images (user_id);
create index if not exists life_images_user_synced_idx on public.life_images (user_id, synced_at);

-- ---------------------------------------------------------------
-- people — placeholder store, no UI yet locally either
-- ---------------------------------------------------------------
create table if not exists public.people (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  relationship text,
  desired_cadence_days integer,
  last_contacted_at date,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text,
  synced_at timestamptz not null default now()
);
create index if not exists people_user_idx on public.people (user_id);
create index if not exists people_user_synced_idx on public.people (user_id, synced_at);

-- ---------------------------------------------------------------
-- period_entries — cycle tracking history
-- ---------------------------------------------------------------
create table if not exists public.period_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date,
  flow text,
  notes text,
  source text not null,
  import_source_label text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text,
  synced_at timestamptz not null default now()
);
create index if not exists period_entries_user_idx on public.period_entries (user_id);
create index if not exists period_entries_user_synced_idx on public.period_entries (user_id, synced_at);

-- ---------------------------------------------------------------
-- settings — one row per user (id is always the fixed local
-- singleton key 'app-settings', scoped per-user by user_id)
-- ---------------------------------------------------------------
create table if not exists public.settings (
  id text not null default 'app-settings',
  user_id uuid not null references auth.users(id) on delete cascade,
  sound_enabled boolean not null default false,
  theme text not null default 'light',
  night_reminder_enabled boolean,
  night_reminder_time text,
  morning_reminder_enabled boolean,
  morning_reminder_time text,
  last_night_reminder_fired_date date,
  last_morning_reminder_fired_date date,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text,
  synced_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------
-- Row Level Security — every table, own-data-only
-- ---------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'care_entries', 'daily_reflections', 'journal_entries', 'life_items',
      'life_images', 'people', 'period_entries', 'settings'
    ])
  loop
    execute format('alter table public.%I enable row level security;', t);

    execute format(
      'create policy "select own %1$s" on public.%1$s for select using (auth.uid() = user_id);',
      t
    );
    execute format(
      'create policy "insert own %1$s" on public.%1$s for insert with check (auth.uid() = user_id);',
      t
    );
    execute format(
      'create policy "update own %1$s" on public.%1$s for update using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t
    );
    execute format(
      'create policy "delete own %1$s" on public.%1$s for delete using (auth.uid() = user_id);',
      t
    );
  end loop;
exception
  when duplicate_object then
    -- Policies already exist (re-running this migration) — safe to skip.
    null;
end $$;

-- Server always owns synced_at, regardless of what a client sends.
create or replace function public.set_synced_at()
returns trigger as $$
begin
  new.synced_at := now();
  return new;
end;
$$ language plpgsql;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'care_entries', 'daily_reflections', 'journal_entries', 'life_items',
      'life_images', 'people', 'period_entries', 'settings'
    ])
  loop
    execute format(
      'drop trigger if exists set_synced_at_trigger on public.%1$s;',
      t
    );
    execute format(
      'create trigger set_synced_at_trigger before insert or update on public.%1$s
       for each row execute function public.set_synced_at();',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------
-- Storage — image blobs for artwork/experience photos and covers
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('life-images', 'life-images', false)
on conflict (id) do nothing;

-- Files are stored at `${user_id}/${imageId}` — these policies read
-- the first path segment and compare it to the requester's own id,
-- so a person can only reach their own folder.
create policy "select own life-images"
  on storage.objects for select
  using (bucket_id = 'life-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "insert own life-images"
  on storage.objects for insert
  with check (bucket_id = 'life-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "update own life-images"
  on storage.objects for update
  using (bucket_id = 'life-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "delete own life-images"
  on storage.objects for delete
  using (bucket_id = 'life-images' and (storage.foldername(name))[1] = auth.uid()::text);
