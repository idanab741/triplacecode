-- ========================================================================
-- Migration 0017: איחוד סופי של תחומי עניין וסגנון חופשה, לפי ההחלטות בצ'אט
-- הרצה: Supabase Dashboard -> SQL Editor -> New query -> להדביק ולהריץ
--
-- שני שינויים בלבד, שניהם תוספת/עדכון בטוח - שום דבר קיים לא נמחק:
-- 1. הוספת applicable_contexts - מאפשר לסמן שערך מסוים לא רלוונטי להקשר
--    מסוים (למשל "סקי" לא רלוונטי ל"סופ"ש בארץ", כן רלוונטי ל"חופשה בחו"ל")
--    בלי ליצור טבלה נפרדת לכל הקשר.
-- 2. כיבוי (is_active=false, לא מחיקה) של המונח הכפול "wineries_dining"
--    ב-interest_category - נשאר רק "wineries_breweries" (זהה בתוכן, זה מה
--    שהופיע ברשימת ה-20 הסופית שאישרת).
-- ========================================================================

alter table public.taxonomy_terms
  add column if not exists applicable_contexts text[];
comment on column public.taxonomy_terms.applicable_contexts is
  'רשימת הקשרים (trip_type / "profile" / "weekend" וכו'') שהמונח רלוונטי אליהם. NULL = רלוונטי לכל ההקשרים (ברירת מחדל). דוגמה: מונח שרלוונטי רק לחו"ל יקבל {"abroad_vacation"}.';

-- wineries_dining כפול תוכנית ל-wineries_breweries (שניהם "יקבים ומבשלות")
-- - זה נכנס ל-DB רק כי היה באיחוד האוטומטי הראשוני (migration 0016); הרשימה
-- הסופית שאישרת (20 תחומי עניין, זהים ל-INTERESTS בקוד) לא כוללת אותו.
update public.taxonomy_terms
set is_active = false
where taxonomy_group = 'interest_category' and value = 'wineries_dining';

-- סימון אילו מ-16 מונחי vacation_preference לא רלוונטיים לסופ"ש בארץ
-- (כן רלוונטיים לחופשה בחו"ל ולפרופיל - שם applicable_contexts נשאר NULL).
update public.taxonomy_terms
set applicable_contexts = array['abroad_vacation', 'profile']
where taxonomy_group = 'vacation_preference'
  and value in ('casino_gambling', 'cruise', 'digital_nomad', 'ski_winter_sports', 'tropical_vacation');
