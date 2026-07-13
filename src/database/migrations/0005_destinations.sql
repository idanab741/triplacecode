-- ========================================================================
-- Migration 0005: destinations table (יעדי טיול ברמת עיר, לא מקומות בודדים)
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- ========================================================================

create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  google_place_id text unique,
  name text not null,
  country text not null,
  image_url text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.destinations enable row level security;

create policy "Authenticated users can view destinations"
  on public.destinations for select
  to authenticated
  using (true);

create trigger set_destinations_updated_at
  before update on public.destinations
  for each row execute function public.set_updated_at();
