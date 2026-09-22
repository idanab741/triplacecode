-- ========================================================================
-- Migration 0052: admin_events - מודל Events אמיתי ונפרד מ-places, לפי
-- בקשה מפורשת (Discovery / "יעדים חמים" - סקשן "אירועים ופסטיבלים").
--
-- למה טבלה נפרדת ולא עוד שורת places: אירוע הוא זמני (יש לו טווח
-- תאריכים אמיתי - startDate/endDate), בעוד ש-places הוא מאגר של מקומות
-- קבועים (עם/בלי opening_hours שבועיים חוזרים). לנסות "לדחוס" אירוע
-- לתוך שורת place היה דורש להמציא סמנטיקה חדשה לגמרי לשדות שכבר
-- קיימים (opening_hours וכו') - בדיוק מה שהמפרט אוסר ("אל תשבור Place
-- schema קיים").
--
-- מוזן ומנוהל דרך ADMIN בלבד (לא API חיצוני, לא AI) - ר' דרישה מפורשת
-- "אנחנו ננהל ונזין את האירועים בעצמנו".
--
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ.
-- ========================================================================

create table public.admin_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  -- טקסט חופשי לתצוגה ("פארק הירקון, תל אביב") - לא join למקום קיים,
  -- כי אירוע לא תמיד קשור למקום ספציפי שכבר קיים ב-places.
  location_label text,
  city text,
  latitude double precision,
  longitude double precision,
  start_date date not null,
  end_date date not null,
  start_time text,
  end_time text,
  -- אחת מקטגוריות tripTaxonomy.ts הקיימות (בעיקר "events_festivals",
  -- אבל לא נאכף ב-DB - שדה טקסט חופשי, כמו category ב-places).
  category text,
  link_url text,
  status text not null default 'active' check (status in ('active', 'draft', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_events_dates on public.admin_events (start_date, end_date);
create index if not exists idx_admin_events_city on public.admin_events (city);

alter table public.admin_events enable row level security;

-- קריאה למשתמשים מחוברים בלבד (כולל אורחים אנונימיים) - כמו places.
create policy "Authenticated users can view active events"
  on public.admin_events for select
  to authenticated
  using (status = 'active');

create trigger set_admin_events_updated_at
  before update on public.admin_events
  for each row execute function public.set_updated_at();
