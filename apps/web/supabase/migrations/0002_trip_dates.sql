-- 0002_trip_dates.sql — trip lifecycle columns on location_signals.
-- Idempotent; safe to re-run. Apply in the Supabase SQL Editor.
--
-- starts_on/ends_on: optional user-declared trip dates. ends_on improves
-- event-window relevance ONLY — it never expires a trip (lifecycle is
-- geographic). closed_at marks a trip ended by return-to-residence or
-- superseded by a newer confirmed signal.

alter table public.location_signals
  add column if not exists starts_on date,
  add column if not exists ends_on date,
  add column if not exists closed_at timestamptz;

create index if not exists location_signals_open_trips_idx
  on public.location_signals (profile_id, kind, confirmed)
  where closed_at is null;

-- One open confirmed signal per (profile, kind, city): makes concurrent
-- duplicate reports collapse into one row instead of double-inserting.
create unique index if not exists location_signals_open_dedupe_idx
  on public.location_signals (profile_id, kind, lower(city))
  where confirmed and closed_at is null;

comment on column public.location_signals.closed_at is
  'Set when a trip ends: manual "I''m back home", a consented signal at the residence city, or superseded by a newer confirmed signal/relocation.';
