-- ============================================================================
-- TRIPLACE Admin — הרחבת טבלת destinations הקיימת
-- הרץ את זה ב-Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- כל השדות עם IF NOT EXISTS - בטוח להריץ גם אם חלק כבר קיימים.
-- ============================================================================

alter table destinations
  add column if not exists name_en text,
  add column if not exists short_description text,
  add column if not exists full_description text,
  add column if not exists ai_description text,
  add column if not exists image_urls text[] default '{}',
  add column if not exists video_urls text[] default '{}',
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists google_place_id text,
  add column if not exists website_url text,
  add column if not exists opening_hours text[] default '{}',
  add column if not exists recommended_visit_times text,
  add column if not exists price_range text,
  add column if not exists recommended_seasons text[] default '{}',
  add column if not exists weather_notes text,
  add column if not exists visit_duration_minutes integer,
  add column if not exists internal_rating numeric,
  add column if not exists google_rating numeric,
  add column if not exists accessibility_info text,
  add column if not exists parking_info text,
  add column if not exists kid_friendly boolean,
  add column if not exists stroller_friendly boolean,
  add column if not exists pet_friendly boolean,
  add column if not exists kosher boolean,
  add column if not exists reservation_required boolean,
  add column if not exists phone text,
  add column if not exists full_address text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists tags text[] default '{}',
  -- Workflow: Draft → Review → Approved → Published → Archived (מתוך המפרט)
  add column if not exists status text default 'draft'
    check (status in ('draft', 'review', 'approved', 'published', 'archived')),
  add column if not exists updated_at timestamptz default now();

-- אינדקס לחיפוש/פילטר מהיר לפי מדינה וסטטוס (המסך הזה יסנן לפי שניהם הרבה)
create index if not exists destinations_country_idx on destinations (country);
create index if not exists destinations_status_idx on destinations (status);

-- מעדכן updated_at אוטומטית בכל שינוי - אותה מתכונת שכנראה כבר יש לך בטבלאות אחרות
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists destinations_set_updated_at on destinations;
create trigger destinations_set_updated_at
  before update on destinations
  for each row execute function set_updated_at();
