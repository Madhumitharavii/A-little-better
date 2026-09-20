# Supabase sync — cross-device data

This app is local-first (Dexie/IndexedDB) and works fully offline
with zero Supabase setup. When configured and signed in, it also
syncs across your own devices — see "How sync actually works" below.

## What this is

- `migrations/0001_initial_schema.sql` — Postgres tables mirroring the
  local Dexie entities (`src/db/schema.ts`), Row Level Security so
  each person can only ever see their own rows, and a private Storage
  bucket (`life-images`) for artwork/experience photos.
- `migrations/0002_settings_unique_id.sql` — a small follow-up fix so
  the generic sync push works for the `settings` table specifically
  (see the comment inside the file for why).
- `src/lib/supabaseClient.ts` — a Supabase client that only
  initializes when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  are set (see `.env.example`). Without them, the app runs exactly as
  it did before this pass, and the Me page shows "Sync not
  configured" instead of pretending sync is available.
- `src/lib/sync/` — mapping functions between local entities and
  remote rows, generic push/pull/image-storage helpers, auth
  wrappers, and **`syncEngine.ts`**, the actual orchestrator that
  runs a real push-then-pull cycle and is called automatically by the
  app (see below) — this is the piece that turns the foundation into
  working sync.
- `src/features/me/AccountSection.tsx` — the minimal sign-in/sign-up/
  sign-out UI and sync status, on the Me page.

## What this is NOT (yet)

- No CRDT / operational-transform merging — see "Conflict rule" below
  for the deliberately simple strategy actually used.
- No migration of pre-existing local data away from Dexie — Dexie
  remains the only thing the UI reads from directly; sync copies data
  to and from it in the background.
- No propagation of local image *deletions* to other devices yet
  (uploads and downloads work; a deleted local image just doesn't
  carry a "please delete this too" signal to remote yet).

## Applying the migrations

Using the Supabase CLI, in order:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

`supabase db push` applies every file under `migrations/` in filename
order, so `0001_initial_schema.sql` then `0002_settings_unique_id.sql`
both run automatically. Alternatively, paste each file's contents
into your project's SQL Editor in the Supabase dashboard and run them
in that same order. Both migrations are written to be safe to re-run
(`if not exists` / `on conflict do nothing` throughout).

## Design choices worth knowing about

- **`life_items.payload` is JSONB, not one column per field.** LIFE
  (books/movies/series/artwork/experiences/wishes) has been the most
  actively-evolving part of this app's schema — episodes and rewatch
  history were both added in the last couple of passes alone. Keeping
  category-specific fields in a JSONB payload means new local fields
  never require a matching Postgres migration; the schema only needs
  to change when a genuinely new top-level concept is added. The
  shared columns (`type`, `title`, `favorite`, `notes`) are still real
  columns so you can query/filter by them directly.
- **`synced_at` is server-assigned**, via a trigger, separate from the
  client-controlled `updated_at`. A future incremental pull should
  compare against `synced_at`, not `updated_at`, so it's never affected
  by clock skew between two devices.
- **Soft deletes everywhere** (`deleted_at`), matching the local app's
  existing pattern — a deletion needs to be something the other device
  can learn about, not just a row that silently disappears.
- **`device_id`** records which device wrote a row last — informational for now (surfaced nowhere in the UI yet), reserved for a future "which device changed this" view.

## How sync actually works

`src/lib/sync/syncEngine.ts`'s `runSync()` is called automatically by
the app — on startup, whenever the app returns to the foreground,
roughly every 60 seconds while it's open, and when connectivity comes
back after being offline (see `src/app/App.tsx`). It always no-ops
instantly and safely if Supabase isn't configured, nobody's signed
in, the device is offline, or a sync is already running — so it's
always safe to call. There's also a manual "Sync now" button in
Me → Cross-device Sync as a secondary fallback.

Every table syncs **push, then pull**: local rows changed since the
last successful sync go up first, then remote rows changed since then
come down. On a device's very first sync (no prior successful sync
recorded), "push" means "push everything local" — so a device that
already has data always gets it into the account before any pull
could run, and an empty remote account can never look like a reason
to erase a device with existing data.

## Conflict rule

Last-write-wins, per row, using each record's own `updatedAt`/
`updated_at` — not a CRDT. When pulling a remote row that already
exists locally, the remote version only overwrites the local one if
`remote.updated_at` is **strictly newer** than `local.updatedAt`. A
newer local edit is never overwritten by an older remote row. A
remote soft-delete is applied the same way (only when newer), so it
can't resurrect an older local copy, but also can't silently discard
a newer local edit made after the delete was recorded elsewhere.

**Known limitation**: `care_entries` and `daily_reflections` don't
have a `deletedAt` field in the local schema at all (no local delete
path was ever built for daily reflections, and the one local delete
path for care entries — un-checking a "Not today" item — is a hard
delete). Creates and updates to those two tables sync correctly, but
a local hard-delete doesn't currently propagate as a deletion to
other devices. This is a narrow, pre-existing gap in the local
schema, not something introduced by sync.

## Image sync

Local image blobs are uploaded to the `life-images` Storage bucket
once each, tracked via a local `remoteUploadedAt` flag so re-running
sync never re-uploads the same photo. Remote images not yet present
on a device are downloaded automatically. A photo always displays
immediately from whatever's already local, regardless of where it is
in its sync — nothing waits on the network to render. Local image
*deletion* doesn't yet propagate to other devices (see "What this is
NOT" above).
