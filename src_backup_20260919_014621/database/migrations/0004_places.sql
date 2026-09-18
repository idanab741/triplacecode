-- ========================================================================
-- Migration 0004: places table (Universal Place Card) + RLS
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- כתיבה לטבלה הזו מתבצעת רק מהשרת (עם ה-service_role key), ולכן אין
-- מדיניות RLS ל-insert/update/delete - רק לקריאה.
-- ========================================================================

create table public.places (
  id uuid primary key default gen_random_uuid(),
  google_place_id text unique,
  name text not null,
  category text not null,
  short_description text,
  city text,
  country text,
  address text,
  latitude double precision,
  longitude double precision,
  rating numeric(2, 1),
  rating_count integer,
  price_level integer,
  estimated_visit_minutes integer,
  image_urls text[] not null default '{}',
  opening_hours jsonb,
  tags text[] not null default '{}',
  source text not null default 'google_places',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.places enable row level security;

-- קריאה למשתמשים מחוברים בלבד (כולל חשבונות אורח/אנונימיים בעתיד),
-- לא לגישה אנונימית גולמית ללא session
create policy "Authenticated users can view places"
  on public.places for select
  to authenticated
  using (true);

create trigger set_places_updated_at
  before update on public.places
  for each row execute function public.set_updated_at();
