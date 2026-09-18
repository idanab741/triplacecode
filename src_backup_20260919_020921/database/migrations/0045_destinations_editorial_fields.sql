-- ========================================================================
-- Migration 0045: השלמת עמודות "עריכה מלאה" לטבלת destinations
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- רקע: עמוד האדמין /admin/destinations (וה-API שלו, PATCH
-- /api/admin/destinations/[id]) כבר קוראים/כותבים לעמודות כמו status,
-- image_urls, kid_friendly, tags וכו' על טבלת destinations (ר'
-- src/screens/admin/destinations/types.ts) - אבל אף migration קיים לא
-- באמת יצר את העמודות האלה. בפרט: ה-API כותב ל-image_urls (מערך, רבים),
-- בעוד שה-migration היחיד שנגע בתמונה על הטבלה הזו (0024) יצר/עדכן רק
-- image_url (יחיד, טקסט בודד, מ-migration 0005) - שתי עמודות שונות
-- לגמרי. כל PATCH שמנסה לשמור image_urls נכשל היום בפועל (שגיאת
-- Postgres "column does not exist"), אלא אם מישהו כבר הוסיף את העמודות
-- האלה ידנית דרך ה-Dashboard בלי migration (schema drift).
--
-- לכן: כל עמודה כאן מתווספת עם `add column if not exists` - אם העמודה
-- כבר קיימת (למשל נוספה ידנית בעבר), ה-statement הוא no-op בטוח לגמרי;
-- אם היא לא קיימת, היא נוצרת עכשיו. אין כאן שום מחיקה/שינוי הרסני,
-- ואפשר להריץ את ה-migration הזה כמה פעמים בלי סיכון.
-- ========================================================================

alter table public.destinations
  add column if not exists name_en text,
  add column if not exists short_description text,
  add column if not exists full_description text,
  add column if not exists ai_description text,
  add column if not exists image_urls text[] not null default '{}',
  add column if not exists video_urls text[] not null default '{}',
  add column if not exists website_url text,
  add column if not exists opening_hours text[] not null default '{}',
  add column if not exists recommended_visit_times text,
  add column if not exists price_range text,
  add column if not exists recommended_seasons text[] not null default '{}',
  add column if not exists weather_notes text,
  add column if not exists visit_duration_minutes integer,
  add column if not exists internal_rating numeric(2, 1),
  add column if not exists google_rating numeric(2, 1),
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
  add column if not exists tags text[] not null default '{}',
  add column if not exists status text not null default 'draft';

-- ולידציה על ה-status (5 הערכים היחידים ש-STATUS_OPTIONS מציג באדמין) -
-- דרך trigger ולא CHECK constraint רגיל: CHECK constraint לא נתמך עם
-- `if not exists` (אין "add constraint if not exists" ב-Postgres), אז
-- constraint רגיל היה נכשל עם שגיאה בכל הרצה חוזרת של ה-migration הזה.
-- ה-trigger למטה כן אידמפוטנטי (drop+create), ונותן בדיוק אותה הגנה.
create or replace function public.check_destination_status()
returns trigger as $$
begin
  if new.status not in ('draft', 'review', 'approved', 'published', 'archived') then
    raise exception 'destinations.status לא תקין: %', new.status;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists destinations_status_check on public.destinations;
create trigger destinations_status_check
  before insert or update on public.destinations
  for each row execute function public.check_destination_status();

comment on column public.destinations.status is
  'workflow עריכה: draft (טיוטה) -> review (בבדיקה) -> approved (מאושר) -> published (פורסם). archived = הוצא משימוש. ר' STATUS_OPTIONS ב-src/screens/admin/destinations/types.ts.';
comment on column public.destinations.image_urls is
  'תמונות היעד לעריכה המלאה באדמין (מערך) - נפרד לגמרי מ-image_url (יחיד, migration 0005/0024) שמשמש את קרוסלת "יעדים חמים" בעמוד הבית. שני שדות שונים בכוונה, לא כפילות.';
