-- Migration 0034: תאריך יומן לטיולים (calendar_date) על trip_builder_sessions
alter table public.trip_builder_sessions
  add column calendar_date date null;

create index if not exists idx_trip_builder_sessions_calendar_date
  on public.trip_builder_sessions (user_id, calendar_date)
  where calendar_date is not null;