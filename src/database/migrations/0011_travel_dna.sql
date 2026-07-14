-- ========================================================================
-- Migration 0011: travel_dna table + RLS
-- "טביעת האצבע" של המשתמש: העדפות מהאשף + קטגוריות שהוא אוהב/דוחה
-- בפועל (לפי favorites). מתעדכן אוטומטית מהאפליקציה, לא ידנית.
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
-- ========================================================================

create table public.travel_dna (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,

  -- מ-user_preferences (שכבה 1 במסמך האפיון)
  culinary_styles text[] not null default '{}',
  dietary_restrictions text[] not null default '{}',
  kosher boolean not null default false,
  accessibility boolean not null default false,
  transportation text[] not null default '{}',
  interests text[] not null default '{}',
  accommodation_types text[] not null default '{}',
  vacation_preferences text[] not null default '{}',

  -- מ-favorites בפועל (פרק "למידה מתמשכת" במסמך)
  preferred_categories text[] not null default '{}',
  disliked_categories text[] not null default '{}',

  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.travel_dna enable row level security;

create policy "Users can view their own travel DNA"
  on public.travel_dna for select
  using (auth.uid() = user_id);

create policy "Users can insert their own travel DNA"
  on public.travel_dna for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own travel DNA"
  on public.travel_dna for update
  using (auth.uid() = user_id);

create trigger set_travel_dna_updated_at
  before update on public.travel_dna
  for each row execute function public.set_updated_at();
