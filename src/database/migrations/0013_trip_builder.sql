-- ========================================================================
-- Migration 0013: trip_builder_sessions + trip_builder_stops + RLS
-- מנוע בניית הטיול האינטראקטיבי (שלב 1: טיול יומי בלבד, אך המבנה גנרי
-- לכל 7 סוגי הטיולים העתידיים - trip_type הוא check constraint פתוח).
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- ========================================================================

create table public.trip_builder_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_type text not null check (trip_type in (
    'day_trip', 'nature_trip', 'weekend', 'romantic_date',
    'restaurants_cafes', 'nightlife', 'abroad_vacation'
  )),
  status text not null default 'questionnaire' check (status in (
    'questionnaire', 'planning', 'building', 'completed', 'abandoned'
  )),
  answers jsonb not null default '{}',
  origin_latitude double precision,
  origin_longitude double precision,
  category_plan jsonb not null default '[]',
  final_itinerary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_builder_stops (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.trip_builder_sessions (id) on delete cascade,
  category text not null,
  slot_index integer not null,
  role text not null default 'attraction' check (role in ('attraction', 'food', 'coffee_dessert', 'viewpoint')),
  status text not null default 'pending' check (status in ('pending', 'liked', 'rejected', 'skipped')),
  place_id uuid references public.places (id),
  score integer check (score >= 0 and score <= 100),
  reason text,
  rejected_place_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, slot_index)
);

alter table public.trip_builder_sessions enable row level security;
alter table public.trip_builder_stops enable row level security;

create policy "Users can view their own trip builder sessions"
  on public.trip_builder_sessions for select using (auth.uid() = user_id);

create policy "Users can insert their own trip builder sessions"
  on public.trip_builder_sessions for insert with check (auth.uid() = user_id);

create policy "Users can update their own trip builder sessions"
  on public.trip_builder_sessions for update using (auth.uid() = user_id);

create policy "Users can view their own trip builder stops"
  on public.trip_builder_stops for select
  using (exists (
    select 1 from public.trip_builder_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ));

create policy "Users can insert their own trip builder stops"
  on public.trip_builder_stops for insert
  with check (exists (
    select 1 from public.trip_builder_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ));

create policy "Users can update their own trip builder stops"
  on public.trip_builder_stops for update
  using (exists (
    select 1 from public.trip_builder_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  ));

create trigger set_trip_builder_sessions_updated_at
  before update on public.trip_builder_sessions
  for each row execute function public.set_updated_at();

create trigger set_trip_builder_stops_updated_at
  before update on public.trip_builder_stops
  for each row execute function public.set_updated_at();
