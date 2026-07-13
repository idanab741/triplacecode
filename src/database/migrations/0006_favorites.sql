-- ========================================================================
-- Migration 0006: favorites table + RLS
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- הערה: place_id יכול להצביע על שורה בטבלת places (מקום בודד) או
-- destinations (יעד ברמת עיר) - place_type מבדיל ביניהם, לכן אין
-- כאן foreign key ישיר (אי אפשר להצביע לשתי טבלאות עם אילוץ אחד).
-- ========================================================================

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id uuid not null,
  place_type text not null check (place_type in ('place', 'destination')),
  status text not null check (status in ('liked', 'saved', 'skipped')),
  created_at timestamptz not null default now(),
  unique (user_id, place_id)
);

alter table public.favorites enable row level security;

create policy "Users can view their own favorites"
  on public.favorites for select
  using (auth.uid() = user_id);

create policy "Users can insert their own favorites"
  on public.favorites for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own favorites"
  on public.favorites for update
  using (auth.uid() = user_id);

create policy "Users can delete their own favorites"
  on public.favorites for delete
  using (auth.uid() = user_id);
