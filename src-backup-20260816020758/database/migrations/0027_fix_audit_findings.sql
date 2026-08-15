-- ========================================================================
-- Migration 0027: תיעוד עמודות חסרות + איחוד שדה גילאי ילדים כפול
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- שני תיקונים מה-Audit, שניהם בטוחים (add if not exists / no data loss):
-- ========================================================================

-- חלק א' - 9 עמודות שכבר בשימוש פעיל בקוד אבל לא מתועדות בשום מיגרציה קודמת.
-- "if not exists" - אם הן כבר קיימות בפרודקשן (כנראה כן), זו פעולה ריקה.
-- אם משום מה הן לא קיימות בסביבה מסוימת, זה גם מתקן באג חי.
alter table public.places
  add column if not exists kosher boolean,
  add column if not exists accessible boolean,
  add column if not exists trip_type_tags text[] not null default '{}',
  add column if not exists cuisine_tags text[] not null default '{}',
  add column if not exists budget_tier text,
  add column if not exists suitable_child_ages text[] not null default '{}',
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists google_maps_url text;

-- חלק ב' - איחוד suitable_child_age_bands (מ-0015) ו-suitable_child_ages
-- (לא מתועד) - שני שדות כמעט זהים שנוצרו בנפרד. ממזגים לתוך
-- suitable_child_ages (השם שכבר בשימוש רחב יותר בקוד: candidatePoolService,
-- CandidatePlace type, עמוד האדמין), ולא מוחקים את העמודה הישנה - רק
-- מפסיקים להשתמש בה, כדי לא לאבד מידע אם משהו עדיין קורא ממנה.
update public.places
set suitable_child_ages = (
  select array_agg(distinct x)
  from unnest(suitable_child_ages || suitable_child_age_bands) as x
)
where suitable_child_age_bands is not null and array_length(suitable_child_age_bands, 1) > 0;

comment on column public.places.suitable_child_age_bands is
  'מיושן (deprecated) - מוזג לתוך suitable_child_ages ב-migration 0027. לא למחוק עדיין, רק להפסיק להשתמש. אפשר להסיר בעתיד אחרי שיוודא שאין עוד קוד שקורא ממנו.';
