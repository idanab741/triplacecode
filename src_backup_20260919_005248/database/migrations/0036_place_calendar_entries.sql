-- ========================================================================
-- Migration 0036: place_calendar_entries + RLS
--
-- הוספה ליומן ישירות מעמוד תוצאת חיפוש (מקום בודד, לא מסלול מלא).
-- ה-placeId שם הוא Google Place ID (לא שורה בטבלת places שלנו) - לכן
-- שומרים כאן שדות תצוגה מפורשים (שם, תמונה) במקום לבצע join.
-- זו טבלה נפרדת מ-trip_builder_sessions.calendar_date, כי מדובר
-- בישות שונה לגמרי (מקום בודד, לא טיול/מסלול מרובה תחנות).
-- ========================================================================

create table public.place_calendar_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id text not null,
  place_name text not null,
  image_url text null,
  calendar_date date not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_place_calendar_entries_user_date
  on public.place_calendar_entries (user_id, calendar_date);

alter table public.place_calendar_entries enable row level security;

create policy "Users can view their own place calendar entries"
  on public.place_calendar_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert their own place calendar entries"
  on public.place_calendar_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own place calendar entries"
  on public.place_calendar_entries for delete
  using (auth.uid() = user_id);
