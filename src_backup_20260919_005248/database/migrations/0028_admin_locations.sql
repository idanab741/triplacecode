-- ========================================================================
-- Migration 0028: היררכיית מיקומים (מדינה -> עיר -> אזור/שכונה)
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- תוספת בלבד - לא נוגע ב-places.city/country הקיימים (טקסט חופשי, נשארים
-- כפי שהם). places.location_id הוא קישור חדש, nullable, אופציונלי -
-- ממלאים אותו בהדרגה (ידנית/Bulk Action באדמין), לא בכפייה מיידית על כל
-- 100,000+ השורות הקיימות.
-- ========================================================================

create table public.admin_locations (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('country', 'city', 'area')),
  parent_id uuid references public.admin_locations (id) on delete cascade,
  name_he text not null,
  name_en text,
  -- רלוונטי רק ל-level='country' - קוד ISO קצר (IL, US, IT...) לשימוש
  -- עתידי (דגלים, מיון, אינטגרציות)
  country_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- מדינה חייבת parent_id ריק; עיר/אזור חייבים parent_id
alter table public.admin_locations
  add constraint admin_locations_parent_check check (
    (level = 'country' and parent_id is null) or
    (level in ('city', 'area') and parent_id is not null)
  );

alter table public.admin_locations enable row level security;

create policy "Authenticated users can view locations"
  on public.admin_locations for select
  to authenticated
  using (true);

create trigger set_admin_locations_updated_at
  before update on public.admin_locations
  for each row execute function public.set_updated_at();

create index admin_locations_parent_id_idx on public.admin_locations (parent_id);
create index admin_locations_level_idx on public.admin_locations (level);

-- קישור אופציונלי מ-places להיררכיה החדשה - לא מחליף city/country הקיימים
alter table public.places
  add column if not exists location_id uuid references public.admin_locations (id) on delete set null;

create index if not exists places_location_id_idx on public.places (location_id);
